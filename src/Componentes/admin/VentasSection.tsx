'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';

interface Venta {
  id: number;
  curso_id: number;
  nombre_curso: string | null;
  monto: number | null;
  precio_lista: number | null;
  metodo: string | null;
  fecha: string | null;
  estado: string | null;
  comprobante_url: string | null;
  alumno_uid: string | null;
  promociones?: { titulo: string } | null;
}

const METODO_LABEL: Record<string, string> = { mercadopago: 'Tarjeta (Mercado Pago)', transferencia: 'Transferencia', yape_plin: 'Yape/Plin', pendiente: 'Pendiente' };

function EstadoTag({ estado }: { estado: string | null }) {
  if (estado === 'aprobado') return <span className="tag activo">aprobado</span>;
  if (estado === 'rechazado') return <span className="tag anulado">rechazado</span>;
  return <span className="tag canjeado">pendiente</span>;
}

export default function VentasSection() {
  const [ventas, setVentas] = useState<Venta[] | null>(null);
  const [verVenta, setVerVenta] = useState<Venta | null>(null);

  async function cargar() {
    const { data } = await supabase.from('ventas').select('*, promociones(titulo)').order('fecha', { ascending: false });
    setVentas((data as unknown as Venta[]) || []);
  }
  useEffect(() => {
    cargar();
  }, []);

  return (
    <>
      <h1 className="titulo">Ventas</h1>
      {ventas === null ? (
        <p>Cargando…</p>
      ) : !ventas.length ? (
        <p className="vacio">Aún no hay ventas registradas.</p>
      ) : (
        <DataTable
          contador={`${ventas.length} venta(s)`}
          columns={[
            { key: 'id', header: 'ID', sortable: true },
            { key: 'nombre_curso', header: 'Curso', sortable: true },
            {
              key: 'monto',
              header: 'Monto',
              sortable: true,
              render: (f) => (
                <>
                  S/ {f.monto}
                  {f.precio_lista != null && Number(f.precio_lista) !== Number(f.monto) && (
                    <span className="meta" style={{ color: 'var(--gris)', textDecoration: 'line-through', marginLeft: '.4rem' }}>
                      S/ {f.precio_lista}
                    </span>
                  )}
                </>
              ),
            },
            { key: 'metodo', header: 'Método', sortable: true, render: (f) => METODO_LABEL[f.metodo || ''] || f.metodo || '' },
            { key: 'fecha', header: 'Fecha', sortable: true, render: (f) => (f.fecha ? new Date(f.fecha).toLocaleString('es-PE') : '') },
            { key: 'estado', header: 'Estado', sortable: true, render: (f) => <EstadoTag estado={f.estado} /> },
          ]}
          rows={ventas}
          actions={(f) => (
            <button className="btn sec btn-sm" onClick={() => setVerVenta(f)}>
              Ver
            </button>
          )}
        />
      )}
      {verVenta && (
        <VerVentaModal
          venta={verVenta}
          onClose={() => setVerVenta(null)}
          onActualizado={() => {
            setVerVenta(null);
            cargar();
          }}
        />
      )}
    </>
  );
}

function VerVentaModal({ venta, onClose, onActualizado }: { venta: Venta; onClose: () => void; onActualizado: () => void }) {
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);
  const [estado, setEstado] = useState(venta.estado || 'pendiente');

  useEffect(() => {
    if (!venta.comprobante_url) return;
    supabase.storage
      .from('comprobantes')
      .createSignedUrl(venta.comprobante_url, 300)
      .then(({ data }) => {
        if (data?.signedUrl) setComprobanteUrl(data.signedUrl);
      });
  }, [venta]);

  async function guardar() {
    const { error } = await supabase.from('ventas').update({ estado }).eq('id', venta.id);
    if (error) {
      alert(error.message);
      return;
    }
    if (estado === 'aprobado') {
      const { data: yaInsc } = await supabase.from('inscripciones').select('id').eq('alumno_id', venta.alumno_uid).eq('curso_id', venta.curso_id).maybeSingle();
      if (!yaInsc) {
        const { error: eIns } = await supabase.from('inscripciones').insert({ alumno_id: venta.alumno_uid, curso_id: venta.curso_id, origen: 'compra', venta_id: venta.id });
        if (eIns) alert('La venta se aprobó pero no se pudo asignar el curso automáticamente: ' + eIns.message);
      }
    }
    onActualizado();
  }

  return (
    <Modal open title={`Venta #${venta.id}`} onClose={onClose}>
      <div style={{ marginBottom: '.4rem' }}>
        <strong>Curso:</strong> {venta.nombre_curso}
      </div>
      <div style={{ marginBottom: '.4rem' }}>
        <strong>Monto:</strong> S/ {venta.monto}
      </div>
      {venta.precio_lista != null && Number(venta.precio_lista) !== Number(venta.monto) && (
        <div style={{ marginBottom: '.4rem' }}>
          <strong>Precio de lista:</strong> S/ {venta.precio_lista}
        </div>
      )}
      {venta.promociones?.titulo && (
        <div style={{ marginBottom: '.4rem' }}>
          <strong>Promoción:</strong> {venta.promociones.titulo}
        </div>
      )}
      <div style={{ marginBottom: '.4rem' }}>
        <strong>Método:</strong> {METODO_LABEL[venta.metodo || ''] || venta.metodo}
      </div>
      <div style={{ marginBottom: '.4rem' }}>
        <strong>Fecha:</strong> {venta.fecha ? new Date(venta.fecha).toLocaleString('es-PE') : ''}
      </div>
      <div style={{ marginBottom: '.4rem' }}>
        <strong>Estado actual:</strong> <EstadoTag estado={venta.estado} />
      </div>
      <hr />
      <strong>Comprobante de pago:</strong>
      <div style={{ marginTop: '.5rem' }}>
        {comprobanteUrl ? (
          <a href={comprobanteUrl} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={comprobanteUrl} style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--borde)' }} alt="Comprobante" />
          </a>
        ) : (
          <p className="vacio">Sin comprobante.</p>
        )}
      </div>
      <hr />
      <label>Cambiar estado</label>
      <div className="fila">
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="pendiente">Pendiente</option>
          <option value="aprobado">Aprobado</option>
          <option value="rechazado">Rechazado</option>
        </select>
        <button className="btn" onClick={guardar}>
          Guardar
        </button>
      </div>
      <p className="sub" style={{ marginTop: '.6rem' }}>
        Al aprobar, el curso se asigna automáticamente al alumno (si aún no lo tiene) y se le notifica.
      </p>
    </Modal>
  );
}
