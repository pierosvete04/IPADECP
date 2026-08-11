'use client';

import { use as usePromise, useEffect, useState } from 'react';
import { useRequireAdmin } from '@/lib/supabase/auth';
import { supabase } from '@/lib/supabase/client';
import { RotuloPedido } from '@/Componentes/admin/pedidos/RotuloPedido';
import type { PedidoRow } from '@/lib/pedidos';

// Vive fuera de /admin?sec=... a propósito, igual que /admin/rotulo-certificado:
// la hoja que se imprime no debe arrastrar el sidebar ni el header del panel.
export default function RotuloPedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const { user, loading } = useRequireAdmin();
  const [pedido, setPedido] = useState<PedidoRow | null | undefined>(undefined);
  const [documento, setDocumento] = useState<string | null>(null);
  // Decide si esta pantalla ofrece o no el volante del código de activación: a
  // quien ya reclamó su cuenta no hay nada que imprimirle.
  const [cuentaActivadaEn, setCuentaActivadaEn] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let activo = true;
    supabase
      .from('pedidos')
      .select('*, ventas(id,curso_id,nombre_curso,monto,precio_lista,alumno_uid)')
      .eq('id', id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!activo || !data) {
          if (activo) setPedido(null);
          return;
        }
        setPedido({
          id: data.id,
          esOrfano: false,
          fecha: data.creado_en,
          cliente_uid: data.cliente_uid,
          cliente_nombre: data.cliente_nombre,
          cliente_email: data.cliente_email,
          cliente_telefono: data.cliente_telefono,
          canal: data.canal,
          metodo: data.metodo,
          estado_pago: data.estado_pago,
          subtotal: data.subtotal,
          descuento: data.descuento,
          total: data.total,
          notas: data.notas,
          comprobante_url: data.comprobante_url,
          items: data.ventas || [],
          incluye_certificado_fisico: data.incluye_certificado_fisico,
          direccion_envio: data.direccion_envio,
          estado_envio: data.estado_envio,
          courier: data.courier,
          courier_otro: data.courier_otro,
          codigo_rotulo: data.codigo_rotulo,
          promocion_id: data.promocion_id,
          promocion_titulo: null,
          origen: data.origen,
          certificados: data.certificados || [],
          zona_envio_id: data.zona_envio_id,
        });
        if (data.cliente_uid) {
          const { data: perfil } = await supabase
            .from('perfiles')
            .select('documento,tipo_documento,cuenta_activada_en')
            .eq('id', data.cliente_uid)
            .maybeSingle();
          if (activo && perfil?.documento) setDocumento(`${perfil.tipo_documento ?? 'Doc.'} ${perfil.documento}`);
          if (activo) setCuentaActivadaEn(perfil?.cuenta_activada_en ?? null);
        }
      });
    return () => {
      activo = false;
    };
  }, [id, user]);

  if (loading || !user) return null;
  if (pedido === undefined) return <p style={{ padding: '1.5rem' }}>Cargando…</p>;
  if (pedido === null) return <p style={{ padding: '1.5rem' }}>Pedido no encontrado.</p>;

  return <RotuloPedido pedido={pedido} documento={documento} cuentaActivadaEn={cuentaActivadaEn} />;
}
