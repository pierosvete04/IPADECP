import type { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase/client';
import { SITIO_PUBLICO } from '@/lib/site-config';

const BASE = `https://${SITIO_PUBLICO}`;

// Mismo filtro que usa el catálogo público (CatalogoClient/CursosDestacados):
// solo cursos activos y marcados para aparecer en el catálogo. Se pide solo
// `id` (la única columna de `cursos` de la que hay certeza en todo el
// código) para no arriesgar el query entero por una columna de fecha que
// podría no existir. Si Supabase no responde (build sin variables de
// entorno, caída puntual), el sitemap no debe romper el deploy — se sirve
// solo con las rutas estáticas.
async function rutasDeCursos(): Promise<MetadataRoute.Sitemap> {
  try {
    const { data, error } = await supabase
      .from('cursos')
      .select('id')
      .eq('estado', '1')
      .eq('mostrar_en_catalogo', true);
    if (error || !data) return [];
    return data.map((curso: { id: number }) => ({
      url: `${BASE}/curso/${curso.id}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const estaticas: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/cursos`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/nosotros`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/contacto`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/terminos-servicio`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/politica-privacidad`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/politica-reembolso`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/cookies`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/reclamos`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  return [...estaticas, ...(await rutasDeCursos())];
}
