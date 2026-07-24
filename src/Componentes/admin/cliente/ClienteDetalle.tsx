'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatSoles, mensajeError } from '@/lib/copy';
import {
  obtenerPedidos,
  BADGE_ESTADO_ENVIO,
  BADGE_ESTADO_PAGO,
  CANAL_LABEL,
  formatFechaPedido,
  ORIGEN_LABEL,
  type PedidoRow,
} from '@/lib/pedidos';
import { obtenerCargosProfesionales, type CargoProfesional } from '@/lib/cargos';
import { asegurarCertificadoEnDrive } from '@/lib/certificado';
import { Badge } from '@/Componentes/admin/Badge';
import ConfirmDialog from '@/Componentes/ui/ConfirmDialog';
import CursoSelector from '../CursoSelector';
import { useCursosAdmin } from '../useCursosAdmin';
import GenerarCertificadoModal from '../GenerarCertificadoModal';

interface PerfilCompleto {
  id: string;
  nombre: string | null;
  nombres: string | null;
  apellidos: string | null;
  email: string | null;
  correo_contacto: string | null;
  telefono: string | null;
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
  nombre_completo: string | null;
  cargo: string | null;
  fecha: string;
  periodo_id: number | null;
  modalidad: string;
  drive_digital_url: string | null;
}

