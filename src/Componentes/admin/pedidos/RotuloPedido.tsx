'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { fechaComoInput, fechaDesdeInput, fechaEntregaEstimada, formatFechaRotulo, nombreCourierEnvio } from '@/lib/envioCertificado';
import type { PedidoRow } from '@/lib/pedidos';

type Orientacion = 'horizontal' | 'vertical';

// Mismas medidas que RotuloEnvioCertificado.tsx — calibradas para la
// impresora térmica de 80mm del instituto. No cambiar sin volver a probar en
// esa impresora.
const ROLLO_MM = 80;
const ANCHO_UTIL_MM = 72;
const LARGO_MM = 124;

export function RotuloPedido({ pedido, documento }: { pedido: PedidoRow; documento: string | null }) {
  const [codigo, setCodigo] = useState(pedido.codigo_rotulo ?? '');
  const [fecha, setFecha] = useState(fechaComoInput(fechaEntregaEstimada(null)));
  const [orientacion, setOrientacion] = useState<Orientacion>('horizontal');
  const [guardando, setGuardando] = useState(false);

  const dir = pedido.direccion_envio;
  const zonaEntrega = [dir?.distrito, dir?.departamento && dir.departamento !== dir.distrito ? dir.departamento : null].filter(Boolean).join(' — ');
  const courierNombre = nombreCourierEnvio(pedido.courier, pedido.courier_otro);
  const nombresCurso = pedido.items.length ? pedido.items.map((it) => it.nombre_curso) : pedido.certificados.map((c) => c.curso_nombre);
  const certificadosTexto = nombresCurso.filter(Boolean).join(' · ') || `Pedido #${pedido.id}`;

  // El certificado no debe salir del instituto antes de confirmar que el
  // pedido está pagado.
  const pagoVerificado = pedido.estado_pago === 'pagado';

  async function imprimir() {
    if (!pagoVerificado) return;
    const codigoLimpio = codigo.trim();
    if (codigoLimpio !== (pedido.codigo_rotulo ?? '')) {
      setGuardando(true);
      await supabase.from('pedidos').update({ codigo_rotulo: codigoLimpio || null }).eq('id', pedido.id);
      setGuardando(false);
    }
    window.print();
  }

  return (
    <div className="pantalla-rotulo min-h-screen font-body">
      <style>{`
        @media print {
          @page {
            size: ${orientacion === 'horizontal' ? `${ROLLO_MM}mm ${LARGO_MM}mm` : `${ROLLO_MM}mm auto`};
            margin: 0;
          }
          html, body { background: #fff !important; margin: 0; padding: 0; }
          .no-imprimir { display: none !important; }
          .pantalla-rotulo { min-height: 0 !important; background: #fff !important; }
          .hoja-rotulo {
            display: block;
            position: relative;
            margin: 0;
            padding: 0;
            background: #fff;
            ${orientacion === 'horizontal' ? `width: ${ROLLO_MM}mm; height: ${LARGO_MM}mm;` : ''}
          }
          .rotulo {
            ${
              orientacion === 'horizontal'
                ? `position: absolute; top: 0; left: ${(ROLLO_MM - ANCHO_UTIL_MM) / 2}mm;
                   transform-origin: top left;
                   transform: translateY(${LARGO_MM}mm) rotate(-90deg);`
                : `margin: 0 auto;`
            }
            box-shadow: none;
          }
        }
      `}</style>

      <div className="no-imprimir" style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem' }}>
        <Link href={`/admin?sec=pedidos`} className="migas">
          <ArrowLeft className="h-4 w-4" style={{ display: 'inline', verticalAlign: '-3px' }} /> Volver a pedidos
        </Link>

        <div className="card card-pad">
          {!pagoVerificado && (
            <div className="aviso err" style={{ marginBottom: '.8rem' }}>
              Este pedido todavía no tiene el pago confirmado. Confírmalo desde el detalle del pedido antes de imprimir el rótulo.
            </div>
          )}
          <div className="perfil-grid">
            <div>
              <label htmlFor="codigo-rotulo">Código de rastreo (opcional)</label>
              <input id="codigo-rotulo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder={`Ej. Pedido #${pedido.id}`} autoFocus />
              <p className="sub" style={{ fontSize: '.78rem', margin: '.3rem 0 0' }}>
                Si lo dejas vacío, el rótulo usa el número de pedido (#{pedido.id}).
              </p>
            </div>
            <div>
              <label htmlFor="fecha-rotulo">Fecha de entrega</label>
              <input id="fecha-rotulo" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              <p className="sub" style={{ fontSize: '.78rem', margin: '.3rem 0 0' }}>
                Puedes ajustarla.
              </p>
            </div>
          </div>

          <div className="fila" style={{ marginTop: '1rem', borderTop: '1px solid var(--borde)', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', border: '1px solid var(--borde)', borderRadius: 6, padding: 2 }}>
              {(['horizontal', 'vertical'] as const).map((o) => (
                <button key={o} type="button" onClick={() => setOrientacion(o)} className={`btn btn-sm ${orientacion === o ? '' : 'sec'}`} style={{ textTransform: 'capitalize' }}>
                  {o}
                </button>
              ))}
            </div>

            <button className="btn" onClick={imprimir} disabled={guardando || !pagoVerificado}>
              <Printer className="h-4 w-4" style={{ display: 'inline', verticalAlign: '-3px' }} /> {guardando ? 'Guardando…' : 'Imprimir rótulo'}
            </button>

            <p className="sub" style={{ fontSize: '.78rem' }}>
              Papel térmico de 80 mm. Si la horizontal sale cortada, usa vertical.
            </p>
          </div>
        </div>
      </div>

      <div className="hoja-rotulo" style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}>
        <Rotulo
          codigo={codigo.trim() || `#${pedido.id}`}
          destinatario={pedido.cliente_nombre ?? '—'}
          telefono={pedido.cliente_telefono ?? '—'}
          documento={documento}
          zonaEntrega={zonaEntrega || '—'}
          certificados={certificadosTexto}
          fechaEntrega={formatFechaRotulo(fechaDesdeInput(fecha))}
          courier={courierNombre}
          orientacion={orientacion}
        />
      </div>
    </div>
  );
}

interface RotuloProps {
  codigo: string;
  destinatario: string;
  telefono: string;
  documento: string | null;
  zonaEntrega: string;
  certificados: string;
  fechaEntrega: string;
  courier: string | null;
  orientacion: Orientacion;
}

const MEDIDAS = {
  horizontal: { ancho: `${LARGO_MM}mm`, alto: `${ANCHO_UTIL_MM}mm`, nombre: '17pt', telefono: '15pt' },
  vertical: { ancho: `${ANCHO_UTIL_MM}mm`, alto: 'auto', nombre: '14pt', telefono: '13pt' },
} as const;

function Rotulo({ codigo, destinatario, telefono, documento, zonaEntrega, certificados, fechaEntrega, courier, orientacion }: RotuloProps) {
  const m = MEDIDAS[orientacion];
  const esVertical = orientacion === 'vertical';
  return (
    <div
      className="rotulo"
      style={{
        width: m.ancho,
        height: m.alto,
        border: '0.8mm solid #000',
        padding: '3mm',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Arial, Helvetica, sans-serif',
        lineHeight: 1.15,
        background: '#fff',
        color: '#000',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: esVertical ? 'flex-start' : 'center',
          flexDirection: esVertical ? 'column' : 'row',
          gap: esVertical ? '1.5mm' : '3mm',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '2.5mm', flex: 1, minWidth: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-ipadecp.webp" alt="IPADECP" style={{ height: esVertical ? '7mm' : '9mm', width: 'auto', objectFit: 'contain' }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '7pt', letterSpacing: '0.5pt', margin: 0 }}>REMITENTE</p>
            <p style={{ fontSize: '11pt', fontWeight: 700, margin: 0 }}>IPADECP</p>
          </div>
        </div>
        {courier && (
          <div style={{ minWidth: 0, textAlign: esVertical ? 'left' : 'right' }}>
            <p style={{ fontSize: '7pt', letterSpacing: '0.5pt', margin: 0 }}>ENVÍO POR</p>
            <p style={{ fontSize: '11pt', fontWeight: 700, margin: 0, textTransform: 'uppercase' }}>{courier}</p>
          </div>
        )}
        <div style={{ textAlign: esVertical ? 'left' : 'right', width: esVertical ? '100%' : 'auto' }}>
          <p style={{ fontSize: '7pt', letterSpacing: '0.5pt', margin: 0 }}>CÓDIGO</p>
          <p style={{ fontSize: '16pt', fontWeight: 700, margin: 0, letterSpacing: '0.5pt', overflowWrap: 'anywhere' }}>{codigo}</p>
        </div>
      </div>

      <div style={{ borderTop: '0.5mm solid #000', margin: '2.5mm 0' }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2mm' }}>
        <Campo etiqueta="DESTINATARIO" valor={destinatario} tamano={m.nombre} />
        <div style={{ display: 'flex', gap: esVertical ? '2mm' : '4mm', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 40%', minWidth: 0 }}>
            <Campo etiqueta="TELÉFONO" valor={telefono} tamano={m.telefono} />
          </div>
          {documento && (
            <div style={{ flex: '1 1 40%', minWidth: 0 }}>
              <Campo etiqueta="DOCUMENTO" valor={documento} tamano="11pt" />
            </div>
          )}
        </div>
        <Campo etiqueta="DISTRITO DE ENTREGA" valor={zonaEntrega} tamano={m.telefono} />
        <Campo etiqueta="CERTIFICADO(S)" valor={certificados} tamano="10pt" />
      </div>

      <div style={{ display: 'flex', gap: '2.5mm', marginTop: '2mm', flexDirection: esVertical ? 'column' : 'row' }}>
        <div style={{ flex: 1.4, minWidth: 0, background: '#fff', color: '#000', border: '0.5mm solid #000', padding: '1.8mm 2.5mm' }}>
          <p style={{ fontSize: '7pt', letterSpacing: '0.5pt', margin: 0 }}>ESTADO DEL PAGO</p>
          <p style={{ fontSize: '12pt', fontWeight: 700, margin: 0 }}>PAGADO — NO COBRAR</p>
        </div>
        <div style={{ flex: 1, minWidth: 0, border: '0.5mm solid #000', padding: '1.8mm 2.5mm' }}>
          <p style={{ fontSize: '7pt', letterSpacing: '0.5pt', margin: 0 }}>FECHA DE ENTREGA</p>
          <p style={{ fontSize: '14pt', fontWeight: 700, margin: 0 }}>{fechaEntrega}</p>
        </div>
      </div>
    </div>
  );
}

function Campo({ etiqueta, valor, tamano }: { etiqueta: string; valor: string; tamano: string }) {
  return (
    <div>
      <p style={{ fontSize: '7pt', letterSpacing: '0.5pt', margin: 0 }}>{etiqueta}</p>
      <p style={{ fontSize: tamano, fontWeight: 700, margin: 0, textTransform: 'uppercase', overflowWrap: 'anywhere' }}>{valor}</p>
    </div>
  );
}
