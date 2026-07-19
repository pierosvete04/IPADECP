'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';
import CursoSelector from './CursoSelector';
import { useCursosAdmin } from './useCursosAdmin';

interface MaterialAdmin {
  id: number;
  nombremat: string | null;
  archivo: string | null;
  descrip: string | null;
  estado: string | null;
}

export default function MaterialesSection() {
  const { cursos } = useCursosAdmin();
  const [cursoId, setCursoId] = useState('');
  const [filas, setFilas] = useState<MaterialAdmin[]>([]);
  const [cargado, setCargado] = useState(false);
  const [editar, setEditar] = useState<MaterialAdmin | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  async function cargar(id: string) {
    const { data } = await supabase.from('materiales').select('*').eq('curso_id', id).order('id');
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
    if (!confirm('¿Borrar material?')) return;
    await supabase.from('materiales').delete().eq('id', id);
    cargar(cursoId);
  }

  return (
    <>
      <h1 className="titulo">Materiales</h1>
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
          + Nuevo material
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
            { key: 'nombremat', header: 'Nombre' },
            {
              key: 'archivo',
              header: 'Archivo',
              render: (f) =>
                f.archivo ? (
                  <a target="_blank" rel="noreferrer" href={f.archivo}>
                    ver
                  </a>
                ) : (
                  '—'
                ),
            },
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
      <FormMaterial
        open={modalAbierto}
        material={editar}
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

function FormMaterial({
  open,
  material,
  cursoId,
  onClose,
  onGuardado,
}: {
  open: boolean;
  material: MaterialAdmin | null;
  cursoId: string;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [archivo, setArchivo] = useState('');
  const [descrip, setDescrip] = useState('');
  const [estado, setEstado] = useState('1');

  useEffect(() => {
    if (open) {
      setNombre(material?.nombremat || '');
      setArchivo(material?.archivo || '');
      setDescrip(material?.descrip || '');
      setEstado(material?.estado || '1');
    }
  }, [open, material]);

  async function guardar() {
    const row = { curso_id: cursoId, nombremat: nombre.trim(), archivo: archivo.trim(), descrip, estado };
    const q = material?.id ? supabase.from('materiales').update(row).eq('id', material.id) : supabase.from('materiales').insert(row);
    const { error } = await q;
    if (error) {
      alert(error.message);
      return;
    }
    onGuardado();
  }

  return (
    <Modal open={open} title={material?.id ? 'Editar material' : 'Nuevo material'} onClose={onClose}>
      <label>Nombre</label>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <label>Archivo (URL o enlace de Drive)</label>
      <input value={archivo} onChange={(e) => setArchivo(e.target.value)} />
      <label>Descripción</label>
      <textarea rows={3} value={descrip} onChange={(e) => setDescrip(e.target.value)} />
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
