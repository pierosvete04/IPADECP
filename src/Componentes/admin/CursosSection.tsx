'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatSoles, mensajeError } from '@/lib/copy';
import DataTable from '@/Componentes/ui/DataTable';
import { TableSkeleton } from '@/Componentes/admin/table/TableSkeleton';
import ConfirmDialog from '@/Componentes/ui/ConfirmDialog';
import CourseArt from '@/Componentes/ui/CourseArt';
import CursoEditor, { type CursoFull } from './curso/CursoEditor';

interface Categoria {
  id: number;
  cat_descripcion: string | null;
}

const POR_PAGINA = 15;

export default function CursosSection() {
  const [todos, setTodos] = useState<CursoFull[]>([]);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [vista, setVista] = useState<{ tipo: 'lista' } | { tipo: 'editor'; curso: CursoFull | null }>({ tipo: 'lista' });
  const [aBorrar, setABorrar] = useState<CursoFull | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    const { data: catsData } = await supabase.from('categorias').select('id,cat_descripcion');
    setCats(catsData || []);
    const { data } = await supabase.from('cursos').select('*').order('id', { ascending: false });
    setTodos(data || []);
    setCargando(false);
  }
  useEffect(() => {
    cargar();
  }, []);

  const catName = (id: number | null) => cats.find((c) => c.id === id)?.cat_descripcion || '—';

  async function toggle(c: CursoFull) {
    const nuevoEstado = c.estado === '1' ? '0' : '1';
    const { error } = await supabase.from('cursos').update({ estado: nuevoEstado }).eq('id', c.id);
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    setTodos((prev) => prev.map((x) => (x.id === c.id ? { ...x, estado: nuevoEstado } : x)));
  }

  async function confirmarBorrado() {
    if (!aBorrar) return;
    const { error } = await supabase.rpc('borrar_curso', { p_id: aBorrar.id });
    if (error) {
      setAviso(mensajeError(error));
      setABorrar(null);
      return;
    }
    setTodos((prev) => prev.filter((x) => x.id !== aBorrar.id));
    setABorrar(null);
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return todos;
    return todos.filter((c) => c.nombre.toLowerCase().includes(q));
  }, [todos, busqueda]);

  const totalPag = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPag);
  const pageItems = filtrados.slice((paginaSegura - 1) * POR_PAGINA, (paginaSegura - 1) * POR_PAGINA + POR_PAGINA);

  if (vista.tipo === 'editor') {
    return (
      <CursoEditor
        curso={vista.curso}
        cats={cats}
        onVolver={() => {
          setVista({ tipo: 'lista' });
          cargar();
        }}
        onGuardado={cargar}
      />
    );
  }

  return (
    <>
      <div className="barra">
        <h1 className="titulo">Cursos</h1>
        <button className="btn" onClick={() => setVista({ tipo: 'editor', curso: null })}>
          + Nuevo curso
        </button>
      </div>
      <div className="fila" style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Buscar curso por nombre…"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setPagina(1);
          }}
          style={{ maxWidth: 320 }}
        />
      </div>
      {aviso && <div className="aviso err">{aviso}</div>}
      {cargando ? (
        <TableSkeleton cols={6} />
      ) : (
        <DataTable
          columns={[
            {
              key: 'nombre',
              header: 'Curso',
              render: (f) => (
                <div className="fila" style={{ gap: '.6rem', alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                    <CourseArt id={f.id} nombre={f.nombre} img={f.img} />
                  </div>
                  <span>{f.nombre}</span>
                </div>
              ),
            },
            { key: 'categoria', header: 'Categoría', render: (f) => catName(f.categoria_id) },
            { key: 'precio', header: 'Precio', render: (f) => (f.precio_ahora ? formatSoles(f.precio_ahora) : '—') },
            { key: 'tipo', header: 'Tipo', render: (f) => (f.tipo_curso === 'premium' ? 'Premium' : 'Estándar') },
            {
              key: 'catalogo',
              header: 'Catálogo',
              render: (f) => (f.mostrar_en_catalogo === false ? <span className="tag anulado">Oculto</span> : <span className="tag activo">Visible</span>),
            },
            {
              key: 'estado',
              header: 'Estado',
              render: (f) => (f.estado === '1' ? <span className="tag activo">Activo</span> : <span className="tag anulado">Inactivo</span>),
            },
          ]}
          rows={pageItems}
          vacio={busqueda ? 'Ningún curso coincide con la búsqueda.' : 'Aún no hay cursos.'}
          actions={(f) => (
            <>
              <button className="btn sec btn-sm" onClick={() => setVista({ tipo: 'editor', curso: f })}>
                Editar
              </button>{' '}
              <button className="btn sec btn-sm" onClick={() => toggle(f)}>
                {f.estado === '1' ? 'Desactivar' : 'Activar'}
              </button>{' '}
              <button className="btn peligro btn-sm" onClick={() => setABorrar(f)}>
                Borrar
              </button>
            </>
          )}
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
      <ConfirmDialog
        open={!!aBorrar}
        title={`¿Borrar el curso "${aBorrar?.nombre}"?`}
        body="Esto elimina sus módulos, materiales, tareas/exámenes, inscripciones y ventas. No se puede deshacer."
        confirmLabel="Borrar curso"
        onConfirm={confirmarBorrado}
        onCancel={() => setABorrar(null)}
      />
    </>
  );
}
