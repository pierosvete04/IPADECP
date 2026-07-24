'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

interface Categoria {
  id: number;
  cat_descripcion: string;
}

export default function SeccionCategorias() {
  const [categorias, setCategorias] = useState<Categoria[] | null>(null);

  useEffect(() => {
    let activo = true;
    supabase
      .from('categorias')
      .select('id,cat_descripcion')
      .eq('cat_estado', '1')
      .order('cat_descripcion')
      .then(({ data }) => {
        if (activo) setCategorias((data as Categoria[]) || []);
      });
    return () => {
      activo = false;
    };
  }, []);

  // Sin categorías activas: la sección no se muestra, nunca se menciona
  // la palabra "categoría" en la UI si no hay datos que la respalden.
  if (!categorias || categorias.length === 0) return null;

  return (
    <section className="px-6 pb-14">
      <div className="ipd-contenedor">
        <h2
          className="text-[1.3rem] font-extrabold mb-5"
          style={{ fontFamily: 'var(--st-font-titulo)', color: 'var(--st-texto-navy)', letterSpacing: '-.01em' }}
        >
          Explora por área
        </h2>
        <div className="flex flex-wrap gap-3">
          {categorias.map((cat) => (
            <a
              key={cat.id}
              href={`/cursos?categoria=${cat.id}`}
              className="ipd-categoria-chip"
            >
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--st-secundario-cont)', color: 'var(--st-on-secundario-cont)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 17 }}>
                  category
                </span>
              </span>
              <span className="text-[.88rem] font-semibold" style={{ color: 'var(--st-texto-navy)' }}>
                {cat.cat_descripcion}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
