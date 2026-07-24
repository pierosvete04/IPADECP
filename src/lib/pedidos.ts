/**
 * Constantes y tipos compartidos por todo lo que crea/edita pedidos y ventas
 * admin (PedidosSection.tsx y subcomponentes, y la emisión de certificados
 * directos).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CertificadoIncluido } from '@/lib/envioCertificado';

export type MetodoPago = 'pendiente' | 'transferencia' | 'yape_plin' | 'mercadopago' | 'culqi';
// Debe calzar exactamente con el CHECK constraint de la columna
// pedidos.estado_pago en Supabase — insertar/actualizar cualquier otro valor
// (p.ej. 'rechazado' o 'reembolsado') falla en la base de datos.
export type EstadoPago = 'pagado' | 'pendiente' | 'cancelado' | 'devolucion';

export const METODO_LABEL: Record<string, string> = {
  mercadopago: 'Tarjeta (Mercado Pago)',
  culqi: 'Tarjeta (Culqi)',
  transferencia: 'Transferencia',
  yape_plin: 'Yape',
  pendiente: 'Pendiente',
};

export const CANAL_LABEL: Record<string, string> = { online: 'Tienda online', admin: 'Admin manual' };

// A diferencia de `canal` (online/admin, cómo se hizo el pedido), `origen`
// dice QUÉ es el pedido: una compra de curso, un certificado directo, o el
// envío de un certificado que un cliente web ya tenía emitido (sin curso ni
// venta asociada — el "ítem" es el certificado, no un curso comprado).
export type OrigenPedido = 'compra' | 'certificado_directo' | 'envio_certificado';

export const ORIGEN_LABEL: Record<OrigenPedido, string> = {
  compra: 'Pedido web',
  certificado_directo: 'Certificado directo',
  envio_certificado: 'Envío de certificado',
};

// La tabla `ventas` es histórica y su columna `estado` usa 'aprobado'/'rechazado'/
// 'pendiente' (la usan ClientesSection, EstadoTag, etc). `pedidos.estado_pago`
// es el vocabulario nuevo tipo Shopify. Este mapa mantiene ambas en sync.
export const ESTADO_PAGO_A_VENTA_ESTADO: Record<string, string> = {
  pagado: 'aprobado',
  cancelado: 'rechazado',
  devolucion: 'rechazado',
  pendiente: 'pendiente',
};

export const BADGE_ESTADO_PAGO: Record<EstadoPago, { color: 'verde' | 'naranja' | 'rojo' | 'gris'; label: string }> = {
  pagado: { color: 'verde', label: 'Pagado' },
  pendiente: { color: 'naranja', label: 'Pendiente' },
  cancelado: { color: 'rojo', label: 'Cancelado' },
  devolucion: { color: 'gris', label: 'Devolución' },
};

export function formatFechaPedido(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-PE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Estado de envío de un pedido que incluye certificado físico. Mismo
// vocabulario que pedidos_envio_certificado (ver lib/envioCertificado.ts),
// para no inventar un segundo set de estados para la misma idea.
export type EstadoEnvio = 'no_preparado' | 'en_preparacion' | 'preparado' | 'entregado' | 'devuelto';

export const BADGE_ESTADO_ENVIO: Record<EstadoEnvio, { color: 'gris' | 'azul' | 'celeste' | 'verde' | 'rojo'; label: string }> = {
  no_preparado: { color: 'gris', label: 'No preparado' },
  en_preparacion: { color: 'azul', label: 'En preparación' },
  preparado: { color: 'celeste', label: 'Preparado' },
  entregado: { color: 'verde', label: 'Entregado' },
  devuelto: { color: 'rojo', label: 'Devuelto' },
};

export interface DireccionEnvioPedido {
  direccion?: string;
  direccionSecundaria?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
}

export interface ItemPedido {
  id: number;
  curso_id: number | null;
  nombre_curso: string | null;
  monto: number | null;
  precio_lista: number | null;
  alumno_uid: string | null;
}

export interface PedidoRow {
  id: number;
  esOrfano: boolean;
  fecha: string | null;
  cliente_uid: string | null;
  cliente_nombre: string | null;
  cliente_email: string | null;
  cliente_telefono: string | null;
  canal: string;
  metodo: string | null;
  estado_pago: EstadoPago;
  subtotal: number | null;
  descuento: number | null;
  total: number | null;
  notas: string | null;
  comprobante_url: string | null;
  items: ItemPedido[];
  promocion_id: number | null;
  promocion_titulo: string | null;
  origen: OrigenPedido;
  // Envío de certificado físico — no existe para las ventas huérfanas
  // (esOrfano), porque esos campos viven en la fila `pedidos`, que ahí no
  // existe todavía.
  incluye_certificado_fisico: boolean;
  direccion_envio: DireccionEnvioPedido | null;
  estado_envio: EstadoEnvio;
  courier: string | null;
  courier_otro: string | null;
  codigo_rotulo: string | null;
  // Solo para origen === 'envio_certificado': qué certificado(s) ya emitidos
  // se están enviando (no hay curso comprado ni fila en `ventas`).
  certificados: CertificadoIncluido[];
  zona_envio_id: number | null;
}

export interface PerfilCliente {
  id: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
}

export interface CursoPrecio {
  id: number;
  nombre: string;
  precio_ahora: string | null;
  img: string | null;
}

export interface ItemNuevoPedido {
  curso_id: number;
  nombre_curso: string;
  precio: number;
}

/**
 * Inscribe al alumno en cada curso de `items` que todavía no tenga (usado al
 * marcar un pedido/venta como pagado, tanto desde la creación como desde el
 * detalle). Devuelve un aviso por cada curso que no se pudo asignar solo,
 * para que quien llama lo muestre y el admin lo asigne manualmente.
 */
