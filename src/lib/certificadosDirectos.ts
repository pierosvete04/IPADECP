/**
 * Lógica de emisión de un certificado directo (Flujo 1): busca/crea la cuenta
 * del cliente por DNI (reutilizando la Edge Function admin-crear-usuario) y
 * emite el certificado vía el RPC admin_emitir_certificado_directo.
 *
 * Separado en dos pasos (resolverCuentaCliente / emitirCertificadoParaCurso)
 * para poder resolver la cuenta una sola vez y emitir varios certificados
 * (uno por curso) sobre esa misma cuenta, sin repetir la búsqueda/creación
 * de cuenta por cada curso — usado por el formulario individual cuando un
 * mismo cliente certifica varios cursos a la vez.
 */
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import { enLotes, traerTodo } from '@/lib/supabase/consultas';
import type { EstadoPago, MetodoPago } from '@/lib/pedidos';

export interface CertificadoDirectoRow {
  id: number;
  curso_id: number;
  dni: string | null;
  nombre_completo: string | null;
  cargo: string | null;
  fecha: string;
  alumno_uid: string | null;
  codigo_verificacion: string;
  periodo_id: number | null;
  drive_digital_url?: string | null;
  drive_imprimir_url?: string | null;
}

export interface ResolverCuentaInput {
  dni: string;
  nombreCompleto: string;
  cargo: string;
  telefono?: string;
  /** Correo real del cliente (para notificarlo), distinto del correo de acceso al aula. */
  correoContacto?: string;
}

export interface ResolverCuentaResultado {
  ok: boolean;
  motivo?: string;
  alumnoUid?: string | null;
  email?: string;
  passwordTemporal?: string;
  yaExistia?: boolean;
}

export async function resolverCuentaCliente(input: ResolverCuentaInput): Promise<ResolverCuentaResultado> {
  const { data: existente } = await supabase.from('perfiles').select('id,email').eq('documento', input.dni).maybeSingle();

  let alumnoUid: string | null = existente?.id || null;
  let cuentaInfo: { email?: string; passwordTemporal?: string; yaExistia?: boolean } = {};

  if (existente) {
    cuentaInfo = { email: existente.email || undefined, yaExistia: true };
  } else {
    const partes = input.nombreCompleto.trim().split(/\s+/);
    const nombres = partes.slice(0, Math.max(1, partes.length - 2)).join(' ') || partes[0];
    const apellidos = partes.slice(-2).join(' ') || '';
    const { data: creado, error: errCrear } = await supabase.functions.invoke('admin-crear-usuario', {
      body: { nombres, apellidos, dni: input.dni, cargo: input.cargo, telefono: input.telefono || undefined },
    });
    if (errCrear || !creado?.ok) {
      return { ok: false, motivo: creado?.motivo || mensajeError(errCrear, 'No se pudo crear la cuenta del cliente.') };
    }
    alumnoUid = creado.alumno_uid;
    cuentaInfo = { email: creado.email, passwordTemporal: creado.passwordTemporal, yaExistia: creado.yaExistia };
  }

  // Se guarda tanto si la cuenta es nueva como si ya existía — a diferencia de cargo/teléfono
  // (que solo admin-crear-usuario setea al crear la cuenta), este campo se puede completar
  // después, para clientes que ya tenían cuenta pero nunca dieron un correo de contacto real.
  if (alumnoUid && input.correoContacto?.trim()) {
    await supabase.from('perfiles').update({ correo_contacto: input.correoContacto.trim() }).eq('id', alumnoUid);
  }

  return { ok: true, alumnoUid, ...cuentaInfo };
}

/**
 * Resuelve la cuenta de cada DNI una sola vez.
 *
 * La carga masiva llamaba a `resolverCuentaCliente` por FILA, y como el archivo
 * trae una fila por certificado, un cliente con cuatro cursos disparaba cuatro
 * búsquedas de perfil seguidas. Un DNI es una persona, no una fila.
 *
 * Secuencial a propósito: si la cuenta no existe hay que crearla, y en paralelo
 * dos filas del mismo DNI competirían por crearla a la vez.
 */
export async function resolverCuentasPorDni(clientes: ResolverCuentaInput[]): Promise<Map<string, ResolverCuentaResultado>> {
  const porDni = new Map<string, ResolverCuentaInput>();
  for (const c of clientes) if (!porDni.has(c.dni)) porDni.set(c.dni, c);

  const resueltas = new Map<string, ResolverCuentaResultado>();
  for (const [dni, input] of porDni) {
    resueltas.set(dni, await resolverCuentaCliente(input));
  }
  return resueltas;
}

