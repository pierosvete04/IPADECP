'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';

interface Categoria {
  id: number;
  cat_descripcion: string | null;
  cat_estado: string | null;
}

export default function CategoriasSection() {
  const [filas, setFilas] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editar, setEditar] = useState<Categoria | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  async function cargar() {
    setCargando(true);
    const { data } = await supabase.from('categorias').select('*').order('id');
    setFilas(data || []);
    setCargando(false);
  }
  useEffect(() => {
    cargar();
  }, []);

  function abrir(c: Categoria | null) {
    setEditar(c);
    setModalAbierto(true);
  }

  return (
    <>
      <div className="barra">
        <h1 className="titulo" style={{ margin: 0 }}>
          Categorías
        </h1>
        <button className="btn" onClick={() => abrir(null)}>
          + Nueva categoría
        </button>
      </div>
      {cargando ? (
        <p>Cargando…</p>
      ) : (
        <DataTable
          columns={[
            { key: 'id', header: 'ID' },
            { key: 'cat_descripcion', header: 'Descripción' },
            {
              key: 'estado',
              header: 'Estado',
              render: (f) => (f.cat_estado === '1' ? <span className="tag activo">activa</span> : <span className="tag anulado">inactiva</span>),
            },
          ]}
          rows={filas}
          actions={(f) => (
            <button className="btn sec btn-sm" onClick={() => abrir(f)}>
              Editar
            </button>
          )}
        />
      )}
      <FormCategoria
        open={modalAbierto}
        categoria={editar}
        onClose={() => setModalAbierto(false)}
        onGuardado={() => {
          setModalAbierto(false);
          cargar();
        }}
      />
    </>
  );
}

function FormCategoria({
  open,
  categoria,
  onClose,
  onGuardado,
}: {
  open: boolean;
  categoria: Categoria | null;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [desc, setDesc] = useState('');
  const [estado, setEstado] = useState('1');

  useEffect(() => {
    if (open) {
      setDesc(categoria?.cat_descripcion || '');
      setEstado(categoria?.cat_estado || '1');
    }
  }, [open, categoria]);

  async function guardar() {
    const row = { cat_descripcion: desc.trim(), cat_estado: estado };
    const q = categoria?.id ? supabase.from('categorias').update(row).eq('id', categoria.id) : supabase.from('categorias').insert(row);
    const { error } = await q;
    if (error) {
      alert(error.message);
      return;
    }
    onGuardado();
  }

  return (
    <Modal open={open} title={categoria?.id ? 'Editar categoría' : 'Nueva categoría'} onClose={onClose}>
      <label>Descripción</label>
      <input value={desc} onChange={(e) => setDesc(e.target.value)} />
      <label>Estado</label>
      <select value={estado} onChange={(e) => setEstado(e.target.value)}>
        <option value="1">Activa</option>
        <option value="0">Inactiva</option>
      </select>
      <button className="btn bloque" style={{ marginTop: '1rem' }} onClick={guardar}>
        Guardar
      </button>
    </Modal>
  );
}
