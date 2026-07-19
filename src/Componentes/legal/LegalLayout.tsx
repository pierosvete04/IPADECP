'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Topbar from '@/Componentes/layout/Topbar';
import Footer from '@/Componentes/layout/Footer';

export default function LegalLayout({ titulo, fecha, children }: { titulo: string; fecha: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <>
      <Topbar variant="simple" onSimpleClick={() => router.back()} />
      <main className="contenedor" style={{ maxWidth: 760 }}>
        <h1 className="titulo">{titulo}</h1>
        <p className="sub">{fecha}</p>
        <div className="card card-pad" style={{ lineHeight: 1.7 }}>
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}
