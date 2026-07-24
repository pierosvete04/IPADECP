'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import { encontrarZonaPorDepartamento, type CertificadoIncluido, type ZonaEnvioCertificado } from '@/lib/envioCertificado';
import type { DireccionEnvioPedido, EstadoPago, MetodoPago } from '@/lib/pedidos';
import { Button } from '@/Componentes/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Componentes/ui/card';
import { Checkbox } from '@/Componentes/ui/checkbox';
import { Input } from '@/Componentes/ui/input';
import { Label } from '@/Componentes/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Componentes/ui/select';

interface AlumnoBusqueda {
  id: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  departamento: string | null;
  distrito: string | null;
}

interface CertificadoAlumno {
  id: number;
  curso_id: number | null;
  codigo_verificacion: string;
  cursos: { nombre: string } | { nombre: string }[] | null;
}

function nombreCursoDe(c: CertificadoAlumno): string {
  if (!c.cursos) return 'Certificado';
  return Array.isArray(c.cursos) ? c.cursos[0]?.nombre || 'Certificado' : c.cursos.nombre;
}

const DIRECCION_VACIA: DireccionEnvioPedido = { direccion: '', direccionSecundaria: '', departamento: '', distrito: '' };

export default function PedidoNuevoEnvioCertificado({ onVolver, onCreado }: { onVolver: () => void; onCreado: () => void }) {
  const [busquedaAlumno, setBusquedaAlumno] = useState('');
  const [perfiles, setPerfiles] = useState<AlumnoBusqueda[]>([]);
  const [alumnoId, setAlumnoId] = useState('');
  const [certificadosAlumno, setCertificadosAlumno] = useState<CertificadoAlumno[]>([]);
  const [certificadosElegidos, setCertificadosElegidos] = useState<number[]>([]);
  const [zonas, setZonas] = useState<ZonaEnvioCertificado[]>([]);
  const [zonaId, setZonaId] = useState('');
  const [costoEnvio, setCostoEnvio] = useState('');
  const [direccion, setDireccion] = useState<DireccionEnvioPedido>({ ...DIRECCION_VACIA });
  const [metodo, setMetodo] = useState<MetodoPago>('pendiente');
  const [estadoPago, setEstadoPago] = useState<EstadoPago>('pendiente');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('zonas_envio_certificado')
      .select('*')
      .eq('activo', true)
      .order('orden')
      .then(({ data }) => setZonas((data as ZonaEnvioCertificado[]) || []));
  }, []);

  useEffect(() => {
    const q = busquedaAlumno.trim();
    if (q.length < 2) {
      setPerfiles([]);
      return;
    }
    let activo = true;
    const t = setTimeout(() => {
      supabase
        .from('perfiles')
        .select('id,nombre,email,telefono,departamento,distrito')
        .neq('rol', 'admin')
        .or(`nombre.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(8)
        .then(({ data }) => {
          if (activo) setPerfiles((data as AlumnoBusqueda[]) || []);
        });
    }, 250);
    return () => {
      activo = false;
      clearTimeout(t);
    };
  }, [busquedaAlumno]);

  const alumnoElegido = perfiles.find((p) => p.id === alumnoId);

  useEffect(() => {
    if (!alumnoId) {
      setCertificadosAlumno([]);
      setCertificadosElegidos([]);
      return;
    }
    supabase
      .from('certificados')
      .select('id,curso_id,codigo_verificacion,cursos(nombre)')
      .eq('alumno_uid', alumnoId)
      .then(({ data }) => setCertificadosAlumno((data as CertificadoAlumno[]) || []));
  }, [alumnoId]);

  useEffect(() => {
    if (!alumnoElegido?.departamento) return;
    const zona = encontrarZonaPorDepartamento(zonas, alumnoElegido.departamento);
    if (zona) {
      setZonaId(String(zona.id));
      setCostoEnvio(String(zona.costo_envio));
      setDireccion((d) => ({ ...d, departamento: alumnoElegido.departamento || d.departamento, distrito: alumnoElegido.distrito || d.distrito }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumnoElegido?.id, zonas]);

  function elegirZona(id: string) {
    setZonaId(id);
    const zona = zonas.find((z) => String(z.id) === id);
    if (zona) setCostoEnvio(String(zona.costo_envio));
  }

  function toggleCertificado(id: number) {
    setCertificadosElegidos((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function guardar() {
    setAviso(null);
    if (!alumnoElegido) {
      setAviso('Elige un cliente.');
      return;
    }
    if (!certificadosElegidos.length) {
      setAviso('Elige al menos un certificado.');
      return;
    }
    setGuardando(true);

    const {
      data: { user: admin },
    } = await supabase.auth.getUser();

    const certificados: CertificadoIncluido[] = certificadosAlumno
      .filter((c) => certificadosElegidos.includes(c.id))
      .map((c) => ({ certificado_id: c.id, curso_nombre: nombreCursoDe(c), codigo_verificacion: c.codigo_verificacion }));

    const costo = Number(costoEnvio) || 0;
    const { error } = await supabase.from('pedidos').insert({
      cliente_uid: alumnoElegido.id,
      cliente_nombre: alumnoElegido.nombre,
      cliente_email: alumnoElegido.email,
      cliente_telefono: alumnoElegido.telefono,
      canal: 'admin',
      metodo,
      estado_pago: estadoPago,
      subtotal: costo,
      descuento: 0,
      total: costo,
      notas: notas.trim() || null,
      creado_por: admin?.id || null,
      origen: 'envio_certificado',
      incluye_certificado_fisico: true,
      direccion_envio: direccion,
      estado_envio: 'no_preparado',
      zona_envio_id: zonaId ? Number(zonaId) : null,
      certificados,
    });

    setGuardando(false);
    if (error) {
      setAviso(mensajeError(error, 'No se pudo registrar el envío.'));
      return;
    }
    onCreado();
  }

  return (
    <div className="flex flex-col gap-6">
      <button type="button" onClick={onVolver} className="flex w-fit items-center gap-1 text-sm font-medium text-primary">
        <ArrowLeft className="h-4 w-4" /> Volver a pedidos
      </button>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Enviar certificado</h2>
        <Button onClick={guardar} disabled={guardando}>
          {guardando ? 'Registrando…' : 'Registrar envío'}
        </Button>
      </div>

      {aviso && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{aviso}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              {alumnoElegido ? (
                <div className="flex items-start justify-between gap-2 rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">{alumnoElegido.nombre || 'Sin nombre'}</p>
                    <p className="text-xs text-muted-foreground">{alumnoElegido.email}</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAlumnoId('')}>
                    Cambiar
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Input placeholder="Busca un cliente por nombre o correo…" value={busquedaAlumno} onChange={(e) => setBusquedaAlumno(e.target.value)} />
                  {perfiles.length > 0 && (
                    <div className="flex flex-col gap-1">
                      {perfiles.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setAlumnoId(p.id);
                            setBusquedaAlumno('');
                            setPerfiles([]);
                          }}
                          className="rounded-md p-2 text-left text-sm hover:bg-muted"
                        >
                          <span className="font-medium">{p.nombre || 'Sin nombre'}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{p.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {alumnoElegido && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Certificados a enviar</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {certificadosAlumno.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Este cliente no tiene certificados emitidos.</p>}
                {certificadosAlumno.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={certificadosElegidos.includes(c.id)} onCheckedChange={() => toggleCertificado(c.id)} />
                    {nombreCursoDe(c)}
                  </label>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Dirección de envío</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Dirección</Label>
                <Input value={direccion.direccion || ''} onChange={(e) => setDireccion((d) => ({ ...d, direccion: e.target.value }))} placeholder="Av. Ejemplo 123" />
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
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Zona de envío</Label>
                  <Select value={zonaId || '_sin'} onValueChange={(v) => elegirZona(!v || v === '_sin' ? '' : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_sin">Sin zona</SelectItem>
                      {zonas.map((z) => (
                        <SelectItem key={z.id} value={String(z.id)}>
                          {z.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Costo de envío (S/)</Label>
                  <Input type="number" step="0.01" min={0} value={costoEnvio} onChange={(e) => setCostoEnvio(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Pago</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Método de pago</Label>
                <Select value={metodo} onValueChange={(v) => setMetodo((v || 'pendiente') as MetodoPago)}>
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
                <Select value={estadoPago} onValueChange={(v) => setEstadoPago((v || 'pendiente') as EstadoPago)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente de verificación</SelectItem>
                    <SelectItem value="pagado">Pagado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Notas</Label>
                <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Notas internas del pedido…" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
