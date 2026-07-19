'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Topbar from '@/Componentes/layout/Topbar';
import Footer from '@/Componentes/layout/Footer';
import { supabase } from '@/lib/supabase/client';
import { useRequireSession } from '@/lib/supabase/auth';

// Página a la que Mercado Pago redirige al alumno después de pagar con
// tarjeta (Checkout Pro). Es solo una pantalla informativa: la fuente de
// verdad es el webhook (mercadopago-webhook), que puede tardar unos segundos
// más que esta redirección en actualizar la venta. Por eso se consulta el
// estado real en 'ventas' en vez de confiar ciegamente en el ?estado= que
// manda Mercado Pago en la URL.

interface VentaEstado {
  id: number;
  nombre_curso: string | null;
  estado: string | null;
}

function RetornoContenido() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useRequireSession();
  const [ventas, setVentas] = useState<VentaEstado[] | null>(null);
  const [consultando, setConsultando] = useState(false);

  const ventaIds = (searchParams.get('venta') || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
  const estadoUrl = searchParams.get('estado');

  const consultar = useCallback(async () => {
    if (!user || !ventaIds.length) return;
    setConsultando(true);
    const { data } = await supabase
      .from('ventas')
      .select('id,nombre_curso,estado')
      .in('id', ventaIds)
      .eq('alumno_uid', user.id);
    setVentas((data as VentaEstado[]) || []);
    setConsultando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ventaIds.join(',')]);

  useEffect(() => {
    if (!loading) consultar();
  }, [loading, consultar]);

  const todasAprobadas = ventas !== null && ventas.length > 0 && ventas.every((v) => v.estado === 'aprobado');
  const algunaRechazada = ventas !== null && ventas.some((v) => v.estado === 'rechazado');
  const enRevision = ventas !== null && !todasAprobadas && !algunaRechazada;

  return (
    <>
      <Topbar variant="simple" onSimpleClick={() => router.push('/aula')} />
      <main className="contenedor" style={{ maxWidth: 560 }}>
        <h1 className="titulo">Resultado de tu pago</h1>

        {(loading || ventas === null) && <p className="sub">Verificando el estado de tu pago…</p>}

        {ventas !== null && (
          <div className="card card-pad" style={{ lineHeight: 1.7 }}>
            {todasAprobadas && (
              <div className="aviso ok" style={{ marginBottom: '1rem' }}>
                ¡Pago aprobado! Ya tienes acceso a tu(s) curso(s).
              </div>
            )}
            {algunaRechazada && (
              <div className="aviso err" style={{ marginBottom: '1rem' }}>
                El pago fue rechazado. Puedes volver a intentarlo desde &quot;Comprar cursos&quot; con otra tarjeta.
              </div>
            )}
            {enRevision && !algunaRechazada && (
              <div className="aviso info" style={{ marginBottom: '1rem' }}>
                Tu pago está en revisión{estadoUrl === 'pending' ? ' por Mercado Pago' : ''}. Esta pantalla se actualiza
                sola en unos segundos; también puedes presionar &quot;Verificar de nuevo&quot;.
              </div>
            )}

            {ventas.length > 0 && (
              <ul style={{ marginBottom: '1rem' }}>
                {ventas.map((v) => (
                  <li key={v.id}>
                    {v.nombre_curso || `Pedido #${v.id}`} —{' '}
                    <strong>
                      {v.estado === 'aprobado' ? 'Aprobado' : v.estado === 'rechazado' ? 'Rechazado' : 'Pendiente'}
                    </strong>
                  </li>
                ))}
              </ul>
            )}

            <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
              {!todasAprobadas && (
                <button className="btn sec" onClick={consultar} disabled={consultando}>
                  {consultando ? 'Verificando…' : 'Verificar de nuevo'}
                </button>
              )}
              <a
                href="#"
                className="btn"
                onClick={(e) => {
                  e.preventDefault();
                  router.push('/aula');
                }}
              >
                Ir a Mis cursos
              </a>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}

export default function CheckoutRetornoPage() {
  return (
    <Suspense fallback={null}>
      <RetornoContenido />
    </Suspense>
  );
}