export default function ClienteDetalle({ clienteId, onVolver }: { clienteId: string; onVolver: () => void }) {
  const { cursos } = useCursosAdmin();
  const [perfil, setPerfil] = useState<PerfilCompleto | null>(null);
  const [pedidos, setPedidos] = useState<PedidoRow[] | null>(null);
  const [insc, setInsc] = useState<Inscripcion[] | null>(null);
  const [certificados, setCertificados] = useState<CertificadoRow[]>([]);
  const [cargos, setCargos] = useState<CargoProfesional[]>([]);
  const [cursoAsignar, setCursoAsignar] = useState('');
  const [aQuitar, setAQuitar] = useState<Inscripcion | null>(null);
  const [certCurso, setCertCurso] = useState<{ id: number; nombre: string } | null>(null);
  const [abriendoCert, setAbriendoCert] = useState<number | null>(null);
  const [verificandoCurso, setVerificandoCurso] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);

  // Campos editables del perfil.
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correoContacto, setCorreoContacto] = useState('');
  const [documento, setDocumento] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('DNI');
  const [cargo, setCargo] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [distrito, setDistrito] = useState('');
  const [genero, setGenero] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');

  async function cargarTodo() {
    const [{ data: perfilData }, todosPedidos, { data: dataInsc }, { data: dataCert }] = await Promise.all([
      supabase
        .from('perfiles')
        .select(
          'id,nombre,nombres,apellidos,email,correo_contacto,telefono,documento,tipo_documento,documento_verificado,cargo,departamento,distrito,genero,fecha_nacimiento,rol,creado_en'
        )
        .eq('id', clienteId)
        .maybeSingle(),
      obtenerPedidos(supabase),
      supabase.from('inscripciones').select('id,curso_id,origen').eq('alumno_id', clienteId),
      supabase
        .from('certificados')
        .select('id,curso_id,codigo_verificacion,nombre_completo,cargo,fecha,periodo_id,modalidad,drive_digital_url')
        .eq('alumno_uid', clienteId),
    ]);
    setPerfil(perfilData || null);
    setPedidos(todosPedidos.filter((p) => p.cliente_uid === clienteId));
    setInsc(dataInsc || []);
    setCertificados((dataCert as CertificadoRow[]) || []);
  }

  useEffect(() => {
    cargarTodo();
    obtenerCargosProfesionales().then(setCargos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  useEffect(() => {
    if (!perfil) return;
    setNombres(perfil.nombres || '');
    setApellidos(perfil.apellidos || '');
    setTelefono(perfil.telefono || '');
    setCorreoContacto(perfil.correo_contacto || '');
    setDocumento(perfil.documento || '');
    setTipoDocumento(perfil.tipo_documento || 'DNI');
    setCargo(perfil.cargo || '');
    setDepartamento(perfil.departamento || '');
    setDistrito(perfil.distrito || '');
    setGenero(perfil.genero || '');
    setFechaNacimiento(perfil.fecha_nacimiento || '');
  }, [perfil]);

  const cursoNombre = (id: number) => cursos.find((c) => c.id === id)?.nombre || `Curso #${id}`;

  async function guardarDatos() {
    setGuardando(true);
    setAviso(null);
    const nombreCompuesto = [nombres.trim(), apellidos.trim()].filter(Boolean).join(' ') || perfil?.nombre || null;
    const { error } = await supabase
      .from('perfiles')
      .update({
        nombres: nombres.trim() || null,
        apellidos: apellidos.trim() || null,
        nombre: nombreCompuesto,
        telefono: telefono.trim() || null,
        correo_contacto: correoContacto.trim() || null,
        documento: documento.trim() || null,
        tipo_documento: tipoDocumento,
        cargo: cargo.trim() || null,
        departamento: departamento.trim() || null,
        distrito: distrito.trim() || null,
        genero: genero || null,
        fecha_nacimiento: fechaNacimiento || null,
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

  async function asignarCurso() {
    const cid = parseInt(cursoAsignar, 10);
    if (!cid) return;
    const { error } = await supabase.from('inscripciones').insert({ alumno_id: clienteId, curso_id: cid, origen: 'admin' });
    if (error) {
      setAviso({ texto: mensajeError(error), tipo: 'err' });
      return;
    }
    setCursoAsignar('');
    cargarTodo();
  }

  async function confirmarQuitarCurso() {
    if (!aQuitar) return;
    const { error } = await supabase.from('inscripciones').delete().eq('id', aQuitar.id);
    if (error) {
      setAviso({ texto: mensajeError(error), tipo: 'err' });
      setAQuitar(null);
      return;
    }
    setAQuitar(null);
    cargarTodo();
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

  async function verCertificado(cert: CertificadoRow) {
    let periodoInfo: { periodoInicio?: string; periodoEntrega?: string; periodoCierre?: string } = {};
    if (cert.periodo_id) {
      const { data: p } = await supabase
        .from('periodos_certificacion')
        .select('fecha_inicio,fecha_entrega,fecha_cierre')
        .eq('id', cert.periodo_id)
        .maybeSingle();
      if (p) {
        periodoInfo = {
          periodoInicio: new Date(p.fecha_inicio + 'T00:00:00').toLocaleDateString('es-PE'),
          periodoEntrega: new Date(p.fecha_entrega + 'T00:00:00').toLocaleDateString('es-PE'),
          periodoCierre: new Date(p.fecha_cierre + 'T00:00:00').toLocaleDateString('es-PE'),
        };
      }
    }
    setAbriendoCert(cert.id);
    try {
      const url = await asegurarCertificadoEnDrive(
        {
          codigo: cert.codigo_verificacion,
          alumnoNombre: cert.nombre_completo || perfil?.nombre || '—',
          cursoNombre: cursoNombre(cert.curso_id),
          fecha: new Date(cert.fecha).toLocaleDateString('es-PE'),
          cargo: cert.cargo || undefined,
          cursoId: cert.curso_id,
          modalidad: cert.modalidad === 'directo' ? 'directo' : 'evaluado',
          ...periodoInfo,
        },
        'digital',
        cert.id,
        cert.drive_digital_url
      );
      setCertificados((prev) => prev.map((c) => (c.id === cert.id ? { ...c, drive_digital_url: url } : c)));
      window.open(url, '_blank');
    } catch (e) {
      setAviso({ texto: e instanceof Error ? e.message : 'No se pudo abrir el certificado.', tipo: 'err' });
    } finally {
      setAbriendoCert(null);
    }
  }

  if (!perfil) {
    return (
      <>
        <div className="barra">
          <button type="button" className="btn sec btn-sm" onClick={onVolver}>
            <ArrowLeft size={16} style={{ marginRight: '.3rem' }} /> Volver a clientes
          </button>
        </div>
        <p>Cargando…</p>
      </>
    );
  }

  const totalPagado = (pedidos || []).filter((p) => p.estado_pago === 'pagado').reduce((acc, p) => acc + (Number(p.total) || 0), 0);

  return (
    <>
      <div className="barra">
        <button type="button" className="btn sec btn-sm" onClick={onVolver}>
          <ArrowLeft size={16} style={{ marginRight: '.3rem' }} /> Volver a clientes
        </button>
        <h1 className="titulo">{perfil.nombre || perfil.email || 'Cliente'}</h1>
      </div>

      {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}

      <div className="card card-pad" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Datos del cliente</h3>
        <div className="perfil-grid">
          <div>
            <label>Nombres</label>
            <input value={nombres} onChange={(e) => setNombres(e.target.value)} />
          </div>
          <div>
            <label>Apellidos</label>
            <input value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
          </div>
        </div>
        <div className="perfil-grid">
          <div>
            <label>Correo de acceso al aula</label>
            <input value={perfil.email || ''} disabled />
          </div>
          <div>
            <label>Correo de contacto (para enviar certificados)</label>
            <input type="email" value={correoContacto} onChange={(e) => setCorreoContacto(e.target.value)} placeholder="Si es distinto al de acceso" />
          </div>
        </div>
        <div className="perfil-grid">
          <div>
            <label>Teléfono</label>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div>
            <label>Cargo profesional</label>
            <select value={cargo} onChange={(e) => setCargo(e.target.value)}>
              <option value="">— Sin especificar —</option>
              {cargos.map((c) => (
                <option value={c.nombre} key={c.id}>
                  {c.nombre}
                </option>
              ))}
              {cargo && !cargos.some((c) => c.nombre === cargo) && <option value={cargo}>{cargo}</option>}
            </select>
          </div>
        </div>
        <div className="perfil-grid">
          <div>
            <label>Tipo de documento</label>
            <select value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)}>
              <option value="DNI">DNI</option>
              <option value="CE">Carnet de Extranjería</option>
              <option value="Pasaporte">Pasaporte</option>
            </select>
          </div>
          <div>
            <label>
              Documento{' '}
              {perfil.documento_verificado ? (
                <span className="tag activo" style={{ marginLeft: '.4rem' }}>
                  Verificado con RENIEC
                </span>
              ) : (
                <span className="tag canjeado" style={{ marginLeft: '.4rem' }}>
                  Autodeclarado
                </span>
              )}
            </label>
            <input value={documento} onChange={(e) => setDocumento(e.target.value)} />
          </div>
        </div>
        <div className="perfil-grid">
          <div>
            <label>Departamento</label>
            <input value={departamento} onChange={(e) => setDepartamento(e.target.value)} />
          </div>
          <div>
            <label>Distrito</label>
            <input value={distrito} onChange={(e) => setDistrito(e.target.value)} />
          </div>
        </div>
        <div className="perfil-grid">
          <div>
            <label>Género</label>
            <select value={genero} onChange={(e) => setGenero(e.target.value)}>
              <option value="">— Sin especificar —</option>
              <option value="femenino">Femenino</option>
              <option value="masculino">Masculino</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label>Fecha de nacimiento</label>
            <input type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} />
          </div>
        </div>
        <p className="sub" style={{ marginTop: '.4rem' }}>
          Cuenta creada el {perfil.creado_en ? new Date(perfil.creado_en).toLocaleDateString('es-PE') : '—'}.
        </p>
        <button className="btn" onClick={guardarDatos} disabled={guardando} style={{ marginTop: '.6rem' }}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>

      <div className="card card-pad" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Cursos inscritos</h3>
        <p className="sub" style={{ margin: '-.4rem 0 .6rem' }}>
          Para un curso sin certificado: <strong>&quot;Emitir por curso completado&quot;</strong> verifica que ya rindió
          el 100% de tareas/exámenes y lo emite tal cual lo haría el sistema solo (certificación web). Si en cambio el
          cliente pide el certificado sin rendir nada, usa <strong>&quot;Generar certificado directo&quot;</strong>, que
          va a la lista de Certificados directos, no a esta.
        </p>
        {insc === null ? (
          <p>Cargando…</p>
        ) : insc.length ? (
          insc.map((i) => {
            const cert = certificados.find((c) => c.curso_id === i.curso_id);
            return (
              <div className="eval" key={i.id}>
                <span style={{ flex: 1 }}>
                  {cursoNombre(i.curso_id)} <span className="tag canjeado">{i.origen}</span>
                </span>
                <div className="fila">
                  {cert ? (
                    <button className="btn sec btn-sm" type="button" onClick={() => verCertificado(cert)} disabled={abriendoCert === cert.id}>
                      {abriendoCert === cert.id ? 'Abriendo…' : 'Ver certificado'}
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn sec btn-sm"
                        type="button"
                        onClick={() => emitirPorCursoCompletado(i.curso_id)}
                        disabled={verificandoCurso === i.curso_id}
                        title="Para cuando el cliente ya completó el 100% de tareas/exámenes pero el certificado no se generó solo."
                      >
                        {verificandoCurso === i.curso_id ? 'Verificando…' : 'Emitir por curso completado'}
                      </button>
                      <button
                        className="btn sec btn-sm"
                        type="button"
                        onClick={() => setCertCurso({ id: i.curso_id, nombre: String(cursoNombre(i.curso_id)) })}
                        title="Para cuando el cliente pide el certificado directamente, sin rendir tareas/exámenes."
                      >
                        Generar certificado directo
                      </button>
                    </>
                  )}
                  <button className="btn peligro btn-sm" onClick={() => setAQuitar(i)}>
                    Quitar
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="vacio">Sin cursos.</p>
        )}
        <hr />
        <label>Asignar curso manualmente</label>
        <div className="fila">
          <CursoSelector cursos={cursos.map((c) => ({ ...c, categoria_id: null, estado: '1' }))} value={cursoAsignar} onChange={setCursoAsignar} />
          <button className="btn" onClick={asignarCurso}>
            Asignar
          </button>
        </div>
      </div>

      <div className="card card-pad">
        <div className="barra" style={{ marginBottom: '.6rem' }}>
          <h3 style={{ margin: 0 }}>Todas sus compras</h3>
          <span className="meta" style={{ color: 'var(--gris)' }}>
            {pedidos === null ? '' : `${pedidos.length} pedido(s) · ${formatSoles(totalPagado)} pagado`}
          </span>
        </div>
        {pedidos === null ? (
          <p>Cargando…</p>
        ) : pedidos.length ? (
          pedidos.map((p) => {
            const estado = BADGE_ESTADO_PAGO[p.estado_pago];
            const envio = BADGE_ESTADO_ENVIO[p.estado_envio];
            return (
              <div className="card card-pad" key={p.id} style={{ marginBottom: '.7rem', background: 'var(--primario-claro)' }}>
                <div className="fila" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <strong>{p.esOrfano ? `Venta V-${-p.id}` : `Pedido #${p.id}`}</strong>
                  <div className="fila">
                    <Badge color={estado.color}>{estado.label}</Badge>
                    {p.incluye_certificado_fisico && <Badge color={envio.color}>{envio.label}</Badge>}
                  </div>
                </div>
                <p className="sub" style={{ margin: '.2rem 0' }}>
                  {formatFechaPedido(p.fecha)} · {CANAL_LABEL[p.canal] || p.canal} · {ORIGEN_LABEL[p.origen]}
                  {p.promocion_titulo ? ` · Promoción: ${p.promocion_titulo}` : ''}
                </p>
                {p.origen === 'envio_certificado'
                  ? p.certificados.map((c) => (
                      <div key={c.certificado_id} className="fila" style={{ justifyContent: 'space-between' }}>
                        <span>{c.curso_nombre}</span>
                      </div>
                    ))
                  : p.items.map((it) => (
                      <div key={it.id} className="fila" style={{ justifyContent: 'space-between' }}>
                        <span>{it.nombre_curso}</span>
                        <span>{formatSoles(it.monto)}</span>
                      </div>
                    ))}
                <div className="fila" style={{ justifyContent: 'flex-end', marginTop: '.3rem', fontWeight: 700 }}>
                  Total: {formatSoles(p.total)}
                </div>
              </div>
            );
          })
        ) : (
          <p className="vacio">Sin compras registradas.</p>
        )}
      </div>

      <ConfirmDialog
        open={!!aQuitar}
        title="¿Quitar este curso del cliente?"
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
