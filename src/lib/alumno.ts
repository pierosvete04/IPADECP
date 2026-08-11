/**
 * Resumen de actividad de un alumno para la ficha de cliente.
 *
 * Todo esto existía en la base y la ficha no lo mostraba: cuántas tareas lleva de
 * cada curso, cuándo entró por última vez, y si hay otra cuenta con su mismo
 * documento. Sin lo primero, la ficha decía que alguien "tiene un curso" pero no
 * si lo empezó; sin lo segundo no se distinguía a quien compró y nunca entró de
 * quien entra a diario, que es la pregunta comercial más útil de la pantalla.
 */
import { supabase } from '@/lib/supabase/client';

export interface ProgresoCurso {
  curso_id: number;
  total: number;
  completadas: number;
  promedio: number | null;
}

export interface ResumenAlumno {
  /** `auth.users.last_sign_in_at`. Null = nunca inició sesión (típico de cuentas creadas por el equipo). */
  ultimo_acceso: string | null;
  cuenta_creada: string | null;
  /** Última vez que ganó puntos. NO es el último acceso — la escribe `sumar_puntos`. */
  ultima_actividad: string | null;
  progreso: ProgresoCurso[];
}

export interface PosibleDuplicado {
  id: string;
  nombre: string | null;
  email: string | null;
  creado_en: string | null;
}

export async function obtenerResumenAlumno(alumnoUid: string): Promise<ResumenAlumno | null> {
  const { data, error } = await supabase.rpc('admin_resumen_alumno', { p_alumno_uid: alumnoUid });
  if (error || !data) return null;
  return data as ResumenAlumno;
}

/** Otras cuentas con el mismo documento. Solo avisa; no fusiona nada. */
export async function obtenerPosiblesDuplicados(alumnoUid: string): Promise<PosibleDuplicado[]> {
  const { data, error } = await supabase.rpc('admin_posibles_duplicados', { p_alumno_uid: alumnoUid });
  if (error || !data) return [];
  return data as PosibleDuplicado[];
}

/** Guarda las notas internas del equipo sobre un cliente. */
export async function guardarNotasInternas(alumnoUid: string, notas: string) {
  return supabase.from('perfiles').update({ notas_internas: notas.trim() || null }).eq('id', alumnoUid);
}

/**
 * "hace 3 días", "hoy", "nunca". Para una ficha, el tiempo relativo dice más que
 * una fecha: lo que importa es si la persona está activa, no el día exacto.
 */
export function haceCuanto(iso: string | null | undefined): string {
  if (!iso) return 'nunca';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias < 0) return 'hoy';
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  if (dias < 60) return 'hace un mes';
  if (dias < 365) return `hace ${Math.floor(dias / 30)} meses`;
  return dias < 730 ? 'hace un año' : `hace ${Math.floor(dias / 365)} años`;
}
