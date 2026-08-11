/**
 * Activación de cuenta: el cliente de certificación directa reclama con su DNI
 * la cuenta que el equipo le creó al emitirle el certificado, y le pone su
 * propio correo y contraseña.
 *
 * El segundo factor es un código de 6 dígitos impreso en un volante que viaja
 * DENTRO del sobre, junto al certificado (ver el botón "Código de acceso" en la
 * pantalla del rótulo). No se usa el código del QR del certificado: ese es
 * público por diseño y quien viera una foto del certificado podría quedarse con
 * la cuenta.
 *
 * La lógica real está en db/migraciones/005_activacion_cuenta.sql y en la Edge
 * Function `activar-cuenta`; acá solo viven las llamadas y el vocabulario.
 */
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

/**
 * Qué hacer con un documento que alguien escribió en el registro:
 *
 *  - `sin_cuenta`  → registro normal, es un cliente nuevo
 *  - `pendiente`   → tiene cuenta sin estrenar y código vigente: puede activarla
 *  - `sin_codigo`  → tiene cuenta sin estrenar pero nadie le generó código
 *  - `bloqueada`   → demasiados intentos fallidos
 *  - `activa`      → ya la reclamó: tiene que iniciar sesión
 */
export type EstadoCuenta = 'sin_cuenta' | 'pendiente' | 'sin_codigo' | 'bloqueada' | 'activa';

export async function estadoCuentaPorDocumento(documento: string): Promise<EstadoCuenta> {
  const { data, error } = await supabase.rpc('estado_cuenta_por_documento', { p_documento: documento.trim() });
  // Ante un fallo de red se responde `sin_cuenta`: el registro sigue su curso
  // normal y, si el documento ya existía, el error de duplicado lo frena igual.
  // Peor sería bloquear a un cliente nuevo porque una consulta no respondió.
  if (error || !data) return 'sin_cuenta';
  return data as EstadoCuenta;
}

export interface ResultadoActivacion {
  ok: boolean;
  motivo?: string;
  bloqueada?: boolean;
  email?: string;
}

export async function activarCuenta(input: {
  documento: string;
  codigo: string;
  email: string;
  password: string;
}): Promise<ResultadoActivacion> {
  const { data, error } = await supabase.functions.invoke('activar-cuenta', {
    body: {
      documento: input.documento.trim(),
      codigo: input.codigo.trim(),
      email: input.email.trim(),
      password: input.password,
    },
  });

  if (error) {
    // Las respuestas 4xx llegan como FunctionsHttpError con el motivo real en el
    // cuerpo. Sin esto, "El código no es correcto" se veía como un genérico
    // "Edge Function returned a non-2xx status code".
    if (error instanceof FunctionsHttpError) {
      try {
        const cuerpo = await error.context.json();
        if (cuerpo?.motivo) return { ok: false, motivo: cuerpo.motivo, bloqueada: !!cuerpo.bloqueada };
      } catch {
        // el cuerpo no era JSON; cae al mensaje genérico
      }
    }
    return { ok: false, motivo: 'No se pudo activar tu cuenta. Intenta nuevamente.' };
  }
  return data as ResultadoActivacion;
}

/** Genera (o regenera) el código de 6 dígitos de un cliente. Solo admin. Se muestra una vez. */
export async function generarCodigoActivacion(alumnoUid: string): Promise<{ ok: boolean; codigo?: string; motivo?: string }> {
  const { data, error } = await supabase.rpc('admin_generar_codigo_activacion', { p_alumno_uid: alumnoUid });
  if (error) return { ok: false, motivo: error.message };
  return { ok: true, codigo: data as string };
}
