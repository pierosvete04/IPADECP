'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Logo from '@/Componentes/brand/Logo';
import { EVENTO_CARRITO, leerCarritoPublico } from '@/lib/carrito-publico';

const NAV = [
  { href: '/', label: 'Inicio' },
  { href: '/cursos', label: 'Cursos' },
  { href: '/nosotros', label: 'Nosotros' },
  { href: '/contacto', label: 'Contáctanos' },
];

export default function HeaderPublico() {
  const [itemsCarrito, setItemsCarrito] = useState(0);

  useEffect(() => {
    const actualizar = () => setItemsCarrito(leerCarritoPublico().length);
    actualizar();
    window.addEventListener(EVENTO_CARRITO, actualizar);
    window.addEventListener('storage', actualizar);
    return () => {
      window.removeEventListener(EVENTO_CARRITO, actualizar);
      window.removeEventListener('storage', actualizar);
    };
  }, []);

  return (
    <header className="ipd-header">
      <div className="ipd-contenedor flex items-center justify-between gap-4 py-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Logo size={32} />
          <span
            className="text-[1.05rem] font-bold tracking-tight"
            style={{ fontFamily: 'var(--st-font-titulo)', color: 'var(--st-texto-navy)' }}
          >
            IPADECP
          </span>
        </Link>

        <nav className="ipd-nav hidden md:flex items-center gap-1">
          {NAV.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/carrito"
            aria-label="Ver carrito de compras"
            className="relative w-10 h-10 rounded-full flex items-center justify-center text-[var(--st-texto-navy)] hover:bg-white transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
              shopping_cart
            </span>
            {itemsCarrito > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 flex items-center justify-center text-white text-[.65rem] font-bold rounded-full"
                style={{ width: 18, height: 18, background: 'var(--st-secundario)' }}
              >
                {itemsCarrito}
              </span>
            )}
          </Link>

          <Link href="/login" className="ipd-btn ipd-btn-primario ipd-btn-sm">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              school
            </span>
            Ingresar al aula
          </Link>
        </div>
      </div>
    </header>
  );
}
