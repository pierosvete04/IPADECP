import type { Metadata } from 'next';
import { Suspense } from 'react';
import CatalogoClient from '@/Componentes/publico/CatalogoClient';
import { CursoCardSkeleton } from '@/Componentes/publico/CursoCard';

export const metadata: Metadata = {
  title: 'Cursos — IPADECP',
  description: 'Explora el catálogo de diplomados y cursos especializados de IPADECP, 100% virtuales y con certificación oficial.',
};

function CatalogoFallback() {
  return (
    <section className="px-6 py-16">
      <div className="ipd-contenedor [display:grid] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <CursoCardSkeleton key={n} />
        ))}
      </div>
    </section>
  );
}

export default function CursosPage() {
  return (
    <Suspense fallback={<CatalogoFallback />}>
      <CatalogoClient />
    </Suspense>
  );
}
