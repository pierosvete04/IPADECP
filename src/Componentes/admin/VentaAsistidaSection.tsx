'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { verificarDni } from '@/lib/dni';
import { formatSoles, mensajeError, repartirEntre } from '@/lib/copy';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Componentes/ui/card';
import { Button } from '@/Componentes/ui/button';
import { Input } from '@/Componentes/ui/input';
import { Label } from '@/Componentes/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Componentes/ui/select';
import CursoMultiSelector, { type CursoSeleccionable } from './CursoMultiSelector';

interface CursoVenta extends CursoSeleccionable {
  precio_antes: string | null;
  categoria_id: number | null;
  estado: string | null;
}

interface PromocionCombo {
  id: number;
  titulo: string;
  cantidad_minima: number | null;
  precio_promo: number | null;
  categoria_id: number | null;
  cursoIds: number[];
}

const PROMO_NINGUNA = 'ninguna';

const METODOS = [
  { value: 'yape_plin', label: 'Yape/Plin' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'culqi', label: 'Tarjeta (Culqi)' },
  { value: 'mercadopago', label: 'Tarjeta (Mercado Pago)' },
];

export default function VentaAsistidaSection() {
  return (
    <>
      <h1 className="titulo">Venta asistida</h1>
      <p className="sub">
        Registra aquí una venta hecha fuera del aula (WhatsApp, en persona, etc.): con el DNI del cliente, los cursos y el
        método de pago, se hace exactamente lo que haría el cliente al comprar — se crea su cuenta (o se reutiliza si ya
        tiene una), se registra la venta y queda matriculado de inmediato. Si en cambio solo quieres entregarle un código
        para que el cliente active los cursos por su cuenta, usa <strong>Códigos de acceso</strong> en el menú.
      </p>
      <VentaAsistidaForm />
    </>
  );
}

