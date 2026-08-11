'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatSoles, mensajeError } from '@/lib/copy';
import {
  obtenerPedidos,
  BADGE_ESTADO_ENVIO,
  codigoPedido,
  BADGE_ESTADO_PAGO,
  CANAL_LABEL,
  formatFechaPedido,
  ORIGEN_LABEL,
  type PedidoRow,
} from '@/lib/pedidos';
import { obtenerCargosProfesionales, type CargoProfesional } from '@/lib/cargos';
import { abrirPdfCertificado, esBlobUrl, respaldarCertificadoEnDrive } from '@/lib/certificado';
import { calcularProgresoNivel, obtenerGamificacionDeAlumno, type GamificacionAlumno } from '@/lib/gamificacion';
import {
  obtenerPosiblesDuplicados,
  obtenerResumenAlumno,
  type PosibleDuplicado,
  type ResumenAlumno,
} from '@/lib/alumno';
import { Badge } from '@/Componentes/admin/Badge';
import ConfirmDialog from '@/Componentes/ui/ConfirmDialog';
import PedidoDetalle from '../pedidos/PedidoDetalle';
import AsignarCursosModal from './AsignarCursosModal';
import { useCursosAdmin } from '../useCursosAdmin';
import GenerarCertificadoModal from '../GenerarCertificadoModal';
import Aviso from '@/Componentes/ui/Aviso';
import EstadoCarga, { BloqueCargando } from '../EstadoCarga';
import { useCargaDatos, datosDe, filaDe } from '../useCargaDatos';
import CabeceraCliente, { type ResumenCliente } from './CabeceraCliente';
import DatosCliente, { type DatosEditables } from './DatosCliente';
import GamificacionCliente from './GamificacionCliente';
import NotasInternas from './NotasInternas';

interface PerfilCompleto {
  id: string;
  nombre: string | null;
  nombres: string | null;
  apellidos: string | null;
  email: string | null;
  correo_contacto: string | null;
  telefono: string | null;
  telefono_alternativo: string | null;
  documento: string | null;
  tipo_documento: string | null;
  documento_verificado: boolean | null;
  cargo: string | null;
  departamento: string | null;
  distrito: string | null;
  genero: string | null;
  fecha_nacimiento: string | null;
  rol: string | null;
  creado_en: string | null;
  puntos: number | null;
  racha_dias: number | null;
  avatar_key: string | null;
  notas_internas: string | null;
}

interface Inscripcion {
  id: number;
  curso_id: number;
  origen: string | null;
}

interface CertificadoRow {
  id: number;
  curso_id: number;
  codigo_verificacion: string;
  fecha: string;
  modalidad: string;
  estado: string;
  drive_digital_url: string | null;
}

/** `inscripciones.origen` es jerga interna; esto es lo que significa para quien lee la ficha. */
const ORIGEN_INSCRIPCION: Record<string, string> = {
  admin: 'Asignado por el equipo',
  compra: 'Comprado',
  codigo: 'Canjeado con código',
};

/**
 * En qué punto está un curso del alumno.
 *
 * Antes la fila solo mostraba dos botones sueltos cuando no había certificado, y
 * había que deducir el estado de qué botones aparecían. La mayoría de los cursos
 * de un alumno activo están sin terminar, así que "todavía no le toca" es el
 * estado más común de la pantalla y merecía decirse en palabras.
 */
type EstadoCurso = 'certificado' | 'anulado' | 'listo' | 'en_curso' | 'sin_empezar' | 'sin_evaluaciones';

const BADGE_CURSO: Record<EstadoCurso, { texto: string; clase: string }> = {
  certificado: { texto: 'Certificado', clase: 'activo' },
  anulado: { texto: 'Certificado anulado', clase: 'anulado' },
  listo: { texto: 'Listo para certificar', clase: 'flujo-web' },
  en_curso: { texto: 'En progreso', clase: 'canjeado' },
  sin_empezar: { texto: 'Sin empezar', clase: 'canjeado' },
  sin_evaluaciones: { texto: 'Curso sin evaluaciones', clase: 'canjeado' },
};

