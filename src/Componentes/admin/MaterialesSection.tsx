'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';
import ConfirmDialog from '@/Componentes/ui/ConfirmDialog';
import CursoSelector from './CursoSelector';
import { useCursosAdmin } from './useCursosAdmin';

interface MaterialAdmin {
  id: number;
  nombremat: string | null;
  archivo: string | null;
  descrip: string | null;
  estado: string | null;
}

export default function MaterialesSection({ cursoId: cursoIdProp }: { cursoId?: string } = {}) {
  const { cursos } = useCursosAdmin();
  const standalone = cursoIdProp === undefined;
  const [cursoIdState, setCursoIdState] = useState('');
  const cursoId = standalone ? cursoIdState : cursoIdProp;
  const [filas, setFilas] = useState<MaterialAdmin[]>([]);
  const [cargado, setCargado] = useState(false);
  const [editar, setEditar] = useState<MaterialAdmin | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [aBorrar, setABorrar] = useState<MaterialAdmin | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

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

  async function confirmarBorrado() {
    if (!aBorrar) return;
    const { error } = await supabase.from('materiales').delete().eq('id', aBorrar.id);
    if (error) {
      setAviso(mensajeError(error));
      setABorrar(null);
      return;
    }
    setABorrar(null);
    if (cursoId) cargar(cursoId);
  }

  return (
    <>
      {standalone && <h1 className="titulo">Materiales</h1>}
      <div className="barra">
        {standalone && <CursoSelector cursos={cursos} value={cursoIdState} onChange={setCursoIdState} />}
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
      {aviso && <div className="aviso err">{aviso}</div>}
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
              render: (f) => (f.estado === '1' ? <span className="tag activo">Activo</span> : <span className="tag anulado">Inactivo</span>),
            },
          ]}
          rows={filas}
          vacio="Aún no hay materiales registrados."
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
      <FormMaterial
        open={modalAbierto}
        material={editar}
        cursoId={cursoId || ''}
        onClose={() => setModalAbierto(false)}
        onGuardado={() => {
          setModalAbierto(false);
          if (cursoId) cargar(cursoId);
        }}
      />
      <ConfirmDialog
        open={!!aBorrar}
        title={`¿Borrar el material "${aBorrar?.nombremat}"?`}
        confirmLabel="Borrar material"
        onConfirm={confirmarBorrado}
        onCancel={() => setABorrar(null)}
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
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNombre(material?.nombremat || '');
      setArchivo(material?.archivo || '');
      setDescrip(material?.descrip || '');
      setEstado(material?.estado || '1');
      setAviso(null);
    }
  }, [open, material]);

  async function guardar() {
    const row = { curso_id: cursoId, nombremat: nombre.trim(), archivo: archivo.trim(), descrip, estado };
    const q = material?.id ? supabase.from('materiales').update(row).eq('id', material.id) : supabase.from('materiales').insert(row);
    const { error } = await q;
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    onGuardado();
  }

  return (
    <Modal open={open} title={material?.id ? 'Editar material' : 'Nuevo material'} onClose={onClose}>
      {aviso && <div className="aviso err">{aviso}</div>}
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
      <button className="btn bloque" onClick={guardar}>
        {material?.id ? 'Guardar cambios' : 'Crear material'}
      </button>
    </Modal>
  );
}
