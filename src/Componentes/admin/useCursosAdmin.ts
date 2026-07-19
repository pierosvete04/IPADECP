'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface CursoAdmin {
  id: number;
  nombre: string;
  categoria_id: number | null;
  estado: string | null;
}

export function useCursosAdmin() {
  const [cursos, setCursos] = useState<CursoAdmin[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    supabase
      .from('cursos')
      .select('id,nombre,categoria_id,estado')
      .order('id')
      .then(({ data }) => {
        if (activo) {
          setCursos(data || []);
          setCargando(false);
        }
      });
    return () => {
      activo = false;
    };
  }, []);

  return { cursos, cargando };
}
