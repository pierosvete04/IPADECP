'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import { asegurarCertificadoEnDrive } from '@/lib/certificado';
import DataTable from '@/Componentes/ui/DataTable';
import { TableSkeleton } from '@/Componentes/admin/table/TableSkeleton';
import Modal from '@/Componentes/ui/Modal';
import ConfirmDialog from '@/Componentes/ui/ConfirmDialog';
import CursoSelector from './CursoSelector';
import { useCursosAdmin } from './useCursosAdmin';
import GenerarCertificadoModal from './GenerarCertificadoModal';

interface PerfilNuevo {
  id: string;
  nombre: string | null;
  email: string | null;
  rol: string | null;
  creado_en: string | null;
  documento: string | null;
  tipo_documento: string | null;
  documento_verificado: boolean | null;
}

function capitalizar(s: string | null): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function AlumnosSection() {
  const { cursos } = useCursosAdmin();
  const [nuevas, setNuevas] = useState<PerfilNuevo[] | null>(null);
  const [verAlumno, setVerAlumno] = useState<PerfilNuevo | null>(null);

  useEffect(() => {
    supabase
      .from('perfiles')
      .select('id,nombre,email,rol,creado_en,documento,tipo_documento,documento_verificado')
      .order('creado_en', { ascending: false })
      .then(({ data }) => setNuevas(data || []));
  }, []);

  return (
    <>
      <h1 className="titulo">Alumnos</h1>
      {nuevas === null ? (
        <TableSkeleton cols={6} />
      ) : (
        <DataTable
          contador={`${nuevas.length} cuenta(s)`}
          columns={[
            { key: 'nombre', header: 'Nombre', sortable: true },
            { key: 'email', header: 'Correo', sortable: true },
            {
              key: 'documento',
              header: 'Documento',
              render: (f) => (f.documento ? `${f.tipo_documento || 'DNI'}: ${f.documento}` : '—'),
            },
            {
              key: 'documento_verificado',
              header: 'Verificación',
              render: (f) =>
                f.documento_verificado ? (
                  <span className="tag activo">Verificado con RENIEC</span>
                ) : (
                  <span className="tag canjeado" title="El alumno declaró este nombre por su cuenta; es responsable de su exactitud.">
                    Autodeclarado
                  </span>
                ),
            },
            {
              key: 'rol',
              header: 'Rol',
              sortable: true,
              render: (f) => <span className={`tag ${f.rol === 'admin' ? 'activo' : 'canjeado'}`}>{capitalizar(f.rol)}</span>,
            },
            { key: 'creado_en', header: 'Registrado', sortable: true, render: (f) => (f.creado_en ? new Date(f.creado_en).toLocaleDateString('es-PE') : '') },
          ]}
          rows={nuevas}
          vacio="Aún no hay cuentas nuevas en el aula."
          actions={(f) => (
            <button className="btn sec btn-sm" onClick={() => setVerAlumno(f)}>
              Ver cursos
            </button>
          )}
        />
      )}
      {verAlumno && <VerAlumnoModal alumno={verAlumno} cursos={cursos} onClose={() => setVerAlumno(null)} />}
    </>
  );
}

interface Inscripcion {
  id: number;
  curso_id: number;
  origen: string | null;
}

