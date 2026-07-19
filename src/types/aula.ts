export interface Curso {
  id: number;
  nombre: string;
  introduccion1?: string | null;
  precio_ahora?: number | string | null;
  img?: string | null;
  tipo_clase?: string | null;
  tipo_curso?: string | null;
}

export interface Inscripcion {
  curso_id: number;
  inscrito_en: string;
  cursos: Curso;
}
