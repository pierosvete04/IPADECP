/**
 * Envío de certificado físico: tarifas por zona, couriers, y fecha estimada
 * de entrega. Los pedidos que envían un certificado ya viven en la tabla
 * `pedidos` (ver lib/pedidos.ts, origen 'envio_certificado' o
 * 'certificado_directo') — este archivo solo guarda la lógica reusable de
 * zonas/couriers/fechas que no depende de esa tabla.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ZonaEnvioCertificado {
  id: number;
  nombre: string;
  departamentos: string[];
  costo_envio: number;
  tiempo_estimado: string | null;
  activo: boolean;
  orden: number;
}

export interface CertificadoIncluido {
  certificado_id: number;
  curso_nombre: string;
  codigo_verificacion: string;
}

export interface DireccionEnvioCertificado {
  direccion?: string;
  direccionSecundaria?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
}

// Empresas de envío que maneja IPADECP. A diferencia del ejemplo de Suplevet
// no hay ninguna que exija un código de rastreo obligatorio para imprimir el
// rótulo (eso era específico de Dinsides), así que el campo siempre es libre.
export type CourierEnvio = 'olva' | 'shalom' | 'uber' | 'indriver' | 'propia' | 'otro';

export const COURIERS_ENVIO: { id: CourierEnvio; label: string }[] = [
  { id: 'olva', label: 'Olva Courier' },
  { id: 'shalom', label: 'Shalom' },
  { id: 'uber', label: 'Uber' },
  { id: 'indriver', label: 'inDriver' },
  { id: 'propia', label: 'Entrega propia' },
  { id: 'otro', label: 'Otro' },
];

export function nombreCourierEnvio(courier: string | null | undefined, courierOtro?: string | null): string | null {
  if (!courier) return null;
  if (courier === 'otro') return courierOtro?.trim() || 'Otro courier';
  return COURIERS_ENVIO.find((c) => c.id === courier)?.label ?? courier;
}

export async function getZonasEnvioActivas(supabase: SupabaseClient): Promise<ZonaEnvioCertificado[]> {
  const { data } = await supabase
    .from('zonas_envio_certificado')
    .select('*')
    .eq('activo', true)
    .order('orden', { ascending: true });
  return (data as ZonaEnvioCertificado[]) ?? [];
}

/**
 * Busca la zona cuyo array `departamentos` incluye el departamento dado. Si
 * ninguna calza, cae en la primera zona con `departamentos` vacío (la zona
 * "catch-all", ej. "Resto del Perú") — así una zona nueva sin configurar no
 * deja al alumno sin tarifa.
 */
export function encontrarZonaPorDepartamento(
  zonas: ZonaEnvioCertificado[],
  departamento: string
): ZonaEnvioCertificado | undefined {
  const exacta = zonas.find((z) => z.departamentos.some((d) => d.toLowerCase() === departamento.toLowerCase()));
  if (exacta) return exacta;
  return zonas.find((z) => z.departamentos.length === 0);
}

// Días hábiles de tránsito por defecto cuando la zona no trae un
// `tiempo_estimado` parseable — se usa solo para la fecha del rótulo.
const DIAS_HABILES_POR_DEFECTO = 4;

function esFinDeSemana(fecha: Date): boolean {
  const dia = fecha.getDay();
  return dia === 0 || dia === 6;
}

export function sumarDiasHabiles(desde: Date, dias: number): Date {
  const resultado = new Date(desde);
  let restantes = dias;
  while (restantes > 0) {
    resultado.setDate(resultado.getDate() + 1);
    if (!esFinDeSemana(resultado)) restantes -= 1;
  }
  return resultado;
}

/** Extrae el número más alto de un texto tipo "2-3 días hábiles" (toma el extremo superior, igual criterio que Suplevet: no prometer una fecha más optimista de la que se muestra al alumno). */
function diasHabilesDesdeTexto(tiempoEstimado: string | null | undefined): number {
  if (!tiempoEstimado) return DIAS_HABILES_POR_DEFECTO;
  const numeros = tiempoEstimado.match(/\d+/g);
  if (!numeros?.length) return DIAS_HABILES_POR_DEFECTO;
  return Math.max(...numeros.map(Number));
}

export function fechaEntregaEstimada(zona: ZonaEnvioCertificado | null | undefined, desde: Date = new Date()): Date {
  return sumarDiasHabiles(desde, diasHabilesDesdeTexto(zona?.tiempo_estimado));
}

export function formatFechaRotulo(fecha: Date): string {
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${fecha.getFullYear()}`;
}

/** Valor ISO (yyyy-mm-dd) para un <input type="date">. */
export function fechaComoInput(fecha: Date): string {
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mm}-${dd}`;
}

/** Parsea yyyy-mm-dd como fecha local (new Date("2026-07-20") da UTC y se corre un día). */
export function fechaDesdeInput(valor: string): Date {
  const [anio, mes, dia] = valor.split('-').map(Number);
  return new Date(anio, (mes ?? 1) - 1, dia ?? 1);
}
