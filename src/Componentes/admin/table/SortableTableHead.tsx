'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/Componentes/ui/table';
import { cn } from '@/lib/utils';
import type { SortDirection } from './useTableRows';

interface SortableTableHeadProps {
  columnId: string;
  label: string;
  activeColumn: string | null;
  direction: SortDirection;
  onSort: (columnId: string) => void;
  className?: string;
}

export function SortableTableHead({ columnId, label, activeColumn, direction, onSort, className }: SortableTableHeadProps) {
  const activo = activeColumn === columnId;
  const Icono = activo && direction === 'asc' ? ArrowUp : activo && direction === 'desc' ? ArrowDown : ArrowUpDown;

  return (
    // `aria-sort` es lo que anuncia el orden a un lector de pantalla; antes lo
    // decía solo la flechita, que además es la misma para "sin ordenar".
    <TableHead
      className={cn('p-0', className)}
      aria-sort={activo ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(columnId)}
        aria-label={`Ordenar por ${label}`}
        className="flex h-10 w-full items-center gap-1 px-2 text-left font-medium text-muted-foreground hover:text-foreground"
      >
        {label}
        <Icono className={cn('size-3.5 shrink-0', activo ? 'opacity-100' : 'opacity-40')} aria-hidden="true" />
      </button>
    </TableHead>
  );
}
