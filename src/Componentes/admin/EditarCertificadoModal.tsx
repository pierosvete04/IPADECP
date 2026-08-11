'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import { cargarCalendarioHabil, type CalendarioHabil } from '@/lib/diasHabiles';
import type { Periodo } from '@/lib/periodos';
import type { CargoProfesional } from '@/lib/cargos';
import Modal from '@/Componentes/ui/Modal';
import Aviso from '@/Componentes/ui/Aviso';
import SelectorCargo from './SelectorCargo';
import SelectorPeriodoFecha from './SelectorPeriodoFecha';

/** Una corrección ya hecha, tal como la guarda `admin_editar_certificado`. */
export interface EdicionCertificado {
  cuando: string;
  quien: string | null;
  motivo: string | null;
  cambios: Record<string, { antes: unknown; despues: unknown }>;
}

export interface CertificadoEditable {
  id: number;
  modalidad: string;
  /** timestamptz. Se muestra y se envía como día de calendario en hora de Perú. */
  fecha: string;
  nombre_completo?: string | null;
  dni?: string | null;
  cargo?: string | null;
  periodo_id?: number | null;
  registro?: string | null;
  libro?: string | null;
  creditos?: string | null;
  meses?: string | null;
  horas_lectivas?: string | null;
  historial_ediciones?: EdicionCertificado[] | null;
}

const ETIQUETA_CAMPO: Record<string, string> = {
  fecha: 'Fecha',
  nombre_completo: 'Nombre',
  dni: 'DNI',
  cargo: 'Cargo',
  periodo_id: 'Período',
  creditos: 'Créditos',
  meses: 'Meses',
  horas_lectivas: 'Horas lectivas',
};

/**
 * El día del certificado en hora de Perú, como yyyy-mm-dd para un <input type="date">.
 *
 * `certificados.fecha` es timestamptz y representa un día de calendario. Formatearlo
 * con la zona del navegador haría que el admin viera un día distinto al impreso —
 * el PDF y la página pública fijan America/Lima (ver lib/fechas.ts), así que aquí
 * también.
 */
function diaPeruParaInput(iso: string): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Lima',
  }).format(new Date(iso));
  return partes; // en-CA da directamente yyyy-mm-dd
}

function textoValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '(vacío)';
  return String(valor);
}

/**
 * Corrige los datos de un certificado YA emitido: fecha, nombre, DNI, cargo,
 * período y los datos académicos.
 *
 * Registro N° y Libro N° se muestran pero NO se editan: los asigna el contador al
 * emitir y el tomo se deriva del registro (ver migración 007). Dejarlos a mano era
 * lo que permitía que dos certificados terminaran con el mismo asiento.
 *
 * Todo pasa por el RPC `admin_editar_certificado`, que repite las validaciones de
 * la emisión (período válido, fecha dentro del período, día hábil) y guarda quién
 * cambió qué en `historial_ediciones`. No hace falta regenerar el PDF: se arma en
 * cada descarga, así que el QR y la web reflejan la corrección al instante.
 */
