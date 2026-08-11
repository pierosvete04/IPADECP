'use client';

import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatSoles, mensajeError } from '@/lib/copy';
import DataTable from '@/Componentes/ui/DataTable';
import ConfirmDialog from '@/Componentes/ui/ConfirmDialog';
import Aviso from '@/Componentes/ui/Aviso';
import CourseArt from '@/Componentes/ui/CourseArt';
import CursoEditor, { type CursoFull } from './curso/CursoEditor';
import EstadoCarga from './EstadoCarga';
import { useCargaDatos, datosDe } from './useCargaDatos';

interface Categoria {
  id: number;
  cat_descripcion: string | null;
}

export default function CursosSection() {
  const [busqueda, setBusqueda] = useState('');
  const [vista, setVista] = useState<{ tipo: 'lista' } | { tipo: 'editor'; curso: CursoFull | null }>({ tipo: 'lista' });
  const [aBorrar, setABorrar] = useState<CursoFull | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const { datos, error, cargando, recargar, setDatos } = useCargaDatos(async () => {
    const [cats, cursos] = await Promise.all([
      datosDe<Categoria>(supabase.from('categorias').select('id,cat_descripcion')),
      datosDe<CursoFull>(supabase.from('cursos').select('*').order('id', { ascending: false })),
    ]);
    return { cats, cursos };
  });

  const cats = datos?.cats ?? [];
  const todos = useMemo(() => datos?.cursos ?? [], [datos]);
  const catName = (id: number | null) => cats.find((c) => c.id === id)?.cat_descripcion || '—';

  /** Reemplaza los cursos en memoria sin volver a pedir toda la lista. */
  function actualizarCursos(fn: (prev: CursoFull[]) => CursoFull[]) {
    setDatos((prev) => (prev ? { ...prev, cursos: fn(prev.cursos) } : prev));
  }

  async function toggle(c: CursoFull) {
    const nuevoEstado = c.estado === '1' ? '0' : '1';
    const { error: eToggle } = await supabase.from('cursos').update({ estado: nuevoEstado }).eq('id', c.id);
    if (eToggle) {
      setAviso(mensajeError(eToggle));
      return;
    }
    setAviso(null);
    actualizarCursos((prev) => prev.map((x) => (x.id === c.id ? { ...x, estado: nuevoEstado } : x)));
  }

  async function confirmarBorrado(): Promise<string | void> {
    if (!aBorrar) return;
    const { error: eBorrado } = await supabase.rpc('borrar_curso', { p_id: aBorrar.id });
    if (eBorrado) return mensajeError(eBorrado);
    actualizarCursos((prev) => prev.filter((x) => x.id !== aBorrar.id));
    setABorrar(null);
  }

  const q = busqueda.trim().toLowerCase();
  const filtrados = useMemo(() => (q ? todos.filter((c) => c.nombre.toLowerCase().includes(q)) : todos), [todos, q]);

  if (vista.tipo === 'editor') {
    return (
      <CursoEditor
        curso={vista.curso}
        cats={cats}
        onVolver={() => {
          setVista({ tipo: 'lista' });
          recargar();
        }}
        onGuardado={recargar}
      />
    );
  }

  return (
    <>
      <div className="cabecera-seccion">
        <h1 className="titulo">Cursos</h1>
        <button className="btn" onClick={() => setVista({ tipo: 'editor', curso: null })}>
          + Nuevo curso
        </button>
      </div>
      <p className="sub">Catálogo completo. Un curso inactivo no se vende ni se ve en el aula, aunque conserve sus alumnos.</p>
      <Aviso mensaje={aviso} />
      <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} cols={7}>
        {/* La paginación es la de DataTable y solo la de DataTable. Antes esta
            pantalla recortaba la lista a 15 ANTES de pasarla, y DataTable
            volvía a paginar ese recorte: el pie decía "15 cursos" habiendo 80,
            y el pie propio de abajo contradecía al de la tabla. */}
        <DataTable
          entidad={['curso', 'cursos']}
          encabezadoExtra={
            <div className="filtros">
              <div>
                <label className="campo-label" htmlFor="buscar-curso">
                  Buscar
                </label>
                <input
                  id="buscar-curso"
                  className="campo-ancho"
                  type="search"
                  placeholder="Nombre del curso…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </div>
          }
          columns={[
            {
              key: 'nombre',
              header: 'Curso',
              sortable: true,
              render: (f) => (
                <div className="fila" style={{ gap: '.6rem', alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                    <CourseArt id={f.id} nombre={f.nombre} img={f.img} />
                  </div>
                  <span className="celda-corta" title={f.nombre}>
                    {f.nombre}
                  </span>
                </div>
              ),
            },
            { key: 'categoria', header: 'Categoría', render: (f) => catName(f.categoria_id) },
            { key: 'precio_ahora', header: 'Precio', align: 'right', sortable: true, render: (f) => (f.precio_ahora ? formatSoles(f.precio_ahora) : '—') },
            { key: 'tipo', header: 'Tipo', render: (f) => (f.tipo_curso === 'premium' ? 'Premium' : 'Estándar') },
            {
              key: 'catalogo',
              header: 'Catálogo',
              render: (f) => (f.mostrar_en_catalogo === false ? <span className="tag anulado">Oculto</span> : <span className="tag activo">Visible</span>),
            },
            {
              key: 'estado',
              header: 'Estado',
              sortable: true,
              render: (f) => (f.estado === '1' ? <span className="tag activo">Activo</span> : <span className="tag anulado">Inactivo</span>),
            },
          ]}
          rows={filtrados}
          filtrosActivos={!!q}
          onLimpiarFiltros={() => setBusqueda('')}
          vacio="Crea tu primer curso para poder venderlo y emitir certificados."
          vacioAccion={
            <button className="btn btn-sm" onClick={() => setVista({ tipo: 'editor', curso: null })}>
              Crear el primer curso
            </button>
          }
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
      </EstadoCarga>
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
