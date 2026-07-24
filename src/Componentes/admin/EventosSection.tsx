'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';
import ConfirmDialog from '@/Componentes/ui/ConfirmDialog';
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
  const [aBorrar, setABorrar] = useState<Evento | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    const { data } = await supabase.from('eventos').select('*').order('id', { ascending: false });
    setFilas(data || []);
    setCargando(false);
  }
  useEffect(() => {
    cargar();
  }, []);

  async function confirmarBorrado() {
    if (!aBorrar) return;
    const { error } = await supabase.from('eventos').delete().eq('id', aBorrar.id);
    if (error) {
      setAviso(mensajeError(error));
      setABorrar(null);
      return;
    }
    setABorrar(null);
    cargar();
  }

  const cursoNombre = (id: number | null) => cursos.find((c) => c.id === id)?.nombre || (id || 'general');

  return (
    <>
      <div className="barra">
        <h1 className="titulo">
          Eventos / Anuncios
        </h1>
        <button
          className="btn"
          onClick={() => {
            setEditar(null);
            setModalAbierto(true);
          }}
        >
          + Nuevo evento
        </button>
      </div>
      {aviso && <div className="aviso err">{aviso}</div>}
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
              render: (f) => (f.estado === '1' ? <span className="tag activo">Activo</span> : <span className="tag anulado">Inactivo</span>),
            },
          ]}
          rows={filas}
          vacio="Aún no hay eventos registrados."
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
              <button className="btn peligro btn-sm" onClick={() => setABorrar(f)}>
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
      <ConfirmDialog
        open={!!aBorrar}
        title={`¿Borrar el evento "${aBorrar?.titulo}"?`}
        confirmLabel="Borrar evento"
        onConfirm={confirmarBorrado}
        onCancel={() => setABorrar(null)}
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
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitulo(evento?.titulo || '');
      setCursoId(evento?.curso_id ? String(evento.curso_id) : '');
      setContenido(evento?.contenido || '');
      setAviso(null);
    }
  }, [open, evento]);

  async function guardar() {
    if (!titulo.trim()) {
      setAviso('Escribe el título.');
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
      setAviso(mensajeError(error));
      return;
    }
    onGuardado();
  }

  return (
    <Modal open={open} title={evento?.id ? 'Editar evento' : 'Nuevo evento'} onClose={onClose}>
      {aviso && <div className="aviso err">{aviso}</div>}
      <label>Título</label>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      <label>Curso (opcional)</label>
      <CursoSelector cursos={cursos.map((c) => ({ ...c, categoria_id: null, estado: '1' }))} value={cursoId} onChange={setCursoId} />
      <label>Descripción</label>
      <textarea rows={4} value={contenido} onChange={(e) => setContenido(e.target.value)} />
      <button className="btn bloque" onClick={guardar}>
        {evento?.id ? 'Guardar cambios' : 'Crear evento'}
      </button>
    </Modal>
  );
}
