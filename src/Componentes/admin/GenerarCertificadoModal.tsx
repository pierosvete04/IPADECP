'use client';

import { useEffect, useState } from 'react';
import { obtenerCargosProfesionales, type CargoProfesional } from '@/lib/cargos';
import { previaCertificadoServidor, respaldarCertificadoEnDrive } from '@/lib/certificado';
import { emitirCertificadoParaCurso } from '@/lib/certificadosDirectos';
import { cargarCalendarioHabil, type CalendarioHabil } from '@/lib/diasHabiles';
import { obtenerPeriodosCertificacion, periodoPorId, type Periodo } from '@/lib/periodos';
import Modal from '@/Componentes/ui/Modal';
import VistaPreviaCertificadoModal, { type VistaPreviaCertificado } from './VistaPreviaCertificadoModal';
import Aviso from '@/Componentes/ui/Aviso';
import SelectorCargo from './SelectorCargo';
import SelectorPeriodoFecha, { fechaSugerida } from './SelectorPeriodoFecha';

/**
 * Trigger manual del certificado: para un alumno que ya tiene el curso (comprado o asignado)
 * pero no va a rendir tareas/exámenes, y pide su certificado directamente. Reutiliza el mismo
 * RPC del Flujo 1 (admin_emitir_certificado_directo) sin pasar por el resto del formulario de
 * "Certificados directos" (no crea pedido/venta — el alumno ya está matriculado).
 */
export default function GenerarCertificadoModal({
  alumnoUid,
  alumnoDni,
  alumnoNombre,
  cursoId,
  cursoNombre,
  onClose,
  onEmitido,
}: {
  alumnoUid: string;
  alumnoDni: string | null;
  alumnoNombre: string | null;
  cursoId: number;
  cursoNombre: string;
  onClose: () => void;
  onEmitido: () => void;
}) {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [cargos, setCargos] = useState<CargoProfesional[]>([]);

  const [dni, setDni] = useState(alumnoDni || '');
  const [nombreCompleto, setNombreCompleto] = useState(alumnoNombre || '');
  const [cargoFinal, setCargoFinal] = useState('');
  const [periodoId, setPeriodoId] = useState('');
  const [fecha, setFecha] = useState('');
  const [emitiendo, setEmitiendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [previa, setPrevia] = useState<VistaPreviaCertificado | null>(null);
  const [calendario, setCalendario] = useState<CalendarioHabil | null>(null);

  useEffect(() => {
    obtenerPeriodosCertificacion().then(setPeriodos);
    obtenerCargosProfesionales().then(setCargos);
    cargarCalendarioHabil().then(setCalendario);
  }, []);

  function cambiarPeriodoFecha(cambios: { periodoId?: string; fecha?: string }) {
    if (cambios.periodoId !== undefined) {
      setPeriodoId(cambios.periodoId);
      setFecha(fechaSugerida(periodoPorId(periodos, cambios.periodoId), calendario));
    }
    if (cambios.fecha !== undefined) setFecha(cambios.fecha);
  }

  async function emitir(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    if (!/^\d{8}$/.test(dni)) return setAviso('Ingresa un DNI válido de 8 dígitos.');
    if (!nombreCompleto.trim()) return setAviso('Falta el nombre completo.');
    if (!cargoFinal.trim()) return setAviso('Elige o escribe el cargo profesional.');
    if (!periodoId || !fecha) return setAviso('Elige el período y la fecha del certificado.');
    // La BD exige día hábil: sin esto, el error llegaba como excepción del RPC
    // después de darle a "Emitir".
    const motivo = calendario?.motivoNoHabil(fecha);
    if (motivo) return setAviso(`La fecha del certificado no es un día hábil. ${motivo}`);

    setEmitiendo(true);
    try {
      const res = await emitirCertificadoParaCurso({
        alumnoUid,
        cursoId,
        periodoId: parseInt(periodoId, 10),
        fecha,
        dni,
        nombreCompleto: nombreCompleto.trim(),
        cargo: cargoFinal.trim(),
      });
      if (!res.ok || !res.row) {
        setAviso(res.motivo || 'No se pudo emitir el certificado.');
        return;
      }

      // Respaldo en Drive: se dispara y no se espera. La previa es el PDF real que sirve
      // la app, con el Registro N° que acaba de asignar la BD al emitir.
      respaldarCertificadoEnDrive('digital', res.row.id, res.row.drive_digital_url);
      respaldarCertificadoEnDrive('imprimir', res.row.id, res.row.drive_imprimir_url);

      setPrevia(await previaCertificadoServidor(res.row.codigo_verificacion, 'digital'));
    } finally {
      setEmitiendo(false);
    }
  }

  if (previa) {
    return (
      <VistaPreviaCertificadoModal
        previa={previa}
        onClose={() => {
          setPrevia(null);
          onEmitido();
        }}
      />
    );
  }

  return (
    <Modal open title={`Generar certificado — ${cursoNombre}`} onClose={onClose}>
      <p className="sub" style={{ marginTop: 0 }}>
        Emite el certificado de este curso para el alumno sin exigir que rinda tareas o exámenes — para cuando el cliente
        lo pide directamente.
      </p>
      <Aviso mensaje={aviso} />

      <form onSubmit={emitir}>
        <label htmlFor="gc-dni">DNI del cliente</label>
        <input
          id="gc-dni"
          inputMode="numeric"
          value={dni}
          onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
          placeholder="8 dígitos"
          style={{ maxWidth: 160 }}
        />

        <label htmlFor="gc-nombre" style={{ marginTop: '.6rem' }}>
          Nombre completo
        </label>
        <input id="gc-nombre" value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} />

        <div style={{ marginTop: '.6rem' }}>
          <SelectorCargo cargos={cargos} onChange={setCargoFinal} />
        </div>

        <div style={{ marginTop: '.6rem' }}>
          <SelectorPeriodoFecha
            periodos={periodos}
            periodoId={periodoId}
            fecha={fecha}
            calendario={calendario}
            onChange={cambiarPeriodoFecha}
          />
        </div>

        <button className="btn bloque" type="submit" disabled={emitiendo}>
          {emitiendo ? 'Emitiendo…' : 'Emitir certificado'}
        </button>
      </form>
    </Modal>
  );
}
