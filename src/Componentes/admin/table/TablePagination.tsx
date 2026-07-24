'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/Componentes/ui/button';
import { cn } from '@/lib/utils';

interface TablePaginationProps {
  page: number;
  totalPages: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function TablePagination({ page, totalPages, totalRows, onPageChange, className }: TablePaginationProps) {
  if (totalRows === 0) return null;

  const paginas = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1);

  return (
    <div className={cn('flex items-center justify-between gap-3 border-t px-4 py-3 md:px-6', className)}>
      <p className="text-sm text-muted-foreground">
        Página {page} de {totalPages} · {totalRows} {totalRows === 1 ? 'resultado' : 'resultados'}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        {paginas.map((p, idx) => {
          const anterior = paginas[idx - 1];
          const salto = anterior !== undefined && p - anterior > 1;
          return (
            <span key={p} className="flex items-center gap-1">
              {salto && <span className="px-1 text-sm text-muted-foreground">…</span>}
              <Button variant={p === page ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => onPageChange(p)}>
                {p}
              </Button>
            </span>
          );
        })}
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
