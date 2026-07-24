import Link from 'next/link';
import FileButton from '@/Componentes/ui/FileButton';

export interface Tarea {
  id: number;
  titulo: string | null;
  categoria: string | null;
  cantpreg: string | null;
  entrega: string | null;
}

export function EvalRow({ t, cursoId, mejor }: { t: Tarea; cursoId: number; mejor?: { nota: number; intentos: number } }) {
  const notaTxt = mejor ? (
    <div className="nota" style={{ color: mejor.nota >= 13 ? 'var(--ok)' : 'var(--error)' }}>
      {mejor.nota}
      <small>NOTA</small>
    </div>
  ) : (
    <div className="nota" style={{ color: 'var(--gris)' }}>
      —<small>NOTA</small>
    </div>
  );
  const maxIntentos = t.categoria === 'examen' ? 1 : 2;
  const restantes = mejor ? Math.max(0, maxIntentos - mejor.intentos) : maxIntentos;
  return (
    <div className="eval">
      <div className="eval-titulo">
        <strong>{t.titulo}</strong>
      </div>
      <div className="eval-accion">
        {notaTxt}
        {restantes > 0 ? (
          <Link className="btn" href={`/aula/evaluacion/${t.id}?curso=${cursoId}&titulo=${encodeURIComponent(t.titulo || '')}`}>
            Rendir ({restantes} intento{restantes > 1 ? 's' : ''})
          </Link>
        ) : (
          <span className="tag canjeado">Sin intentos</span>
        )}
      </div>
    </div>
  );
}

export function EntregaRow({
  t,
  entrega,
  onSubir,
}: {
  t: Tarea;
  entrega?: { nota: number | null; situacion: string | null };
  onSubir: (tareaId: number, file: File) => void;
}) {
  let estado: React.ReactNode = null;
  if (entrega) {
    estado = entrega.nota != null ? <span className="tag activo">Revisado · Nota {entrega.nota}</span> : <span className="tag canjeado">Revisando…</span>;
  }
  return (
    <div className="eval">
      <div className="eval-titulo">
        <strong>{t.titulo}</strong>
        {t.entrega && t.entrega !== 'auto' && (
          <div>
            <a target="_blank" rel="noreferrer" href={t.entrega}>
              Descargar consigna
            </a>
          </div>
        )}
      </div>
      <div className="eval-accion">
        {estado}
        {!entrega && (
          <FileButton accept="application/pdf" onFile={(file) => onSubir(t.id, file)}>
            Subir PDF
          </FileButton>
        )}
      </div>
    </div>
  );
}
