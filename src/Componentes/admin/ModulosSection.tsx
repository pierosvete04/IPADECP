'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';
import CursoSelector from './CursoSelector';
import { useCursosAdmin } from './useCursosAdmin';

interface ModuloAdmin {
  id: number;
  titulo: string | null;
  linkvideo: string | null;
  archivo: string | null;
  estado: string | null;
}

export default function ModulosSection() {
  const { cursos } = useCursosAdmin();
  const [cursoId, setCursoId] = useState('');
  const [filas, setFilas] = useState<ModuloAdmin[]>([]);
  const [cargado, setCargado] = useState(false);
  const [editar, setEditar] = useState<ModuloAdmin | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  async function cargar(id: string) {
    const { data } = await supabase.from('modulos').select('*').eq('curso_id', id).order('id');
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
    if (!confirm('¿Borrar módulo?')) return;
    await supabase.from('modulos').delete().eq('id', id);
    cargar(cursoId);
  }

  return (
    <>
      <h1 className="titulo">Módulos</h1>
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
          + Nuevo módulo
        </button>
      </div>
      {!cursoId ? (
        <p className="vacio">Elige un curso para ver sus módulos.</p>
      ) : !cargado ? (
        <p>Cargando…</p>
      ) : (
        <DataTable
          columns={[
            { key: 'id', header: 'ID' },
            { key: 'titulo', header: 'Título' },
            { key: 'video', header: 'Video', render: (f) => (f.linkvideo ? '✔' : '—') },
            { key: 'doc', header: 'Documento', render: (f) => (f.archivo ? '✔' : '—') },
            {
              key: 'estado',
              header: 'Estado',
              render: (f) => (f.estado === '1' ? <span className="tag activo">activo</span> : <span className="tag anulado">inactivo</span>),
            },
          ]}
          rows={filas}
          actions={(f) => (
            <>
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
      <FormModulo
        open={modalAbierto}
        modulo={editar}
        cursoId={cursoId}
        onClose={() => setModalAbierto(false)}
        onGuardado={() => {
          setModalAbierto(false);
          cargar(cursoId);
        }}
      />
    </>
  );
}

function FormModulo({
  open,
  modulo,
  cursoId,
  onClose,
  onGuardado,
}: {
  open: boolean;
  modulo: ModuloAdmin | null;
  cursoId: string;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [linkvideo, setLinkvideo] = useState('');
  const [archivo, setArchivo] = useState('');
  const [estado, setEstado] = useState('1');

  useEffect(() => {
    if (open) {
      setTitulo(modulo?.titulo || '');
      setLinkvideo(modulo?.linkvideo || '');
      setArchivo(modulo?.archivo || '');
      setEstado(modulo?.estado || '1');
    }
  }, [open, modulo]);

  async function guardar() {
    const row = { curso_id: parseInt(cursoId, 10), titulo: titulo.trim(), linkvideo: linkvideo.trim(), archivo: archivo.trim(), estado };
    const q = modulo?.id ? supabase.from('modulos').update(row).eq('id', modulo.id) : supabase.from('modulos').insert(row);
    const { error } = await q;
    if (error) {
      alert(error.message);
      return;
    }
    onGuardado();
  }

  return (
    <Modal open={open} title={modulo?.id ? 'Editar módulo' : 'Nuevo módulo'} onClose={onClose}>
      <label>Título</label>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      <label>Link de video (clases grabadas)</label>
      <input value={linkvideo} onChange={(e) => setLinkvideo(e.target.value)} />
      <label>Archivo / documento (URL)</label>
      <input value={archivo} onChange={(e) => setArchivo(e.target.value)} />
      <label>Estado</label>
      <select value={estado} onChange={(e) => setEstado(e.target.value)}>
        <option value="1">Activo</option>
        <option value="0">Inactivo</option>
      </select>
      <button className="btn bloque" style={{ marginTop: '1rem' }} onClick={guardar}>
        Guardar
      </button>
    </Modal>
  );
}
