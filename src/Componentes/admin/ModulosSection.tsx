'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';
import ConfirmDialog from '@/Componentes/ui/ConfirmDialog';
import CursoSelector from './CursoSelector';
import { useCursosAdmin } from './useCursosAdmin';

interface ModuloAdmin {
  id: number;
  titulo: string | null;
  linkvideo: string | null;
  archivo: string | null;
  estado: string | null;
}

export default function ModulosSection({ cursoId: cursoIdProp }: { cursoId?: string } = {}) {
  const { cursos } = useCursosAdmin();
  const standalone = cursoIdProp === undefined;
  const [cursoIdState, setCursoIdState] = useState('');
  const cursoId = standalone ? cursoIdState : cursoIdProp;
  const [filas, setFilas] = useState<ModuloAdmin[]>([]);
  const [cargado, setCargado] = useState(false);
  const [editar, setEditar] = useState<ModuloAdmin | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [aBorrar, setABorrar] = useState<ModuloAdmin | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

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

  async function confirmarBorrado() {
    if (!aBorrar) return;
    const { error } = await supabase.from('modulos').delete().eq('id', aBorrar.id);
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
      {standalone && <h1 className="titulo">Módulos</h1>}
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
          + Nuevo módulo
        </button>
      </div>
      {aviso && <div className="aviso err">{aviso}</div>}
      {!cursoId ? (
        <p className="vacio">Elige un curso para ver sus módulos.</p>
      ) : !cargado ? (
        <p>Cargando…</p>
      ) : (
        <DataTable
          columns={[
            { key: 'titulo', header: 'Título' },
            { key: 'video', header: 'Video', render: (f) => (f.linkvideo ? '✔' : '—') },
            { key: 'doc', header: 'Documento', render: (f) => (f.archivo ? '✔' : '—') },
            {
              key: 'estado',
              header: 'Estado',
              render: (f) => (f.estado === '1' ? <span className="tag activo">Activo</span> : <span className="tag anulado">Inactivo</span>),
            },
          ]}
          rows={filas}
          vacio="Aún no hay módulos registrados."
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
      <FormModulo
        open={modalAbierto}
        modulo={editar}
        cursoId={cursoId || ''}
        onClose={() => setModalAbierto(false)}
        onGuardado={() => {
          setModalAbierto(false);
          if (cursoId) cargar(cursoId);
        }}
      />
      <ConfirmDialog
        open={!!aBorrar}
        title={`¿Borrar el módulo "${aBorrar?.titulo}"?`}
        confirmLabel="Borrar módulo"
        onConfirm={confirmarBorrado}
        onCancel={() => setABorrar(null)}
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
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitulo(modulo?.titulo || '');
      setLinkvideo(modulo?.linkvideo || '');
      setArchivo(modulo?.archivo || '');
      setEstado(modulo?.estado || '1');
      setAviso(null);
    }
  }, [open, modulo]);

  async function guardar() {
    const row = { curso_id: parseInt(cursoId, 10), titulo: titulo.trim(), linkvideo: linkvideo.trim(), archivo: archivo.trim(), estado };
    const q = modulo?.id ? supabase.from('modulos').update(row).eq('id', modulo.id) : supabase.from('modulos').insert(row);
    const { error } = await q;
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    onGuardado();
  }

  return (
    <Modal open={open} title={modulo?.id ? 'Editar módulo' : 'Nuevo módulo'} onClose={onClose}>
      {aviso && <div className="aviso err">{aviso}</div>}
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
      <button className="btn bloque" onClick={guardar}>
        {modulo?.id ? 'Guardar cambios' : 'Crear módulo'}
      </button>
    </Modal>
  );
}
