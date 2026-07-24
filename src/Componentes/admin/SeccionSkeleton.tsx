import { Skeleton } from '@/Componentes/ui/skeleton';
import { TableSkeleton } from './table/TableSkeleton';

/**
 * Fallback de next/dynamic mientras se descarga el chunk de una sección
 * admin. Imita la forma típica de una pantalla del panel (título + tabla)
 * para que la carga del bundle no se sienta como una pantalla en blanco.
 */
export default function SeccionSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-48" />
      <TableSkeleton />
    </div>
  );
}
