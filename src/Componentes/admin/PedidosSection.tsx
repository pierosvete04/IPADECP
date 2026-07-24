'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { obtenerPedidos, type PedidoRow } from '@/lib/pedidos';
import PedidosLista from './pedidos/PedidosLista';
import PedidoDetalle from './pedidos/PedidoDetalle';
import PedidoNuevo from './pedidos/PedidoNuevo';
import PedidoNuevoEnvioCertificado from './pedidos/PedidoNuevoEnvioCertificado';

type Vista = { tipo: 'lista' } | { tipo: 'detalle'; id: number } | { tipo: 'nuevo' } | { tipo: 'nuevo-envio' };

export default function PedidosSection() {
  const [pedidos, setPedidos] = useState<PedidoRow[] | null>(null);
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' });

  async function cargar() {
    setPedidos(await obtenerPedidos(supabase));
  }

  useEffect(() => {
    cargar();
  }, []);

  // Aplica un cambio a un pedido puntual en memoria, sin volver a pedir la
  // lista completa a Supabase. Lo usan los cambios de estado inline de
  // PedidosLista (pago/envío) — la acción más frecuente de esta pantalla —
  // para que la UI responda al instante en vez de esperar un refetch de
  // todo el historial de pedidos. PedidoDetalle lee de este mismo array
  // (`pedidos.find`), así que también ve el cambio de inmediato.
  function actualizarPedidoLocal(id: number, cambios: Partial<PedidoRow>) {
    setPedidos((prev) => (prev ? prev.map((p) => (p.id === id ? { ...p, ...cambios } : p)) : prev));
  }

  if (vista.tipo === 'nuevo') {
    return <PedidoNuevo onVolver={() => setVista({ tipo: 'lista' })} onCreado={() => { setVista({ tipo: 'lista' }); cargar(); }} />;
  }

  if (vista.tipo === 'nuevo-envio') {
    return <PedidoNuevoEnvioCertificado onVolver={() => setVista({ tipo: 'lista' })} onCreado={() => { setVista({ tipo: 'lista' }); cargar(); }} />;
  }

  if (vista.tipo === 'detalle') {
    const pedido = (pedidos || []).find((p) => p.id === vista.id);
    if (!pedido) return <p>Cargando…</p>;
    return <PedidoDetalle pedido={pedido} onVolver={() => setVista({ tipo: 'lista' })} onActualizado={cargar} />;
  }

  return (
    <PedidosLista
      pedidos={pedidos}
      onVer={(p) => setVista({ tipo: 'detalle', id: p.id })}
      onCrear={() => setVista({ tipo: 'nuevo' })}
      onEnviarCertificado={() => setVista({ tipo: 'nuevo-envio' })}
      onCambiado={cargar}
      onPedidoActualizado={actualizarPedidoLocal}
    />
  );
}
