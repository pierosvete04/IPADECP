'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, RefreshCw, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatSoles } from '@/lib/copy';
import {
  actualizarEstadoEnvioPedido,
  actualizarEstadoPagoPedido,
  BADGE_ESTADO_ENVIO,
  BADGE_ESTADO_PAGO,
  CANAL_LABEL,
  codigoPedido,
  formatFechaCorta,
  ORIGEN_LABEL,
  type EstadoEnvio,
  type EstadoPago,
  type OrigenPedido,
  type PedidoRow,
} from '@/lib/pedidos';
import { descargarListadoPedidosPdf } from '@/lib/reportePedidos';
import { Badge } from '@/Componentes/admin/Badge';
import Aviso from '@/Componentes/ui/Aviso';
import { TableCard } from '@/Componentes/admin/table/TableCard';
import { TableSkeleton } from '@/Componentes/admin/table/TableSkeleton';
import { SortableTableHead } from '@/Componentes/admin/table/SortableTableHead';
import { TablePagination } from '@/Componentes/admin/table/TablePagination';
import { useTableRows } from '@/Componentes/admin/table/useTableRows';
import { Button } from '@/Componentes/ui/button';
import { Input } from '@/Componentes/ui/input';
import { Label } from '@/Componentes/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Componentes/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/Componentes/ui/table';

// Valor centinela de "sin filtrar". Lleva guion bajo para no chocar nunca con
// un id real de promoción ni con un valor de enum. Ojo: `SelectValue` de Base
// UI pinta el valor crudo si no le dices cómo etiquetarlo — por eso los tres
// filtros de abajo le pasan una función que traduce el valor a su texto, y no
// un `<SelectValue />` pelado (así se veía literalmente "_todas" en el
// disparador).
const TODAS = '_todas';

const ETIQUETA_TODOS_TIPOS = 'Todos los tipos';
const ETIQUETA_TODAS_PROMOS = 'Todas las promociones';
const ETIQUETA_TODOS_ENVIOS = 'Todos los estados';

const ORIGEN_COLOR: Record<OrigenPedido, 'gris' | 'azul' | 'celeste'> = {
  compra: 'gris',
  certificado_directo: 'azul',
  envio_certificado: 'celeste',
};

interface PromocionSimple {
  id: number;
  titulo: string;
}

function valorOrden(p: PedidoRow, columna: string) {
  switch (columna) {
    case 'id':
      return p.id;
    case 'fecha':
      return p.fecha ?? '';
    case 'cliente':
      return p.cliente_nombre ?? p.cliente_email ?? '';
    case 'canal':
      return p.canal;
    case 'total':
      return Number(p.total) || 0;
    case 'estado':
      return p.estado_pago;
    case 'envio':
      return p.estado_envio;
    case 'promocion':
      return p.promocion_titulo ?? '';
    case 'origen':
      return p.origen;
    default:
      return null;
  }
}

