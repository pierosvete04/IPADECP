'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { obtenerCargosProfesionales, type CargoProfesional } from '@/lib/cargos';
import { abrirVistaPreviaCertificado, asegurarCertificadoEnDrive, type CertificadoRenderData } from '@/lib/certificado';
import { emitirCertificadoParaCurso } from '@/lib/certificadosDirectos';
import Modal from '@/Componentes/ui/Modal';
import VistaPreviaCertificadoModal, { type VistaPreviaCertificado } from './VistaPreviaCertificadoModal';

interface Periodo {
  id: number;
  nombre: string;
  fecha_inicio: string;
  fecha_entrega: string;
  fecha_cierre: string;
}

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
  const [cargoSel, setCargoSel] = useState('');
  const [cargoOtro, setCargoOtro] = useState('');
  const [periodoId, setPeriodoId] = useState('');
  const [fecha, setFecha] = useState('');
  const [emitiendo, setEmitiendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [previa, setPrevia] = useState<VistaPreviaCertificado | null>(null);

  useEffect(() => {
    supabase
      .from('periodos_certificacion')
      .select('*')
      .order('fecha_inicio', { ascending: false })
      .then(({ data }) => setPeriodos((data as Periodo[]) || []));
    obtenerCargosProfesionales().then(setCargos);
  }, []);

  const cargoFinal = cargoSel === 'Otro' ? cargoOtro.trim() : cargoSel;
  const periodo = periodos.find((p) => String(p.id) === periodoId);

  async function emitir(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    if (!/^\d{8}$/.test(dni)) return setAviso('Ingresa un DNI válido de 8 dígitos.');
    if (!nombreCompleto.trim()) return setAviso('Falta el nombre completo.');
    if (!cargoFinal) return setAviso('Elige o escribe el cargo profesional.');
    if (!periodoId || !fecha) return setAviso('Elige el período y la fecha del certificado.');

    setEmitiendo(true);
    try {
      const res = await emitirCertificadoParaCurso({
        alumnoUid,
        cursoId,
        periodoId: parseInt(periodoId, 10),
        fecha,
        dni,
        nombreCompleto: nombreCompleto.trim(),
        cargo: cargoFinal,
      });
      if (!res.ok || !res.row) {
        setAviso(res.motivo || 'No se pudo emitir el certificado.');
        return;
      }

      const data: CertificadoRenderData = {
        codigo: res.row.codigo_verificacion,
        alumnoNombre: nombreCompleto.trim(),
        cursoNombre,
        fecha: new Date(res.row.fecha).toLocaleDateString('es-PE'),
        cargo: cargoFinal,
        cursoId,
        modalidad: 'directo',
        periodoInicio: periodo ? new Date(periodo.fecha_inicio + 'T00:00:00').toLocaleDateString('es-PE') : undefined,
        periodoEntrega: periodo ? new Date(periodo.fecha_entrega + 'T00:00:00').toLocaleDateString('es-PE') : undefined,
        periodoCierre: periodo ? new Date(periodo.fecha_cierre + 'T00:00:00').toLocaleDateString('es-PE') : undefined,
      };

      try {
        await Promise.all([
          asegurarCertificadoEnDrive(data, 'digital', res.row.id, res.row.drive_digital_url),
          asegurarCertificadoEnDrive(data, 'imprimir', res.row.id, res.row.drive_imprimir_url),
        ]);
      } catch (e) {
        console.error('No se pudo subir el certificado a Drive:', e);
      }

      setPrevia(await abrirVistaPreviaCertificado(data, 'digital'));
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
      {aviso && <div className="aviso err">{aviso}</div>}

      <form onSubmit={emitir}>
        <label>DNI del cliente</label>
        <input value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="8 dígitos" style={{ maxWidth: 160 }} />

        <label style={{ marginTop: '.6rem' }}>Nombre completo</label>
        <input value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} />

        <label style={{ marginTop: '.6rem' }}>Cargo profesional</label>
        <select value={cargoSel} onChange={(e) => setCargoSel(e.target.value)}>
          <option value="">— Elige un cargo —</option>
          {cargos.map((c) => (
            <option value={c.nombre} key={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        {cargoSel === 'Otro' && (
          <input style={{ marginTop: '.4rem' }} placeholder="Especifica el cargo" value={cargoOtro} onChange={(e) => setCargoOtro(e.target.value)} />
        )}

        <div className="perfil-grid" style={{ marginTop: '.6rem' }}>
          <div>
            <label>Período de certificación</label>
            <select value={periodoId} onChange={(e) => setPeriodoId(e.target.value)}>
              <option value="">— Elige un período —</option>
              {periodos.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Fecha del certificado</label>
            <input
              type="date"
              disabled={!periodo}
              min={periodo?.fecha_inicio}
              max={periodo?.fecha_cierre}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
        </div>
        {periodo && (
          <p className="sub" style={{ margin: '.3rem 0 0', fontSize: '.75rem' }}>
            Debe ser un día hábil entre {new Date(periodo.fecha_inicio + 'T00:00:00').toLocaleDateString('es-PE')} y{' '}
            {new Date(periodo.fecha_cierre + 'T00:00:00').toLocaleDateString('es-PE')}.
          </p>
        )}

        <button className="btn bloque" type="submit" disabled={emitiendo}>
          {emitiendo ? 'Emitiendo…' : 'Emitir certificado'}
        </button>
      </form>
    </Modal>
  );
}
