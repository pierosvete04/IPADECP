'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatSoles, mensajeError, repartirEntre } from '@/lib/copy';
import {
  asignarInscripcionesPorPago,
  ESTADO_PAGO_A_VENTA_ESTADO,
  ORIGEN_LABEL,
  type EstadoPago,
  type ItemNuevoPedido,
  type OrigenPedido,
  type PerfilCliente,
} from '@/lib/pedidos';
import { ClienteSelector, type CuentaResuelta } from './ClienteSelector';
import BuscarCursoModal from './BuscarCursoModal';
import FileDropzone from '@/Componentes/ui/FileDropzone';
import { Button } from '@/Componentes/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Componentes/ui/card';
import { Label } from '@/Componentes/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Componentes/ui/select';
import Aviso from '@/Componentes/ui/Aviso';

const SIN_PROMO = '_ninguna';
const ETIQUETA_SIN_PROMO = 'Ninguna, cursos sueltos';

const METODOS: Record<string, string> = {
  pendiente: 'Pendiente',
  transferencia: 'Transferencia',
  yape_plin: 'Yape / Plin',
  mercadopago: 'Tarjeta (Mercado Pago)',
  culqi: 'Tarjeta (Culqi)',
};

// Yape/Plin y transferencia se confirman viendo la captura que manda el
// cliente: no hay webhook que avise, así que el comprobante ES la prueba del
// pago y se sube acá mismo.
const METODOS_CON_COMPROBANTE = ['transferencia', 'yape_plin'];
// Mercado Pago y Culqi confirman solos por webhook; no hay captura que subir
// y pedirla sería pedir algo que el admin no tiene.
const METODOS_TARJETA = ['mercadopago', 'culqi'];

const ESTADOS_PAGO: Record<string, string> = {
  pagado: 'Pagado',
  pendiente: 'Pendiente',
  cancelado: 'Cancelado',
};

interface PromocionCombo {
  id: number;
  titulo: string;
  cantidad_minima: number | null;
  precio_promo: number | null;
  categoria_id: number | null;
  cursoIds: number[];
}