export default function PedidosLista({
  pedidos,
  onVer,
  onCrear,
  onEnviarCertificado,
  onCambiado,
  onPedidoActualizado,
}: {
  pedidos: PedidoRow[] | null;
  onVer: (pedido: PedidoRow) => void;
  onCrear: () => void;
  onEnviarCertificado: () => void;
  onCambiado: () => Promise<void>;
  onPedidoActualizado: (id: number, cambios: Partial<PedidoRow>) => void;
}) {
  const router = useRouter();
  const [buscar, setBuscar] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [filtroPromocion, setFiltroPromocion] = useState(TODAS);
  const [filtroEstadoEnvio, setFiltroEstadoEnvio] = useState(TODAS);
  const [filtroOrigen, setFiltroOrigen] = useState(TODAS);
  const [promociones, setPromociones] = useState<PromocionSimple[]>([]);
  const [promocionesRotas, setPromocionesRotas] = useState(false);
  const [actualizandoId, setActualizandoId] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [recargando, setRecargando] = useState(false);
  // Selección para exportar. Guarda ids, no filas: las filas se recrean en cada
  // recarga (y en cada cambio de estado optimista), así que quedarse con el
  // objeto dejaría el PDF con datos viejos.
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());

  async function recargar() {
    setRecargando(true);
    await onCambiado();
    setRecargando(false);
  }

  useEffect(() => {
    // Si esto falla, el desplegable de promociones queda vacío. No se levanta
    // como error de pantalla (la tabla sí funciona sin él), pero tampoco se
    // esconde: el propio filtro lo dice.
    supabase
      .from('promociones')
      .select('id,titulo')
      .order('titulo')
      .then(({ data, error: ePromos }) => {
        if (ePromos) {
          setPromocionesRotas(true);
          return;
        }
        setPromociones((data as PromocionSimple[]) || []);
      });
  }, []);

  const filtrados = useMemo(() => {
    const q = buscar.toLowerCase().trim();
    return (pedidos || []).filter((p) => {
      if (q && ![p.cliente_nombre, p.cliente_email].some((v) => (v || '').toLowerCase().includes(q))) return false;
      if (fechaDesde && (!p.fecha || p.fecha < fechaDesde)) return false;
      if (fechaHasta && (!p.fecha || p.fecha > `${fechaHasta}T23:59:59`)) return false;
      if (filtroPromocion !== TODAS && String(p.promocion_id ?? '') !== filtroPromocion) return false;
      if (filtroEstadoEnvio !== TODAS && p.estado_envio !== filtroEstadoEnvio) return false;
      if (filtroOrigen !== TODAS && p.origen !== filtroOrigen) return false;
      return true;
    });
  }, [pedidos, buscar, fechaDesde, fechaHasta, filtroPromocion, filtroEstadoEnvio, filtroOrigen]);

  const { pageRows, totalRows, page, totalPages, setPage, sortColumn, sortDirection, toggleSort } = useTableRows({
    rows: filtrados,
    getSortValue: valorOrden,
  });

  const hayFiltros =
    !!buscar.trim() || !!fechaDesde || !!fechaHasta || filtroPromocion !== TODAS || filtroEstadoEnvio !== TODAS || filtroOrigen !== TODAS;

  function limpiarFiltros() {
    setBuscar('');
    setFechaDesde('');
    setFechaHasta('');
    setFiltroPromocion(TODAS);
    setFiltroEstadoEnvio(TODAS);
    setFiltroOrigen(TODAS);
  }

  function alternarSeleccion(id: number) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // "Todos" son los FILTRADOS, no los de la página actual ni los 200 del
  // historial: si acabas de acotar por fecha, lo que esperas exportar es
  // justamente ese recorte.
  const todosFiltradosSeleccionados = filtrados.length > 0 && filtrados.every((p) => seleccionados.has(p.id));

  function alternarSeleccionTodos() {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (todosFiltradosSeleccionados) filtrados.forEach((p) => next.delete(p.id));
      else filtrados.forEach((p) => next.add(p.id));
      return next;
    });
  }

  function exportarPdf() {
    // Se exporta en el orden en que se ve la tabla (ya filtrada y ordenada),
    // no en el orden en que se fueron marcando las casillas.
    const elegidos = filtrados.filter((p) => seleccionados.has(p.id));
    if (!elegidos.length) return;
    descargarListadoPedidosPdf(elegidos, new Date());
  }

  // Optimista: refleja el nuevo estado en la fila al instante actualizando
  // solo ese pedido en memoria (ver PedidosSection.actualizarPedidoLocal),
  // sin el viaje redondo de recargar TODO el listado por un solo cambio. Si
  // la mutación falla se revierte la fila al valor anterior.
  async function cambiarEstadoPago(pedido: PedidoRow, estado: EstadoPago) {
    const anterior = pedido.estado_pago;
    setActualizandoId(pedido.id);
    setAviso(null);
    onPedidoActualizado(pedido.id, { estado_pago: estado });

    const mensaje = await actualizarEstadoPagoPedido(supabase, pedido, estado);
    setActualizandoId(null);

    // actualizarEstadoPagoPedido devuelve el mensaje "Se marcó pagado, pero…"
    // cuando el cambio de estado SÍ se guardó y solo falló la inscripción
    // automática (ver lib/pedidos.ts) — ahí no hay que revertir la fila,
    // solo avisar. Cualquier otro mensaje es un error real de guardado.
    if (mensaje && !mensaje.startsWith('Se marcó pagado')) {
      onPedidoActualizado(pedido.id, { estado_pago: anterior });
      setAviso(mensaje);
      return;
    }
    if (mensaje) setAviso(mensaje);
  }

  async function cambiarEstadoEnvio(pedido: PedidoRow, estado: EstadoEnvio) {
    const anterior = pedido.estado_envio;
    setActualizandoId(pedido.id);
    setAviso(null);
    onPedidoActualizado(pedido.id, { estado_envio: estado });

    const mensaje = await actualizarEstadoEnvioPedido(supabase, pedido.id, estado);
    setActualizandoId(null);

    if (mensaje) {
      onPedidoActualizado(pedido.id, { estado_envio: anterior });
      setAviso(mensaje);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="cabecera-seccion">
        <h1 className="titulo">Pedidos</h1>
        <div className="cabecera-seccion-acciones">
          {/* El `title` traía un párrafo de 130 caracteres: un tooltip nativo
              no se alcanza con teclado, no se puede seleccionar y se va solo.
              La explicación larga vive ahora bajo el título, donde se lee. */}
          <Button variant="outline" size="sm" onClick={recargar} disabled={recargando}>
            <RefreshCw className={`h-4 w-4 ${recargando ? 'animate-spin' : ''}`} aria-hidden="true" />{' '}
            {recargando ? 'Actualizando…' : 'Actualizar'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/admin?sec=tarifas-envio-certificado')}>
            <Truck className="h-4 w-4" /> Tarifas de envío
          </Button>
          <Button variant="outline" size="sm" onClick={onEnviarCertificado}>
            <Plus className="h-4 w-4" /> Enviar certificado
          </Button>
          <Button size="sm" onClick={onCrear}>
            <Plus className="h-4 w-4" /> Crear pedido
          </Button>
        </div>
      </div>

      <p className="sub" style={{ margin: '-1rem 0 0' }}>
        Compras de la web y pedidos que registras tú. Los cambios de estado se guardan al instante; usa
        &quot;Actualizar&quot; solo si sospechas que otro administrador cambió algo en paralelo.
      </p>

      <Aviso mensaje={aviso} />

      <div className="flex flex-nowrap items-end gap-2 overflow-x-auto pb-1">
        <div className="flex shrink-0 flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Cliente o correo</Label>
          <Input placeholder="Buscar…" className="w-40" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Tipo de pedido</Label>
          <Select value={filtroOrigen} onValueChange={(v) => setFiltroOrigen(v || TODAS)}>
            <SelectTrigger className="w-36">
              <SelectValue>{(v) => (v === TODAS ? ETIQUETA_TODOS_TIPOS : ORIGEN_LABEL[v as OrigenPedido])}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>{ETIQUETA_TODOS_TIPOS}</SelectItem>
              {Object.entries(ORIGEN_LABEL).map(([valor, label]) => (
                <SelectItem key={valor} value={valor}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Desde</Label>
          <Input type="date" className="w-36" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Hasta</Label>
          <Input type="date" className="w-36" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">
            {promocionesRotas ? 'Promoción (no se pudo cargar)' : 'Promoción'}
          </Label>
          <Select value={filtroPromocion} onValueChange={(v) => setFiltroPromocion(v || TODAS)}>
            <SelectTrigger className="w-36">
              <SelectValue>
                {(v) => (v === TODAS ? ETIQUETA_TODAS_PROMOS : promociones.find((p) => String(p.id) === v)?.titulo || ETIQUETA_TODAS_PROMOS)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>{ETIQUETA_TODAS_PROMOS}</SelectItem>
              {promociones.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.titulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Estado del envío</Label>
          <Select value={filtroEstadoEnvio} onValueChange={(v) => setFiltroEstadoEnvio(v || TODAS)}>
            <SelectTrigger className="w-40">
              <SelectValue>{(v) => (v === TODAS ? ETIQUETA_TODOS_ENVIOS : BADGE_ESTADO_ENVIO[v as EstadoEnvio]?.label)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>{ETIQUETA_TODOS_ENVIOS}</SelectItem>
              {Object.entries(BADGE_ESTADO_ENVIO).map(([valor, { label }]) => (
                <SelectItem key={valor} value={valor}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {seleccionados.size > 0 && (
        <div className="barra-seleccion">
          <span className="barra-seleccion-info">
            <span>
              <b>{seleccionados.size}</b> {seleccionados.size === 1 ? 'pedido seleccionado' : 'pedidos seleccionados'}
            </span>
            <button type="button" className="barra-seleccion-limpiar" onClick={() => setSeleccionados(new Set())}>
              Quitar selección
            </button>
          </span>
          <span className="barra-seleccion-acciones">
            <button type="button" className="btn btn-sm" onClick={exportarPdf}>
              <FileText size={14} /> Exportar listado en PDF
            </button>
          </span>
        </div>
      )}

      {/* TableCard va sin `badge`: el conteo total vive en el pie, junto a la
          paginación (ver TablePagination). Arriba gastaba una franja entera
          antes de la primera fila para decir un número que igual se repite
          abajo. */}
      {pedidos === null ? (
        <TableSkeleton cols={10} />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-px">
                  <span className="chk-fila">
                    <input
                      type="checkbox"
                      checked={todosFiltradosSeleccionados}
                      onChange={alternarSeleccionTodos}
                      aria-label="Seleccionar todos los pedidos filtrados"
                    />
                  </span>
                </TableHead>
                <SortableTableHead columnId="id" label="Pedido" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} />
                <SortableTableHead columnId="fecha" label="Fecha" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} />
                <SortableTableHead columnId="cliente" label="Cliente" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} />
                <SortableTableHead columnId="canal" label="Canal" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} />
                <SortableTableHead columnId="origen" label="Tipo" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} />
                <SortableTableHead columnId="promocion" label="Promoción" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} />
                <SortableTableHead columnId="total" label="Total" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} />
                <SortableTableHead columnId="estado" label="Estado del pago" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} />
                <SortableTableHead columnId="envio" label="Estado del envío" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* `pageRows` sale DESPUÉS de aplicar los seis filtros. El
                  mensaje fijo "Aún no hay pedidos registrados" era falso en
                  cuanto filtrabas por fecha sin coincidencias: parecía que la
                  base estaba vacía cuando lo único vacío era el filtro. */}
              {pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10}>
                    {hayFiltros ? (
                      <div className="vacio-estado">
                        <p className="vacio-estado-titulo">Sin coincidencias</p>
                        <p className="vacio-estado-texto">Ningún pedido coincide con estos filtros. Prueba con menos criterios.</p>
                        <button type="button" className="btn sec btn-sm" onClick={limpiarFiltros}>
                          Limpiar filtros
                        </button>
                      </div>
                    ) : (
                      <div className="vacio-estado">
                        <p className="vacio-estado-titulo">Todavía no hay pedidos</p>
                        <p className="vacio-estado-texto">
                          Aquí caen las compras de la web y los pedidos que registras tú. Crea el primero para probarlo.
                        </p>
                        <button type="button" className="btn btn-sm" onClick={onCrear}>
                          Crear pedido
                        </button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )}
              {pageRows.map((p) => {
                const estado = BADGE_ESTADO_PAGO[p.estado_pago];
                const envio = BADGE_ESTADO_ENVIO[p.estado_envio];
                const actualizando = actualizandoId === p.id;
                return (
                  // La fila abre el detalle también con teclado: sin tabIndex
                  // ni onKeyDown, el único camino al detalle de un pedido era
                  // el mouse (el botón "Ver" se quitó a propósito).
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    role="link"
                    tabIndex={0}
                    aria-label={`Ver el pedido ${codigoPedido(p)} de ${p.cliente_nombre || p.cliente_email || 'cliente sin nombre'}`}
                    onClick={() => onVer(p)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onVer(p);
                      }
                    }}
                  >
                    <TableCell>
                      <span className="chk-fila">
                        <input
                          type="checkbox"
                          checked={seleccionados.has(p.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => alternarSeleccion(p.id)}
                          aria-label={`Seleccionar el pedido ${codigoPedido(p)}`}
                        />
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="codigo-fila">{codigoPedido(p)}</span>
                    </TableCell>
                    <TableCell>{formatFechaCorta(p.fecha)}</TableCell>
                    <TableCell>
                      <span className="celda-corta" title={p.cliente_nombre || p.cliente_email || ''}>
                        {p.cliente_nombre || p.cliente_email || '—'}
                      </span>
                    </TableCell>
                    <TableCell>{CANAL_LABEL[p.canal] || p.canal}</TableCell>
                    <TableCell>
                      <Badge color={ORIGEN_COLOR[p.origen]}>{ORIGEN_LABEL[p.origen]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.promocion_titulo || '—'}</TableCell>
                    <TableCell>{formatSoles(p.total)}</TableCell>
                    <TableCell>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Select value={p.estado_pago} disabled={actualizando} onValueChange={(v) => cambiarEstadoPago(p, v as EstadoPago)}>
                          <SelectTrigger className="h-auto w-fit gap-1.5 border-none bg-transparent p-0 shadow-none focus-visible:ring-0 [&_svg]:opacity-50">
                            <Badge color={estado.color}>{estado.label}</Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(BADGE_ESTADO_PAGO).map(([valor, { label }]) => (
                              <SelectItem key={valor} value={valor}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.incluye_certificado_fisico ? (
                        <div onClick={(e) => e.stopPropagation()}>
                          <Select value={p.estado_envio} disabled={actualizando} onValueChange={(v) => cambiarEstadoEnvio(p, v as EstadoEnvio)}>
                            <SelectTrigger className="h-auto w-fit gap-1.5 border-none bg-transparent p-0 shadow-none focus-visible:ring-0 [&_svg]:opacity-50">
                              <Badge color={envio.color}>{envio.label}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(BADGE_ESTADO_ENVIO).map(([valor, { label }]) => (
                                <SelectItem key={valor} value={valor}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {/* Sin botón "Ver": la fila entera ya abre el detalle. El
                        botón era un segundo camino al mismo sitio y solo
                        gastaba una columna. */}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <TablePagination page={page} totalPages={totalPages} totalRows={totalRows} onPageChange={setPage} />
        </TableCard>
      )}
    </div>
  );
}
