'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import CursoCard, { CursoCardSkeleton, type CursoCardData } from './CursoCard';

interface Categoria {
  id: number;
  cat_descripcion: string;
}

interface CursoDestacado extends CursoCardData {
  categoria_id: number | null;
}

export default function CursosDestacados() {
  const [cursos, setCursos] = useState<CursoDestacado[] | null>(null);
  const [categorias, setCategorias] = useState<Record<number, string>>({});

  useEffect(() => {
    let activo = true;
    (async () => {
      const [{ data: listaCursos }, { data: listaCategorias }] = await Promise.all([
        supabase
          .from('cursos')
          .select('id,nombre,precio_ahora,precio_antes,img,categoria_id')
          .eq('estado', '1')
          .eq('mostrar_en_catalogo', true)
          .order('id', { ascending: false })
          .limit(6),
        supabase.from('categorias').select('id,cat_descripcion'),
      ]);
      if (!activo) return;
      setCursos((listaCursos as CursoDestacado[]) || []);
      const mapa: Record<number, string> = {};
      for (const cat of (listaCategorias as Categoria[]) || []) mapa[cat.id] = cat.cat_descripcion;
      setCategorias(mapa);
    })();
    return () => {
      activo = false;
    };
  }, []);

  return (
    <section id="cursos-destacados" className="ipd-seccion">
      <div className="ipd-contenedor">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            <span className="ipd-eyebrow">
              <span className="material-symbols-outlined">local_fire_department</span>
              Cursos destacados
            </span>
            <h2 className="ipd-titulo-seccion">Empieza por estos programas</h2>
          </div>
          <a href="/cursos" className="ipd-btn ipd-btn-claro ipd-btn-sm">
            Ver todos los cursos
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              arrow_forward
            </span>
          </a>
        </div>

        {cursos === null && (
          <div className="[display:grid] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <CursoCardSkeleton key={n} />
            ))}
          </div>
        )}

        {cursos !== null && cursos.length === 0 && (
          <div className="ipd-card text-center py-14 px-6">
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--gris)' }}>
              school
            </span>
            <p className="mt-3 font-semibold" style={{ color: 'var(--st-texto-navy)' }}>
              Muy pronto vas a encontrar aquí nuestros cursos.
            </p>
          </div>
        )}

        {cursos !== null && cursos.length > 0 && (
          <div className="[display:grid] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {cursos.map((curso) => (
              <CursoCard
                key={curso.id}
                curso={curso}
                categoriaLabel={categorias[curso.categoria_id ?? -1] ?? 'Estándar'}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