export default function PedidoNuevo({ onVolver, onCreado }: { onVolver: () => void; onCreado: () => void }) {
  const [cliente, setCliente] = useState<PerfilCliente | null>(null);
  const [cuenta, setCuenta] = useState<CuentaResuelta | null>(null);
  const [items, setItems] = useState<ItemNuevoPedido[]>([]);
  // 'envio_certificado' no se ofrece acá: ese pedido no lleva cursos sino
  // certificados ya emitidos, y tiene su propia pantalla (Enviar certificado).
  const [origen, setOrigen] = useState<Extract<OrigenPedido, 'compra' | 'certificado_directo'>>('compra');
  const [buscandoCurso, setBuscandoCurso] = useState(false);
  const [promociones, setPromociones] = useState<PromocionCombo[]>([]);
  const [promoId, setPromoId] = useState(SIN_PROMO);
  const [metodo, setMetodo] = useState('pendiente');
  const [estadoPago, setEstadoPago] = useState<EstadoPago>('pagado');
  const [notas, setNotas] = useState('');
  // Se guarda el File en memoria y se sube DESPUÉS de crear el pedido: la ruta
  // en el bucket lleva el id del pedido, que hasta ese momento no existe.
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // Solo combos de precio fijo: son los únicos donde el precio del pedido deja
  // de ser la suma de los cursos y pasa a ser un monto único a repartir.
  useEffect(() => {
    supabase
      .from('promociones')
      .select('id,titulo,cantidad_minima,precio_promo,categoria_id,promocion_cursos(curso_id)')
      .eq('estado', '1')
      .eq('tipo', 'precio_fijo_bundle')
      .order('titulo')
      .then(({ data }) =>
        setPromociones(
          ((data as unknown as (PromocionCombo & { promocion_cursos?: { curso_id: number }[] })[]) || []).map((p) => ({
            id: p.id,
            titulo: p.titulo,
            cantidad_minima: p.cantidad_minima,
            precio_promo: p.precio_promo,
            categoria_id: p.categoria_id,
            cursoIds: (p.promocion_cursos || []).map((x) => x.curso_id),
          }))
        )
      );
  }, []);

  const promoCombo = promociones.find((p) => String(p.id) === promoId) || null;

  // Con un combo activo el precio de cada curso deja de ser el suyo de lista:
  // el combo cuesta un monto fijo que se reparte entre los cursos elegidos
  // (repartirEntre distribuye los centavos sobrantes para que la suma cuadre
  // exactamente con el precio del combo, sin perder un céntimo por redondeo).
  const montosCombo = promoCombo && items.length ? repartirEntre(Number(promoCombo.precio_promo) || 0, items.length) : null;
  const itemsConPrecio = items.map((it, i) => (montosCombo ? { ...it, precio: Number(montosCombo[i]) } : it));
  const total = itemsConPrecio.reduce((acc, it) => acc + it.precio, 0);

  const cursosDelCombo = useMemo(() => (promoCombo?.cursoIds.length ? promoCombo.cursoIds : undefined), [promoCombo]);
  const cursosRequeridos = promoCombo ? promoCombo.cantidad_minima || 1 : 0;
  const puedeGuardar = !!cliente && items.length > 0 && !guardando;

  function quitarItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function cambiarPromo(v: string | null) {
    setPromoId(v || SIN_PROMO);
    // Los cursos ya agregados pueden no pertenecer al combo nuevo, así que se
    // vacía la lista en vez de dejar una mezcla inválida.
    setItems([]);
  }

  async function guardar() {
    setAviso(null);
    if (!cliente) {
      setAviso('Elige un cliente.');
      return;
    }
    if (!items.length) {
      setAviso('Agrega al menos un curso.');
      return;
    }
    if (promoCombo && items.length !== cursosRequeridos) {
      setAviso(`El combo "${promoCombo.titulo}" requiere exactamente ${cursosRequeridos} curso(s). Tienes ${items.length}.`);
      return;
    }
    setGuardando(true);

    const {
      data: { user: admin },
    } = await supabase.auth.getUser();

    const { data: pedido, error: ePedido } = await supabase
      .from('pedidos')
      .insert({
        cliente_uid: cliente.id,
        cliente_nombre: cliente.nombre,
        cliente_email: cliente.email,
        cliente_telefono: cliente.telefono,
        canal: 'admin',
        metodo,
        estado_pago: estadoPago,
        subtotal: total,
        descuento: 0,
        total,
        promocion_id: promoCombo ? promoCombo.id : null,
        origen,
        // Un certificado directo siempre termina en un certificado físico que
        // hay que hacerle llegar al cliente; no es opcional como en un curso
        // online. Mismo criterio que usa Certificados directos al emitir.
        incluye_certificado_fisico: origen === 'certificado_directo',
        notas: notas.trim() || null,
        creado_por: admin?.id || null,
      })
      .select('id')
      .single();
    if (ePedido || !pedido) {
      setAviso(mensajeError(ePedido, 'No se pudo crear el pedido.'));
      setGuardando(false);
      return;
    }

    // El comprobante se sube recién ahora, con el id del pedido ya en mano. Si
    // falla no se aborta nada: el pedido es válido igual y la captura se puede
    // volver a subir desde el detalle — perder el pedido por una imagen sería
    // peor que quedarse sin la imagen.
    if (comprobante && METODOS_CON_COMPROBANTE.includes(metodo)) {
      const extension = comprobante.name.split('.').pop() || 'jpg';
      const ruta = `${admin?.id || 'admin'}/pedido-${pedido.id}-${Date.now()}.${extension}`;
      const { error: eSubida } = await supabase.storage.from('comprobantes').upload(ruta, comprobante);
      if (eSubida) {
        setAviso(`El pedido P-${String(pedido.id).padStart(4, '0')} se creó, pero no se pudo subir el comprobante (${eSubida.message}). Súbelo desde el detalle del pedido.`);
      } else {
        await supabase.from('pedidos').update({ comprobante_url: ruta }).eq('id', pedido.id);
      }
    }

    const estadoVenta = ESTADO_PAGO_A_VENTA_ESTADO[estadoPago] || 'pendiente';
    const filas = itemsConPrecio.map((it) => ({
      curso_id: it.curso_id,
      alumno_uid: cliente.id,
      nombre_curso: it.nombre_curso,
      monto: it.precio,
      // Con combo, `precio_lista` guarda el precio suelto del curso para que se
      // vea cuánto se descontó; sin combo ambos son lo mismo.
      precio_lista: it.precio,
      promocion_id: promoCombo ? promoCombo.id : null,
      metodo,
      estado: estadoVenta,
      pedido_id: pedido.id,
    }));
    const { data: ventasInsertadas, error: eVentas } = await supabase.from('ventas').insert(filas).select('id,curso_id,nombre_curso');
    if (eVentas) {
      setAviso(mensajeError(eVentas));
      setGuardando(false);
      return;
    }

    // Solo los pedidos de curso matriculan al pagar. En un certificado directo
    // el cliente no va a cursar nada: la inscripción la crea recién la emisión
    // del certificado (emitirCertificadoParaCurso, con origen 'admin'), y
    // adelantarla acá le daría acceso al aula a un curso que no compró para
    // llevar.
    if (estadoPago === 'pagado' && origen === 'compra') {
      const avisos = await asignarInscripcionesPorPago(
        supabase,
        (ventasInsertadas || []).map((v) => ({ id: v.id, curso_id: v.curso_id, nombre_curso: v.nombre_curso, alumno_uid: cliente.id }))
      );
      if (avisos.length) setAviso(`El pedido se creó pagado, pero ${avisos.join(' ')}`);
    }

    setGuardando(false);
    onCreado();
  }

  return (
    <div className="flex flex-col gap-6">
      <button type="button" onClick={onVolver} className="flex w-fit items-center gap-1 text-sm font-medium text-primary">
        <ArrowLeft className="h-4 w-4" /> Volver a pedidos
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Crear pedido</h2>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Tipo de pedido</Label>
          <Select value={origen} onValueChange={(v) => setOrigen((v || 'compra') as 'compra' | 'certificado_directo')}>
            <SelectTrigger className="w-48">
              <SelectValue>{(v) => ORIGEN_LABEL[v as OrigenPedido]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="compra">{ORIGEN_LABEL.compra}</SelectItem>
              <SelectItem value="certificado_directo">{ORIGEN_LABEL.certificado_directo}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={guardar} disabled={!puedeGuardar}>
            {guardando ? 'Creando…' : 'Crear pedido'}
          </Button>
        </div>
      </div>

      {/* `aviso` a secas es `display:none` en estilos.css — solo .ok/.err/.info
          lo vuelven visible. Este bloque, que explica que el certificado NO se
          emite aquí, no se veía nunca. */}
      {origen === 'certificado_directo' && (
        <div className="aviso info">
          Este pedido queda <strong>pendiente de emisión</strong>. El certificado no se emite acá: aparecerá en{' '}
          <strong>Certificación directa → Pendientes de emitir</strong>, donde le pones el período, la fecha y el cargo de cada curso.
        </div>
      )}

      <Aviso mensaje={aviso} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm text-muted-foreground">Cursos</CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setBuscandoCurso(true)}
                disabled={!!promoCombo && items.length >= cursosRequeridos}
              >
                <Plus className="h-4 w-4" /> Agregar curso
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {items.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Todavía no agregaste cursos.</p>}
              {itemsConPrecio.map((it, i) => (
                <div key={i} className="flex items-center justify-between gap-3 border-b py-2 last:border-0">
                  <p className="flex-1 text-sm font-medium">{it.nombre_curso}</p>
                  <span className="w-24 text-right text-sm font-medium">{formatSoles(it.precio)}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => quitarItem(i)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
              {promoCombo && (
                <p className="text-xs text-muted-foreground">
                  El combo cuesta {formatSoles(promoCombo.precio_promo)} por {cursosRequeridos} curso(s) — el monto se reparte entre los cursos que
                  elijas. Llevas {items.length} de {cursosRequeridos}.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Pago</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex justify-between border-t pt-3 font-semibold">
                <span>Total</span>
                <span className="text-primary">{formatSoles(total)}</span>
              </div>

              {promociones.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label>Promoción / combo</Label>
                  <Select value={promoId} onValueChange={cambiarPromo}>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v) => (v === SIN_PROMO ? ETIQUETA_SIN_PROMO : promociones.find((p) => String(p.id) === v)?.titulo || ETIQUETA_SIN_PROMO)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SIN_PROMO}>{ETIQUETA_SIN_PROMO}</SelectItem>
                      {promociones.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.titulo} ({p.cantidad_minima} cursos × {formatSoles(p.precio_promo)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="mt-2 grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Método de pago</Label>
                  <Select value={metodo} onValueChange={(v) => setMetodo(v || 'pendiente')}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{(v) => METODOS[v as string]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(METODOS).map(([valor, label]) => (
                        <SelectItem key={valor} value={valor}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Estado del pago</Label>
                  <Select value={estadoPago} onValueChange={(v) => setEstadoPago(v as EstadoPago)}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{(v) => ESTADOS_PAGO[v as string]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ESTADOS_PAGO).map(([valor, label]) => (
                        <SelectItem key={valor} value={valor}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {METODOS_CON_COMPROBANTE.includes(metodo) && (
                <div className="flex flex-col gap-1.5">
                  <Label>Comprobante de pago</Label>
                  <FileDropzone
                    accept="image/*,application/pdf"
                    onFile={setComprobante}
                    label={comprobante ? 'Cambiar comprobante' : 'Subir la captura del pago'}
                    ayuda="JPG, PNG o PDF"
                    nombreArchivo={comprobante?.name || null}
                  />
                  <p className="text-xs text-muted-foreground">
                    Se sube al crear el pedido. Si te falta ahora, puedes agregarlo después desde el detalle.
                  </p>
                </div>
              )}

              {/* Igual que arriba: sin modificador este aviso estaba oculto y
                  el admin buscaba un campo de comprobante que no existe para
                  los pagos con tarjeta. */}
              {METODOS_TARJETA.includes(metodo) && (
                <div className="aviso info">
                  Pago con <strong>tarjeta de crédito/débito</strong> vía {METODOS[metodo]}. No lleva comprobante: la pasarela confirma
                  el cobro sola por webhook y deja registrado el número de operación.
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label>Notas</Label>
                <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Notas internas del pedido…" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <ClienteSelector value={cliente} onChange={setCliente} onCuentaResuelta={setCuenta} />
              {/* Las credenciales solo se muestran una vez: si el admin recarga
                  sin copiarlas, la contraseña temporal se pierde y hay que
                  resetearla desde Supabase. */}
              {cuenta?.passwordTemporal && (
                <div className="aviso ok mt-3" role="status">
                  <p style={{ margin: 0 }}>
                    Cuenta creada: <code>{cuenta.email}</code>
                    <br />
                    Contraseña temporal: <code>{cuenta.passwordTemporal}</code>
                  </p>
                  <p className="text-xs">Entrégaselos al cliente ahora; no se volverán a mostrar.</p>
                </div>
              )}
              {cuenta?.yaExistia && cuenta.email && !cuenta.passwordTemporal && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Ese DNI ya tenía cuenta: se vinculó a <code>{cuenta.email}</code>.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {buscandoCurso && (
        <BuscarCursoModal
          soloCursoIds={cursosDelCombo}
          onAgregar={(item) => setItems((prev) => [...prev, item])}
          onClose={() => setBuscandoCurso(false)}
        />
      )}
    </div>
  );
}
