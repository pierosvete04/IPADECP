'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

interface Venta {
  id: number;
  nombre_curso: string | null;
  fecha: string | null;
  monto: number | null;
  precio_lista: number | null;
  metodo: string | null;
  estado: string | null;
  comprobante_url: string | null;
  promociones?: { titulo: string } | null;
}

const METODO_LABEL: Record<string, string> = {
  mercadopago: 'Tarjeta (Mercado Pago)',
  transferencia: 'Transferencia',
  yape_plin: 'Yape',
  pendiente: 'Pendiente',
  simulado: '—',
};
const ESTADO_TAG: Record<string, string> = { pagado: 'activo', pendiente: 'canjeado', anulado: 'anulado' };

export default function HistorialList({ userId }: { userId: string }) {
  const [ventas, setVentas] = useState<Venta[] | null>(null);

  useEffect(() => {
    let activo = true;
    supabase
      .from('ventas')
      .select('*, promociones(titulo)')
      .eq('alumno_uid', userId)
      .order('fecha', { ascending: false })
      .then(({ data }) => {
        if (activo) setVentas((data as unknown as Venta[]) || []);
      });
    return () => {
      activo = false;
    };
  }, [userId]);

  async function verComprobante(ruta: string) {
    const { data } = await supabase.storage.from('comprobantes').createSignedUrl(ruta, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  if (ventas === null) return <p>Cargando…</p>;
  if (!ventas.length) return <p className="vacio">Aún no tienes compras registradas.</p>;

  return (
    <div className="card" style={{ overflow: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Curso</th>
            <th>Fecha</th>
            <th>Monto</th>
            <th>Promoción</th>
            <th>Método</th>
            <th>Estado</th>
            <th>Comprobante</th>
          </tr>
        </thead>
        <tbody>
          {ventas.map((v) => (
            <tr key={v.id}>
              <td>{v.nombre_curso || '—'}</td>
              <td>{v.fecha ? new Date(v.fecha).toLocaleString('es-PE') : ''}</td>
              <td>
                {v.monto != null ? (
                  <>
                    S/ {v.monto}
                    {v.precio_lista != null && Number(v.precio_lista) !== Number(v.monto) && (
                      <span style={{ textDecoration: 'line-through', color: 'var(--gris)', marginLeft: '.4rem' }}>
                        S/ {v.precio_lista}
                      </span>
                    )}
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td>{v.promociones?.titulo ? <span className="tag activo">{v.promociones.titulo}</span> : 'Sin promoción'}</td>
              <td>{METODO_LABEL[v.metodo || ''] || v.metodo || '—'}</td>
              <td>
                <span className={`tag ${ESTADO_TAG[v.estado || ''] || 'canjeado'}`}>{v.estado || 'pendiente'}</span>
              </td>
              <td>
                {v.comprobante_url ? (
                  <button className="btn sec btn-sm" onClick={() => verComprobante(v.comprobante_url!)}>
                    Ver
                  </button>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
