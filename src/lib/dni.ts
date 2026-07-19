import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

export interface ResultadoVerificacionDni {
  ok: boolean;
  motivo?: string;
  dni?: string;
  nombreCompleto?: string;
  coincide?: boolean | null;
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
}

export async function verificarDni(dni: string, nombre: string): Promise<ResultadoVerificacionDni> {
  const { data, error } = await supabase.functions.invoke('verificar-dni', {
    body: { dni, nombre },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        if (body?.motivo) return { ok: false, motivo: body.motivo };
      } catch {
        // el cuerpo no era JSON parseable; se usa el mensaje genérico de abajo
      }
    }
    return { ok: false, motivo: 'No se pudo verificar tu DNI. Intenta nuevamente.' };
  }
  return data as ResultadoVerificacionDni;
}
