import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase/client';
import FichaCursoClient from '@/Componentes/publico/FichaCursoClient';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { data } = await supabase.from('cursos').select('nombre,introduccion1').eq('id', id).maybeSingle();

  if (!data) return { title: 'Curso — IPADECP' };

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
