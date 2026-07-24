'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import CursoCard, { CursoCardSkeleton, type CursoCardData } from './CursoCard';

interface Categoria {
  id: number;
  cat_descripcion: string;
}

interface CursoCatalogo extends CursoCardData {
  categoria_id: number | null;
}

interface Promo {
  titulo: string;
  descripcion: string | null;
}

function normaliza(txt: string): string {
  return txt
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function parseCategoriaUrl(valor: string | null): number | 'todos' {
  if (!valor) return 'todos';
  const n = Number(valor);
  return Number.isFinite(n) ? n : 'todos';
}

export default function CatalogoClient() {
  const searchParams = useSearchParams();

  const [cursos, setCursos] = useState<CursoCatalogo[] | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [promo, setPromo] = useState<Promo | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<number | 'todos'>(() =>
    parseCategoriaUrl(searchParams.get('categoria')),
  );

  useEffect(() => {
    let activo = true;
    const hoy = new Date().toISOString().slice(0, 10);
    (async () => {
      const [{ data: listaCursos }, { data: listaCategorias }, { data: listaPromos }] = await Promise.all([
        supabase
          .from('cursos')
          .select('id,nombre,precio_ahora,precio_antes,img,categoria_id')
          .eq('estado', '1')
          .eq('mostrar_en_catalogo', true)
          .order('nombre'),
        supabase.from('categorias').select('id,cat_descripcion').eq('cat_estado', '1').order('cat_descripcion'),
        supabase
          .from('promociones')
          .select('titulo,descripcion')
          .eq('estado', '1')
          .lte('fecha_inicio', hoy)
          .gte('fecha_fin', hoy)
          .order('fecha_inicio', { ascending: false })
          .limit(1),
      ]);
      if (!activo) return;
      setCursos((listaCursos as CursoCatalogo[]) || []);
      setCategorias((listaCategorias as Categoria[]) || []);
      setPromo(listaPromos && listaPromos.length > 0 ? (listaPromos[0] as Promo) : null);
    })();
    return () => {
      activo = false;
    };
  }, []);

  // Curso sin categoría activa (o cuya categoría fue desactivada) cae bajo
  // la categoría real llamada "Estándar" si existe, para no desaparecer del
  // catálogo ni inventar una categoría nueva — ver DISENO-WEB-PUBLICA-IPADECP.md §11.
  const idEstandar = useMemo(
    () => categorias.find((c) => normaliza(c.cat_descripcion) === 'estandar')?.id ?? null,
    [categorias],
  );

  function categoriaEfectiva(curso: CursoCatalogo): number | null {
    if (curso.categoria_id != null && categorias.some((c) => c.id === curso.categoria_id)) {
      return curso.categoria_id;
    }
    return idEstandar;
  }

  const cursosFiltrados = useMemo(() => {
    if (!cursos) return [];
    const q = normaliza(busqueda);
    return cursos.filter((curso) => {
      const coincideTexto = !q || normaliza(curso.nombre).includes(q);
      const coincideCategoria = filtroCategoria === 'todos' || categoriaEfectiva(curso) === filtroCategoria;
      return coincideTexto && coincideCategoria;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursos, busqueda, filtroCategoria, categorias, idEstandar]);

  const etiquetaCategoria = (curso: CursoCatalogo) => {
    const id = categoriaEfectiva(curso);
    return categorias.find((c) => c.id === id)?.cat_descripcion ?? 'Estándar';
  };

  return (
    <>
      <section className="px-6 pt-10 pb-6">
        <div className="ipd-contenedor">
          <span className="ipd-eyebrow">
            <span className="material-symbols-outlined">grid_view</span>
            Catálogo
          </span>
          <h1 className="ipd-titulo-seccion">Cursos</h1>
          <p className="ipd-subtitulo-seccion">
            Diplomados y cursos especializados, 100&nbsp;% virtuales, con certificación oficial.
          </p>
        </div>
      </section>

      {promo && (
        <section className="px-6 mb-10">
          <div className="ipd-contenedor">
            <div
              className="ipd-seccion-navy flex flex-wrap items-center justify-between gap-3"
              style={{ padding: '1.3rem 1.6rem', borderRadius: 'var(--st-radio-card)' }}
            >
              <div>
                <span className="text-[.7rem] font-bold tracking-[.08em] uppercase" style={{ color: 'var(--st-celeste)' }}>
                  Oferta especial
                </span>
                <p className="text-white font-bold text-[1.05rem] mt-1" style={{ fontFamily: 'var(--st-font-titulo)' }}>
                  {promo.titulo}
                </p>
                {promo.descripcion && (
                  <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,.75)' }}>
                    {promo.descripcion}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="px-6 pb-16">
        <div className="ipd-contenedor">
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <div className="relative flex-1">
              <span
                className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--gris)', fontSize: 20 }}
              >
                search
              </span>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar cursos"
                style={{ paddingLeft: '2.7rem' }}
              />
            </div>

            {categorias.length > 0 && (
              <div className="sm:w-56 shrink-0">
                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value === 'todos' ? 'todos' : Number(e.target.value))}
                >
                  <option value="todos">Todas las categorías</option>
                  {categorias.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.cat_descripcion}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {cursos !== null && (
            <p className="text-sm mb-6" style={{ color: 'var(--gris)' }}>
              {cursosFiltrados.length} {cursosFiltrados.length === 1 ? 'curso encontrado' : 'cursos encontrados'}
            </p>
          )}

          {cursos === null && (
            <div className="[display:grid] sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <CursoCardSkeleton key={n} />
              ))}
            </div>
          )}

          {cursos !== null && cursosFiltrados.length === 0 && (
            <div className="ipd-card text-center py-16 px-6">
              <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--gris)' }}>
                search_off
              </span>
              <p className="mt-3 font-semibold" style={{ color: 'var(--st-texto-navy)' }}>
                {busqueda || filtroCategoria !== 'todos' ? 'No encontramos cursos con ese filtro.' : 'Aún no hay cursos en esta categoría.'}
              </p>
              {(busqueda || filtroCategoria !== 'todos') && (
                <button
                  onClick={() => {
                    setBusqueda('');
                    setFiltroCategoria('todos');
                  }}
                  className="ipd-btn ipd-btn-claro ipd-btn-sm mt-5"
                >
                  Ver todos los cursos
                </button>
              )}
            </div>
          )}

          {cursos !== null && cursosFiltrados.length > 0 && (
            <div className="[display:grid] sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {cursosFiltrados.map((curso) => (
                <CursoCard key={curso.id} curso={curso} categoriaLabel={etiquetaCategoria(curso)} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
