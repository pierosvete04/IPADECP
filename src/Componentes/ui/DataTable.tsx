import { ReactNode, useCallback } from 'react';
import { ArrowUp, ArrowDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Componentes/ui/table';
import { useTableRows } from '@/Componentes/admin/table/useTableRows';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
}

/**
 * Valor comparable de una celda. Los booleanos se pasan a 0/1 para que
 * "Activo/Inactivo" ordene por estado y no alfabéticamente por "false"/"true".
 */
function valorOrdenable(row: unknown, columnId: string): string | number | null {
  const v = (row as Record<string, unknown>)[columnId];
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return Number(v);
  return String(v);
}

export default function DataTable<T extends { id?: number | string }>({
  columns,
  rows,
  actions,
  vacio = 'Sin registros.',
  vacioAccion,
  filtrosActivos = false,
  vacioFiltrado,
  onLimpiarFiltros,
  titulo,
  entidad = ['registro', 'registros'],
  encabezadoExtra,
  onRowClick,
  rowClickLabel,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  actions?: (row: T) => ReactNode;
  /**
   * Texto para cuando NO hay datos todavía. Es distinto de no tener
   * resultados: ver `vacioFiltrado`.
   */
  vacio?: ReactNode;
  /**
   * Acción que resuelve el vacío ("Crear el primer cupón"). Un estado vacío
   * sin salida deja al admin mirando una frase y sin saber qué hacer.
   */
  vacioAccion?: ReactNode;
  /**
   * Si hay algún filtro o búsqueda aplicados. Sin esto la tabla no puede
   * distinguir "no hay nada" de "tu filtro no encontró nada", y acababa
   * diciendo "Aún no hay pedidos registrados" con la base llena.
   */
  filtrosActivos?: boolean;
  /** Texto para cuando hay filtros y ninguno coincide. */
  vacioFiltrado?: ReactNode;
  /** Si se pasa, el estado sin resultados ofrece un botón para limpiar. */
  onLimpiarFiltros?: () => void;
  /** Título opcional mostrado como encabezado de la tarjeta (estilo TableCard). */
  titulo?: string;
  /**
   * Nombre de lo que se lista, en singular y plural: ['cliente', 'clientes'].
   * Se usa en el pie ("31 clientes"), no en un chip sobre la tabla — el total
   * es un dato de cierre, no un encabezado, y arriba solo robaba una franja
   * entera de alto antes de que empezara el contenido.
   */
  entidad?: [string, string];
  /** Contenido opcional a la derecha del encabezado (ej. un filtro o menú). */
  encabezadoExtra?: ReactNode;
  /**
   * Abre el detalle de la fila al hacer clic en cualquier parte de ella.
   * Cuando se pasa, la fila se vuelve un destino de teclado (Enter/Espacio)
   * para que no dependa del mouse.
   */
  onRowClick?: (row: T) => void;
  /** Texto del tooltip/aria de la fila clicable, ej. "Ver cliente". */
  rowClickLabel?: (row: T) => string;
}) {
  // Mismo motor que usan PedidosLista y las demás tablas armadas a mano
  // (useTableRows). Antes cada una traía su propio ordenamiento y divergían en
  // un detalle que se nota: aquí se comparaba con `localeCompare` SIN locale y
  // allá con `localeCompare(…, 'es')`, así que la Ñ y los acentos se
  // ordenaban distinto según la pantalla en la que estuvieras.
  const getSortValue = useCallback((row: T, columnId: string) => valorOrdenable(row, columnId), []);
  const {
    pageRows: filasPagina,
    totalRows,
    page: paginaSegura,
    totalPages: totalPaginas,
    setPage: setPagina,
    sortColumn,
    sortDirection,
    toggleSort: alternarOrden,
  } = useTableRows<T>({ rows, getSortValue });

  const desde = (paginaSegura - 1) * 15;
  const conEncabezado = titulo || encabezadoExtra;

  return (
    <div className="card table-card">
      {conEncabezado && (
        <div className="table-card-cab">
          {/* El contenedor del título solo existe si HAY título. Si se renderiza
              vacío, la cabecera pasa a tener dos hijos y el `space-between` de
              .table-card-cab empuja los filtros contra el borde derecho, lejos
              de la columna con la que deberían alinearse. */}
          {titulo && (
            <div className="table-card-cab-titulo">
              <h3>{titulo}</h3>
            </div>
          )}
          {encabezadoExtra}
        </div>
      )}
      {!totalRows ? (
        // Dos vacíos distintos, no uno. Antes esto era una sola frase fija,
        // así que una tabla filtrada sin coincidencias afirmaba "Aún no hay
        // registros" — el admin concluía que la base estaba vacía cuando lo
        // único vacío era su filtro.
        filtrosActivos ? (
          <div className="vacio-estado">
            <p className="vacio-estado-titulo">Sin coincidencias</p>
            <p className="vacio-estado-texto">
              {vacioFiltrado ?? `Ningún ${entidad[0]} coincide con estos filtros. Prueba con menos criterios.`}
            </p>
            {onLimpiarFiltros && (
              <button type="button" className="btn sec btn-sm" onClick={onLimpiarFiltros}>
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="vacio-estado">
            <p className="vacio-estado-titulo">Todavía no hay {entidad[1]}</p>
            <p className="vacio-estado-texto">{vacio}</p>
            {vacioAccion}
          </div>
        )
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => {
                const activa = sortColumn === c.key;
                return (
                  <TableHead
                    key={c.key}
                    style={c.align ? { textAlign: c.align } : undefined}
                    // `aria-sort` es lo que anuncia el orden a un lector de
                    // pantalla: antes solo lo decía la flechita.
                    aria-sort={activa ? (sortDirection === 'asc' ? 'ascending' : 'descending') : c.sortable ? 'none' : undefined}
                  >
                    {c.sortable ? (
                      // <button> y no un onClick sobre el <th>: así la
                      // cabecera se puede ordenar también con el teclado.
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1 select-none hover:text-[var(--primario)]"
                        onClick={() => alternarOrden(c.key)}
                        aria-label={`Ordenar por ${c.header}`}
                      >
                        {c.header}
                        <span className={cn('inline-flex align-middle opacity-45', activa && 'text-[var(--primario)] opacity-100')}>
                          {activa ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="size-3.5" />
                            ) : (
                              <ArrowDown className="size-3.5" />
                            )
                          ) : (
                            <ChevronsUpDown className="size-3.5" />
                          )}
                        </span>
                      </button>
                    ) : (
                      c.header
                    )}
                  </TableHead>
                );
              })}
              {actions && <TableHead className="w-px" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filasPagina.map((row, i) => (
              <TableRow
                key={row.id ?? i}
                className={cn(onRowClick && 'cursor-pointer')}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'link' : undefined}
                aria-label={onRowClick ? rowClickLabel?.(row) : undefined}
                onClick={
                  onRowClick
                    ? (e) => {
                        // Si la fila trae sus propios controles (un botón, un
                        // select de estado, un enlace), ese clic es para ellos
                        // y no debe además abrir el detalle.
                        if ((e.target as HTMLElement).closest('button, a, input, select, textarea, [role="button"]')) return;
                        onRowClick(row);
                      }
                    : undefined
                }
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
              >
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
      {totalRows > 0 && (
        <div className="table-card-pie">
          {/* `aria-live` para que al pasar de página se anuncie el nuevo rango:
              si no, quien navega con lector solo oye la tabla recargarse. */}
          <span aria-live="polite">
            {totalRows === 1 ? `1 ${entidad[0]}` : `${totalRows} ${entidad[1]}`}
            {totalPaginas > 1 && ` · mostrando ${desde + 1}–${Math.min(desde + 15, totalRows)}`}
          </span>
          {totalPaginas > 1 && (
            <div className="table-card-pie-nav">
              <button type="button" onClick={() => setPagina(paginaSegura - 1)} disabled={paginaSegura <= 1} aria-label="Página anterior">
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <span>
                {paginaSegura} / {totalPaginas}
              </span>
              <button type="button" onClick={() => setPagina(paginaSegura + 1)} disabled={paginaSegura >= totalPaginas} aria-label="Página siguiente">
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