export interface EmisionCursoInput {
  alumnoUid: string | null;
  cursoId: number;
  periodoId: number;
  fecha: string;
  dni: string;
  nombreCompleto: string;
  cargo: string;
  /**
   * Pedido del que sale este certificado, cuando el pedido se creó ANTES de
   * emitir (Pedidos → Crear pedido con tipo "Certificado directo"). En el
   * camino inverso — emitir primero y crear el pedido después — el id todavía
   * no existe acá; ese caso usa `vincularCertificadosAPedido`.
   */
  pedidoId?: number;
}

export interface EmisionCursoResultado {
  ok: boolean;
  motivo?: string;
  row?: CertificadoDirectoRow;
}

export async function emitirCertificadoParaCurso(input: EmisionCursoInput): Promise<EmisionCursoResultado> {
  const { data: cert, error: errCert } = await supabase.rpc('admin_emitir_certificado_directo', {
    p_curso_id: input.cursoId,
    p_periodo_id: input.periodoId,
    p_fecha: input.fecha,
    p_dni: input.dni,
    p_nombre_completo: input.nombreCompleto,
    p_cargo: input.cargo,
    p_alumno_uid: input.alumnoUid,
  });

  if (errCert || !cert) {
    // `certificados` tiene UNIQUE (curso_id, alumno_uid): un cliente no se
    // recertifica en el mismo curso. El mensaje genérico de duplicado ("Ya
    // existe un registro con ese mismo dato. Usa uno distinto.") no dice ni
    // qué registro ni qué dato, justo en el caso más frecuente.
    if (/duplicate key value|certificados_curso_id_alumno_uid_key/i.test(errCert?.message || '')) {
      return { ok: false, motivo: 'Este cliente ya tiene un certificado de este curso. No se emite dos veces el mismo.' };
    }
    return { ok: false, motivo: mensajeError(errCert, 'No se pudo emitir el certificado.') };
  }

  // Se sella después del RPC y no dentro: `admin_emitir_certificado_directo`
  // es la misma función que usa la carga masiva y el aula, y no vale la pena
  // cambiarle la firma por un campo que solo importa a este camino.
  if (input.pedidoId) {
    await vincularCertificadosAPedido([(cert as CertificadoDirectoRow).id], input.pedidoId);
  }

  if (input.alumnoUid) {
    await supabase
      .from('inscripciones')
      .upsert({ alumno_id: input.alumnoUid, curso_id: input.cursoId, origen: 'admin' }, { onConflict: 'alumno_id,curso_id', ignoreDuplicates: true });
  }

  return { ok: true, row: cert as CertificadoDirectoRow };
}

/**
 * Marca qué pedido originó estos certificados. Lo usa el camino "emito primero
 * y creo el pedido después" (Certificados directos → Emitir a un cliente), que
 * recién conoce el id del pedido cuando ya emitió todo.
 */
export async function vincularCertificadosAPedido(certificadoIds: number[], pedidoId: number): Promise<void> {
  if (!certificadoIds.length) return;
  await supabase.from('certificados').update({ pedido_id: pedidoId }).in('id', certificadoIds);
}

/**
 * Anula un certificado emitido. No lo borra: lo marca, para que la página pública lo siga
 * mostrando pero como anulado, y para no perder el rastro contable (pedido y venta).
 */
export async function anularCertificado(certificadoId: number, motivo: string): Promise<{ ok: boolean; motivo?: string }> {
  const { error } = await supabase.rpc('admin_anular_certificado', {
    p_certificado_id: certificadoId,
    p_motivo: motivo.trim() || null,
  });
  return error ? { ok: false, motivo: mensajeError(error, 'No se pudo anular el certificado.') } : { ok: true };
}

/** Revierte una anulación hecha por error. */
export async function restaurarCertificado(certificadoId: number): Promise<{ ok: boolean; motivo?: string }> {
  const { error } = await supabase.rpc('admin_restaurar_certificado', { p_certificado_id: certificadoId });
  return error ? { ok: false, motivo: mensajeError(error, 'No se pudo restaurar el certificado.') } : { ok: true };
}

export interface ItemEmisionDirecta {
  cursoId: number;
  periodoId: number;
  /** yyyy-mm-dd. Debe caer dentro del período y ser día hábil: lo valida el RPC. */
  fecha: string;
  precio: number;
}

export interface EmisionConPedidoResultado {
  ok: boolean;
  motivo?: string;
  pedidoId?: number;
  certificados?: { id: number; curso_id: number; codigo_verificacion: string; drive_digital_url: string | null; drive_imprimir_url: string | null }[];
}

