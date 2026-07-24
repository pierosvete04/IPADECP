'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, RefreshCw, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatSoles } from '@/lib/copy';
import {
  actualizarEstadoEnvioPedido,
  actualizarEstadoPagoPedido,
  BADGE_ESTADO_ENVIO,
  BADGE_ESTADO_PAGO,
  CANAL_LABEL,
  formatFechaPedido,
  ORIGEN_LABEL,
  type EstadoEnvio,
  type EstadoPago,
  type OrigenPedido,
  type PedidoRow,
} from '@/lib/pedidos';
import { Badge } from '@/Componentes/admin/Badge';
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

const TODAS = '_todas';

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
  const [actualizandoId, setActualizandoId] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [recargando, setRecargando] = useState(false);

  async function recargar() {
    setRecargando(true);
    await onCambiado();
    setRecargando(false);
  }

  useEffect(() => {
    supabase
      .from('promociones')
      .select('id,titulo')
      .order('titulo')
      .then(({ data }) => setPromociones((data as PromocionSimple[]) || []));
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="titulo" style={{ margin: 0 }}>
          Pedidos
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={recargar} disabled={recargando} title="Los cambios de estado se reflejan al instante; usa esto solo si sospechas que otro admin cambió algo en paralelo.">
            <RefreshCw className={`h-4 w-4 ${recargando ? 'animate-spin' : ''}`} /> Actualizar
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

      {aviso && <div className="aviso err">{aviso}</div>}

      <div className="flex flex-nowrap items-end gap-2 overflow-x-auto pb-1">
        <div className="flex shrink-0 flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Cliente o correo</Label>
          <Input placeholder="Buscar…" className="w-40" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Tipo de pedido</Label>
          <Select value={filtroOrigen} onValueChange={(v) => setFiltroOrigen(v || TODAS)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todos los tipos</SelectItem>
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
          <Label className="text-xs text-muted-foreground">Promoción</Label>
          <Select value={filtroPromocion} onValueChange={(v) => setFiltroPromocion(v || TODAS)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas las promociones</SelectItem>
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
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todos los estados de envío</SelectItem>
              {Object.entries(BADGE_ESTADO_ENVIO).map(([valor, { label }]) => (
                <SelectItem key={valor} value={valor}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {pedidos === null ? (
        <TableSkeleton cols={9} />
      ) : (
        <TableCard badge={<Badge color="gris">{totalRows}</Badge>}>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead columnId="id" label="Pedido" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} />
                <SortableTableHead columnId="fecha" label="Fecha" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} />
                <SortableTableHead columnId="cliente" label="Cliente" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} />
                <SortableTableHead columnId="canal" label="Canal" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} />
                <SortableTableHead columnId="origen" label="Tipo" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} />
                <SortableTableHead columnId="promocion" label="Promoción" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} />
                <SortableTableHead columnId="total" label="Total" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} />
                <SortableTableHead columnId="estado" label="Estado del pago" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} />
                <SortableTableHead columnId="envio" label="Estado del envío" activeColumn={sortColumn} direction={sortDirection} onSort={toggleSort} />
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    Aún no hay pedidos registrados.
                  </TableCell>
                </TableRow>
              )}
              {pageRows.map((p) => {
                const estado = BADGE_ESTADO_PAGO[p.estado_pago];
                const envio = BADGE_ESTADO_ENVIO[p.estado_envio];
                const actualizando = actualizandoId === p.id;
                return (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => onVer(p)}>
                    <TableCell className="font-medium text-primary">{p.esOrfano ? `V-${-p.id}` : `#${p.id}`}</TableCell>
                    <TableCell>{formatFechaPedido(p.fecha)}</TableCell>
                    <TableCell>{p.cliente_nombre || p.cliente_email || '—'}</TableCell>
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
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onVer(p);
                        }}
                      >
                        Ver
                      </Button>
                    </TableCell>
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
