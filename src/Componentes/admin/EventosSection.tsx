'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';
import CursoSelector from './CursoSelector';
import { useCursosAdmin } from './useCursosAdmin';

interface Evento {
  id: number;
  titulo: string | null;
  contenido: string | null;
  curso_id: number | null;
  link: string | null;
  categoria: string | null;
  estado: string | null;
}

export default function EventosSection() {
  const { cursos } = useCursosAdmin();
  const [filas, setFilas] = useState<Evento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editar, setEditar] = useState<Evento | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  async function cargar() {
    setCargando(true);
    const { data } = await supabase.from('eventos').select('*').order('id', { ascending: false });
    setFilas(data || []);
    setCargando(false);
  }
  useEffect(() => {
    cargar();
  }, []);

  async function borrar(id: number) {
    if (!confirm('¿Borrar evento?')) return;
    await supabase.from('eventos').delete().eq('id', id);
    cargar();
  }

  const cursoNombre = (id: number | null) => cursos.find((c) => c.id === id)?.nombre || (id || 'general');

  return (
    <>
      <div className="barra">
        <h1 className="titulo" style={{ margin: 0 }}>
          Eventos / Anuncios
        </h1>
        <button
          className="btn"
          onClick={() => {
            setEditar(null);
            setModalAbierto(true);
          }}
        >
          + Nuevo
        </button>
      </div>
      {cargando ? (
        <p>Cargando…</p>
      ) : (
        <DataTable
          columns={[
            { key: 'id', header: 'ID' },
            { key: 'titulo', header: 'Título' },
            { key: 'curso', header: 'Curso', render: (f) => String(cursoNombre(f.curso_id)) },
            { key: 'categoria', header: 'Tipo' },
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
      <FormEvento
        open={modalAbierto}
        evento={editar}
        cursos={cursos}
        onClose={() => setModalAbierto(false)}
        onGuardado={() => {
          setModalAbierto(false);
          cargar();
        }}
      />
    </>
  );
}

function FormEvento({
  open,
  evento,
  cursos,
  onClose,
  onGuardado,
}: {
  open: boolean;
  evento: Evento | null;
  cursos: { id: number; nombre: string }[];
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [cursoId, setCursoId] = useState('');
  const [contenido, setContenido] = useState('');

  useEffect(() => {
    if (open) {
      setTitulo(evento?.titulo || '');
      setCursoId(evento?.curso_id ? String(evento.curso_id) : '');
      setContenido(evento?.contenido || '');
    }
  }, [open, evento]);

  async function guardar() {
    if (!titulo.trim()) {
      alert('Escribe el asunto.');
      return;
    }
    const row = {
      titulo: titulo.trim(),
      contenido,
      curso_id: cursoId ? parseInt(cursoId, 10) : null,
      link: evento?.link || null,
      categoria: evento?.categoria || 'anuncio',
      estado: evento?.estado || '1',
      idusu: 'admin',
    };
    const q = evento?.id ? supabase.from('eventos').update(row).eq('id', evento.id) : supabase.from('eventos').insert(row);
    const { error } = await q;
    if (error) {
      alert(error.message);
      return;
    }
    onGuardado();
  }

  return (
    <Modal open={open} title={evento?.id ? 'Editar anuncio' : 'Nuevo anuncio'} onClose={onClose}>
      <label>Asunto</label>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      <label>Curso (opcional)</label>
      <CursoSelector cursos={cursos.map((c) => ({ ...c, categoria_id: null, estado: '1' }))} value={cursoId} onChange={setCursoId} />
      <label>Descripción</label>
      <textarea rows={4} value={contenido} onChange={(e) => setContenido(e.target.value)} />
      <button className="btn bloque" style={{ marginTop: '1rem' }} onClick={guardar}>
        Guardar
      </button>
    </Modal>
  );
}
