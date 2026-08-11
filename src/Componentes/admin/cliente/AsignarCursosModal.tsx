'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatSoles, mensajeError } from '@/lib/copy';
import { cargarCalendarioHabil, type CalendarioHabil } from '@/lib/diasHabiles';
import { obtenerPeriodosCertificacion, periodoPorId, type Periodo } from '@/lib/periodos';
import { emitirCertificadosConPedido, type ItemEmisionDirecta } from '@/lib/certificadosDirectos';
import { respaldarCertificadoEnDrive } from '@/lib/certificado';
import type { EstadoPago, MetodoPago } from '@/lib/pedidos';
import type { CargoProfesional } from '@/lib/cargos';
import type { CursoAdmin } from '../useCursosAdmin';
import Modal from '@/Componentes/ui/Modal';
import Aviso from '@/Componentes/ui/Aviso';
import SelectorCargo from '../SelectorCargo';
import SelectorPeriodoFecha, { fechaSugerida } from '../SelectorPeriodoFecha';

/** Cómo se va a certificar este curso. */
type TipoCertificacion = 'web' | 'directa';

interface Eleccion {
  tipo: TipoCertificacion;
  periodoId: string;
  fecha: string;
  precio: string;
}

function eleccionInicial(curso: CursoAdmin): Eleccion {
  return { tipo: 'web', periodoId: '', fecha: '', precio: curso.precio_ahora || '' };
}

/**
 * Asignar cursos a un cliente, eligiendo por curso cómo se certifica.
 *
 * Los dos caminos del negocio conviven en la misma persona y hasta ahora vivían
 * en pantallas distintas:
 *
 *  - **Web**: se le da acceso al curso y él rinde tareas y exámenes en el aula.
 *    El certificado sale solo cuando completa el 100 %.
 *  - **Directa**: compró el certificado sin rendir nada. Se emite en el acto con
 *    su período y su fecha, y queda registrado el pedido.
 *
 * Antes, para lo segundo había que salir a "Certificados directos", buscar otra
 * vez al mismo cliente y volver a teclear su DNI y su cargo. Acá los datos de la
 * persona ya están, así que solo falta decir qué curso y con qué fecha.
 *
 * La emisión directa va por `admin_emitir_certificados_con_pedido`, que valida
 * todos los cursos ANTES de escribir el primero y hace certificado + pedido +
 * ventas en una sola transacción: si el tercero trae una fecha en domingo, no
 * queda ninguno emitido ni un pedido a medias.
 */
