import { ReactNode, useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Componentes/ui/table';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
}

interface Orden {
  col: string;
  dir: 'asc' | 'desc';
}

function comparar(a: unknown, b: unknown, dir: 'asc' | 'desc'): number {
  let cmp: number;
  if (typeof a === 'number' && typeof b === 'number') {
    cmp = a - b;
  } else if (typeof a === 'boolean' && typeof b === 'boolean') {
    cmp = Number(a) - Number(b);
  } else {
    cmp = String(a ?? '').localeCompare(String(b ?? ''));
  }
  return dir === 'asc' ? cmp : -cmp;
}

export default function DataTable<T extends { id?: number | string }>({
  columns,
  rows,
  actions,
  vacio = 'Sin registros.',
  titulo,
  contador,
  encabezadoExtra,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  actions?: (row: T) => ReactNode;
  vacio?: string;
  /** Título opcional mostrado como encabezado de la tarjeta (estilo TableCard). */
  titulo?: string;
  /** Contador opcional junto al título, ej. "128 alumnos". */
  contador?: string | number;
  /** Contenido opcional a la derecha del encabezado (ej. un filtro o menú). */
  encabezadoExtra?: ReactNode;
}) {
  const [orden, setOrden] = useState<Orden | null>(null);

  const filas = useMemo(() => {
    if (!orden) return rows;
    return [...rows].sort((a, b) => comparar((a as Record<string, unknown>)[orden.col], (b as Record<string, unknown>)[orden.col], orden.dir));
  }, [rows, orden]);

  function alternarOrden(col: string) {
    setOrden((prev) => {
      if (!prev || prev.col !== col) return { col, dir: 'asc' };
      if (prev.dir === 'asc') return { col, dir: 'desc' };
      return null;
    });
  }

  const conEncabezado = titulo || contador !== undefined || encabezadoExtra;

  return (
    <div className="card table-card">
      {conEncabezado && (
        <div className="table-card-cab">
          <div className="table-card-cab-titulo">
            {titulo && <h3>{titulo}</h3>}
            {contador !== undefined && <span className="tag canjeado">{contador}</span>}
          </div>
          {encabezadoExtra}
        </div>
      )}
      {!filas.length ? (
        <p className="vacio">{vacio}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn(c.sortable && 'cursor-pointer select-none hover:text-[var(--primario)]')}
                  style={c.align ? { textAlign: c.align } : undefined}
                  onClick={c.sortable ? () => alternarOrden(c.key) : undefined}
                >
                  {c.header}
                  {c.sortable && (
                    <span
                      className={cn(
                        'ml-1 inline-flex align-middle opacity-45',
                        orden?.col === c.key && 'text-[var(--primario)] opacity-100'
                      )}
                    >
                      {orden?.col === c.key ? (
                        orden.dir === 'asc' ? (
                          <ArrowUp className="size-3.5" />
                        ) : (
                          <ArrowDown className="size-3.5" />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3.5" />
                      )}
                    </span>
                  )}
                </TableHead>
              ))}
              {actions && <TableHead className="w-px" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((row, i) => (
              <TableRow key={row.id ?? i}>
                {columns.map((c) => (
                  <TableCell key={c.key} style={c.align ? { textAlign: c.align } : undefined}>
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                  </TableCell>
                ))}
                {actions && (
                  <TableCell>
                    <div className="acciones">{actions(row)}</div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