export default function ClienteDetalle({ clienteId, onVolver }: { clienteId: string; onVolver: () => void }) {
  const { cursos } = useCursosAdmin();
  const [perfil, setPerfil] = useState<PerfilCompleto | null>(null);
  const [pedidos, setPedidos] = useState<PedidoRow[] | null>(null);
  const [insc, setInsc] = useState<Inscripcion[] | null>(null);
  const [certificados, setCertificados] = useState<CertificadoRow[]>([]);
  const [gamificacion, setGamificacion] = useState<GamificacionAlumno | null>(null);
  const [resumenAlumno, setResumenAlumno] = useState<ResumenAlumno | null>(null);
  const [duplicados, setDuplicados] = useState<PosibleDuplicado[]>([]);
  const [pedidoAbierto, setPedidoAbierto] = useState<PedidoRow | null>(null);
  const [cargos, setCargos] = useState<CargoProfesional[]>([]);
  const [asignando, setAsignando] = useState(false);
  const [aQuitar, setAQuitar] = useState<Inscripcion | null>(null);
  const [certCurso, setCertCurso] = useState<{ id: number; nombre: string } | null>(null);
  const [verificandoCurso, setVerificandoCurso] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);

  const {
    error: errorCarga,
    cargando,
    recargar: cargarTodo,
  } = useCargaDatos(async () => {
    const [perfilData, susPedidos, dataInsc, dataCert, gam, resumen, dups] = await Promise.all([
      filaDe<PerfilCompleto>(
        supabase
          .from('perfiles')
          .select(
            'id,nombre,nombres,apellidos,email,correo_contacto,telefono,telefono_alternativo,documento,tipo_documento,documento_verificado,cargo,departamento,distrito,genero,fecha_nacimiento,rol,creado_en,puntos,racha_dias,avatar_key,notas_internas'
          )
          .eq('id', clienteId)
          .maybeSingle()
      ),
      // Filtrado en el servidor: antes se traían TODOS los pedidos del sistema
      // para quedarse con los de una persona.
      obtenerPedidos(supabase, clienteId),
      datosDe<Inscripcion>(supabase.from('inscripciones').select('id,curso_id,origen').eq('alumno_id', clienteId)),
      datosDe<CertificadoRow>(
        supabase
          .from('certificados')
          .select('id,curso_id,codigo_verificacion,fecha,modalidad,estado,drive_digital_url')
          .eq('alumno_uid', clienteId)
      ),
      obtenerGamificacionDeAlumno(clienteId),
      obtenerResumenAlumno(clienteId),
      obtenerPosiblesDuplicados(clienteId),
    ]);
    // Un cliente que no existe no es "sigue cargando": se levanta como error
    // para que la pantalla lo diga en vez de quedarse en el esqueleto.
    if (!perfilData) throw new Error('Este cliente ya no existe o no tienes permiso para verlo.');
    setPerfil(perfilData);
    setPedidos(susPedidos);
    setInsc(dataInsc);
    setCertificados(dataCert);
    setGamificacion(gam);
    setResumenAlumno(resumen);
    setDuplicados(dups);
    return perfilData;
  }, [clienteId]);

  useEffect(() => {
    obtenerCargosProfesionales().then(setCargos);
  }, []);

  const cursoNombre = (id: number) => cursos.find((c) => c.id === id)?.nombre || `Curso #${id}`;

  const valores: DatosEditables = useMemo(
    () => ({
      nombres: perfil?.nombres || '',
      apellidos: perfil?.apellidos || '',
      telefono: perfil?.telefono || '',
      telefonoAlternativo: perfil?.telefono_alternativo || '',
      correoContacto: perfil?.correo_contacto || '',
      documento: perfil?.documento || '',
      tipoDocumento: perfil?.tipo_documento || 'DNI',
      cargo: perfil?.cargo || '',
      departamento: perfil?.departamento || '',
      distrito: perfil?.distrito || '',
      genero: perfil?.genero || '',
      fechaNacimiento: perfil?.fecha_nacimiento || '',
    }),
    [perfil]
  );

  async function guardarDatos(v: DatosEditables) {
    setGuardando(true);
    setAviso(null);
    const nombreCompuesto = [v.nombres.trim(), v.apellidos.trim()].filter(Boolean).join(' ') || perfil?.nombre || null;
    const { error } = await supabase
      .from('perfiles')
      .update({
        nombres: v.nombres.trim() || null,
        apellidos: v.apellidos.trim() || null,
        nombre: nombreCompuesto,
        telefono: v.telefono.trim() || null,
        telefono_alternativo: v.telefonoAlternativo.trim() || null,
        correo_contacto: v.correoContacto.trim() || null,
        documento: v.documento.trim() || null,
        tipo_documento: v.tipoDocumento,
        cargo: v.cargo.trim() || null,
        departamento: v.departamento.trim() || null,
        distrito: v.distrito.trim() || null,
        genero: v.genero || null,
        fecha_nacimiento: v.fechaNacimiento || null,
      })
      .eq('id', clienteId);
    setGuardando(false);
    if (error) {
      setAviso({ texto: mensajeError(error), tipo: 'err' });
      return;
    }
    setAviso({ texto: 'Datos guardados.', tipo: 'ok' });
    cargarTodo();
  }

  // Devuelve el motivo en vez de cerrar y avisar por detrás: ConfirmDialog lo
  // muestra dentro del propio diálogo y deja reintentar sin volver a buscar la
  // fila.
  async function confirmarQuitarCurso(): Promise<string | void> {
    if (!aQuitar) return;
    const { error: eQuitar } = await supabase.from('inscripciones').delete().eq('id', aQuitar.id);
    if (eQuitar) return mensajeError(eQuitar);
    setAQuitar(null);
    await cargarTodo();
  }

  // Flujo 2 (certificación web): red de seguridad para cuando el alumno ya
  // completó el 100% de tareas/exámenes pero el trigger automático no emitió
  // el certificado. A propósito NO usa el formulario de "Certificados
  // directos" (DNI/cargo/período) — eso crea un certificado modalidad
  // 'directo' y lo mezclaría con la lista de certificación directa. Este
  // llama al mismo RPC de red de seguridad que ya usa el alumno desde su
  // aula (CertificadoBanner) y siempre emite modalidad 'evaluado'.
  async function emitirPorCursoCompletado(cursoId: number) {
    setVerificandoCurso(cursoId);
    setAviso(null);
    const { data, error } = await supabase.rpc('intentar_emitir_certificado', { p_curso_id: cursoId, p_alumno_uid: clienteId });
    setVerificandoCurso(null);
    if (error) {
      setAviso({ texto: mensajeError(error), tipo: 'err' });
      return;
    }
    if (data?.emitido) {
      setAviso({ texto: `Certificado emitido (promedio ${data.promedio}).`, tipo: 'ok' });
      cargarTodo();
    } else {
      setAviso({
        texto: `Todavía no completa todas las tareas/exámenes del curso (${data?.completadas ?? 0} de ${data?.total ?? 0}). No se puede emitir por este medio.`,
        tipo: 'err',
      });
    }
  }

  /** El PDF lo arma el servidor desde la BD. Drive se respalda en paralelo y no se espera. */
  async function verCertificado(cert: CertificadoRow) {
    respaldarCertificadoEnDrive('digital', cert.id, cert.drive_digital_url);
    try {
      const url = await abrirPdfCertificado(cert.codigo_verificacion, 'digital');
      window.open(url, '_blank');
      if (esBlobUrl(url)) setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setAviso({ texto: e instanceof Error ? e.message : 'No se pudo abrir el certificado.', tipo: 'err' });
    }
  }

  // "Cargando" y "no se pudo cargar" dejan de ser el mismo estado: antes un
  // fallo de permisos dejaba la ficha en "Cargando…" para siempre.
  if (!perfil) {
    return (
      <>
        <div className="barra">
          <button type="button" className="btn sec btn-sm" onClick={onVolver}>
            Volver a clientes
          </button>
        </div>
        <EstadoCarga cargando={cargando} error={errorCarga} onReintentar={cargarTodo} variante="bloque">
          <></>
        </EstadoCarga>
      </>
    );
  }

  // El detalle del pedido reemplaza la ficha entera, igual que en Pedidos. Es el
  // MISMO componente, así que desde acá se puede cambiar el estado de pago, subir
  // el comprobante y gestionar el envío sin salir del cliente.
  if (pedidoAbierto) {
    return (
      <PedidoDetalle
        pedido={pedidoAbierto}
        onVolver={() => setPedidoAbierto(null)}
        onActualizado={() => {
          setPedidoAbierto(null);
          cargarTodo();
        }}
      />
    );
  }

  const totalPagado = (pedidos || []).filter((p) => p.estado_pago === 'pagado').reduce((acc, p) => acc + (Number(p.total) || 0), 0);
  const certificadosVigentes = certificados.filter((c) => c.estado !== 'anulado');
  const nivel = gamificacion ? calcularProgresoNivel(perfil.puntos || 0, gamificacion.niveles).actual : null;

  // Lo que impide certificar a esta persona, nombrado. Antes era un punto rojo
  // con un `title` que no decía cuál de los dos datos faltaba.
  const datosFaltantes = [
    !perfil.documento && 'documento',
    !perfil.telefono && 'teléfono',
    !perfil.cargo && 'cargo profesional',
  ].filter((x): x is string => !!x);

  const resumen: ResumenCliente = {
    nombre: perfil.nombre || perfil.email || 'Cliente sin nombre',
    email: perfil.email,
    correoContacto: perfil.correo_contacto,
    telefono: perfil.telefono,
    documento: perfil.documento,
    tipoDocumento: perfil.tipo_documento,
    documentoVerificado: !!perfil.documento_verificado,
    avatarKey: perfil.avatar_key,
    creadoEn: perfil.creado_en,
    totalPagado,
    pedidos: (pedidos || []).length,
    cursos: (insc || []).length,
    certificados: certificadosVigentes.length,
    nivel: nivel?.nombre ?? null,
    datosFaltantes,
    ultimoAcceso: resumenAlumno?.ultimo_acceso ?? null,
  };

  return (
    <>
      <CabeceraCliente resumen={resumen} onVolver={onVolver} />

      {/* Cuentas con el mismo documento. Solo se avisa: fusionarlas mueve
          certificados y ventas entre personas y se decide caso por caso. */}
      {duplicados.length > 0 && (
        <div className="aviso err" role="alert">
          <strong>
            {duplicados.length === 1
              ? 'Hay otra cuenta con este mismo documento.'
              : `Hay ${duplicados.length} cuentas más con este mismo documento.`}
          </strong>{' '}
          Probablemente sea la misma persona registrada dos veces. Sus cursos, certificados y compras están repartidos
          entre las cuentas.
          <ul style={{ margin: '.5rem 0 0', paddingLeft: '1.2rem' }}>
            {duplicados.map((d) => (
              <li key={d.id} style={{ fontSize: '.88rem' }}>
                {d.nombre || 'Sin nombre'} · {d.email || 'sin correo'}
                {d.creado_en && ` · creada el ${new Date(d.creado_en).toLocaleDateString('es-PE')}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Aviso tipo={aviso?.tipo ?? 'err'} mensaje={aviso?.texto} />

      <DatosCliente
        valores={valores}
        correoAcceso={perfil.email}
        documentoVerificado={!!perfil.documento_verificado}
        cargos={cargos}
        guardando={guardando}
        onGuardar={guardarDatos}
      />

      <section className="card card-pad separado" aria-labelledby="cursos-titulo">
        <h2 id="cursos-titulo" className="bloque-titulo">
          Cursos y certificados
        </h2>
        <p className="campo-ayuda">
          <strong>Emitir por curso completado</strong> comprueba que ya rindió el 100% de tareas y exámenes, y emite el
          certificado igual que lo haría el sistema solo. <strong>Generar certificado directo</strong> es para cuando el
          cliente lo pide sin rendir nada: ese va a la lista de Certificados directos, no a esta.
        </p>

        {insc === null ? (
          <BloqueCargando />
        ) : insc.length ? (
          <ul className="lista-cursos">
            {insc.map((i) => {
              const cert = certificados.find((c) => c.curso_id === i.curso_id);
              const anulado = cert?.estado === 'anulado';
              const avance = resumenAlumno?.progreso.find((p) => p.curso_id === i.curso_id);
              const pct = avance && avance.total > 0 ? Math.floor((avance.completadas / avance.total) * 100) : 0;

              const estadoCurso: EstadoCurso = anulado
                ? 'anulado'
                : cert
                  ? 'certificado'
                  : !avance || avance.total === 0
                    ? 'sin_evaluaciones'
                    : avance.completadas === 0
                      ? 'sin_empezar'
                      : avance.completadas >= avance.total
                        ? 'listo'
                        : 'en_curso';
              const badge = BADGE_CURSO[estadoCurso];

              return (
                <li className="curso-fila" key={i.id}>
                  <div className="curso-fila-info">
                    <strong>{cursoNombre(i.curso_id)}</strong>
                    <span className="curso-fila-meta">
                      <span className={`tag ${badge.clase}`}>{badge.texto}</span>
                      {cert && !anulado && (
                        <span className="campo-ayuda">
                          {cert.modalidad === 'directo' ? 'Directo' : 'Del aula'} ·{' '}
                          {new Date(cert.fecha).toLocaleDateString('es-PE')}
                        </span>
                      )}
                      <span className="campo-ayuda">{ORIGEN_INSCRIPCION[i.origen || ''] || i.origen || 'Origen desconocido'}</span>
                    </span>

                    {/* Avance real. La ficha decía que alguien "tiene un curso" pero no
                        si lo había empezado — es lo que más se pregunta por WhatsApp.
                        Los certificados directos no rinden nada, así que ahí no aplica. */}
                    {avance && avance.total > 0 && cert?.modalidad !== 'directo' && (
                      <span className="curso-avance">
                        <span className="curso-avance-barra" role="presentation">
                          <span style={{ width: `${pct}%` }} />
                        </span>
                        <span className="campo-ayuda">
                          {avance.completadas} de {avance.total} tareas y exámenes
                          {avance.promedio != null && ` · promedio ${avance.promedio}`}
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="fila curso-fila-acciones">
                    {cert && !anulado ? (
                      <button className="btn sec btn-sm" type="button" onClick={() => verCertificado(cert)}>
                        Ver certificado
                      </button>
                    ) : cert && anulado ? (
                      <span className="campo-ayuda">Se anuló desde Certificados emitidos.</span>
                    ) : (
                      <>
                        {/* Cuando ya completó todo, emitir por curso completado es LA acción:
                            va como botón primario. Cuando no, ese botón solo puede fallar, así
                            que la acción a mano queda al frente y la otra ni se ofrece. */}
                        {estadoCurso === 'listo' && (
                          <button
                            className="btn btn-sm"
                            type="button"
                            onClick={() => emitirPorCursoCompletado(i.curso_id)}
                            disabled={verificandoCurso === i.curso_id}
                          >
                            {verificandoCurso === i.curso_id ? 'Emitiendo…' : 'Emitir certificado'}
                          </button>
                        )}
                        <button
                          className="btn sec btn-sm"
                          type="button"
                          onClick={() => setCertCurso({ id: i.curso_id, nombre: String(cursoNombre(i.curso_id)) })}
                        >
                          Generar a mano
                        </button>
                      </>
                    )}
                    <button className="btn peligro btn-sm" onClick={() => setAQuitar(i)}>
                      Quitar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="vacio">Todavía no tiene cursos. Asígnale uno abajo o espera a que compre.</p>
        )}

        <div className="asignar-curso">
          <button className="btn sec" type="button" onClick={() => setAsignando(true)}>
            + Asignar cursos
          </button>
          <span className="campo-ayuda">Puedes marcar varios de una vez y fijarles la fecha de inscripción.</span>
        </div>
      </section>

      <GamificacionCliente
        clienteId={clienteId}
        puntos={perfil.puntos || 0}
        rachaDias={perfil.racha_dias || 0}
        datos={gamificacion}
        onCambio={(texto) => {
          setAviso({ texto, tipo: 'ok' });
          cargarTodo();
        }}
        onError={(texto) => setAviso({ texto, tipo: 'err' })}
      />

      <NotasInternas
        clienteId={clienteId}
        inicial={perfil.notas_internas || ''}
        onGuardado={(texto) => {
          setAviso({ texto, tipo: 'ok' });
          cargarTodo();
        }}
        onError={(texto) => setAviso({ texto, tipo: 'err' })}
      />

      <section className="card card-pad" aria-labelledby="compras-titulo">
        <div className="fila-entre separado">
          <h2 id="compras-titulo" className="bloque-titulo">
            Compras
          </h2>
          <span className="campo-ayuda">
            {pedidos === null
              ? ''
              : `${pedidos.length === 1 ? '1 pedido' : `${pedidos.length} pedidos`} · ${formatSoles(totalPagado)} pagado`}
          </span>
        </div>
        {pedidos === null ? (
          <BloqueCargando />
        ) : pedidos.length ? (
          pedidos.map((p) => {
            const estado = BADGE_ESTADO_PAGO[p.estado_pago];
            const envio = BADGE_ESTADO_ENVIO[p.estado_envio];
            // Resumen, no inventario. Antes se listaba cada curso con su precio
            // dentro del resumen: con un pedido de cuatro cursos la tarjeta se
            // volvía una lista larga y no se distinguía un pedido de otro. Lo
            // que identifica a un pedido de un vistazo es su código, su fecha y
            // su total; el desglose es exactamente lo que hay dentro.
            //
            // La caja entera abre el detalle. Las ventas sueltas (`esOrfano`) no
            // tienen cabecera de pedido, así que no hay nada que abrir.
            const cuantos = p.origen === 'envio_certificado' ? p.certificados.length : p.items.length;
            const resumenLinea = (
              <>
                <div className="fila-entre">
                  <strong>{p.esOrfano ? `Venta ${codigoPedido(p)}` : `Pedido ${codigoPedido(p)}`}</strong>
                  <div className="fila">
                    <Badge color={estado.color}>{estado.label}</Badge>
                    {p.incluye_certificado_fisico && <Badge color={envio.color}>{envio.label}</Badge>}
                  </div>
                </div>
                <p className="campo-ayuda">
                  {formatFechaPedido(p.fecha)} · {CANAL_LABEL[p.canal] || p.canal} · {ORIGEN_LABEL[p.origen]}
                  {p.promocion_titulo ? ` · Promoción: ${p.promocion_titulo}` : ''}
                </p>
                <div className="pedido-total">
                  <span className="campo-ayuda">{cuantos === 1 ? '1 ítem' : `${cuantos} ítems`}</span>
                  <strong>{formatSoles(p.total)}</strong>
                </div>
              </>
            );

            if (p.esOrfano) {
              return (
                <div className="panel separado" key={p.id}>
                  {resumenLinea}
                </div>
              );
            }
            return (
              <button
                type="button"
                className="panel separado panel-abrible"
                key={p.id}
                onClick={() => setPedidoAbierto(p)}
                aria-label={`Ver el detalle del pedido ${codigoPedido(p)}`}
              >
                {resumenLinea}
              </button>
            );
          })
        ) : (
          <p className="vacio">Sin compras registradas.</p>
        )}
      </section>

      <AsignarCursosModal
        abierto={asignando}
        clienteId={clienteId}
        cliente={{
          nombre: perfil.nombre,
          documento: perfil.documento,
          cargo: perfil.cargo,
          email: perfil.correo_contacto || perfil.email,
          telefono: perfil.telefono,
        }}
        cursos={cursos}
        cargos={cargos}
        yaInscritos={(insc || []).map((i) => i.curso_id)}
        yaCertificados={certificados.filter((c) => c.estado !== 'anulado').map((c) => c.curso_id)}
        onCerrar={() => setAsignando(false)}
        onAsignado={(texto) => {
          setAsignando(false);
          setAviso({ texto, tipo: 'ok' });
          cargarTodo();
        }}
      />

      <ConfirmDialog
        open={!!aQuitar}
        title="¿Quitar este curso del cliente?"
        body={
          aQuitar
            ? `Perderá el acceso a "${cursoNombre(aQuitar.curso_id)}" en su aula. Si ya tiene el certificado de este curso, el certificado no se toca.`
            : undefined
        }
        confirmLabel="Quitar curso"
        onConfirm={confirmarQuitarCurso}
        onCancel={() => setAQuitar(null)}
      />

      {certCurso && (
        <GenerarCertificadoModal
          alumnoUid={clienteId}
          alumnoDni={perfil.documento}
          alumnoNombre={perfil.nombre}
          cursoId={certCurso.id}
          cursoNombre={certCurso.nombre}
          onClose={() => setCertCurso(null)}
          onEmitido={() => {
            setCertCurso(null);
            cargarTodo();
          }}
        />
      )}
    </>
  );
}
