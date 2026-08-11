/**
 * Lectura de un certificado público desde el servidor.
 *
 * La página de verificación era un componente de cliente que pedía los datos con `useEffect`:
 * quien escaneaba el QR veía primero "Verificando…" y el HTML llegaba vacío. Es la página más
 * pública del producto y la que más se comparte, así que ahora se renderiza en el servidor.
 *
 * Usa la clave anónima a propósito: `obtener_certificado_publico` y `buscar_certificado_publico`
 * son SECURITY DEFINER y están pensadas para consulta anónima. No hace falta service role para
 * leer algo que ya es público, y no usarla evita exponer de más si mañana cambian las funciones.
 */
import { createClient } from '@supabase/supabase-js';
import type { CertificadoPublico } from '@/lib/certificado';

function clientePublico() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  return createClient(url, anonKey);
}

export async function obtenerCertificadoPublicoServidor(codigo: string): Promise<CertificadoPublico | null> {
  const { data, error } = await clientePublico().rpc('obtener_certificado_publico', { p_codigo: codigo });
  if (error || !data) return null;
  return data as CertificadoPublico;
}

export async function buscarCertificadoPublicoServidor(busqueda: string): Promise<CertificadoPublico | null> {
  const { data, error } = await clientePublico().rpc('buscar_certificado_publico', { p_busqueda: busqueda });
  if (error || !data) return null;
  return data as CertificadoPublico;
}