function VentaAsistidaForm() {
  const [cursos, setCursos] = useState<CursoVenta[]>([]);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [promociones, setPromociones] = useState<PromocionCombo[]>([]);
  const [promoComboId, setPromoComboId] = useState('');

  const [dni, setDni] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [telefono, setTelefono] = useState('');
  const [metodo, setMetodo] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);
  const [resultado, setResultado] = useState<{
    cursosNombres: string[];
    total: number;
    email?: string;
    passwordTemporal?: string;
    yaExistia?: boolean;
  } | null>(null);

  useEffect(() => {
    supabase
      .from('cursos')
      .select('id,nombre,precio_ahora,precio_antes,categoria_id,estado')
      .eq('estado', '1')
      .order('nombre')
      .then(({ data }) => setCursos((data as CursoVenta[]) || []));
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

  const promoCombo = promociones.find((p) => String(p.id) === promoComboId);
  const cursosDisponibles = !promoCombo
    ? cursos
    : promoCombo.cursoIds.length
      ? cursos.filter((c) => promoCombo.cursoIds.includes(c.id))
      : promoCombo.categoria_id
        ? cursos.filter((c) => c.categoria_id === promoCombo.categoria_id)
        : cursos;

  function seleccionarPromo(v: string | null) {
    const val = !v || v === PROMO_NINGUNA ? '' : v;
    setPromoComboId(val);
    setSeleccion(new Set());
  }

  async function verificarConReniec() {
    if (!/^\d{8}$/.test(dni)) {
      setAviso({ texto: 'Ingresa un DNI válido de 8 dígitos.', tipo: 'err' });
      return;
    }
    setVerificando(true);
    setAviso(null);
    const res = await verificarDni(dni, '');
    setVerificando(false);
    if (res.ok && res.nombreCompleto) {
      setNombreCompleto(res.nombreCompleto);
      setAviso({ texto: `Nombre encontrado en RENIEC: ${res.nombreCompleto}`, tipo: 'ok' });
    } else {
      setAviso({ texto: res.motivo || 'No se pudo verificar el DNI en RENIEC. Ingresa el nombre manualmente.', tipo: 'err' });
    }
  }

  async function registrarVenta(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    setResultado(null);

    if (!/^\d{8}$/.test(dni)) return setAviso({ texto: 'Ingresa un DNI válido de 8 dígitos.', tipo: 'err' });
    if (!nombreCompleto.trim()) return setAviso({ texto: 'Ingresa el nombre completo del cliente.', tipo: 'err' });
    if (!seleccion.size) return setAviso({ texto: 'Selecciona al menos un curso.', tipo: 'err' });
    if (promoCombo) {
      const cantidad = promoCombo.cantidad_minima || 1;
      if (seleccion.size !== cantidad) {
        return setAviso({ texto: `Este combo requiere exactamente ${cantidad} curso(s). Tienes ${seleccion.size} seleccionado(s).`, tipo: 'err' });
      }
    }
    if (!metodo) return setAviso({ texto: 'Elige el método de pago.', tipo: 'err' });

    setEnviando(true);
    try {
      const { data: existente } = await supabase.from('perfiles').select('id,email').eq('documento', dni).maybeSingle();

      let alumnoUid: string | null = existente?.id || null;
      let cuentaInfo: { email?: string; passwordTemporal?: string; yaExistia?: boolean } = {};

      if (existente) {
        cuentaInfo = { email: existente.email || undefined, yaExistia: true };
      } else {
        const partes = nombreCompleto.trim().split(/\s+/);
        const nombres = partes.slice(0, Math.max(1, partes.length - 2)).join(' ') || partes[0];
        const apellidos = partes.slice(-2).join(' ') || '';
        const { data: creado, error: errCrear } = await supabase.functions.invoke('admin-crear-usuario', {
          body: { nombres, apellidos, dni, cargo: '', telefono: telefono.trim() || undefined },
        });
        if (errCrear || !creado?.ok) {
          setAviso({ texto: creado?.motivo || mensajeError(errCrear, 'No se pudo crear la cuenta del cliente. Inténtalo de nuevo.'), tipo: 'err' });
          setEnviando(false);
          return;
        }
        alumnoUid = creado.alumno_uid;
        cuentaInfo = { email: creado.email, passwordTemporal: creado.passwordTemporal, yaExistia: creado.yaExistia };
      }

      const cursosElegidos = cursos.filter((c) => seleccion.has(c.id));
      const montosCombo = promoCombo ? repartirEntre(Number(promoCombo.precio_promo) || 0, cursosElegidos.length) : null;
      let total = 0;
      for (const [i, curso] of cursosElegidos.entries()) {
        const monto = montosCombo ? Number(montosCombo[i]) : Number(curso.precio_ahora) || 0;
        const precioLista = Number(curso.precio_antes) || Number(curso.precio_ahora) || monto;
        total += monto;
        const { data: venta, error: errVenta } = await supabase
          .from('ventas')
          .insert({
            curso_id: curso.id,
            alumno_uid: alumnoUid,
            nombre_curso: curso.nombre,
            monto,
            precio_lista: precioLista,
            promocion_id: promoCombo ? promoCombo.id : null,
            metodo,
            estado: 'aprobado',
          })
          .select('id')
          .single();
        if (errVenta) {
          setAviso({
            texto: `Venta registrada parcialmente. Error en "${curso.nombre}": ${mensajeError(errVenta)}. Los cursos ya guardados quedan matriculados; vuelve a intentar solo el que falló.`,
            tipo: 'err',
          });
          setEnviando(false);
          return;
        }
        await supabase
          .from('inscripciones')
          .upsert(
            { alumno_id: alumnoUid, curso_id: curso.id, origen: 'compra', venta_id: venta.id },
            { onConflict: 'alumno_id,curso_id', ignoreDuplicates: true }
          );
      }

      setResultado({ cursosNombres: cursosElegidos.map((c) => c.nombre), total, ...cuentaInfo });
      setAviso({ texto: 'Venta registrada y cliente matriculado.', tipo: 'ok' });
      setDni('');
      setNombreCompleto('');
      setTelefono('');
      setMetodo('');
      setSeleccion(new Set());
      setPromoComboId('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Venta asistida</CardTitle>
        <CardDescription>Completa los datos del cliente, los cursos que compró y cómo pagó.</CardDescription>
      </CardHeader>
      <CardContent>
        {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}
        <form onSubmit={registrarVenta} className="flex flex-col gap-3">
          <div>
            <Label>DNI del cliente</Label>
            <div className="fila mt-1">
              <Input
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="8 dígitos"
                style={{ maxWidth: 160 }}
              />
              <Button type="button" variant="outline" onClick={verificarConReniec} disabled={verificando}>
                {verificando ? 'Verificando…' : 'Verificar con RENIEC'}
              </Button>
            </div>
          </div>

          <div>
            <Label>Nombre completo</Label>
            <Input
              className="mt-1"
              value={nombreCompleto}
              onChange={(e) => setNombreCompleto(e.target.value)}
              placeholder="Nombres y apellidos"
            />
            <p className="sub" style={{ margin: '.3rem 0 0', fontSize: '.78rem' }}>
              Se completa solo al verificar el DNI con RENIEC. Si RENIEC no lo encuentra, ingrésalo aquí manualmente.
            </p>
          </div>

          <div>
            <Label>Teléfono (opcional)</Label>
            <Input className="mt-1" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>

          {promociones.length > 0 && (
            <div>
              <Label>Promoción (opcional)</Label>
              <Select
                items={{
                  [PROMO_NINGUNA]: 'Ninguna, cursos sueltos',
                  ...Object.fromEntries(
                    promociones.map((p) => [String(p.id), `${p.titulo} (${p.cantidad_minima} cursos × ${formatSoles(p.precio_promo)})`])
                  ),
                }}
                value={promoComboId || PROMO_NINGUNA}
                onValueChange={seleccionarPromo}
              >
                <SelectTrigger className="mt-1 w-full hover:border-ring/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PROMO_NINGUNA}>Ninguna, cursos sueltos</SelectItem>
                  {promociones.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.titulo} ({p.cantidad_minima} cursos × {formatSoles(p.precio_promo)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {promoCombo && (
                <p className="sub" style={{ margin: '.3rem 0 0', fontSize: '.78rem' }}>
                  Selecciona exactamente {promoCombo.cantidad_minima} curso{promoCombo.cantidad_minima === 1 ? '' : 's'} del combo
                  abajo — el precio ya es fijo: {formatSoles(promoCombo.precio_promo)} en total.
                </p>
              )}
            </div>
          )}

          <CursoMultiSelector
            cursos={cursosDisponibles}
            seleccion={seleccion}
            onChange={setSeleccion}
            label="Cursos comprados"
            maxSeleccion={promoCombo ? promoCombo.cantidad_minima || 1 : undefined}
          />

          <div>
            <Label>Método de pago</Label>
            <Select value={metodo} onValueChange={(v) => setMetodo(v || '')}>
              <SelectTrigger className="mt-1 w-full hover:border-ring/60">
                <SelectValue placeholder="Elige un método de pago" />
              </SelectTrigger>
              <SelectContent>
                {METODOS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="sub" style={{ margin: '.2rem 0 0', fontSize: '.78rem' }}>
            Si el DNI ya tiene cuenta, se reutiliza automáticamente. Si no existe, se genera un correo{' '}
            <code>@ipadecp.com.pe</code> y una contraseña temporal que deberás entregarle al cliente; al iniciar sesión, el
            aula le pedirá completar los datos que falten.
          </p>

          <Button type="submit" disabled={enviando} className="mt-1">
            {enviando ? (seleccion.size > 1 ? `Registrando ${seleccion.size} cursos…` : 'Registrando…') : 'Registrar venta y matricular'}
          </Button>
        </form>

        {resultado && (
          <div className="aviso ok" style={{ marginTop: '1.2rem' }}>
            <p style={{ margin: 0 }}>
              <strong>Matriculado</strong> en: {resultado.cursosNombres.join(', ')} — Total: {formatSoles(resultado.total)}
            </p>
            {resultado.passwordTemporal && (
              <p style={{ margin: '.5rem 0' }}>
                Cuenta creada: <code>{resultado.email}</code> / contraseña temporal: <code>{resultado.passwordTemporal}</code>
                <br />
                <span className="sub" style={{ fontSize: '.78rem' }}>
                  Entrégale estos datos al cliente ahora; no se volverán a mostrar.
                </span>
              </p>
            )}
            {resultado.yaExistia && resultado.email && (
              <p style={{ margin: '.5rem 0' }}>
                Se vinculó a la cuenta existente: <code>{resultado.email}</code>
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
