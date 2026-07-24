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

export interface EmisionCursoInput {
  alumnoUid: string | null;
  cursoId: number;
  periodoId: number;
  fecha: string;
  dni: string;
  nombreCompleto: string;
  cargo: string;
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
    return { ok: false, motivo: mensajeError(errCert, 'No se pudo emitir el certificado.') };
  }

  if (input.alumnoUid) {
    await supabase
      .from('inscripciones')
      .upsert({ alumno_id: input.alumnoUid, curso_id: input.cursoId, origen: 'admin' }, { onConflict: 'alumno_id,curso_id', ignoreDuplicates: true });
  }

  return { ok: true, row: cert as CertificadoDirectoRow };
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
