import { supabase } from '@/lib/supabase/client';

export interface CargoProfesional {
  id: number;
  nombre: string;
}

export async function obtenerCargosProfesionales(): Promise<CargoProfesional[]> {
  const { data } = await supabase
    .from('cargos_profesionales')
    .select('id,nombre')
    .eq('estado', '1')
    .order('nombre');
  return data || [];
}