export async function asignarInscripcionesPorPago(
  supabase: SupabaseClient,
  items: { id: number; curso_id: number | null; nombre_curso: string | null; alumno_uid: string | null }[]
): Promise<string[]> {
  const avisos: string[] = [];
  for (const item of items) {
    if (!item.alumno_uid || !item.curso_id) continue;
    const { data: yaInsc } = await supabase.from('inscripciones').select('id').eq('alumno_id', item.alumno_uid).eq('curso_id', item.curso_id).maybeSingle();
    if (!yaInsc) {
      const { error } = await supabase.from('inscripciones').insert({ alumno_id: item.alumno_uid, curso_id: item.curso_id, origen: 'compra', venta_id: item.id });
      if (error) avisos.push(`No se pudo asignar el curso "${item.nombre_curso}" automáticamente. Asígnalo manualmente desde Alumnos.`);
    }
  }
  return avisos;
}

/**
 * Cambia el estado de pago de un pedido (o de una venta huérfana, que no
 * tiene fila `pedidos` — ahí solo se actualiza `ventas`) y, si queda pagado,
 * dispara la inscripción automática. Se usa tanto desde el desplegable
 * inline de la lista como desde el botón "Guardar" del detalle, para no
 * mantener dos copias de esta lógica.
 */
export async function actualizarEstadoPagoPedido(supabase: SupabaseClient, pedido: PedidoRow, estado: EstadoPago): Promise<string | null> {
  const estadoVenta = ESTADO_PAGO_A_VENTA_ESTADO[estado] || 'pendiente';

  if (!pedido.esOrfano) {
    const { error } = await supabase.from('pedidos').update({ estado_pago: estado }).eq('id', pedido.id);
    if (error) return error.message;
  }

  const idsVentas = pedido.items.map((it) => it.id);
  if (idsVentas.length) {
    const { error } = await supabase.from('ventas').update({ estado: estadoVenta }).in('id', idsVentas);
    if (error) return error.message;
  }

  if (estado === 'pagado') {
    const avisos = await asignarInscripcionesPorPago(supabase, pedido.items);
    if (avisos.length) return `Se marcó pagado, pero ${avisos.join(' ')}`;
  }

  return null;
}

/** Cambia el estado de envío de un pedido. No aplica a ventas huérfanas (no tienen fila `pedidos`). */
export async function actualizarEstadoEnvioPedido(supabase: SupabaseClient, pedidoId: number, estado: EstadoEnvio): Promise<string | null> {
  const { error } = await supabase.from('pedidos').update({ estado_envio: estado }).eq('id', pedidoId);
  return error ? error.message : null;
}

/**
 * Trae TODOS los pedidos (cabeceras `pedidos` + ventas huérfanas sin
 * `pedido_id`, típicamente compras viejas de Mercado Pago) con nombre/correo
 * de cliente y título de promoción ya resueltos. Es la misma lógica que usa
 * `PedidosSection`, extraída aquí para que también la use el detalle de
 * cliente (`ClienteDetalle`) y así ambas pantallas muestren exactamente el
 * mismo historial de compras — nunca dos fuentes de verdad distintas.
 */
