/**
 * Períodos de certificación.
 *
 * La interfaz estaba redeclarada, idéntica, en cinco archivos distintos
 * (CertificadosDirectosSection, CargaMasivaCertificados, PendientesEmisionSection,
 * CertificadosEmitidosSection, GenerarCertificadoModal) y la consulta en cuatro.
 */
import { supabase } from '@/lib/supabase/client';

export interface Periodo {
  id: number;
  nombre: string;
  fecha_inicio: string;
  fecha_entrega: string;
  fecha_cierre: string;
}

export async function obtenerPeriodosCertificacion(): Promise<Periodo[]> {
  const { data } = await supabase
    .from('periodos_certificacion')
    .select('id,nombre,fecha_inicio,fecha_entrega,fecha_cierre')
    .order('fecha_inicio', { ascending: false });
  return (data as Periodo[]) || [];
}

export function periodoPorId(periodos: Periodo[], id: string | number | null | undefined): Periodo | undefined {
  if (id === null || id === undefined || id === '') return undefined;
  return periodos.find((p) => String(p.id) === String(id));
}