/**
 * Emite varios certificados directos y registra su pedido, todo en una transacción.
 *
 * Usa `admin_emitir_certificados_con_pedido`, que valida TODOS los ítems antes de
 * escribir el primero: si el tercer curso trae una fecha en domingo, no queda
 * ninguno emitido ni un pedido a medias. El camino viejo —N llamadas al RPC de
 * emisión, después el insert del pedido, después el de ventas, todo desde el
 * navegador— podía dejar certificados sin pedido o un pedido sin ítems.
 */
export async function emitirCertificadosConPedido(input: {
  alumnoUid: string;
  dni: string;
  nombreCompleto: string;
  cargo: string;
  email?: string | null;
  telefono?: string | null;
  metodo: MetodoPago;
  estadoPago: EstadoPago;
  items: ItemEmisionDirecta[];
}): Promise<EmisionConPedidoResultado> {
  const { data, error } = await supabase.rpc('admin_emitir_certificados_con_pedido', {
    p_alumno_uid: input.alumnoUid,
    p_dni: input.dni,
    p_nombre_completo: input.nombreCompleto,
    p_cargo: input.cargo,
    p_cliente_email: input.email || null,
    p_cliente_telefono: input.telefono || null,
    p_metodo: input.metodo,
    p_estado_pago: input.estadoPago,
    p_items: input.items.map((i) => ({
      curso_id: i.cursoId,
      periodo_id: i.periodoId,
      fecha: i.fecha,
      precio: i.precio,
      promocion_id: null,
    })),
  });

  if (error) {
    // El RPC habla en castellano y con contexto ("La fecha 2026-05-03 no es un día
    // hábil"), así que su mensaje vale más que el genérico de `mensajeError`.
    return { ok: false, motivo: error.message || mensajeError(error, 'No se pudieron emitir los certificados.') };
  }
  const res = data as { pedido_id: number; certificados: EmisionConPedidoResultado['certificados'] };
  return { ok: true, pedidoId: res?.pedido_id, certificados: res?.certificados || [] };
}

/** Un curso de un pedido de certificación directa al que todavía le falta emitir su certificado. */
export interface ItemPendienteEmision {
  ventaId: number;
  cursoId: number;
  cursoNombre: string;
  monto: number;
}

export interface PedidoPendienteEmision {
  pedidoId: number;
  clienteUid: string | null;
  clienteNombre: string | null;
  clienteEmail: string | null;
  /** Del perfil, para precargar el formulario de emisión sin volver a pedirlos. */
  dni: string | null;
  cargo: string | null;
  telefono: string | null;
  creadoEn: string | null;
  estadoPago: string | null;
  total: number | null;
  items: ItemPendienteEmision[];
}

/**
 * Pedidos de tipo "certificado directo" que aún esperan que alguien les ponga
 * período y fecha. Es la bandeja del flujo inverso: primero se registra la
 * venta en Pedidos, después se emite.
 *
 * Un ítem está pendiente si ese CLIENTE todavía no tiene certificado de ese
 * CURSO — no si falta el certificado sellado con este pedido en particular.
 *
 * La distinción importa: `certificados` tiene un UNIQUE (curso_id, alumno_uid),
 * o sea que un cliente no se puede recertificar en el mismo curso. Comparando
 * por pedido, un curso ya certificado en una compra anterior seguía saliendo
 * como pendiente y era IMPOSIBLE de resolver: emitir fallaba siempre contra ese
 * UNIQUE y la fila se quedaba en la bandeja para siempre.
 *
 * Los pedidos sin cuenta de cliente (`cliente_uid` nulo) no entran en ese
 * UNIQUE — Postgres trata los NULL como distintos —, así que para esos se sigue
 * comparando contra `certificados.pedido_id`.
 */
