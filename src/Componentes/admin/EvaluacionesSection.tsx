'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';
import CursoSelector from './CursoSelector';
import { useCursosAdmin } from './useCursosAdmin';

interface TareaAdmin {
  id: number;
  titulo: string | null;
  categoria: string | null;
  cantpreg: string | null;
  entrega: string | null;
  estado: string | null;
}

function tipoLabel(f: TareaAdmin) {
  return f.categoria === 'examen' ? 'Examen' : f.cantpreg === 'sin' ? 'Entregable' : 'Autoevaluable';
}

export default function EvaluacionesSection() {
  const { cursos } = useCursosAdmin();
  const [cursoId, setCursoId] = useState('');
  const [filas, setFilas] = useState<TareaAdmin[]>([]);
  const [cargado, setCargado] = useState(false);
  const [editar, setEditar] = useState<TareaAdmin | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [preguntasTarea, setPreguntasTarea] = useState<number | null>(null);

  async function cargar(id: string) {
    const { data } = await supabase.from('tareas').select('*').eq('curso_id', id).order('id');
    setFilas(data || []);
    setCargado(true);
  }

  useEffect(() => {
    if (cursoId) cargar(cursoId);
    else {
      setFilas([]);
      setCargado(false);
    }
  }, [cursoId]);

  async function borrar(id: number) {
    if (!confirm('¿Borrar evaluación y sus preguntas?')) return;
    await supabase.from('tareas').delete().eq('id', id);
    cargar(cursoId);
  }

  return (
    <>
      <h1 className="titulo">Tareas y exámenes</h1>
      <div className="barra">
        <CursoSelector cursos={cursos} value={cursoId} onChange={setCursoId} />
        <button
          className="btn"
          disabled={!cursoId}
          onClick={() => {
            setEditar(null);
            setModalAbierto(true);
          }}
        >
          + Nueva evaluación
        </button>
      </div>
      {!cursoId ? (
        <p className="vacio">Elige un curso.</p>
      ) : !cargado ? (
        <p>Cargando…</p>
      ) : (
        <DataTable
          columns={[
            { key: 'id', header: 'ID' },
            { key: 'titulo', header: 'Título' },
            { key: 'tipo', header: 'Tipo', render: tipoLabel },
            { key: 'cantpreg', header: 'Preguntas' },
            {
              key: 'estado',
              header: 'Estado',
              render: (f) => (f.estado === '1' ? <span className="tag activo">activo</span> : <span className="tag anulado">inactivo</span>),
            },
          ]}
          rows={filas}
          actions={(f) => (
            <>
              {f.cantpreg !== 'sin' && (
                <button className="btn sec btn-sm" onClick={() => setPreguntasTarea(f.id)}>
                  Preguntas
                </button>
              )}{' '}
              <button
                className="btn sec btn-sm"
                onClick={() => {
                  setEditar(f);
                  setModalAbierto(true);
                }}
              >
                Editar
              </button>{' '}
              <button className="btn peligro btn-sm" onClick={() => borrar(f.id)}>
                Borrar
              </button>
            </>
          )}
        />
      )}
      <FormEval
        open={modalAbierto}
        tarea={editar}
        cursoId={cursoId}
        onClose={() => setModalAbierto(false)}
        onGuardado={() => {
          setModalAbierto(false);
          cargar(cursoId);
        }}
      />
      {preguntasTarea != null && <EditorPreguntas tareaId={preguntasTarea} onClose={() => setPreguntasTarea(null)} />}
    </>
  );
}

