/**
 * Formato de fechas del certificado. Una sola definición para los dos lados.
 *
 * `certificados.fecha` es `timestamptz`. Formatearla con la zona de quien mira
 * hace que el certificado cambie de día según dónde se abra: el PDF lo genera
 * el servidor fijando Lima, pero la página pública usaba la zona del navegador,
 * así que un empleador en Madrid veía 23/12/2026 donde el diploma decía
 * 22/12/2026. En una página cuyo único trabajo es confirmar que el certificado
 * es auténtico, eso es exactamente lo que no puede pasar.
 *
 * Las fechas del instituto son de Perú, siempre. La zona no depende de quién mira.
 */
export const ZONA_PERU = 'America/Lima';

const FORMATO_PERU = new Intl.DateTimeFormat('es-PE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: ZONA_PERU,
});

/** Un `timestamptz` como dd/mm/aaaa en hora de Perú. */
export function fechaPeru(valor: string | Date | null | undefined): string {
  if (!valor) return '';
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? '' : FORMATO_PERU.format(fecha);
}

/**
 * Una columna `date` (sin hora) como dd/mm/aaaa.
 *
 * No pasa por `new Date`: `new Date('2026-07-01')` se interpreta como medianoche
 * UTC y en Lima retrocede al 30/06. Las fechas de período no tienen hora, así que
 * se parten como texto y se acabó el problema.
 */
export function fechaSoloDia(valor: string | null | undefined): string {
  if (!valor) return '';
  const [a, m, d] = valor.slice(0, 10).split('-');
  return a && m && d ? `${d}/${m}/${a}` : '';
}