export async function obtenerPedidosPendientesEmision(): Promise<PedidoPendienteEmision[]> {
  const filas = await traerTodo<{
    id: number;
    cliente_uid: string | null;
    cliente_nombre: string | null;
    cliente_email: string | null;
    cliente_telefono: string | null;
    creado_en: string | null;
    estado_pago: string | null;
    total: number | null;
    ventas: { id: number; curso_id: number | null; nombre_curso: string | null; monto: number | null }[] | null;
  }>(() =>
    supabase
      .from('pedidos')
      .select('id,cliente_uid,cliente_nombre,cliente_email,cliente_telefono,creado_en,estado_pago,total,ventas(id,curso_id,nombre_curso,monto)')
      .eq('origen', 'certificado_directo')
      .order('creado_en', { ascending: false })
      .order('id', { ascending: false })
  );
  if (!filas.length) return [];

  const uidsPedidos = [...new Set(filas.map((p) => p.cliente_uid).filter((v): v is string => !!v))];

  // Dos consultas complementarias, no una: por dueño (lo que el UNIQUE realmente
  // impide) y por pedido (para los pedidos sin cuenta, que el UNIQUE no cubre).
  // En lotes porque un `.in()` con cientos de valores rebasa el largo de la URL.
  const [certsPorDueno, certsPorPedido] = await Promise.all([
    enLotes(uidsPedidos, 200, async (lote) => {
      const { data } = await supabase.from('certificados').select('alumno_uid,curso_id').in('alumno_uid', lote);
      return (data as { alumno_uid: string | null; curso_id: number | null }[]) || [];
    }),
    enLotes(filas.map((p) => p.id), 200, async (lote) => {
      const { data } = await supabase.from('certificados').select('pedido_id,curso_id').in('pedido_id', lote);
      return (data as { pedido_id: number | null; curso_id: number | null }[]) || [];
    }),
  ]);

  const certificadoDeDueno = new Set(certsPorDueno.map((c) => `${c.alumno_uid}:${c.curso_id}`));
  const certificadoDePedido = new Set(certsPorPedido.map((c) => `${c.pedido_id}:${c.curso_id}`));

  const yaEmitido = (p: { id: number; cliente_uid: string | null }, cursoId: number) =>
    p.cliente_uid
      ? certificadoDeDueno.has(`${p.cliente_uid}:${cursoId}`)
      : certificadoDePedido.has(`${p.id}:${cursoId}`);

  const pendientes = filas
    .map((p) => ({
      p,
      items: (p.ventas || [])
        .filter((v) => v.curso_id && !yaEmitido(p, v.curso_id))
        .map((v) => ({ ventaId: v.id, cursoId: v.curso_id as number, cursoNombre: v.nombre_curso || `Curso #${v.curso_id}`, monto: Number(v.monto) || 0 })),
    }))
    .filter((x) => x.items.length > 0);
  if (!pendientes.length) return [];

  // DNI y cargo viven en el perfil, no en el pedido: el certificado los
  // necesita y así el admin no los vuelve a tipear.
  const uids = [...new Set(pendientes.map((x) => x.p.cliente_uid).filter((v): v is string => !!v))];
  const porUid = new Map<string, { documento: string | null; cargo: string | null; telefono: string | null }>();
  if (uids.length) {
    const perfiles = await enLotes(uids, 200, async (lote) => {
      const { data } = await supabase.from('perfiles').select('id,documento,cargo,telefono').in('id', lote);
      return (data as { id: string; documento: string | null; cargo: string | null; telefono: string | null }[]) || [];
    });
    for (const perfil of perfiles) {
      porUid.set(perfil.id, perfil);
    }
  }

  return pendientes.map(({ p, items }) => {
    const perfil = p.cliente_uid ? porUid.get(p.cliente_uid) : undefined;
    return {
      pedidoId: p.id,
      clienteUid: p.cliente_uid,
      clienteNombre: p.cliente_nombre,
      clienteEmail: p.cliente_email,
      dni: perfil?.documento ?? null,
      cargo: perfil?.cargo ?? null,
      telefono: perfil?.telefono ?? p.cliente_telefono ?? null,
      creadoEn: p.creado_en,
      estadoPago: p.estado_pago,
      total: p.total,
      items,
    };
  });
}

export interface EmisionCertificadoInput {
  cursoId: number;
  periodoId: number;
  fecha: string;
  dni: string;
  nombreCompleto: string;
  cargo: string;
  telefono?: string;
  correoContacto?: string;
}

export interface EmisionCertificadoResultado {
  ok: boolean;
  motivo?: string;
  row?: CertificadoDirectoRow;
  email?: string;
  passwordTemporal?: string;
  yaExistia?: boolean;
}

/** Un solo cliente, un solo curso: resuelve la cuenta y emite en un solo paso. Usado por la carga masiva. */
export async function emitirCertificadoDirecto(input: EmisionCertificadoInput): Promise<EmisionCertificadoResultado> {
  const cuenta = await resolverCuentaCliente(input);
  if (!cuenta.ok) return { ok: false, motivo: cuenta.motivo };

  const emision = await emitirCertificadoParaCurso({
    alumnoUid: cuenta.alumnoUid ?? null,
    cursoId: input.cursoId,
    periodoId: input.periodoId,
    fecha: input.fecha,
    dni: input.dni,
    nombreCompleto: input.nombreCompleto,
    cargo: input.cargo,
  });
  if (!emision.ok) return { ok: false, motivo: emision.motivo };

  return {
    ok: true,
    row: emision.row,
    email: cuenta.email,
    passwordTemporal: cuenta.passwordTemporal,
    yaExistia: cuenta.yaExistia,
  };
}
