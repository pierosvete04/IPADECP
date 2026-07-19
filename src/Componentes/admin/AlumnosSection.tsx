'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';
import CursoSelector from './CursoSelector';
import { useCursosAdmin } from './useCursosAdmin';

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

interface AlumnoHistorico {
  id_usuario: number;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  doc: string | null;
  rol: string | null;
  estado: string | null;
  fecha: string | null;
}

const POR_PAG = 25;

function EstadoTag({ estado }: { estado: string | null }) {
  if (estado === 'conf') return <span className="tag activo">confirmado</span>;
  if (estado === 'sinconf') return <span className="tag canjeado">sin confirmar</span>;
  return <span className="tag canjeado">{estado}</span>;
}

export default function AlumnosSection() {
  const { cursos } = useCursosAdmin();
  const [nuevas, setNuevas] = useState<PerfilNuevo[] | null>(null);
  const [historico, setHistorico] = useState<AlumnoHistorico[] | null>(null);
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'conf' | 'sinconf'>('todos');
  const [pagina, setPagina] = useState(1);
  const [verAlumno, setVerAlumno] = useState<PerfilNuevo | null>(null);

  useEffect(() => {
    supabase
      .from('perfiles')
      .select('id,nombre,email,rol,creado_en,documento,tipo_documento,documento_verificado')
      .order('creado_en', { ascending: false })
      .then(({ data }) => setNuevas(data || []));
    supabase
      .from('historico_alumnos')
      .select('id_usuario,nombre,email,telefono,doc,rol,estado,fecha')
      .neq('rol', 'administrador')
      .neq('rol', 'profesor')
      .order('id_usuario', { ascending: false })
      .then(({ data }) => setHistorico(data || []));
  }, []);

  const filtrado = useMemo(() => {
    let rows = historico || [];
    if (filtro !== 'todos') rows = rows.filter((a) => a.estado === filtro);
    const q = buscar.toLowerCase().trim();
    if (q) rows = rows.filter((a) => [a.nombre, a.email, a.doc, a.telefono].some((v) => (v || '').toLowerCase().includes(q)));
    return rows;
  }, [historico, filtro, buscar]);

  const totalPag = Math.max(1, Math.ceil(filtrado.length / POR_PAG));
  const paginaSegura = Math.min(pagina, totalPag);
  const slice = filtrado.slice((paginaSegura - 1) * POR_PAG, (paginaSegura - 1) * POR_PAG + POR_PAG);
  const confirmados = (historico || []).filter((a) => a.estado === 'conf').length;

  return (
    <>
      <h1 className="titulo">Alumnos</h1>
      <h2 className="titulo" style={{ fontSize: '1.1rem' }}>
        Cuentas del aula (nuevas)
      </h2>
      {nuevas === null ? (
        <p>Cargando…</p>
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
                  <span className="tag activo">verificado con RENIEC</span>
                ) : (
                  <span className="tag canjeado" title="El alumno declaró este nombre por su cuenta; es responsable de su exactitud.">
                    autodeclarado
                  </span>
                ),
            },
            { key: 'rol', header: 'Rol', sortable: true, render: (f) => <span className={`tag ${f.rol === 'admin' ? 'activo' : 'canjeado'}`}>{f.rol}</span> },
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

      <h2 className="titulo" style={{ fontSize: '1.1rem', marginTop: '1.6rem' }}>
        Alumnos registrados (histórico)
      </h2>
      <div className="barra">
        <div className="fila">
          <input
            placeholder="Buscar por nombre, correo o documento…"
            style={{ minWidth: 280 }}
            value={buscar}
            onChange={(e) => {
              setBuscar(e.target.value);
              setPagina(1);
            }}
          />
          <select
            style={{ width: 'auto' }}
            value={filtro}
            onChange={(e) => {
              setFiltro(e.target.value as 'todos' | 'conf' | 'sinconf');
              setPagina(1);
            }}
          >
            <option value="todos">Todos los estados</option>
            <option value="conf">Confirmados</option>
            <option value="sinconf">Sin confirmar</option>
          </select>
        </div>
        <span className="meta" style={{ color: 'var(--gris)' }}>
          {filtrado.length} alumno(s) • {confirmados} confirmados en total
        </span>
      </div>
      {historico === null ? (
        <p>Cargando…</p>
      ) : (
        <DataTable
          columns={[
            { key: 'id_usuario', header: 'ID', sortable: true },
            { key: 'nombre', header: 'Nombre', sortable: true },
            { key: 'email', header: 'Correo', sortable: true },
            { key: 'telefono', header: 'Teléfono' },
            { key: 'doc', header: 'Documento' },
            { key: 'fecha', header: 'Fecha registro', sortable: true, render: (f) => f.fecha || '—' },
            { key: 'estado', header: 'Estado', sortable: true, render: (f) => <EstadoTag estado={f.estado} /> },
          ]}
          rows={slice.map((f) => ({ ...f, id: f.id_usuario }))}
          vacio="Sin resultados para esa búsqueda."
        />
      )}
      {totalPag > 1 && (
        <div className="fila" style={{ justifyContent: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
          <button className="btn sec btn-sm" disabled={paginaSegura === 1} onClick={() => setPagina(paginaSegura - 1)}>
            ‹
          </button>
          <span className="pag-info">
            Página {paginaSegura} de {totalPag}
          </span>
          <button className="btn sec btn-sm" disabled={paginaSegura === totalPag} onClick={() => setPagina(paginaSegura + 1)}>
            ›
          </button>
        </div>
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

function VerAlumnoModal({ alumno, cursos, onClose }: { alumno: PerfilNuevo; cursos: { id: number; nombre: string }[]; onClose: () => void }) {
  const [insc, setInsc] = useState<Inscripcion[] | null>(null);
  const [cursoAsignar, setCursoAsignar] = useState('');

  async function cargar() {
    const { data } = await supabase.from('inscripciones').select('id,curso_id,origen').eq('alumno_id', alumno.id);
    setInsc(data || []);
  }
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumno]);

  const cursoNombre = (id: number) => cursos.find((c) => c.id === id)?.nombre || id;

  async function asignar() {
    const cid = parseInt(cursoAsignar, 10);
    if (!cid) return;
    const { error } = await supabase.from('inscripciones').insert({ alumno_id: alumno.id, curso_id: cid, origen: 'admin' });
    if (error) {
      alert(error.message);
      return;
    }
    setCursoAsignar('');
    cargar();
  }

  async function quitar(id: number) {
    await supabase.from('inscripciones').delete().eq('id', id);
    cargar();
  }

  return (
    <Modal open title={`Cursos de ${alumno.nombre || alumno.email}`} onClose={onClose}>
      <div>
        {insc === null ? (
          'Cargando…'
        ) : insc.length ? (
          insc.map((i) => (
            <div className="eval" key={i.id}>
              <span style={{ flex: 1 }}>
                {cursoNombre(i.curso_id)} <span className="tag canjeado">{i.origen}</span>
              </span>
              <button className="btn peligro btn-sm" onClick={() => quitar(i.id)}>
                Quitar
              </button>
            </div>
          ))
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
    </Modal>
  );
}
