'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';

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
  // Este hook alimenta los selectores de curso de media docena de pantallas
  // (emitir certificado, crear pedido, códigos de acceso, anuncios). Cuando la
  // consulta fallaba, `data` llegaba null, el `|| []` lo volvía lista vacía y
  // el desplegable salía sin opciones: se leía como "no hay cursos creados",
  // no como "no se pudieron cargar". Ahora el motivo llega hasta la pantalla.
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    supabase
      .from('cursos')
      .select('id,nombre,categoria_id,estado,precio_ahora')
      .order('id')
      .then(({ data, error: eConsulta }) => {
        if (!activo) return;
        setCargando(false);
        if (eConsulta) {
          setError(mensajeError(eConsulta, 'No se pudieron cargar los cursos.'));
          return;
        }
        setError(null);
        setCursos(data || []);
      });
    return () => {
      activo = false;
    };
  }, []);

  return { cursos, cargando, error };
}