interface CertificadoAlumno {
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

function VerAlumnoModal({ alumno, cursos, onClose }: { alumno: PerfilNuevo; cursos: { id: number; nombre: string }[]; onClose: () => void }) {
  const [insc, setInsc] = useState<Inscripcion[] | null>(null);
  const [certificados, setCertificados] = useState<CertificadoAlumno[]>([]);
  const [cursoAsignar, setCursoAsignar] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [aQuitar, setAQuitar] = useState<Inscripcion | null>(null);
  const [certCurso, setCertCurso] = useState<{ id: number; nombre: string } | null>(null);
  const [abriendoCert, setAbriendoCert] = useState<number | null>(null);
  const [verificandoCurso, setVerificandoCurso] = useState<number | null>(null);

  async function cargar() {
    const [{ data: dataInsc }, { data: dataCert }] = await Promise.all([
      supabase.from('inscripciones').select('id,curso_id,origen').eq('alumno_id', alumno.id),
      supabase
        .from('certificados')
        .select('id,curso_id,codigo_verificacion,nombre_completo,cargo,fecha,periodo_id,modalidad,drive_digital_url')
        .eq('alumno_uid', alumno.id),
    ]);
    setInsc(dataInsc || []);
    setCertificados((dataCert as CertificadoAlumno[]) || []);
  }
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumno]);

  const cursoNombre = (id: number) => cursos.find((c) => c.id === id)?.nombre || id;

  // Flujo 2 (certificación web): red de seguridad para cuando el alumno ya
  // completó el 100% de tareas/exámenes pero el trigger automático no emitió
  // el certificado. A propósito NO usa el formulario de "Certificados
  // directos" (DNI/cargo/período) — eso crea un certificado modalidad
  // 'directo' y lo mezclaría con la lista de certificación directa. Llama al
  // mismo RPC de red de seguridad que ya usa el alumno desde su aula
  // (CertificadoBanner) y siempre emite modalidad 'evaluado'.
  async function emitirPorCursoCompletado(cursoId: number) {
    setVerificandoCurso(cursoId);
    setAviso(null);
    const { data, error } = await supabase.rpc('intentar_emitir_certificado', { p_curso_id: cursoId, p_alumno_uid: alumno.id });
    setVerificandoCurso(null);
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    if (data?.emitido) {
      cargar();
    } else {
      setAviso(
        `Todavía no completa todas las tareas/exámenes del curso (${data?.completadas ?? 0} de ${data?.total ?? 0}). No se puede emitir por este medio.`
      );
    }
  }

  /** Sube el certificado a Drive si aún no lo estaba (primera vez que se pide) y abre el link. */
  async function verCertificado(cert: CertificadoAlumno, nombreCurso: string | number) {
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
          alumnoNombre: cert.nombre_completo || alumno.nombre || '—',
          cursoNombre: String(nombreCurso),
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
      setAviso(e instanceof Error ? e.message : 'No se pudo abrir el certificado.');
    } finally {
      setAbriendoCert(null);
    }
  }

  async function asignar() {
    const cid = parseInt(cursoAsignar, 10);
    if (!cid) return;
    const { error } = await supabase.from('inscripciones').insert({ alumno_id: alumno.id, curso_id: cid, origen: 'admin' });
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    setCursoAsignar('');
    cargar();
  }

  async function confirmarQuitar() {
    if (!aQuitar) return;
    const { error } = await supabase.from('inscripciones').delete().eq('id', aQuitar.id);
    if (error) {
      setAviso(mensajeError(error));
      setAQuitar(null);
      return;
    }
    setAQuitar(null);
    cargar();
  }

  return (
    <Modal open title={`Cursos de ${alumno.nombre || alumno.email}`} onClose={onClose}>
      {aviso && <div className="aviso err">{aviso}</div>}
      <div>
        {insc === null ? (
          'Cargando…'
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
                    <button
                      className="btn sec btn-sm"
                      type="button"
                      onClick={() => verCertificado(cert, cursoNombre(i.curso_id))}
                      disabled={abriendoCert === cert.id}
                    >
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
      </div>
      <hr />
      <label>Asignar curso manualmente</label>
      <div className="fila">
        <CursoSelector cursos={cursos.map((c) => ({ ...c, categoria_id: null, estado: '1' }))} value={cursoAsignar} onChange={setCursoAsignar} />
        <button className="btn" onClick={asignar}>
          Asignar
        </button>
      </div>
      <ConfirmDialog
        open={!!aQuitar}
        title="¿Quitar este curso del alumno?"
        confirmLabel="Quitar curso"
        onConfirm={confirmarQuitar}
        onCancel={() => setAQuitar(null)}
      />

      {certCurso && (
        <GenerarCertificadoModal
          alumnoUid={alumno.id}
          alumnoDni={alumno.documento}
          alumnoNombre={alumno.nombre}
          cursoId={certCurso.id}
          cursoNombre={certCurso.nombre}
          onClose={() => setCertCurso(null)}
          onEmitido={() => {
            setCertCurso(null);
            cargar();
          }}
        />
      )}
    </Modal>
  );
}
