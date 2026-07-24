'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { WHATSAPP_PEDIDOS, whatsappLink } from '@/lib/site-config';
import { WhatsAppIcon } from '@/Componentes/ui/WhatsAppIcon';
import { LinkQrCode } from '@/Componentes/ui/LinkQrCode';
import { celebrar } from '@/lib/motion';

export interface CarritoItem {
  id: number;
  nombre: string;
  precio: string | number | null;
}

interface CalcItem {
  curso_id: number;
  precio_lista: number;
  precio_final: number;
}

interface Calc {
  subtotal: number;
  total: number;
  descuento: number;
  promocion: { id: number; titulo: string; ahorro: number } | null;
  items: CalcItem[];
  metodos_permitidos?: string[];
}

const TODOS_LOS_METODOS = ['mercadopago', 'transferencia', 'yape_plin'] as const;

interface MetodoPago {
  metodo: string;
  titulo?: string | null;
  instrucciones?: string | null;
  titular?: string | null;
  numero?: string | null;
  banco?: string | null;
  cci?: string | null;
  qr_url?: string | null;
}

const ICONOS_TARJETA = (
  <>
    <span className="tarjeta-icono visa">VISA</span>
    <span className="tarjeta-icono master">●●</span>
    <span className="tarjeta-icono diners">DC</span>
    <span className="tarjeta-icono amex">AMEX</span>
  </>
);

function DetalleMetodo({ m }: { m?: MetodoPago }) {
  if (!m) return null;
  return (
    <div className="metodo-detalle-info">
      <div className="metodo-detalle-datos">
        {m.instrucciones && <p>{m.instrucciones}</p>}
        {m.titular && (
          <div>
            <strong>Titular:</strong> {m.titular}
          </div>
        )}
        {m.numero && (
          <div>
            <strong>Número:</strong> {m.numero}
          </div>
        )}
        {m.banco && (
          <div>
            <strong>Banco:</strong> {m.banco}
          </div>
        )}
        {m.cci && (
          <div>
            <strong>CCI:</strong> {m.cci}
          </div>
        )}
      </div>
      {m.qr_url && (
        <div className="metodo-detalle-qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.qr_url} alt={`Código QR de ${m.titulo || m.metodo}`} className="metodo-detalle-qr-img" />
          <span>Escanea para pagar</span>
        </div>
      )}
    </div>
  );
}

