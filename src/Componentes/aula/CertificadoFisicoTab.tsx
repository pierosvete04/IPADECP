'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import { WHATSAPP_PEDIDOS, whatsappLink } from '@/lib/site-config';
import { WhatsAppIcon } from '@/Componentes/ui/WhatsAppIcon';
import { LinkQrCode } from '@/Componentes/ui/LinkQrCode';
import { celebrar } from '@/lib/motion';
import {
  encontrarZonaPorDepartamento,
  getZonasEnvioActivas,
  type DireccionEnvioCertificado,
  type ZonaEnvioCertificado,
} from '@/lib/envioCertificado';

interface CertificadoAlumno {
  id: number;
  codigo_verificacion: string;
  cursos: { nombre: string } | { nombre: string }[] | null;
}

function nombreCursoDe(c: CertificadoAlumno): string {
  if (!c.cursos) return 'Certificado';
  return Array.isArray(c.cursos) ? c.cursos[0]?.nombre || 'Certificado' : c.cursos.nombre;
}

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

export default function CertificadoFisicoTab({ user }: { user: User }) {
  const [certificados, setCertificados] = useState<CertificadoAlumno[] | null>(null);
  const [elegidos, setElegidos] = useState<number[]>([]);
  const [perfil, setPerfil] = useState<{
    nombre?: string;
    email?: string;
    telefono?: string;
    documento?: string;
    tipo_documento?: string;
    departamento?: string;
    distrito?: string;
  } | null>(null);
  const [zonas, setZonas] = useState<ZonaEnvioCertificado[]>([]);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [direccion, setDireccion] = useState<DireccionEnvioCertificado>({
    direccion: '',
    direccionSecundaria: '',
    departamento: '',
    provincia: '',
    distrito: '',
  });
  const [metodo, setMetodo] = useState<'transferencia' | 'yape_plin'>('transferencia');
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'err' } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [numeroPedido, setNumeroPedido] = useState<string | null>(null);
  const exitoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (confirmado) celebrar(exitoRef.current);
  }, [confirmado]);

  useEffect(() => {
    let activo = true;
    supabase
      .from('certificados')
      .select('id,codigo_verificacion,cursos(nombre)')
      .eq('alumno_uid', user.id)
      .then(({ data }) => {
        if (activo) setCertificados((data as CertificadoAlumno[]) || []);
      });
    supabase
      .from('perfiles')
      .select('nombre,email,telefono,documento,tipo_documento,departamento,distrito')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!activo) return;
        setPerfil(data || null);
        setDireccion((d) => ({ ...d, departamento: data?.departamento || d.departamento, distrito: data?.distrito || d.distrito }));
      });
    getZonasEnvioActivas(supabase).then((z) => {
      if (activo) setZonas(z);
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

  const zonaDetectada = useMemo(
    () => (direccion.departamento ? encontrarZonaPorDepartamento(zonas, direccion.departamento) : undefined),
    [zonas, direccion.departamento]
  );
  const costoEnvio = zonaDetectada?.costo_envio ?? 0;

  const mTransf = metodosPago.find((m) => m.metodo === 'transferencia');
  const mYape = metodosPago.find((m) => m.metodo === 'yape_plin');

  function toggleCertificado(id: number) {
    setElegidos((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function confirmar() {
    setAviso(null);
    if (!elegidos.length) {
      setAviso({ texto: 'Elige al menos un certificado para enviar.', tipo: 'err' });
      return;
    }
    if (!direccion.direccion?.trim() || !direccion.departamento?.trim() || !direccion.distrito?.trim()) {
      setAviso({ texto: 'Completa tu dirección, departamento y distrito.', tipo: 'err' });
      return;
    }
    setEnviando(true);

    const certificadosElegidos = (certificados || [])
      .filter((c) => elegidos.includes(c.id))
      .map((c) => ({ certificado_id: c.id, curso_nombre: nombreCursoDe(c), codigo_verificacion: c.codigo_verificacion }));

    const { data: pedido, error } = await supabase
      .from('pedidos')
      .insert({
        cliente_uid: user.id,
        cliente_nombre: perfil?.nombre || user.email,
        cliente_telefono: perfil?.telefono || null,
        cliente_email: perfil?.email || user.email,
        canal: 'online',
        origen: 'envio_certificado',
        incluye_certificado_fisico: true,
        certificados: certificadosElegidos,
        direccion_envio: direccion,
        zona_envio_id: zonaDetectada?.id ?? null,
        subtotal: costoEnvio,
        descuento: 0,
        total: costoEnvio,
        metodo,
        estado_pago: 'pendiente',
        estado_envio: 'no_preparado',
      })
      .select('id')
      .single();

    setEnviando(false);
    if (error || !pedido) {
      setAviso({ texto: mensajeError(error, 'No se pudo registrar el pedido de envío.'), tipo: 'err' });
      return;
    }
    setNumeroPedido(`#${pedido.id}`);
    setConfirmado(true);
  }

  if (confirmado) {
    const mensajeWhatsapp = [
      `Hola, soy ${perfil?.nombre || user.email}.`,
      numeroPedido && `Acabo de solicitar el envío de mi certificado físico, pedido ${numeroPedido}, por S/ ${costoEnvio}.`,
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
          ¡Solicitud registrada!
        </h2>
        {numeroPedido && (
          <p className="sub" style={{ marginBottom: '.2rem' }} data-celebrar-item>
            N° de pedido <strong style={{ color: 'var(--texto)' }}>{numeroPedido}</strong>
          </p>
        )}
        <p className="sub" data-celebrar-item>
          Tu pedido quedó pendiente de verificación. Envíanos tu comprobante de pago por WhatsApp para que empecemos a preparar el envío.
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
      </div>
    );
  }

  return (
    <>
      <h2 className="titulo" style={{ margin: '0 0 .3rem' }}>
        Certificado físico
      </h2>
      <p className="sub" style={{ marginTop: 0 }}>
        Pide que te enviemos por courier una copia física de tu(s) certificado(s) ya emitido(s).
      </p>

      {certificados === null ? (
        <p>Cargando…</p>
      ) : !certificados.length ? (
        <p className="vacio">Aún no tienes certificados emitidos para enviar.</p>
      ) : (
        <div className="checkout-grid">
          <div>
            <div className="card card-pad" style={{ marginBottom: '.6rem' }}>
              <h3 style={{ margin: '0 0 .5rem' }}>Certificado(s) a enviar</h3>
              {certificados.map((c) => (
                <label key={c.id} className="fila" style={{ padding: '.2rem 0' }}>
                  <input type="checkbox" checked={elegidos.includes(c.id)} onChange={() => toggleCertificado(c.id)} style={{ width: 'auto' }} />
                  {nombreCursoDe(c)}
                </label>
              ))}
            </div>

            <div className="card card-pad" style={{ marginBottom: '.6rem' }}>
              <h3 style={{ margin: '0 0 .5rem' }}>Dirección de envío</h3>
              <label>Dirección</label>
              <input
                value={direccion.direccion || ''}
                onChange={(e) => setDireccion((d) => ({ ...d, direccion: e.target.value }))}
                placeholder="Av. Ejemplo 123"
              />
              <label style={{ marginTop: '.5rem' }}>Interior / referencia</label>
              <input
                value={direccion.direccionSecundaria || ''}
                onChange={(e) => setDireccion((d) => ({ ...d, direccionSecundaria: e.target.value }))}
                placeholder="Dpto. 402, casa de reja verde"
              />
              <div className="perfil-grid" style={{ marginTop: '.5rem' }}>
                <div>
                  <label>Departamento</label>
                  <input value={direccion.departamento || ''} onChange={(e) => setDireccion((d) => ({ ...d, departamento: e.target.value }))} />
                </div>
                <div>
                  <label>Provincia</label>
                  <input value={direccion.provincia || ''} onChange={(e) => setDireccion((d) => ({ ...d, provincia: e.target.value }))} />
                </div>
                <div>
                  <label>Distrito</label>
                  <input value={direccion.distrito || ''} onChange={(e) => setDireccion((d) => ({ ...d, distrito: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="card card-pad">
              <h3 style={{ margin: '0 0 .2rem' }}>Pago del envío</h3>
              <p className="sub" style={{ margin: '0 0 .5rem', fontSize: '.82rem' }}>
                El costo depende de tu departamento. Envía el comprobante por WhatsApp para que confirmemos tu pedido.
              </p>
              <div className="pago-grupo">
                <label className={`pago-fila${metodo === 'transferencia' ? ' activa' : ''}`}>
                  <input type="radio" name="cf-metodo" checked={metodo === 'transferencia'} onChange={() => setMetodo('transferencia')} style={{ width: 'auto' }} />
                  <span className="pago-fila-texto">
                    <strong>Pago por transferencia bancaria</strong>
                  </span>
                </label>
                {metodo === 'transferencia' && (
                  <div className="metodo-detalle">
                    <DetalleMetodo m={mTransf} />
                  </div>
                )}
                <label className={`pago-fila${metodo === 'yape_plin' ? ' activa' : ''}`}>
                  <input type="radio" name="cf-metodo" checked={metodo === 'yape_plin'} onChange={() => setMetodo('yape_plin')} style={{ width: 'auto' }} />
                  <span className="pago-fila-texto">
                    <strong>Pago por YAPE o PLIN</strong>
                  </span>
                </label>
                {metodo === 'yape_plin' && (
                  <div className="metodo-detalle">
                    <DetalleMetodo m={mYape} />
                  </div>
                )}
              </div>
            </div>

            {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}
            <button className="btn bloque" disabled={enviando} onClick={confirmar} style={{ marginTop: '1rem' }}>
              {enviando ? 'Enviando…' : `Confirmar pedido de envío · S/ ${costoEnvio}`}
            </button>
          </div>

          <aside className="checkout-resumen">
            <h3 style={{ margin: '0 0 1rem' }}>Resumen</h3>
            <div className="checkout-resumen-lista">
              {certificados
                .filter((c) => elegidos.includes(c.id))
                .map((c) => (
                  <div className="checkout-resumen-item" key={c.id}>
                    <div className="checkout-resumen-item-info">
                      <span className="checkout-resumen-icono">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                          workspace_premium
                        </span>
                      </span>
                      <span>{nombreCursoDe(c)}</span>
                    </div>
                  </div>
                ))}
              {!elegidos.length && <p className="vacio">Elige al menos un certificado.</p>}
            </div>
            <div className="checkout-resumen-total">
              <span>Zona</span>
              <strong>{zonaDetectada?.nombre || 'Ingresa tu departamento'}</strong>
            </div>
            <div className="checkout-resumen-total checkout-resumen-total-final">
              <span>Costo de envío</span>
              <strong>S/ {costoEnvio}</strong>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
