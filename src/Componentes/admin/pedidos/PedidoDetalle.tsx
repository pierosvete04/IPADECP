'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatSoles, mensajeError } from '@/lib/copy';
import { COURIERS_ENVIO } from '@/lib/envioCertificado';
import {
  actualizarEstadoPagoPedido,
  BADGE_ESTADO_ENVIO,
  BADGE_ESTADO_PAGO,
  CANAL_LABEL,
  formatFechaPedido,
  METODO_LABEL,
  type DireccionEnvioPedido,
  type EstadoEnvio,
  type EstadoPago,
  type PedidoRow,
} from '@/lib/pedidos';
import { Badge } from '@/Componentes/admin/Badge';
import FileDropzone from '@/Componentes/ui/FileDropzone';
import { Button, buttonVariants } from '@/Componentes/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Componentes/ui/card';
import { Checkbox } from '@/Componentes/ui/checkbox';
import { Input } from '@/Componentes/ui/input';
import { Label } from '@/Componentes/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Componentes/ui/select';

const DIRECCION_VACIA: DireccionEnvioPedido = { direccion: '', direccionSecundaria: '', departamento: '', provincia: '', distrito: '' };

export default function PedidoDetalle({
  pedido,
  onVolver,
  onActualizado,
}: {
  pedido: PedidoRow;
  onVolver: () => void;
  onActualizado: () => void;
}) {
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);
  const [subiendoComprobante, setSubiendoComprobante] = useState(false);
  const [estado, setEstado] = useState<EstadoPago>(pedido.estado_pago);
  const [notas, setNotas] = useState(pedido.notas || '');
  const [incluyeCertificado, setIncluyeCertificado] = useState(pedido.incluye_certificado_fisico);
  const [direccion, setDireccion] = useState<DireccionEnvioPedido>({ ...DIRECCION_VACIA, ...pedido.direccion_envio });
  const [estadoEnvio, setEstadoEnvio] = useState<EstadoEnvio>(pedido.estado_envio);
  const [courier, setCourier] = useState(pedido.courier || '');
  const [courierOtro, setCourierOtro] = useState(pedido.courier_otro || '');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    setEstado(pedido.estado_pago);
    setNotas(pedido.notas || '');
    setIncluyeCertificado(pedido.incluye_certificado_fisico);
    setDireccion({ ...DIRECCION_VACIA, ...pedido.direccion_envio });
    setEstadoEnvio(pedido.estado_envio);
    setCourier(pedido.courier || '');
    setCourierOtro(pedido.courier_otro || '');
    setComprobanteUrl(null);
    if (!pedido.comprobante_url) return;
    supabase.storage
      .from('comprobantes')
      .createSignedUrl(pedido.comprobante_url, 300)
      .then(({ data }) => {
        if (data?.signedUrl) setComprobanteUrl(data.signedUrl);
      });
  }, [pedido]);

  // El checkout ya le pide departamento/distrito al cliente (quedan en su
  // perfil) — al activar el envío de certificado los autocompletamos ahí en
  // vez de hacer que el admin los vuelva a escribir. La dirección exacta
  // (calle/número) no vive en el perfil, así que esa sí se completa a mano.
  async function activarCertificadoFisico(activar: boolean) {
    setIncluyeCertificado(activar);
    if (!activar || !pedido.cliente_uid) return;
    if (direccion.departamento || direccion.distrito) return;
    const { data: perfil } = await supabase.from('perfiles').select('departamento,distrito').eq('id', pedido.cliente_uid).maybeSingle();
    if (perfil) setDireccion((d) => ({ ...d, departamento: perfil.departamento || d.departamento, distrito: perfil.distrito || d.distrito }));
  }

  async function guardar() {
    setGuardando(true);
    setAviso(null);

    const avisoPago = await actualizarEstadoPagoPedido(supabase, pedido, estado);
    if (avisoPago) setAviso(avisoPago);

    if (!pedido.esOrfano) {
      const { error } = await supabase
        .from('pedidos')
        .update({
          notas,
          incluye_certificado_fisico: incluyeCertificado,
          direccion_envio: incluyeCertificado ? direccion : null,
          estado_envio: estadoEnvio,
          courier: courier || null,
          courier_otro: courier === 'otro' ? courierOtro.trim() || null : null,
        })
        .eq('id', pedido.id);
      if (error) {
        setAviso(mensajeError(error));
        setGuardando(false);
        return;
      }
    }

    setGuardando(false);
    onActualizado();
  }

  async function subirComprobante(file: File) {
    setSubiendoComprobante(true);
    setAviso(null);
    const {
      data: { user: admin },
    } = await supabase.auth.getUser();
    if (!admin) {
      setAviso('No se pudo identificar tu sesión de admin.');
      setSubiendoComprobante(false);
      return;
    }
    const extension = file.name.split('.').pop() || 'jpg';
    const ruta = `${admin.id}/pedido-${pedido.id}-${Date.now()}.${extension}`;
    const { error: eSubida } = await supabase.storage.from('comprobantes').upload(ruta, file);
    if (eSubida) {
      setAviso('No se pudo subir el comprobante: ' + eSubida.message);
      setSubiendoComprobante(false);
      return;
    }

    const tabla = pedido.esOrfano ? 'ventas' : 'pedidos';
    const idFila = pedido.esOrfano ? pedido.items[0]?.id : pedido.id;
    const { error: eGuardar } = await supabase.from(tabla).update({ comprobante_url: ruta }).eq('id', idFila);
    if (eGuardar) {
      setAviso(mensajeError(eGuardar));
      setSubiendoComprobante(false);
      return;
    }

    const { data } = await supabase.storage.from('comprobantes').createSignedUrl(ruta, 300);
    if (data?.signedUrl) setComprobanteUrl(data.signedUrl);
    setSubiendoComprobante(false);
    onActualizado();
  }

  const estadoBadge = BADGE_ESTADO_PAGO[pedido.estado_pago];
  const estadoEnvioBadge = BADGE_ESTADO_ENVIO[pedido.estado_envio];
  const esEnvioCertificado = pedido.origen === 'envio_certificado';
  // Certificado directo y envío de certificado siempre incluyen envío físico
  // (no es una opción que el admin decida caso a caso, como sí lo es en un
  // pedido de curso online) — por eso ahí no se muestra el checkbox.
  const certificadoSiempreIncluido = pedido.origen !== 'compra';

  return (
    <div className="flex flex-col gap-6">
      <button type="button" onClick={onVolver} className="flex w-fit items-center gap-1 text-sm font-medium text-primary">
        <ArrowLeft className="h-4 w-4" /> Volver a pedidos
      </button>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{pedido.esOrfano ? `Pedido V-${-pedido.id}` : `Pedido #${pedido.id}`}</h2>
        <div className="flex items-center gap-2">
          {pedido.incluye_certificado_fisico && <Badge color={estadoEnvioBadge.color}>{estadoEnvioBadge.label}</Badge>}
          <Badge color={estadoBadge.color}>{estadoBadge.label}</Badge>
        </div>
      </div>

      {aviso && <div className="aviso err">{aviso}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{esEnvioCertificado ? 'Certificados a enviar' : 'Ítems del pedido'}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {esEnvioCertificado
                ? pedido.certificados.map((c) => (
                    <div key={c.certificado_id} className="border-b py-2 text-sm last:border-0">
                      {c.curso_nombre}
                    </div>
                  ))
                : pedido.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0">
                      <span>{it.nombre_curso}</span>
                      <span className="font-medium">{formatSoles(it.monto)}</span>
                    </div>
                  ))}
              <div className="mt-1 flex justify-between text-sm">
                <span className="text-muted-foreground">{esEnvioCertificado ? 'Costo de envío' : 'Subtotal'}</span>
                <span>{formatSoles(pedido.subtotal)}</span>
              </div>
              {!!pedido.descuento && (
                <div className="flex justify-between text-sm text-green-700">
                  <span>Descuento</span>
                  <span>− {formatSoles(pedido.descuento)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-3 font-semibold">
                <span>Total</span>
                <span className="text-primary">{formatSoles(pedido.total)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Mercado Pago y Culqi confirman el pago solos (webhook) — el comprobante
              manual solo tiene sentido para transferencia y Yape/Plin. */}
          {(pedido.metodo === 'transferencia' || pedido.metodo === 'yape_plin' || comprobanteUrl) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Comprobante de pago</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {comprobanteUrl && (
                  <a href={comprobanteUrl} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={comprobanteUrl} alt="Comprobante" className="max-w-full rounded-md border" />
                  </a>
                )}
                {(pedido.metodo === 'transferencia' || pedido.metodo === 'yape_plin') && (
                  <FileDropzone
                    accept="image/*,application/pdf"
                    onFile={subirComprobante}
                    cargando={subiendoComprobante}
                    label={comprobanteUrl ? 'Reemplazar comprobante' : 'Subir comprobante'}
                    ayuda="JPG, PNG o PDF"
                  />
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Cliente</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <p className="text-sm font-medium">{pedido.cliente_nombre || 'Sin nombre'}</p>
              <p className="text-sm text-muted-foreground">{pedido.cliente_email}</p>
              <p className="text-sm text-muted-foreground">{pedido.cliente_telefono || 'Sin teléfono'}</p>
              <p className="mt-1 text-xs text-muted-foreground">{CANAL_LABEL[pedido.canal] || pedido.canal}</p>
              <p className="text-xs text-muted-foreground">{METODO_LABEL[pedido.metodo || ''] || pedido.metodo || 'Sin método'}</p>
              <p className="text-xs text-muted-foreground">{formatFechaPedido(pedido.fecha)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Estado del pago</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Select value={estado} onValueChange={(v) => setEstado(v as EstadoPago)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="pagado">Pagado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                  <SelectItem value="devolucion">Devolución</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex flex-col gap-1.5">
                <Label>Notas</Label>
                <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Notas internas del pedido…" />
              </div>
            </CardContent>
          </Card>

          {!pedido.esOrfano && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Certificado físico</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {!certificadoSiempreIncluido && (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={incluyeCertificado} onCheckedChange={(v) => activarCertificadoFisico(v === true)} />
                    Incluye envío de certificado físico
                  </label>
                )}

                {(certificadoSiempreIncluido || incluyeCertificado) && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <Label>Dirección</Label>
                      <Input value={direccion.direccion || ''} onChange={(e) => setDireccion((d) => ({ ...d, direccion: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Interior / referencia</Label>
                      <Input
                        value={direccion.direccionSecundaria || ''}
                        onChange={(e) => setDireccion((d) => ({ ...d, direccionSecundaria: e.target.value }))}
                        placeholder="Dpto. 402, casa de reja verde"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1.5">
                        <Label>Departamento</Label>
                        <Input value={direccion.departamento || ''} onChange={(e) => setDireccion((d) => ({ ...d, departamento: e.target.value }))} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Distrito</Label>
                        <Input value={direccion.distrito || ''} onChange={(e) => setDireccion((d) => ({ ...d, distrito: e.target.value }))} />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label>Estado del envío</Label>
                      <Select value={estadoEnvio} onValueChange={(v) => setEstadoEnvio(v as EstadoEnvio)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
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

                    <div className="flex flex-col gap-1.5">
                      <Label>Empresa de envío</Label>
                      <Select value={courier || '_sin'} onValueChange={(v) => setCourier(!v || v === '_sin' ? '' : v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_sin">Sin asignar</SelectItem>
                          {COURIERS_ENVIO.map(({ id, label }) => (
                            <SelectItem key={id} value={id}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {courier === 'otro' && (
                      <div className="flex flex-col gap-1.5">
                        <Label>Nombre del courier</Label>
                        <Input value={courierOtro} onChange={(e) => setCourierOtro(e.target.value)} />
                      </div>
                    )}

                    <Link href={`/admin/rotulo-pedido/${pedido.id}`} target="_blank" className={buttonVariants({ variant: 'outline' })}>
                      <Printer className="h-4 w-4" /> Rótulo
                    </Link>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Button onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
          {pedido.origen === 'compra' && (
            <p className="text-xs text-muted-foreground">Al marcar como pagado, el/los curso(s) se asignan automáticamente al alumno (si aún no los tiene).</p>
          )}
        </div>
      </div>
    </div>
  );
}
