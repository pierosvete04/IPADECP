/**
 * Utilidades de copy compartidas por el panel admin: formato de moneda y
 * traducción de errores técnicos (Postgres/Supabase/red) a mensajes en
 * español que un admin sin conocimientos técnicos pueda entender y accionar.
 */

export function formatSoles(monto: number | string | null | undefined): string {
  const n = Number(monto) || 0;
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Reparte un monto total en `n` partes en soles, sin perder centavos por redondeo. */
export function repartirEntre(total: number, n: number): string[] {
  const centavosTotal = Math.round(total * 100);
  const base = Math.floor(centavosTotal / n);
  const resto = centavosTotal - base * n;
  return Array.from({ length: n }, (_, i) => ((base + (i < resto ? 1 : 0)) / 100).toFixed(2));
}

interface ErrorLike {
  message?: string | null;
  code?: string | null;
}

export function mensajeError(error: ErrorLike | null | undefined, fallback = 'No se pudo completar la acción. Inténtalo de nuevo.'): string {
  if (!error) return fallback;
  const msg = error.message || '';

  if (/duplicate key value|already exists/i.test(msg)) {
    return 'Ya existe un registro con ese mismo dato. Usa uno distinto.';
  }
  if (/violates foreign key constraint/i.test(msg)) {
    return 'No se puede completar: hay otros registros que dependen de este elemento.';
  }
  if (/violates row-level security|permission denied/i.test(msg)) {
    return 'No tienes permisos para realizar esta acción.';
  }
  if (/Failed to fetch|NetworkError|network|ERR_INTERNET/i.test(msg)) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión a internet e inténtalo de nuevo.';
  }

  return msg || fallback;
}