export default function CheckoutView({
  user,
  carrito,
  calc,
  onVolver,
  onFinalizado,
}: {
  user: User;
  carrito: CarritoItem[];
  calc: Calc;
  onVolver: () => void;
  onFinalizado: () => void;
}) {
  const [perfil, setPerfil] = useState<{ nombre?: string; nombres?: string; apellidos?: string; email?: string; telefono?: string } | null>(null);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [email, setEmail] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [telefono, setTelefono] = useState('');
  const [metodo, setMetodo] = useState<'mercadopago' | 'transferencia' | 'yape_plin'>('mercadopago');
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' | 'info' } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [redirigiendo, setRedirigiendo] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [numeroPedido, setNumeroPedido] = useState<string | null>(null);
  const exitoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (confirmado) celebrar(exitoRef.current);
  }, [confirmado]);

  const metodosPermitidos = useMemo(
    () => (calc.metodos_permitidos && calc.metodos_permitidos.length ? calc.metodos_permitidos : [...TODOS_LOS_METODOS]),
    [calc.metodos_permitidos]
  );

  useEffect(() => {
    if (!metodosPermitidos.includes(metodo) && metodosPermitidos.length) {
      setMetodo(metodosPermitidos[0] as 'mercadopago' | 'transferencia' | 'yape_plin');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metodosPermitidos]);

  useEffect(() => {
    let activo = true;
    supabase
      .from('perfiles')
      .select('nombre,nombres,apellidos,email,telefono')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!activo) return;
        setPerfil(data);
        setEmail(data?.email || user.email || '');
        setNombres(data?.nombres || data?.nombre || '');
        setApellidos(data?.apellidos || '');
        setTelefono(data?.telefono || '');
      });
    supabase
      .from('metodos_pago_config')
      .select('*')
      .then(({ data }) => {
        if (activo) setMetodosPago(data || []);
      });
    return () => {
      activo = false;
    };
  }, [user]);

  const mTransf = metodosPago.find((m) => m.metodo === 'transferencia');
  const mYape = metodosPago.find((m) => m.metodo === 'yape_plin');

  const itemsPorCurso: Record<number, CalcItem> = {};
  (calc.items || []).forEach((it) => (itemsPorCurso[it.curso_id] = it));
  const itemsResumen = carrito.map((it) => {
    const ci = itemsPorCurso[it.id];
    return {
      nombre: it.nombre,
      precio_lista: ci ? ci.precio_lista : it.precio,
      precio_final: ci ? ci.precio_final : it.precio,
    };
  });

  async function confirmar() {
    setAviso(null);
    const nombresV = nombres.trim();
    const apellidosV = apellidos.trim();
    const nuevoEmail = email.trim();
    if (!nombresV || !apellidosV || !nuevoEmail) {
      setAviso({ texto: 'Completa tu correo, nombres y apellidos.', tipo: 'err' });
      return;
    }
    setEnviando(true);
    const emailPrevio = perfil?.email || user.email || '';
    if (nuevoEmail !== emailPrevio) {
      const { error: eMail } = await supabase.auth.updateUser({ email: nuevoEmail });
      if (eMail) {
        setAviso({ texto: eMail.message, tipo: 'err' });
        setEnviando(false);
        return;
      }
    }
    await supabase
      .from('perfiles')
      .update({ nombres: nombresV, apellidos: apellidosV, nombre: `${nombresV} ${apellidosV}`.trim(), email: nuevoEmail, telefono: telefono.trim() })
      .eq('id', user.id);

    if (metodo === 'mercadopago') {
      // Tarjeta de crédito/débito: se paga en la propia página de Mercado Pago
      // (Checkout Pro). La venta la crea la función y la confirma el webhook
      // en cuanto Mercado Pago avise el resultado — el alumno no manda
      // comprobante por WhatsApp para este método.
      setRedirigiendo(true);
      const { data, error } = await supabase.functions.invoke('mercadopago-crear-preferencia', {
        body: { curso_ids: carrito.map((it) => it.id), promocion_id: calc.promocion ? calc.promocion.id : null },
      });
      setEnviando(false);
      if (error || !data?.ok) {
        setRedirigiendo(false);
        setAviso({ texto: data?.motivo || error?.message || 'No se pudo iniciar el pago con Mercado Pago.', tipo: 'err' });
        return;
      }
      window.location.href = data.init_point;
      return;
    }

    const { data: pedido, error: ePedido } = await supabase
      .from('pedidos')
      .insert({
        cliente_uid: user.id,
        cliente_nombre: `${nombresV} ${apellidosV}`.trim(),
        cliente_email: nuevoEmail,
        cliente_telefono: telefono.trim(),
        canal: 'online',
        metodo,
        estado_pago: 'pendiente',
        subtotal: calc.subtotal,
        descuento: calc.descuento,
        total: calc.total,
        promocion_id: calc.promocion ? calc.promocion.id : null,
      })
      .select('id')
      .single();
    if (ePedido || !pedido) {
      setEnviando(false);
      setAviso({ texto: ePedido?.message || 'No se pudo registrar el pedido.', tipo: 'err' });
      return;
    }

    const filas = carrito.map((it) => {
      const ci = itemsPorCurso[it.id];
      return {
        curso_id: it.id,
        alumno_uid: user.id,
        nombre_curso: it.nombre,
        monto: ci ? ci.precio_final : it.precio ? Number(it.precio) : null,
        precio_lista: ci ? ci.precio_lista : it.precio ? Number(it.precio) : null,
        promocion_id: calc.promocion ? calc.promocion.id : null,
        metodo,
        estado: 'pendiente',
        pedido_id: pedido.id,
      };
    });
    const { error } = await supabase.from('ventas').insert(filas);
    setEnviando(false);
    if (error) {
      setAviso({ texto: error.message, tipo: 'err' });
      return;
    }
    setNumeroPedido(`#${pedido.id}`);
    setConfirmado(true);
  }

  if (confirmado) {
    // La opción de Mercado Pago nunca llega a esta pantalla: en cuanto se
    // confirma, se redirige de inmediato a la página de Mercado Pago (ver
    // confirmar()). Esta pantalla es solo para transferencia/yape_plin, que
    // siguen requiriendo el comprobante manual por WhatsApp.
    const mensajeWhatsapp = [
      `Hola, soy ${nombres} ${apellidos}.`.trim(),
      numeroPedido && `Acabo de hacer el pedido ${numeroPedido} por S/ ${calc.total}.`,
      `Curso${itemsResumen.length > 1 ? 's' : ''} comprado${itemsResumen.length > 1 ? 's' : ''}:\n${itemsResumen.map((it) => `- ${it.nombre}`).join('\n')}`,
      'Les envío el comprobante de pago a continuación.',
    ]
      .filter(Boolean)
      .join('\n\n');
    const linkWhatsapp = whatsappLink(WHATSAPP_PEDIDOS, mensajeWhatsapp);

    return (
      <div className="card card-pad" style={{ maxWidth: 480, margin: '2.5rem auto', textAlign: 'center' }} ref={exitoRef}>
        <div style={{ fontSize: '2.6rem' }} data-celebrar-icono>
          <span className="material-symbols-outlined" style={{ fontSize: '2.4rem', color: 'var(--ok)' }}>
            check_circle
          </span>
        </div>
        <h2 className="titulo" style={{ marginTop: '.6rem' }} data-celebrar-item>
          ¡Pedido registrado!
        </h2>
        {numeroPedido && (
          <p className="sub" style={{ marginBottom: '.2rem' }} data-celebrar-item>
            N° de pedido <strong style={{ color: 'var(--texto)' }}>{numeroPedido}</strong>
          </p>
        )}
        <p className="sub" data-celebrar-item>
          Tu pedido quedó pendiente de verificación. Envíanos tu comprobante de pago por WhatsApp para activar tu(s) curso(s).
        </p>

        <div className="wsp-postventa" data-celebrar-item>
          <p className="wsp-postventa-titulo">Envíanos tu comprobante de pago</p>
          <p className="wsp-postventa-sub">Presiona el botón o escanea el QR para escribirnos por WhatsApp y compartirlo.</p>
          <div className="wsp-postventa-fila">
            <a href={linkWhatsapp} target="_blank" rel="noopener noreferrer" className="wsp-btn wsp-btn-grande">
              <WhatsAppIcon className="wsp-icono" />
              Escribir por WhatsApp
            </a>
            <div className="wsp-postventa-qr">
              <LinkQrCode link={linkWhatsapp} size={200} />
              <span>O escanea el QR</span>
            </div>
          </div>
        </div>

        <a href="#" className="btn" style={{ marginTop: '1rem' }} onClick={(e) => { e.preventDefault(); onFinalizado(); }} data-celebrar-item>
          Ir a Mis cursos
        </a>
      </div>
    );
  }

  return (
    <>
      <a href="#" className="migas" onClick={(e) => { e.preventDefault(); onVolver(); }}>
        ← Volver al carrito
      </a>
      <h2 className="titulo" style={{ marginTop: '.4rem' }}>
        Finalizar compra
      </h2>
      <div className="checkout-grid">
        <div>
          <div className="card card-pad" style={{ marginBottom: '.6rem' }}>
            <h3 style={{ margin: '0 0 .5rem' }}>Contacto</h3>
            <label>Correo electrónico</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <div className="perfil-grid">
              <div>
                <label>Nombres</label>
                <input value={nombres} onChange={(e) => setNombres(e.target.value)} required />
              </div>
              <div>
                <label>Apellidos</label>
                <input value={apellidos} onChange={(e) => setApellidos(e.target.value)} required />
              </div>
            </div>
            <label>Teléfono</label>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="999 999 999" />
          </div>
          <div className="card card-pad">
            <h3 style={{ margin: '0 0 .2rem' }}>Pago</h3>
            <p className="sub" style={{ margin: '0 0 .5rem', fontSize: '.82rem' }}>
              Todas las transacciones son seguras y están encriptadas.
            </p>
            <div className="pago-grupo">
              {metodosPermitidos.includes('mercadopago') && (
                <label className={`pago-fila${metodo === 'mercadopago' ? ' activa' : ''}`}>
                  <input type="radio" name="co-metodo" checked={metodo === 'mercadopago'} onChange={() => setMetodo('mercadopago')} style={{ width: 'auto' }} />
                  <span className="pago-fila-texto">
                    <strong>Tarjeta de crédito/débito</strong>
                  </span>
                  <span className="pago-fila-iconos">{ICONOS_TARJETA}</span>
                </label>
              )}

              {metodosPermitidos.includes('transferencia') && (
                <>
                  <label className={`pago-fila${metodo === 'transferencia' ? ' activa' : ''}`}>
                    <input type="radio" name="co-metodo" checked={metodo === 'transferencia'} onChange={() => setMetodo('transferencia')} style={{ width: 'auto' }} />
                    <span className="pago-fila-texto">
                      <strong>Pago por transferencia bancaria</strong>
                    </span>
                  </label>
                  {metodo === 'transferencia' && (
                    <div className="metodo-detalle">
                      <DetalleMetodo m={mTransf} />
                    </div>
                  )}
                </>
              )}

              {metodosPermitidos.includes('yape_plin') && (
                <>
                  <label className={`pago-fila${metodo === 'yape_plin' ? ' activa' : ''}`}>
                    <input type="radio" name="co-metodo" checked={metodo === 'yape_plin'} onChange={() => setMetodo('yape_plin')} style={{ width: 'auto' }} />
                    <span className="pago-fila-texto">
                      <strong>Pago por YAPE o PLIN</strong>
                    </span>
                  </label>
                  {metodo === 'yape_plin' && (
                    <div className="metodo-detalle">
                      <DetalleMetodo m={mYape} />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}
          <button className="btn bloque" disabled={enviando || redirigiendo} onClick={confirmar} style={{ marginTop: '1rem' }}>
            {redirigiendo ? 'Redirigiendo a Mercado Pago…' : `Confirmar pedido · S/ ${calc.total}`}
          </button>
        </div>
        <aside className="checkout-resumen">
          <h3 style={{ margin: '0 0 1rem' }}>Resumen del pedido</h3>
          {calc.promocion && <div className="aviso ok" style={{ margin: '0 0 1rem' }}>🎉 {calc.promocion.titulo} aplicada</div>}
          <div className="checkout-resumen-lista">
            {itemsResumen.map((it, i) => {
              const cambioPrecio = it.precio_final != null && Number(it.precio_final) !== Number(it.precio_lista);
              return (
                <div className="checkout-resumen-item" key={i}>
                  <div className="checkout-resumen-item-info">
                    <span className="checkout-resumen-icono">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                        school
                      </span>
                    </span>
                    <span>{it.nombre}</span>
                  </div>
                  <strong>
                    {cambioPrecio ? (
                      <>
                        <span style={{ textDecoration: 'line-through', color: 'var(--gris)', fontWeight: 400, marginRight: '.4rem' }}>
                          S/ {it.precio_lista}
                        </span>
                        S/ {it.precio_final}
                      </>
                    ) : it.precio_final != null ? (
                      `S/ ${it.precio_final}`
                    ) : (
                      'A confirmar'
                    )}
                  </strong>
                </div>
              );
            })}
          </div>
          <div className="checkout-resumen-total">
            <span>Subtotal</span>
            <strong>S/ {calc.subtotal}</strong>
          </div>
          {calc.descuento > 0 && (
            <div className="checkout-resumen-total">
              <span>Descuento</span>
              <strong style={{ color: 'var(--ok)' }}>− S/ {calc.descuento}</strong>
            </div>
          )}
          <div className="checkout-resumen-total">
            <span>Acceso</span>
            <strong>Inmediato al confirmar pago</strong>
          </div>
          <div className="checkout-resumen-total checkout-resumen-total-final">
            <span>Total</span>
            <strong>S/ {calc.total}</strong>
          </div>
        </aside>
      </div>
    </>
  );
}
