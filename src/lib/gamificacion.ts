/**
 * Gamificación de un alumno: nivel, logros e historial de puntos.
 *
 * La base de datos guarda cuatro cosas y la ficha del cliente solo mostraba una:
 *
 *   - `perfiles.puntos` y `racha_dias`  → se mostraban como un renglón de texto
 *   - `niveles_gamificacion`            → nunca se mostraba
 *   - `logros` / `logros_alumnos`       → nunca se mostraban
 *   - `actividad_puntos`                → nunca se mostraba
 *
 * Lo último es lo más raro: `admin_ajustar_puntos` escribe ahí el motivo de cada
 * ajuste manual precisamente para poder explicar después un saldo extraño, y ese
 * registro no se leía en ninguna pantalla. Un número de puntos sin nivel, sin
 * logros y sin historia no dice nada — ni al admin ni al alumno.
 */
import { supabase } from '@/lib/supabase/client';

export interface NivelGamificacion {
  nivel: number;
  nombre: string;
  minimo: number;
  maximo: number;
}

export interface Logro {
  id: number;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  criterio_tipo: string;
  criterio_valor: number | null;
}

export interface LogroDeAlumno extends Logro {
  obtenido_en: string | null;
}

export interface MovimientoPuntos {
  id: number;
  tipo: string;
  /** Para 'ajuste_admin' guarda el motivo escrito por el admin; en el resto, el id del origen. */
  ref_id: string | null;
  puntos: number;
  creado_en: string;
}

/** Nivel alcanzado con esos puntos y cuánto falta para el siguiente. */
export interface ProgresoNivel {
  actual: NivelGamificacion | null;
  siguiente: NivelGamificacion | null;
  /** 0-100. Avance dentro del nivel actual; 100 si ya está en el último. */
  porcentaje: number;
  puntosParaSiguiente: number;
}

export function calcularProgresoNivel(puntos: number, niveles: NivelGamificacion[]): ProgresoNivel {
  const ordenados = [...niveles].sort((a, b) => a.nivel - b.nivel);
  const actual = ordenados.filter((n) => puntos >= n.minimo).pop() ?? ordenados[0] ?? null;
  const siguiente = actual ? ordenados.find((n) => n.nivel === actual.nivel + 1) ?? null : null;

  if (!actual) return { actual: null, siguiente: null, porcentaje: 0, puntosParaSiguiente: 0 };
  if (!siguiente) return { actual, siguiente: null, porcentaje: 100, puntosParaSiguiente: 0 };

  const recorrido = puntos - actual.minimo;
  const tramo = siguiente.minimo - actual.minimo;
  return {
    actual,
    siguiente,
    // Se trunca, no se redondea: con 199 de 200 puntos `Math.round` daba 100 % y
    // la barra se veía llena mientras todavía faltaba un punto para subir. Una
    // barra de progreso al 100 % tiene que significar que ya llegó.
    //
    // `tramo` no debería ser 0, pero si alguien configura dos niveles con el mismo
    // mínimo desde el panel, dividir acá reventaría la ficha entera del cliente.
    porcentaje: tramo > 0 ? Math.min(100, Math.max(0, Math.floor((recorrido / tramo) * 100))) : 0,
    puntosParaSiguiente: Math.max(0, siguiente.minimo - puntos),
  };
}

/** Etiquetas legibles de los tipos de movimiento. `actividad_puntos.tipo` es jerga interna. */
export const MOTIVO_PUNTOS: Record<string, string> = {
  leccion: 'Lección completada',
  tarea: 'Tarea entregada',
  examen: 'Examen rendido',
  curso: 'Curso completado',
  racha: 'Racha diaria',
  logro: 'Logro obtenido',
  ajuste_admin: 'Ajuste manual',
};

export function etiquetaMovimiento(m: MovimientoPuntos): string {
  const base = MOTIVO_PUNTOS[m.tipo] || m.tipo;
  // En los ajustes manuales `ref_id` es el motivo que escribió el admin, y es
  // justamente lo que hay que leer para entender el saldo.
  if (m.tipo === 'ajuste_admin' && m.ref_id?.trim()) return `${base}: ${m.ref_id.trim()}`;
  return base;
}

export interface GamificacionAlumno {
  niveles: NivelGamificacion[];
  logrosObtenidos: LogroDeAlumno[];
  logrosPendientes: Logro[];
  movimientos: MovimientoPuntos[];
}

/** Todo lo que la ficha necesita para pintar la gamificación de una persona. */
export async function obtenerGamificacionDeAlumno(alumnoUid: string, limiteMovimientos = 12): Promise<GamificacionAlumno> {
  const [niveles, logros, obtenidos, movimientos] = await Promise.all([
    supabase.from('niveles_gamificacion').select('nivel,nombre,minimo,maximo').order('nivel'),
    supabase.from('logros').select('id,nombre,descripcion,icono,criterio_tipo,criterio_valor').eq('estado', '1').order('id'),
    supabase.from('logros_alumnos').select('logro_id,obtenido_en').eq('alumno_uid', alumnoUid),
    supabase
      .from('actividad_puntos')
      .select('id,tipo,ref_id,puntos,creado_en')
      .eq('alumno_uid', alumnoUid)
      .order('creado_en', { ascending: false })
      .limit(limiteMovimientos),
  ]);

  const catalogo = (logros.data as Logro[]) || [];
  const fechaPorLogro = new Map(
    ((obtenidos.data as { logro_id: number; obtenido_en: string | null }[]) || []).map((l) => [l.logro_id, l.obtenido_en])
  );

  return {
    niveles: (niveles.data as NivelGamificacion[]) || [],
    logrosObtenidos: catalogo
      .filter((l) => fechaPorLogro.has(l.id))
      .map((l) => ({ ...l, obtenido_en: fechaPorLogro.get(l.id) ?? null })),
    logrosPendientes: catalogo.filter((l) => !fechaPorLogro.has(l.id)),
    movimientos: (movimientos.data as MovimientoPuntos[]) || [],
  };
}
