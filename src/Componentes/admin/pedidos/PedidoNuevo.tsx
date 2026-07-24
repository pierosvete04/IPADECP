'use client';

import { useState } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatSoles, mensajeError } from '@/lib/copy';
import { asignarInscripcionesPorPago, ESTADO_PAGO_A_VENTA_ESTADO, type EstadoPago, type ItemNuevoPedido, type PerfilCliente } from '@/lib/pedidos';
import { ClienteSelector } from './ClienteSelector';
import BuscarCursoModal from './BuscarCursoModal';
import { Button } from '@/Componentes/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Componentes/ui/card';
import { Label } from '@/Componentes/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Componentes/ui/select';

export default function PedidoNuevo({ onVolver, onCreado }: { onVolver: () => void; onCreado: () => void }) {
  const [cliente, setCliente] = useState<PerfilCliente | null>(null);
  const [items, setItems] = useState<ItemNuevoPedido[]>([]);
  const [buscandoCurso, setBuscandoCurso] = useState(false);
  const [metodo, setMetodo] = useState('pendiente');
  const [estadoPago, setEstadoPago] = useState<EstadoPago>('pagado');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const total = items.reduce((acc, it) => acc + it.precio, 0);
  const puedeGuardar = !!cliente && items.length > 0 && !guardando;

  function quitarItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
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

    const estadoVenta = ESTADO_PAGO_A_VENTA_ESTADO[estadoPago] || 'pendiente';
    const filas = items.map((it) => ({
      curso_id: it.curso_id,
      alumno_uid: cliente.id,
      nombre_curso: it.nombre_curso,
      monto: it.precio,
      precio_lista: it.precio,
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

    if (estadoPago === 'pagado') {
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

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Crear pedido</h2>
        <Button onClick={guardar} disabled={!puedeGuardar}>
          {guardando ? 'Creando…' : 'Crear pedido'}
        </Button>
      </div>

      {aviso && <div className="aviso err">{aviso}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm text-muted-foreground">Cursos</CardTitle>
              <Button type="button" size="sm" variant="outline" onClick={() => setBuscandoCurso(true)}>
                <Plus className="h-4 w-4" /> Agregar curso
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {items.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Todavía no agregaste cursos.</p>}
              {items.map((it, i) => (
                <div key={i} className="flex items-center justify-between gap-3 border-b py-2 last:border-0">
                  <p className="flex-1 text-sm font-medium">{it.nombre_curso}</p>
                  <span className="w-24 text-right text-sm font-medium">{formatSoles(it.precio)}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => quitarItem(i)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
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

              <div className="mt-2 grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Método de pago</Label>
                  <Select value={metodo} onValueChange={(v) => setMetodo(v || '')}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="yape_plin">Yape</SelectItem>
                      <SelectItem value="mercadopago">Tarjeta (Mercado Pago)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Estado del pago</Label>
                  <Select value={estadoPago} onValueChange={(v) => setEstadoPago(v as EstadoPago)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pagado">Pagado</SelectItem>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

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
              <ClienteSelector value={cliente} onChange={setCliente} />
            </CardContent>
          </Card>
        </div>
      </div>

      {buscandoCurso && <BuscarCursoModal onAgregar={(item) => setItems((prev) => [...prev, item])} onClose={() => setBuscandoCurso(false)} />}
    </div>
  );
}
