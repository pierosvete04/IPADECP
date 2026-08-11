import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase/client';
import FichaCursoClient from '@/Componentes/publico/FichaCursoClient';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  // Mismo filtro que usa FichaCursoClient para renderizar la página: un curso
  // oculto del catálogo (o inactivo) no debe filtrar ni su nombre ni su
  // descripción en el <title>/<meta> — aunque el cuerpo de la página ya
  // muestre "No encontramos este curso", el <head> se sirve aparte y Google
  // sí lo lee. Se marca noindex explícito por si la URL llega a descubrirse.
  const { data } = await supabase
    .from('cursos')
    .select('nombre,introduccion1')
    .eq('id', id)
    .eq('estado', '1')
    .eq('mostrar_en_catalogo', true)
    .maybeSingle();

  if (!data) return { title: 'Curso — IPADECP', robots: { index: false, follow: false } };

  return {
    title: `${data.nombre} — IPADECP`,
    description: data.introduccion1
      ? data.introduccion1.slice(0, 160)
      : 'Curso de capacitación profesional con certificación oficial IPADECP.',
  };
}

export default async function FichaCursoPage({ params }: Props) {
  const { id } = await params;
  // key={id} fuerza un remount completo al navegar entre cursos (ej. desde
  // "Cursos relacionados"), para no arrastrar el estado del curso anterior
  // mientras carga el nuevo.
  return <FichaCursoClient key={id} cursoId={Number(id)} />;
}
