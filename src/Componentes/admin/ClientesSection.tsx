'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatSoles } from '@/lib/copy';
import { obtenerPedidos, type PedidoRow } from '@/lib/pedidos';
import DataTable from '@/Componentes/ui/DataTable';
import { TableSkeleton } from '@/Componentes/admin/table/TableSkeleton';
import ClienteDetalle from './cliente/ClienteDetalle';

interface Perfil {
  id: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  documento: string | null;
  rol: string | null;
}

interface Cliente {
  id: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  documento: string | null;
  pedidos: number;
  totalPagado: number;
  ultima: string | null;
  datosCompletos: boolean;
}

function agregarPorCliente(perfiles: Perfil[], pedidos: PedidoRow[]): Cliente[] {
  const porCliente = new Map<string, { pedidos: number; totalPagado: number; ultima: string | null }>();
  for (const p of pedidos) {
    if (!p.cliente_uid) continue;
    const acc = porCliente.get(p.cliente_uid) || { pedidos: 0, totalPagado: 0, ultima: null };
    acc.pedidos += 1;
    if (p.estado_pago === 'pagado') acc.totalPagado += Number(p.total) || 0;
    if (p.fecha && (!acc.ultima || new Date(p.fecha) > new Date(acc.ultima))) acc.ultima = p.fecha;
    porCliente.set(p.cliente_uid, acc);
  }

  return perfiles
    .filter((perfil) => porCliente.has(perfil.id))
    .map((perfil) => {
      const acc = porCliente.get(perfil.id)!;
      return {
        id: perfil.id,
        nombre: perfil.nombre,
        email: perfil.email,
        telefono: perfil.telefono,
        documento: perfil.documento,
        pedidos: acc.pedidos,
        totalPagado: acc.totalPagado,
        ultima: acc.ultima,
        datosCompletos: !!(perfil.telefono && perfil.documento),
      };
    })
    .sort((a, b) => new Date(b.ultima || 0).getTime() - new Date(a.ultima || 0).getTime());
}

// Un "cliente" es alguien que tiene al menos un pedido (cualquier origen o
// estado: compra web, certificado directo o envío de certificado — no solo
// ventas con estado 'aprobado' como antes). Se filtran las cuentas de
// administrador para no mezclarlas con compradores reales.
export default function ClientesSection() {
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [buscar, setBuscar] = useState('');
  const [vista, setVista] = useState<{ tipo: 'lista' } | { tipo: 'detalle'; id: string }>({ tipo: 'lista' });

  async function cargar() {
    const [{ data: perfiles }, pedidos] = await Promise.all([
      supabase.from('perfiles').select('id,nombre,email,telefono,documento,rol').neq('rol', 'admin'),
      obtenerPedidos(supabase),
    ]);
    setClientes(agregarPorCliente((perfiles as Perfil[]) || [], pedidos));
  }

  useEffect(() => {
    cargar();
  }, []);

  const filtrado = useMemo(() => {
    const q = buscar.toLowerCase().trim();
    if (!q) return clientes || [];
    return (clientes || []).filter((c) => [c.nombre, c.email, c.documento].some((v) => (v || '').toLowerCase().includes(q)));
  }, [clientes, buscar]);

  if (vista.tipo === 'detalle') {
    return (
      <ClienteDetalle
        clienteId={vista.id}
        onVolver={() => {
          setVista({ tipo: 'lista' });
          cargar();
        }}
      />
    );
  }

  return (
    <>
      <h1 className="titulo">Clientes</h1>
      <p className="sub">Personas con al menos un pedido registrado (compra, certificado directo o envío de certificado). No incluye cuentas de administrador.</p>
      <div className="barra">
        <input placeholder="Buscar por nombre, correo o documento…" style={{ minWidth: 280 }} value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        <span className="meta" style={{ color: 'var(--gris)' }}>{clientes === null ? '' : `${clientes.length} cliente(s)`}</span>
      </div>
      {clientes === null ? (
        <TableSkeleton cols={7} />
      ) : (
        <DataTable
          columns={[
            {
              key: 'nombre',
              header: 'Nombre',
              sortable: true,
              render: (f) => (
                <span>
                  {f.nombre || '—'}
                  {!f.datosCompletos && (
                    <span className="tag anulado" style={{ marginLeft: '.4rem' }} title="Falta teléfono y/o documento">
                      Datos incompletos
                    </span>
                  )}
                </span>
              ),
            },
            { key: 'email', header: 'Correo', sortable: true },
            { key: 'documento', header: 'Documento', render: (f) => f.documento || '—' },
            { key: 'telefono', header: 'Teléfono', render: (f) => f.telefono || '—' },
            { key: 'pedidos', header: 'Pedidos', sortable: true, align: 'right' },
            { key: 'totalPagado', header: 'Total pagado', sortable: true, align: 'right', render: (f) => formatSoles(f.totalPagado) },
            { key: 'ultima', header: 'Última compra', sortable: true, render: (f) => (f.ultima ? new Date(f.ultima).toLocaleDateString('es-PE') : '') },
          ]}
          rows={filtrado}
          vacio="Aún no hay clientes con pedidos registrados."
          actions={(f) => (
            <button className="btn sec btn-sm" onClick={() => setVista({ tipo: 'detalle', id: f.id })}>
              Ver cliente
            </button>
          )}
        />
      )}
    </>
  );
}
