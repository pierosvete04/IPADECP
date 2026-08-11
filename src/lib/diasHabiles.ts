/**
 * Espejo en el navegador de la función `es_dia_habil(date)` de la base de datos.
 *
 * El RPC `admin_emitir_certificado_directo` rechaza cualquier fecha que caiga en
 * fin de semana, en un feriado de `feriados_pe`, o en Jueves/Viernes Santo. Hasta
 * ahora eso solo se comprobaba en el servidor: el formulario dejaba elegir un
 * sábado, pasaba la validación local, pasaba el diálogo de confirmación y recién
 * reventaba a mitad del bucle de emisión — con los certificados anteriores ya
 * emitidos y el pedido cuadrado solo sobre los que sí salieron.
 *
 * Por eso este módulo replica la MISMA regla acá, para poder avisar antes de
 * emitir. La base de datos sigue siendo la autoridad: esto es una malla previa,
 * no un reemplazo.
 */
import { supabase } from '@/lib/supabase/client';

/** Domingo de Pascua (algoritmo anónimo gregoriano). Misma fórmula que `domingo_pascua(int)` en la BD. */
function domingoPascua(anio: number): string {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Suma días a una fecha 'YYYY-MM-DD' sin pasar por zonas horarias. */
function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

/**
 * Día de la semana de una fecha 'YYYY-MM-DD'.
 *
 * Se construye en UTC a propósito: `new Date('2026-05-02')` se interpreta como
 * medianoche UTC y en Lima (UTC-5) retrocede al día anterior, así que un sábado
 * se leería como viernes y pasaría la validación.
 */
function diaSemana(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

const NOMBRE_DIA: Record<number, string> = { 0: 'domingo', 6: 'sábado' };

export interface CalendarioHabil {
  /** null si la fecha es hábil; si no, la razón en lenguaje humano. */
  motivoNoHabil(iso: string): string | null;
  esHabil(iso: string): boolean;
  /**
   * El día hábil más cercano a `iso` dentro de [min, max], buscando hacia atrás
   * y hacia adelante a la vez. null si no hay ninguno en el rango.
   */
  masCercano(iso: string, min?: string, max?: string): string | null;
}

function construirCalendario(feriados: Map<string, string>): CalendarioHabil {
  // Jueves/Viernes Santo se calculan por año y se memorizan: un período de
  // certificación puede cruzar dos años y no vale la pena recalcular por fecha.
  const semanaSantaPorAnio = new Map<number, Map<string, string>>();
  function semanaSanta(anio: number): Map<string, string> {
    let cache = semanaSantaPorAnio.get(anio);
    if (!cache) {
      const pascua = domingoPascua(anio);
      cache = new Map([
        [sumarDias(pascua, -3), 'Jueves Santo'],
        [sumarDias(pascua, -2), 'Viernes Santo'],
      ]);
      semanaSantaPorAnio.set(anio, cache);
    }
    return cache;
  }

  function motivoNoHabil(iso: string): string | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso.slice(0, 10))) return null;
    const fecha = iso.slice(0, 10);

    const dow = diaSemana(fecha);
    if (dow === 0 || dow === 6) return `Es ${NOMBRE_DIA[dow]}.`;

    const feriado = feriados.get(fecha);
    if (feriado) return `Es feriado: ${feriado}.`;

    const santo = semanaSanta(Number(fecha.slice(0, 4))).get(fecha);
    if (santo) return `Es ${santo}.`;

    return null;
  }

  return {
    motivoNoHabil,
    esHabil: (iso) => motivoNoHabil(iso) === null,
    masCercano(iso, min, max) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso.slice(0, 10))) return null;
      const base = iso.slice(0, 10);
      const dentro = (f: string) => (!min || f >= min) && (!max || f <= max);
      // 400 días cubre cualquier período de certificación (son de 6 meses) aun
      // si el rango entero cayera en fechas raras.
      for (let salto = 0; salto <= 400; salto++) {
        for (const candidato of salto === 0 ? [base] : [sumarDias(base, -salto), sumarDias(base, salto)]) {
          if (dentro(candidato) && motivoNoHabil(candidato) === null) return candidato;
        }
      }
      return null;
    },
  };
}

/** Calendario vacío (solo fines de semana y Semana Santa) para cuando la consulta de feriados falla. */
export function calendarioSinFeriados(): CalendarioHabil {
  return construirCalendario(new Map());
}

let promesaCalendario: Promise<CalendarioHabil> | null = null;

/**
 * Carga los feriados una sola vez por sesión y devuelve el calendario.
 *
 * Si la consulta falla se devuelve igual un calendario con fines de semana y
 * Semana Santa: sigue atajando la mayoría de los errores y la BD ataja el resto.
 */
export function cargarCalendarioHabil(): Promise<CalendarioHabil> {
  promesaCalendario ??= (async () => {
    try {
      const { data } = await supabase.from('feriados_pe').select('fecha,descripcion');
      const mapa = new Map<string, string>();
      for (const f of (data as { fecha: string; descripcion: string | null }[]) || []) {
        mapa.set(f.fecha.slice(0, 10), f.descripcion?.trim() || 'feriado nacional');
      }
      return construirCalendario(mapa);
    } catch {
      return calendarioSinFeriados();
    }
  })();
  return promesaCalendario;
}

/** Formatea 'YYYY-MM-DD' como dd/mm/aaaa sin pasar por `new Date` (evita el corrimiento de zona horaria). */
export function fechaLegible(iso: string | null | undefined): string {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return a && m && d ? `${d}/${m}/${a}` : '';
}
