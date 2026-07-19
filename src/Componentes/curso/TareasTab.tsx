import { EntregaRow, EvalRow, Tarea } from './EvalRow';

export default function TareasTab({
  cursoId,
  autoeval,
  entregables,
  mejorPorTarea,
  misEntregas,
  onSubir,
}: {
  cursoId: number;
  autoeval: Tarea[];
  entregables: Tarea[];
  mejorPorTarea: Record<number, { nota: number; intentos: number }>;
  misEntregas: Record<number, { nota: number | null; situacion: string | null }>;
  onSubir: (tareaId: number, file: File) => void;
}) {
  return (
    <>
      <div className="grupo-eval">
        <h3>Tareas autoevaluables</h3>
        {autoeval.length ? (
          autoeval.map((t) => <EvalRow key={t.id} t={t} cursoId={cursoId} mejor={mejorPorTarea[t.id]} />)
        ) : (
          <p className="vacio">Sin tareas autoevaluables.</p>
        )}
      </div>
      <div className="grupo-eval">
        <h3>Tareas entregables</h3>
        {entregables.length ? (
          entregables.map((t) => <EntregaRow key={t.id} t={t} entrega={misEntregas[t.id]} onSubir={onSubir} />)
        ) : (
          <p className="vacio">Sin tareas entregables.</p>
        )}
      </div>
    </>
  );
}
