'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import CourseArt from '@/Componentes/ui/CourseArt';
import { EVENTO_CARRITO, leerCarritoPublico, quitarDelCarritoPublico, type ItemCarritoPublico } from '@/lib/carrito-publico';

function precio(valor: number): string {
  return `S/ ${valor.toFixed(2)}`;
}

export default function CarritoClient() {
  const router = useRouter();
  const [items, setItems] = useState<ItemCarritoPublico[] | null>(null);
  const [conSesion, setConSesion] = useState<boolean | null>(null);
  const [continuando, setContinuando] = useState(false);

  useEffect(() => {
    const actualizar = () => setItems(leerCarritoPublico());
    actualizar();
    window.addEventListener(EVENTO_CARRITO, actualizar);
    return () => window.removeEventListener(EVENTO_CARRITO, actualizar);
  }, []);

  useEffect(() => {
    let activo = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (activo) setConSesion(!!session);
    });
    return () => {
      activo = false;
    };
  }, []);

  const subtotal = (items || []).reduce((s, it) => s + (Number(it.precio) || 0), 0);

  function continuar() {
    setContinuando(true);
    router.push(conSesion ? '/checkout' : '/login?next=/checkout');
  }

  if (items === null) {
    return (
      <section className="px-6 py-16">
        <div className="max-w-3xl mx-auto animate-pulse flex flex-col gap-3">
          <div className="h-8 rounded-full w-48" style={{ background: 'var(--st-superficie-borde)' }} />
          <div className="ipd-card h-24" />
          <div className="ipd-card h-24" />
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="px-6 py-20">
        <div className="max-w-md mx-auto text-center">
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--gris)' }}>
            shopping_cart
          </span>
          <p className="mt-4 font-bold text-lg" style={{ color: 'var(--st-texto-navy)', fontFamily: 'var(--st-font-titulo)' }}>
            Tu carrito está vacío
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--gris)' }}>
            Explora nuestros cursos y agrega el que más te interese.
          </p>
          <Link href="/cursos" className="ipd-btn ipd-btn-primario mt-6">
            Explorar cursos
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 py-12">
      <div className="ipd-contenedor">
        <h1
          className="font-extrabold mb-8"
          style={{ fontFamily: 'var(--st-font-titulo)', fontSize: 'clamp(1.6rem,3vw,2rem)', color: 'var(--st-texto-navy)', letterSpacing: '-.02em' }}
        >
          Tu carrito
        </h1>

        <div className="[display:grid] grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <div key={item.id} className="ipd-card flex items-center gap-4 p-3">
                <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0" style={{ background: 'var(--st-superficie-borde)' }}>
                  <CourseArt id={item.id} nombre={item.nombre} img={item.img} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[.92rem] truncate" style={{ color: 'var(--st-texto-navy)' }}>
                    {item.nombre}
                  </p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--st-secundario)' }}>
                    {precio(item.precio)}
                  </p>
                </div>
                <button
                  onClick={() => setItems(quitarDelCarritoPublico(item.id))}
                  aria-label={`Quitar ${item.nombre} del carrito`}
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ color: 'var(--gris)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                    delete
                  </span>
                </button>
              </div>
            ))}
          </div>

          <div className="ipd-card p-6 lg:sticky lg:top-24">
            <div className="flex items-center justify-between text-sm" style={{ color: 'var(--gris)' }}>
              <span>Subtotal</span>
              <span className="font-semibold" style={{ color: 'var(--st-texto-navy)' }}>
                {precio(subtotal)}
              </span>
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--gris)' }}>
              Los descuentos y promociones se calculan al continuar.
            </p>

            <div className="h-px my-4" style={{ background: 'var(--st-superficie-borde)' }} />

            <div className="flex items-center justify-between">
              <span className="font-bold" style={{ color: 'var(--st-texto-navy)' }}>
                Total
              </span>
              <span className="text-xl font-extrabold" style={{ fontFamily: 'var(--st-font-titulo)', color: 'var(--st-texto-navy)' }}>
                {precio(subtotal)}
              </span>
            </div>

            <button onClick={continuar} disabled={continuando} className="ipd-btn ipd-btn-primario w-full mt-6">
              Comprar
            </button>
            {!conSesion && (
              <p className="text-center text-[.78rem] mt-3 flex items-center justify-center gap-1.5" style={{ color: 'var(--gris)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                  lock
                </span>
                Te pedimos iniciar sesión o registrarte para pagar
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