export async function obtenerPedidos(supabase: SupabaseClient): Promise<PedidoRow[]> {
  const [{ data: cabeceras }, { data: sueltas }] = await Promise.all([
    supabase
      .from('pedidos')
      .select('*, ventas(id,curso_id,nombre_curso,monto,precio_lista,alumno_uid)')
      .order('creado_en', { ascending: false }),
    supabase
      .from('ventas')
      .select('id,curso_id,nombre_curso,monto,precio_lista,metodo,estado,fecha,alumno_uid,comprobante_url')
      .is('pedido_id', null)
      .order('fecha', { ascending: false }),
  ]);

  const deCabeceras: PedidoRow[] = (cabeceras || []).map((p) => ({
    id: p.id,
    esOrfano: false,
    fecha: p.creado_en,
    cliente_uid: p.cliente_uid,
    cliente_nombre: p.cliente_nombre,
    cliente_email: p.cliente_email,
    cliente_telefono: p.cliente_telefono,
    canal: p.canal,
    metodo: p.metodo,
    estado_pago: p.estado_pago,
    subtotal: p.subtotal,
    descuento: p.descuento,
    total: p.total,
    notas: p.notas,
    comprobante_url: p.comprobante_url,
    items: (p.ventas as ItemPedido[]) || [],
    incluye_certificado_fisico: p.incluye_certificado_fisico,
    direccion_envio: p.direccion_envio,
    estado_envio: p.estado_envio,
    courier: p.courier,
    courier_otro: p.courier_otro,
    codigo_rotulo: p.codigo_rotulo,
    promocion_id: p.promocion_id,
    promocion_titulo: null,
    origen: p.origen,
    certificados: p.certificados || [],
    zona_envio_id: p.zona_envio_id,
  }));

  const deSueltas: PedidoRow[] = (
    (sueltas as (ItemPedido & { metodo: string | null; estado: string | null; fecha: string | null; comprobante_url: string | null })[]) || []
  ).map((v) => ({
    id: -v.id,
    esOrfano: true,
    fecha: v.fecha,
    cliente_uid: v.alumno_uid,
    cliente_nombre: null,
    cliente_email: null,
    cliente_telefono: null,
    canal: 'online',
    metodo: v.metodo,
    estado_pago: v.estado === 'aprobado' ? 'pagado' : v.estado === 'rechazado' ? 'cancelado' : 'pendiente',
    subtotal: v.precio_lista,
    descuento: 0,
    total: v.monto,
    notas: null,
    comprobante_url: v.comprobante_url,
    items: [v],
    incluye_certificado_fisico: false,
    direccion_envio: null,
    estado_envio: 'no_preparado',
    courier: null,
    courier_otro: null,
    codigo_rotulo: null,
    promocion_id: null,
    promocion_titulo: null,
    origen: 'compra',
    certificados: [],
    zona_envio_id: null,
  }));

  const todos = [...deCabeceras, ...deSueltas].sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());

  // Nombres/correos de clientes vinculados a una cuenta (pedidos manuales
  // guardan una foto del cliente, pero las ventas sueltas de Mercado Pago
  // solo tienen el uid — hay que resolverlas contra perfiles).
  const idsSinNombre = [...new Set(todos.filter((p) => !p.cliente_nombre && p.cliente_uid).map((p) => p.cliente_uid as string))];
  if (idsSinNombre.length) {
    const { data: perfiles } = await supabase.from('perfiles').select('id,nombre,email,telefono').in('id', idsSinNombre);
    const porId = new Map((perfiles || []).map((p) => [p.id, p]));
    for (const p of todos) {
      if (!p.cliente_nombre && p.cliente_uid && porId.has(p.cliente_uid)) {
        const perfil = porId.get(p.cliente_uid)!;
        p.cliente_nombre = perfil.nombre;
        p.cliente_email = perfil.email;
        p.cliente_telefono = perfil.telefono;
      }
    }
  }

  const idsPromocion = [...new Set(todos.filter((p) => p.promocion_id).map((p) => p.promocion_id as number))];
  if (idsPromocion.length) {
    const { data: promos } = await supabase.from('promociones').select('id,titulo').in('id', idsPromocion);
    const tituloPorId = new Map((promos || []).map((p) => [p.id, p.titulo as string]));
    for (const p of todos) {
      if (p.promocion_id) p.promocion_titulo = tituloPorId.get(p.promocion_id) || null;
    }
  }

  return todos;
}
