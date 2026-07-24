'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useRequireSession } from '@/lib/supabase/auth';
import CheckoutView, { type CarritoItem } from '@/Componentes/aula/CheckoutView';
import { leerCarritoPublico, vaciarCarritoPublico } from '@/lib/carrito-publico';

interface Calc {
  subtotal: number;
  total: number;
  descuento: number;
  promocion: { id: number; titulo: string; ahorro: number } | null;
  items: { curso_id: number; precio_lista: number; precio_final: number }[];
}

const CALC_VACIO: Calc = { subtotal: 0, total: 0, descuento: 0, promocion: null, items: [] };

// Mismo componente de checkout que ya usa el aula (ComprarTab/CheckoutView) —
// solo cambia dónde se monta: acá en la web pública, en vez de dentro del
// shell del aula. Así el checkout capta siempre los mismos datos, sin
// duplicar el formulario ni la lógica de pago.
export default function CheckoutClient() {
  const { user, loading } = useRequireSession();
  const router = useRouter();
  const [carrito, setCarrito] = useState<CarritoItem[] | null>(null);
  const [calc, setCalc] = useState<Calc>(CALC_VACIO);
  const [calculando, setCalculando] = useState(true);

  useEffect(() => {
    if (!user) return;
    const pendientes = leerCarritoPublico();
    if (pendientes.length === 0) {
      router.replace('/carrito');
      return;
    }
    setCarrito(pendientes.map((it) => ({ id: it.id, nombre: it.nombre, precio: it.precio })));
  }, [user, router]);

  useEffect(() => {
    if (!carrito || carrito.length === 0) return;
    let activo = true;
    setCalculando(true);
    supabase
      .rpc('calcular_total_carrito', { p_curso_ids: carrito.map((it) => it.id), p_promocion_id: null })
      .then(({ data, error }) => {
        if (!activo) return;
        if (error || !data) {
          const subtotal = carrito.reduce((s, it) => s + (Number(it.precio) || 0), 0);
          setCalc({ ...CALC_VACIO, subtotal, total: subtotal });
        } else {
          setCalc(data);
        }
        setCalculando(false);
      });
    return () => {
      activo = false;
    };
  }, [carrito]);

  function onFinalizado() {
    vaciarCarritoPublico();
    router.push('/aula?sec=miscursos');
  }

  if (loading || !user || carrito === null || calculando) {
    return (
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto animate-pulse flex flex-col gap-3">
          <div className="h-8 rounded-full w-48" style={{ background: 'var(--st-superficie-borde)' }} />
          <div className="ipd-card h-40" />
          <div className="ipd-card h-24" />
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <CheckoutView
          user={user}
          carrito={carrito}
          calc={calc}
          onVolver={() => router.push('/carrito')}
          onFinalizado={onFinalizado}
        />
      </div>
    </section>
  );
}
