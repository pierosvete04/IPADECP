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
  const [menuAbierto, setMenuAbierto] = useState(false);

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

  // El menú móvil es un panel aparte (no un simple "hidden" con CSS), así que
  // si el usuario lo deja abierto y agranda la ventana hasta el breakpoint de
  // escritorio (o rota el celular), hay que cerrarlo — si no, queda un panel
  // "fantasma" montado debajo del nav de escritorio. Se usa `resize` en vez
  // de (o además de) `matchMedia().addEventListener('change', …)` porque ese
  // evento no dispara de forma confiable en todos los navegadores/DevTools
  // al redimensionar mediante herramientas de emulación, solo en cambios
  // reales de media feature detectados por el motor.
  useEffect(() => {
    const cerrarSiEsEscritorio = () => {
      if (window.innerWidth >= 768) setMenuAbierto(false);
    };
    window.addEventListener('resize', cerrarSiEsEscritorio);
    return () => window.removeEventListener('resize', cerrarSiEsEscritorio);
  }, []);

  return (
    <header className="ipd-header">
      <div className="ipd-contenedor flex items-center justify-between gap-3 py-3 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 shrink-0" onClick={() => setMenuAbierto(false)}>
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

        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
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

          <Link href="/login" className="ipd-btn ipd-btn-primario ipd-btn-sm ipd-header-cta">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              school
            </span>
            Ingresar al aula
          </Link>

          {/* En mobile el nav de arriba está en `hidden` (display:none) y por
              años acá no había ningún reemplazo: Inicio/Nosotros/Contáctanos
              eran inalcanzables desde el header en celular (solo quedaban en
              el footer, al fondo del todo). Este botón abre el panel de abajo
              con esos mismos enlaces. */}
          <button
            type="button"
            className="ipd-menu-boton"
            aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuAbierto}
            aria-controls="ipd-menu-movil"
            onClick={() => setMenuAbierto((v) => !v)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
              {menuAbierto ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {menuAbierto && (
        <nav id="ipd-menu-movil" className="ipd-menu-movil">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setMenuAbierto(false)}>
              {item.label}
            </a>
          ))}
          <Link href="/login" className="ipd-btn ipd-btn-primario" onClick={() => setMenuAbierto(false)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              school
            </span>
            Ingresar al aula
          </Link>
        </nav>
      )}
    </header>
  );
}
