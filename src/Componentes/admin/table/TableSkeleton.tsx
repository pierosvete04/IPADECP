import { Skeleton } from '@/Componentes/ui/skeleton';
import { TableCard } from './TableCard';

/**
 * Reemplaza el "Cargando…" de texto plano en tablas: reserva la misma forma
 * (filas x columnas) que va a tener la tabla real para no producir salto de
 * layout (CLS) cuando llegan los datos.
 */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <TableCard>
      <div className="flex flex-col">
        <div className="flex gap-4 border-b px-4 py-3 md:px-6">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0 md:px-6">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" style={{ opacity: 1 - r * 0.08 }} />
            ))}
          </div>
        ))}
      </div>
    </TableCard>
  );
}
