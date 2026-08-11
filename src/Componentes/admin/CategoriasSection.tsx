'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';
import Aviso from '@/Componentes/ui/Aviso';
import EstadoCarga from './EstadoCarga';
import { useCargaDatos, datosDe } from './useCargaDatos';

interface Categoria {
  id: number;
  cat_descripcion: string | null;
  cat_estado: string | null;
}

export default function CategoriasSection() {
  const {
    datos: filas,
    error,
    cargando,
    recargar,
  } = useCargaDatos(() => datosDe<Categoria>(supabase.from('categorias').select('*').order('id')));
  const [editar, setEditar] = useState<Categoria | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  function abrir(c: Categoria | null) {
    setEditar(c);
    setModalAbierto(true);
  }

  return (
    <>
      <div className="cabecera-seccion">
        <h1 className="titulo">Categorías</h1>
        <button className="btn" onClick={() => abrir(null)}>
          + Nueva categoría
        </button>
      </div>
      <p className="sub">
        Agrupan los cursos en el catálogo público y en el aula. Un curso sin categoría no aparece en la navegación por
        áreas.
      </p>
      <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} cols={4}>
        <DataTable
          entidad={['categoría', 'categorías']}
          columns={[
            { key: 'id', header: 'ID', align: 'right' },
            { key: 'cat_descripcion', header: 'Descripción' },
            {
              key: 'estado',
              header: 'Estado',
              render: (f) => (f.cat_estado === '1' ? <span className="tag activo">Activa</span> : <span className="tag anulado">Inactiva</span>),
            },
          ]}
          rows={filas || []}
          vacio="Las categorías agrupan los cursos en el catálogo. Crea la primera para empezar a clasificarlos."
          vacioAccion={
            <button className="btn btn-sm" onClick={() => abrir(null)}>
              Crear la primera categoría
            </button>
          }
          actions={(f) => (
            <button className="btn sec btn-sm" onClick={() => abrir(f)}>
              Editar
            </button>
          )}
        />
      </EstadoCarga>
      <FormCategoria
        open={modalAbierto}
        categoria={editar}
        onClose={() => setModalAbierto(false)}
        onGuardado={() => {
          setModalAbierto(false);
          recargar();
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
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setDesc(categoria?.cat_descripcion || '');
      setEstado(categoria?.cat_estado || '1');
      setAviso(null);
      setGuardando(false);
    }
  }, [open, categoria]);

  async function guardar() {
    // La descripción es lo único que identifica a la categoría en el
    // catálogo: guardarla vacía dejaba una fila sin nombre que después no se
    // podía distinguir de las demás en el desplegable del curso.
    if (!desc.trim()) {
      setAviso('Escribe la descripción de la categoría.');
      return;
    }
    setGuardando(true);
    setAviso(null);
    const row = { cat_descripcion: desc.trim(), cat_estado: estado };
    const q = categoria?.id ? supabase.from('categorias').update(row).eq('id', categoria.id) : supabase.from('categorias').insert(row);
    const { error } = await q;
    setGuardando(false);
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    onGuardado();
  }

  return (
    <Modal open={open} title={categoria?.id ? 'Editar categoría' : 'Nueva categoría'} onClose={onClose}>
      <Aviso mensaje={aviso} />
      <label htmlFor="cat-desc">Descripción</label>
      <input
        id="cat-desc"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Ej: Enfermería"
        aria-invalid={!!aviso || undefined}
      />
      <label htmlFor="cat-estado" style={{ marginTop: '.6rem' }}>
        Estado
      </label>
      <select id="cat-estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
        <option value="1">Activa</option>
        <option value="0">Inactiva</option>
      </select>
      <button className="btn bloque" onClick={guardar} disabled={guardando}>
        {guardando ? 'Guardando…' : categoria?.id ? 'Guardar cambios' : 'Crear categoría'}
      </button>
    </Modal>
  );
}
