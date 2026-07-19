import { EvalRow, Tarea } from './EvalRow';

export default function ExamenesTab({
  cursoId,
  examenes,
  mejorPorTarea,
}: {
  cursoId: number;
  examenes: Tarea[];
  mejorPorTarea: Record<number, { nota: number; intentos: number }>;
}) {
  return (
    <div className="grupo-eval">
      <h3>Examen final</h3>
      {examenes.length ? (
        examenes.map((t) => <EvalRow key={t.id} t={t} cursoId={cursoId} mejor={mejorPorTarea[t.id]} />)
      ) : (
        <p className="vacio">Sin exámenes.</p>
      )}
    </div>
  );
}
