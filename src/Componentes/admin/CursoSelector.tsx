import type { CursoAdmin } from './useCursosAdmin';

export default function CursoSelector({
  cursos,
  value,
  onChange,
}: {
  cursos: CursoAdmin[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Elige un curso —</option>
      {cursos.map((c) => (
        <option value={c.id} key={c.id}>
          {c.nombre} {c.estado !== '1' ? '(inactivo)' : ''}
        </option>
      ))}
    </select>
  );
}
