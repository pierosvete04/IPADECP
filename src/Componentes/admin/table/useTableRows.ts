'use client';

import { useMemo, useState } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

interface UseTableRowsOptions<T> {
  rows: T[];
  pageSize?: number;
  getSortValue?: (row: T, columnId: string) => string | number | null | undefined;
}

/**
 * Ordena y pagina un array de filas en el cliente. `getSortValue` mapea una
 * fila + id de columna a un valor comparable; sin ese callback el orden queda deshabilitado.
 */
// 15 por página, igual que DataTable — las dos tablas del panel deben pasar de
// página al mismo ritmo o se siente que son dos productos distintos.
export function useTableRows<T>({ rows, pageSize = 15, getSortValue }: UseTableRowsOptions<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [page, setPage] = useState(1);

  const sortedRows = useMemo(() => {
    if (!sortColumn || !sortDirection || !getSortValue) return rows;

    return [...rows].sort((a, b) => {
      const va = getSortValue(a, sortColumn);
      const vb = getSortValue(b, sortColumn);

      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;

      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDirection === 'asc' ? va - vb : vb - va;
      }

      const cmp = String(va).localeCompare(String(vb), 'es');
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortColumn, sortDirection, getSortValue]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const paginaSegura = Math.min(page, totalPages);

  const pageRows = useMemo(() => {
    const inicio = (paginaSegura - 1) * pageSize;
    return sortedRows.slice(inicio, inicio + pageSize);
  }, [sortedRows, paginaSegura, pageSize]);

  function toggleSort(columnId: string) {
    setPage(1);
    if (sortColumn !== columnId) {
      setSortColumn(columnId);
      setSortDirection('asc');
      return;
    }
    if (sortDirection === 'asc') {
      setSortDirection('desc');
      return;
    }
    setSortColumn(null);
    setSortDirection(null);
  }

  return {
    pageRows,
    totalRows: sortedRows.length,
    page: paginaSegura,
    totalPages,
    setPage,
    sortColumn,
    sortDirection,
    toggleSort,
  };
}