export default function EditarCertificadoModal({
  fila,
  periodos,
  cargos,
  onClose,
  onGuardado,
}: {
  fila: CertificadoEditable | null;
  periodos: Periodo[];
  cargos: CargoProfesional[];
  onClose: () => void;
  onGuardado: (fila: CertificadoEditable) => void;
}) {
  const [fecha, setFecha] = useState('');
  const [periodoId, setPeriodoId] = useState('');
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [cargo, setCargo] = useState('');
  const [creditos, setCreditos] = useState('');
  const [meses, setMeses] = useState('');
  const [horas, setHoras] = useState('');
  const [motivo, setMotivo] = useState('');
  const [calendario, setCalendario] = useState<CalendarioHabil | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const esDirecto = fila?.modalidad === 'directo';

  useEffect(() => {
    let vivo = true;
    cargarCalendarioHabil().then((c) => vivo && setCalendario(c));
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (!fila) return;
    setAviso(null);
    setMotivo('');
    setFecha(diaPeruParaInput(fila.fecha));
    setPeriodoId(fila.periodo_id ? String(fila.periodo_id) : '');
    setNombre(fila.nombre_completo || '');
    setDni(fila.dni || '');
    setCargo(fila.cargo || '');
    setCreditos(fila.creditos || '');
    setMeses(fila.meses || '');
    setHoras(fila.horas_lectivas || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fila?.id]);

  async function guardar() {
    if (!fila) return;
    setGuardando(true);
    setAviso(null);

    // null = "no cambiar". El nombre, el DNI y el cargo no se vacían desde acá:
    // un certificado sin nombre no es un documento, es un error. Los datos
    // académicos sí admiten quedar en blanco, así que se mandan tal cual.
    const oNull = (v: string) => (v.trim() ? v.trim() : null);

    const { data, error } = await supabase.rpc('admin_editar_certificado', {
      p_certificado_id: fila.id,
      p_fecha: fecha || null,
      p_nombre_completo: oNull(nombre),
      p_dni: oNull(dni),
      p_cargo: oNull(cargo),
      p_periodo_id: esDirecto && periodoId ? parseInt(periodoId, 10) : null,
      p_motivo: oNull(motivo),
      p_creditos: creditos,
      p_meses: meses,
      p_horas_lectivas: horas,
    });

    setGuardando(false);
    if (error) {
      // El RPC habla en castellano y con contexto ("La fecha debe estar dentro
      // del rango del período (X a Y)"), así que su mensaje vale más que el genérico.
      setAviso(error.message || mensajeError(error));
      return;
    }

    onGuardado(data as CertificadoEditable);
    onClose();
  }

  const historial = fila?.historial_ediciones || [];

  return (
    <Modal open={!!fila} title="Editar certificado" onClose={onClose}>
      {/* El número no se toca: lo pone el contador al emitir y el tomo sale del
          registro. Se muestra porque es el dato con el que se ubica el asiento
          en el libro físico. */}
      {(fila?.registro || fila?.libro) && (
        <p className="sub" style={{ marginTop: 0 }}>
          Registro N° <strong>{fila?.registro || '—'}</strong> · Libro N° <strong>{fila?.libro || '—'}</strong>
          <br />
          <span className="campo-ayuda">Los asigna el sistema al emitir y no se editan.</span>
        </p>
      )}
      {!fila?.registro && !fila?.libro && (
        <p className="sub" style={{ marginTop: 0 }}>
          Certificado de certificación web: se identifica por su código de verificación y su QR, sin número de registro.
        </p>
      )}

      {esDirecto ? (
        <SelectorPeriodoFecha
          periodos={periodos}
          periodoId={periodoId}
          fecha={fecha}
          calendario={calendario}
          onChange={(cambios) => {
            // A diferencia de la emisión, cambiar el período NO reajusta la fecha:
            // acá se está corrigiendo un dato concreto, no eligiendo uno nuevo, y
            // pisarle la fecha al admin sería justo el error que vino a arreglar.
            if (cambios.periodoId !== undefined) setPeriodoId(cambios.periodoId);
            if (cambios.fecha !== undefined) setFecha(cambios.fecha);
          }}
        />
      ) : (
        <div style={{ marginBottom: '.6rem' }}>
          <label htmlFor="edit-fecha">Fecha del certificado</label>
          <input id="edit-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <p className="campo-ayuda" style={{ margin: '.25rem 0 0' }}>
            Es la fecha en que el alumno terminó el curso. No necesita ser día hábil ni pertenecer a un período.
          </p>
        </div>
      )}

      <div className="perfil-grid" style={{ marginTop: '.6rem' }}>
        <div>
          <label htmlFor="edit-nombre">Nombre completo</label>
          <input
            id="edit-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={esDirecto ? 'Como va impreso' : 'Si se deja vacío, usa el nombre del perfil'}
          />
        </div>
        <div>
          <label htmlFor="edit-dni">DNI</label>
          <input id="edit-dni" inputMode="numeric" value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))} />
        </div>
      </div>

      <div style={{ marginTop: '.6rem' }}>
        <SelectorCargo cargos={cargos} inicial={fila?.cargo || ''} onChange={setCargo} />
      </div>

      <hr />
      <p className="campo-ayuda" style={{ margin: '0 0 .4rem' }}>
        Datos académicos. Solo se imprimen si el diseño del certificado incluye esos campos.
      </p>
      <div className="perfil-grid">
        <div>
          <label htmlFor="edit-creditos">Créditos académicos</label>
          <input id="edit-creditos" value={creditos} onChange={(e) => setCreditos(e.target.value)} placeholder="Ej. 30" />
        </div>
        <div>
          <label htmlFor="edit-meses">Meses de estudio</label>
          <input id="edit-meses" value={meses} onChange={(e) => setMeses(e.target.value)} placeholder="Ej. 06" />
        </div>
      </div>
      <label htmlFor="edit-horas" style={{ marginTop: '.6rem' }}>
        Horas lectivas
      </label>
      <input id="edit-horas" value={horas} onChange={(e) => setHoras(e.target.value)} placeholder="Ej. 480" />

      <hr />
      <label htmlFor="edit-motivo">Motivo del cambio</label>
      <input
        id="edit-motivo"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Ej. fecha mal ingresada al emitir"
      />
      <p className="campo-ayuda" style={{ margin: '.25rem 0 0' }}>
        Queda guardado junto al cambio. El certificado ya entregado pasa a mostrar los datos nuevos.
      </p>

      {historial.length > 0 && (
        <>
          <hr />
          <p className="campo-ayuda" style={{ margin: '0 0 .4rem' }}>
            Correcciones anteriores
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '.82rem' }}>
            {historial.map((e, i) => (
              <li key={i} style={{ marginBottom: '.3rem' }}>
                {new Date(e.cuando).toLocaleString('es-PE')}
                {e.motivo ? ` — ${e.motivo}` : ''}
                <br />
                {Object.entries(e.cambios || {}).map(([campo, v]) => (
                  <span key={campo} className="campo-ayuda">
                    {ETIQUETA_CAMPO[campo] || campo}: {textoValor(v.antes)} → {textoValor(v.despues)}{' '}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </>
      )}

      <Aviso mensaje={aviso} />
      <button className="btn bloque" onClick={guardar} disabled={guardando} type="button">
        {guardando ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </Modal>
  );
}