function FormEval({
  open,
  tarea,
  cursoId,
  onClose,
  onGuardado,
}: {
  open: boolean;
  tarea: TareaAdmin | null;
  cursoId: string;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const tipoActual = tarea?.categoria === 'examen' ? 'examen' : tarea?.cantpreg === 'sin' ? 'entregable' : 'autoeval';
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<'autoeval' | 'examen' | 'entregable'>('autoeval');
  const [consigna, setConsigna] = useState('');
  const [estado, setEstado] = useState('1');

  useEffect(() => {
    if (open) {
      setTitulo(tarea?.titulo || '');
      setTipo(tipoActual as 'autoeval' | 'examen' | 'entregable');
      setConsigna(tarea?.entrega && tarea.entrega !== 'auto' ? tarea.entrega : '');
      setEstado(tarea?.estado || '1');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tarea]);

  async function guardar() {
    const row = {
      curso_id: cursoId,
      titulo: titulo.trim(),
      estado,
      id_usu: 'admin',
      categoria: tipo === 'examen' ? 'examen' : 'tarea',
      cantpreg: tipo === 'entregable' ? 'sin' : tarea?.cantpreg && tarea.cantpreg !== 'sin' ? tarea.cantpreg : '5',
      entrega: tipo === 'entregable' ? consigna.trim() : 'auto',
      tiempo: tipo === 'examen' ? 'sin tiempo' : null,
    };
    const q = tarea?.id ? supabase.from('tareas').update(row).eq('id', tarea.id) : supabase.from('tareas').insert(row);
    const { error } = await q;
    if (error) {
      alert(error.message);
      return;
    }
    onGuardado();
  }

  return (
    <Modal open={open} title={tarea?.id ? 'Editar evaluación' : 'Nueva evaluación'} onClose={onClose}>
      <label>Título</label>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      <label>Tipo</label>
      <select value={tipo} onChange={(e) => setTipo(e.target.value as 'autoeval' | 'examen' | 'entregable')}>
        <option value="autoeval">Tarea autoevaluable (preguntas, 2 intentos)</option>
        <option value="examen">Examen (preguntas)</option>
        <option value="entregable">Tarea entregable (subir PDF)</option>
      </select>
      {tipo === 'entregable' && (
        <div>
          <label>Consigna (URL del archivo a descargar)</label>
          <input value={consigna} onChange={(e) => setConsigna(e.target.value)} />
        </div>
      )}
      <label>Estado</label>
      <select value={estado} onChange={(e) => setEstado(e.target.value)}>
        <option value="1">Activo</option>
        <option value="0">Inactivo</option>
      </select>
      <button className="btn bloque" style={{ marginTop: '1rem' }} onClick={guardar}>
        Guardar
      </button>
      <p className="meta" style={{ color: 'var(--gris)', marginTop: '.6rem' }}>
        Tras crear una evaluación con preguntas, usa el botón &quot;Preguntas&quot; para añadirlas.
      </p>
    </Modal>
  );
}

interface Pregunta {
  id: number;
  titulo: string | null;
}
interface Alternativa {
  id: number;
  titulo: string | null;
  designo: string | null;
  respuesta: string | null;
}

function EditorPreguntas({ tareaId, onClose }: { tareaId: number; onClose: () => void }) {
  const [preguntas, setPreguntas] = useState<{ p: Pregunta; alts: Alternativa[] }[] | null>(null);
  const [nuevaAbierta, setNuevaAbierta] = useState(false);

  async function cargar() {
    const { data: pregs } = await supabase.from('preguntas').select('*').eq('tarea_id', String(tareaId)).eq('estado', '1').order('id');
    const conAlts = await Promise.all(
      (pregs || []).map(async (p) => {
        const { data: alts } = await supabase.from('respuestas').select('*').eq('pregunta_id', String(p.id)).eq('estado', '1').order('designo');
        return { p, alts: alts || [] };
      })
    );
    setPreguntas(conAlts);
  }
  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tareaId]);

  async function borrarPregunta(id: number) {
    if (!confirm('¿Borrar pregunta y sus alternativas?')) return;
    await supabase.from('respuestas').delete().eq('pregunta_id', id);
    await supabase.from('preguntas').delete().eq('id', id);
    cargar();
  }

  return (
    <Modal open title={`Preguntas de la evaluación #${tareaId}`} onClose={onClose}>
      <div className="barra">
        <strong>Preguntas</strong>
        <button className="btn btn-sm" onClick={() => setNuevaAbierta(true)}>
          + Pregunta
        </button>
      </div>
      <div>
        {preguntas === null ? (
          'Cargando…'
        ) : preguntas.length ? (
          preguntas.map(({ p, alts }) => (
            <div className="card card-pad" style={{ marginBottom: '.8rem' }} key={p.id}>
              <div className="barra">
                <strong>{p.titulo}</strong>
                <button className="btn peligro btn-sm" onClick={() => borrarPregunta(p.id)}>
                  Borrar
                </button>
              </div>
              {alts.map((a) => (
                <div className={`alt${a.designo === a.respuesta ? ' correcta' : ''}`} key={a.id}>
                  <span className="letra">{a.designo}</span>
                  <span style={{ flex: 1 }}>{a.titulo}</span>
                  {a.designo === a.respuesta && <span className="tag activo">correcta</span>}
                </div>
              ))}
            </div>
          ))
        ) : (
          <p className="vacio">Sin preguntas.</p>
        )}
      </div>
      {nuevaAbierta && (
        <FormPregunta
          tareaId={tareaId}
          onClose={() => setNuevaAbierta(false)}
          onGuardado={() => {
            setNuevaAbierta(false);
            cargar();
          }}
        />
      )}
    </Modal>
  );
}

const LETRAS = ['a', 'b', 'c', 'd', 'e'];

function FormPregunta({ tareaId, onClose, onGuardado }: { tareaId: number; onClose: () => void; onGuardado: () => void }) {
  const [enunciado, setEnunciado] = useState('');
  const [correcta, setCorrecta] = useState('');
  const [alts, setAlts] = useState<Record<string, string>>({});

  async function guardar() {
    if (!enunciado.trim() || !correcta) {
      alert('Escribe el enunciado y marca la alternativa correcta.');
      return;
    }
    const { data: p, error } = await supabase.from('preguntas').insert({ tarea_id: String(tareaId), titulo: enunciado.trim(), ide: 'admin', estado: '1' }).select('id').single();
    if (error) {
      alert(error.message);
      return;
    }
    const filas = LETRAS.filter((l) => alts[l]?.trim()).map((l) => ({
      pregunta_id: String(p.id),
      tarea_id: String(tareaId),
      titulo: alts[l].trim(),
      designo: l,
      respuesta: correcta,
      ide: 'admin',
      estado: '1',
    }));
    if (filas.length) {
      const { error: e2 } = await supabase.from('respuestas').insert(filas);
      if (e2) {
        alert(e2.message);
        return;
      }
    }
    onGuardado();
  }

  return (
    <Modal open title="Nueva pregunta" onClose={onClose}>
      <label>Enunciado</label>
      <textarea rows={2} value={enunciado} onChange={(e) => setEnunciado(e.target.value)} />
      <label>Alternativas (marca la correcta)</label>
      {LETRAS.map((l) => (
        <div className="fila" style={{ marginBottom: '.3rem' }} key={l}>
          <input type="radio" name="correcta" value={l} checked={correcta === l} onChange={() => setCorrecta(l)} style={{ width: 'auto' }} />
          <span className="letra">{l}</span>
          <input
            placeholder={`Texto de la alternativa ${l}`}
            style={{ flex: 1 }}
            value={alts[l] || ''}
            onChange={(e) => setAlts((prev) => ({ ...prev, [l]: e.target.value }))}
          />
        </div>
      ))}
      <button className="btn bloque" style={{ marginTop: '1rem' }} onClick={guardar}>
        Guardar pregunta
      </button>
    </Modal>
  );
}