export default function AsignarCursosModal({
  abierto,
  clienteId,
  cliente,
  cursos,
  cargos,
  yaInscritos,
  yaCertificados,
  onCerrar,
  onAsignado,
}: {
  abierto: boolean;
  clienteId: string;
  cliente: { nombre: string | null; documento: string | null; cargo: string | null; email: string | null; telefono: string | null };
  cursos: CursoAdmin[];
  cargos: CargoProfesional[];
  yaInscritos: number[];
  /** Cursos que ya tienen certificado: no se pueden volver a certificar (UNIQUE curso+alumno). */
  yaCertificados: number[];
  onCerrar: () => void;
  onAsignado: (texto: string) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [elegidos, setElegidos] = useState<Map<number, Eleccion>>(new Map());
  const [fechaInscripcion, setFechaInscripcion] = useState('');
  const [cargo, setCargo] = useState(cliente.cargo || '');
  const [metodo, setMetodo] = useState<MetodoPago>('pendiente');
  const [estadoPago, setEstadoPago] = useState<EstadoPago>('pagado');
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [calendario, setCalendario] = useState<CalendarioHabil | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    obtenerPeriodosCertificacion().then(setPeriodos);
    cargarCalendarioHabil().then(setCalendario);
  }, [abierto]);

  const inscritos = useMemo(() => new Set(yaInscritos), [yaInscritos]);
  const certificados = useMemo(() => new Set(yaCertificados), [yaCertificados]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return cursos.filter((c) => !q || (c.nombre || '').toLowerCase().includes(q));
  }, [cursos, busqueda]);

  const seleccion = [...elegidos.entries()];
  const directos = seleccion.filter(([, e]) => e.tipo === 'directa');
  const web = seleccion.filter(([, e]) => e.tipo === 'web');
  const totalDirecto = directos.reduce((acc, [, e]) => acc + (Number(e.precio) || 0), 0);

  const nombreCurso = (id: number) => cursos.find((c) => c.id === id)?.nombre || `Curso #${id}`;

  function alternar(curso: CursoAdmin) {
    setElegidos((prev) => {
      const next = new Map(prev);
      if (next.has(curso.id)) next.delete(curso.id);
      else next.set(curso.id, eleccionInicial(curso));
      return next;
    });
  }

  function cambiar(cursoId: number, cambios: Partial<Eleccion>) {
    setElegidos((prev) => {
      const next = new Map(prev);
      const actual = next.get(cursoId);
      if (!actual) return prev;
      const siguiente = { ...actual, ...cambios };
      // Elegir período propone su fecha de entrega, ajustada al día hábil más
      // cercano: la fecha de entrega puede caer en sábado y el RPC la rechaza.
      if (cambios.periodoId !== undefined) {
        siguiente.fecha = fechaSugerida(periodoPorId(periodos, cambios.periodoId), calendario);
      }
      next.set(cursoId, siguiente);
      return next;
    });
  }

  /** Primer problema, o null si se puede guardar. */
  function primerProblema(): string | null {
    if (!elegidos.size) return 'Marca al menos un curso.';
    if (!directos.length) return null;

    // A partir de acá, todo lo que exige la certificación directa.
    if (!cliente.nombre?.trim()) return 'Este cliente no tiene nombre registrado. Complétalo antes de emitir certificados.';
    if (!/^\d{8}$/.test((cliente.documento || '').trim()))
      return 'Para certificación directa el cliente necesita un DNI de 8 dígitos. Complétalo en sus datos.';
    if (!cargo.trim()) return 'Elige el cargo profesional con el que salen los certificados.';

    for (const [id, e] of directos) {
      if (!e.periodoId || !e.fecha) return `Elige el período y la fecha de "${nombreCurso(id)}".`;
      const motivo = calendario?.motivoNoHabil(e.fecha);
      if (motivo) return `La fecha de "${nombreCurso(id)}" no sirve. ${motivo}`;
      if (!(Number(e.precio) >= 0)) return `Ingresa el monto de "${nombreCurso(id)}" (puede ser 0 si es cortesía).`;
    }
    return null;
  }

  async function guardar() {
    const problema = primerProblema();
    if (problema) {
      setError(problema);
      return;
    }
    setGuardando(true);
    setError(null);

    try {
      // 1. Los de certificación web son solo una inscripción: el alumno rinde en
      //    el aula y el certificado sale solo cuando complete todo.
      if (web.length) {
        const filas = web.map(([curso_id]) => ({
          alumno_id: clienteId,
          curso_id,
          origen: 'admin',
          ...(fechaInscripcion ? { inscrito_en: new Date(fechaInscripcion + 'T12:00:00').toISOString() } : {}),
        }));
        const { error: eInsc } = await supabase.from('inscripciones').insert(filas);
        if (eInsc) throw new Error(mensajeError(eInsc, 'No se pudieron asignar los cursos de certificación web.'));
      }

      // 2. Los directos: certificado + pedido + ventas, atómico. El RPC crea la
      //    inscripción también, así que no hay que insertarla aparte.
      let pedidoId: number | undefined;
      if (directos.length) {
        const items: ItemEmisionDirecta[] = directos.map(([cursoId, e]) => ({
          cursoId,
          periodoId: parseInt(e.periodoId, 10),
          fecha: e.fecha,
          precio: Number(e.precio) || 0,
        }));
        const res = await emitirCertificadosConPedido({
          alumnoUid: clienteId,
          dni: (cliente.documento || '').trim(),
          nombreCompleto: cliente.nombre!.trim(),
          cargo: cargo.trim(),
          email: cliente.email,
          telefono: cliente.telefono,
          metodo,
          estadoPago,
          items,
        });
        if (!res.ok) throw new Error(res.motivo || 'No se pudieron emitir los certificados.');
        pedidoId = res.pedidoId;

        // Respaldo en Drive: se dispara y no se espera. El certificado ya es
        // válido y el PDF lo sirve la app.
        for (const c of res.certificados || []) {
          respaldarCertificadoEnDrive('digital', c.id, c.drive_digital_url);
          respaldarCertificadoEnDrive('imprimir', c.id, c.drive_imprimir_url);
        }
      }

      const partes: string[] = [];
      if (web.length) partes.push(web.length === 1 ? '1 curso asignado' : `${web.length} cursos asignados`);
      if (directos.length)
        partes.push(directos.length === 1 ? '1 certificado emitido' : `${directos.length} certificados emitidos`);
      if (pedidoId) partes.push(`pedido P-${String(pedidoId).padStart(4, '0')} registrado`);

      setElegidos(new Map());
      setBusqueda('');
      setFechaInscripcion('');
      onAsignado(`${partes.join(' · ')}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la asignación.');
    } finally {
      setGuardando(false);
    }
  }

  const dniValido = /^\d{8}$/.test((cliente.documento || '').trim());

  return (
    <Modal
      open={abierto}
      title="Asignar cursos"
      onClose={guardando ? () => {} : onCerrar}
      hideClose={guardando}
      className="modal-ancho"
    >
      <p className="campo-ayuda" style={{ marginTop: 0 }}>
        Marca los cursos y, por cada uno, cómo se certifica. Los que ya tiene aparecen bloqueados.
      </p>

      <label htmlFor="asig-buscar">Buscar curso</label>
      <input
        id="asig-buscar"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Escribe parte del nombre…"
        autoComplete="off"
      />

      <ul className="asignar-lista">
        {visibles.length === 0 && <li className="campo-ayuda">Ningún curso coincide con esa búsqueda.</li>}
        {visibles.map((c) => {
          const yaLoTiene = inscritos.has(c.id);
          const eleccion = elegidos.get(c.id);
          const yaCertificado = certificados.has(c.id);
          return (
            <li key={c.id} className={`asignar-fila${eleccion ? ' abierta' : ''}`}>
              {/* `.chk` no es decorativo: es el escape que usa todo el panel para
                  las etiquetas que llevan su propio layout. Sin él, la regla
                  global `label:not(.flex):not(.chk){display:block}` gana por
                  especificidad y tumba el flex, y `input{width:100%}` estira la
                  casilla de lado a lado. */}
              <label className={`chk asignar-item${yaLoTiene ? ' bloqueado' : ''}`}>
                <input
                  type="checkbox"
                  checked={yaLoTiene || !!eleccion}
                  disabled={yaLoTiene || guardando}
                  onChange={() => alternar(c)}
                />
                <span className="asignar-item-nombre">{c.nombre}</span>
                {yaLoTiene && <span className="tag canjeado">Ya lo tiene</span>}
              </label>

              {eleccion && (
                <div className="asignar-config">
                  <span className="asignar-config-etq" id={`tipo-etq-${c.id}`}>
                    Cómo se certifica
                  </span>

                  {/* Segmentado y no dos tarjetas con párrafo: son dos opciones
                      excluyentes, y con seis cursos marcados la pantalla se
                      llenaba de texto repetido. La explicación va una sola vez,
                      abajo, y cambia con lo elegido. */}
                  <div className="segmentado" role="radiogroup" aria-labelledby={`tipo-etq-${c.id}`}>
                    <label className={`chk segmentado-op${eleccion.tipo === 'web' ? ' activa' : ''}`}>
                      <input
                        type="radio"
                        name={`tipo-${c.id}`}
                        checked={eleccion.tipo === 'web'}
                        disabled={guardando}
                        onChange={() => cambiar(c.id, { tipo: 'web' })}
                      />
                      Web
                    </label>
                    <label
                      className={`chk segmentado-op${eleccion.tipo === 'directa' ? ' activa' : ''}${yaCertificado ? ' bloqueado' : ''}`}
                    >
                      <input
                        type="radio"
                        name={`tipo-${c.id}`}
                        checked={eleccion.tipo === 'directa'}
                        // Ya tiene certificado de este curso: el UNIQUE lo impide.
                        disabled={guardando || yaCertificado}
                        onChange={() => cambiar(c.id, { tipo: 'directa' })}
                      />
                      Directa
                    </label>
                  </div>

                  <p className="campo-ayuda">
                    {yaCertificado
                      ? 'Ya tiene el certificado de este curso, así que solo puede ir por el aula.'
                      : eleccion.tipo === 'web'
                        ? 'Rinde en el aula. El certificado sale solo al completar el curso.'
                        : 'Se emite ahora, con la fecha que elijas, y se registra el pedido.'}
                  </p>

                  {eleccion.tipo === 'directa' && (
                    <div className="asignar-directa">
                      <SelectorPeriodoFecha
                        periodos={periodos}
                        periodoId={eleccion.periodoId}
                        fecha={eleccion.fecha}
                        calendario={calendario}
                        deshabilitado={guardando}
                        onChange={(cambios) => cambiar(c.id, cambios)}
                      />
                      <div className="asignar-precio">
                        <label htmlFor={`precio-${c.id}`}>Precio (S/)</label>
                        <input
                          id={`precio-${c.id}`}
                          type="number"
                          min={0}
                          step="0.01"
                          value={eleccion.precio}
                          disabled={guardando}
                          onChange={(e) => cambiar(c.id, { precio: e.target.value })}
                        />
                        <span className="campo-ayuda">Pon 0 si es cortesía.</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Solo aparece si hay al menos un curso web: es la fecha de la inscripción. */}
      {web.length > 0 && (
        <div className="perfil-grid" style={{ marginTop: '1rem' }}>
          <div>
            <label htmlFor="asig-fecha">Fecha de inscripción (opcional)</label>
            <input
              id="asig-fecha"
              type="date"
              value={fechaInscripcion}
              disabled={guardando}
              onChange={(e) => setFechaInscripcion(e.target.value)}
            />
            <span className="campo-ayuda">Vacía = hoy. Sirve para registrar a alguien que empezó antes.</span>
          </div>
        </div>
      )}

      {/* Lo que necesita la certificación directa y no depende de cada curso. */}
      {directos.length > 0 && (
        <div className="asignar-directa-comun">
          <h3 className="gam-subtitulo">Datos del certificado</h3>

          {!dniValido && (
            <div className="aviso err" role="alert">
              Este cliente no tiene un DNI de 8 dígitos registrado. La certificación directa lo imprime en el
              certificado, así que hay que completarlo en sus datos antes de emitir.
            </div>
          )}

          <div className="perfil-grid">
            <div>
              <label htmlFor="asig-dni">DNI del titular</label>
              <input id="asig-dni" value={cliente.documento || ''} disabled />
              <span className="campo-ayuda">Sale del perfil. Se imprime tal cual en el certificado.</span>
            </div>
            <div>
              <SelectorCargo cargos={cargos} inicial={cliente.cargo || ''} onChange={setCargo} />
            </div>
          </div>

          <div className="perfil-grid">
            <div>
              <label htmlFor="asig-metodo">Método de pago</label>
              <select id="asig-metodo" value={metodo} disabled={guardando} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
                <option value="pendiente">Pendiente</option>
                <option value="transferencia">Transferencia</option>
                <option value="yape_plin">Yape</option>
                <option value="mercadopago">Tarjeta (Mercado Pago)</option>
              </select>
            </div>
            <div>
              <label htmlFor="asig-estado">Estado del pago</label>
              <select
                id="asig-estado"
                value={estadoPago}
                disabled={guardando}
                onChange={(e) => setEstadoPago(e.target.value as EstadoPago)}
              >
                <option value="pagado">Pagado</option>
                <option value="pendiente">Pendiente</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          <p className="campo-ayuda">
            Se registrará un pedido por <strong>{formatSoles(totalDirecto)}</strong> con{' '}
            {directos.length === 1 ? 'este certificado' : `estos ${directos.length} certificados`}. Emitir no se deshace
            desde el panel.
          </p>
        </div>
      )}

      <Aviso tipo="err" mensaje={error} />

      <div className="fila" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
        <button className="btn sec" type="button" onClick={onCerrar} disabled={guardando}>
          Cancelar
        </button>
        <button className="btn" type="button" onClick={guardar} disabled={guardando || !elegidos.size}>
          {guardando ? 'Guardando…' : directos.length ? 'Asignar y emitir' : 'Asignar cursos'}
        </button>
      </div>
    </Modal>
  );
}
