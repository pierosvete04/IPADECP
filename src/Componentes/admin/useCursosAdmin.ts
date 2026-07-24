'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface CursoAdmin {
  id: number;
  nombre: string;
  categoria_id: number | null;
  estado: string | null;
  /** Opcional: no todos los consumidores de este tipo (selectores anidados con props más angostas) lo traen. */
  precio_ahora?: string | null;
}

export function useCursosAdmin() {
  const [cursos, setCursos] = useState<CursoAdmin[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    supabase
      .from('cursos')
      .select('id,nombre,categoria_id,estado,precio_ahora')
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
