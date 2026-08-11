'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { generarCodigoActivacion } from '@/lib/activacion';
import { SITIO_PUBLICO, WHATSAPP_PEDIDOS } from '@/lib/site-config';
import { fechaComoInput, fechaDesdeInput, fechaEntregaEstimada, formatFechaRotulo, nombreCourierEnvio } from '@/lib/envioCertificado';
import type { PedidoRow } from '@/lib/pedidos';

type Orientacion = 'horizontal' | 'vertical';
/** Qué pieza va a salir por la impresora. Las dos viven en la misma pantalla y solo se imprime una. */
type Pieza = 'rotulo' | 'activacion';

// Mismas medidas que RotuloEnvioCertificado.tsx — calibradas para la
// impresora térmica de 80mm del instituto. No cambiar sin volver a probar en
// esa impresora.
const ROLLO_MM = 80;
const ANCHO_UTIL_MM = 72;
const LARGO_MM = 124;

export function RotuloPedido({
  pedido,
  documento,
  cuentaActivadaEn,
}: {
  pedido: PedidoRow;
  documento: string | null;
  /** Fecha en que el cliente reclamó su cuenta, o null si todavía no lo hizo. */
  cuentaActivadaEn?: string | null;
}) {
  const [codigo, setCodigo] = useState(pedido.codigo_rotulo ?? '');
  const [fecha, setFecha] = useState(fechaComoInput(fechaEntregaEstimada(null)));
  const [orientacion, setOrientacion] = useState<Orientacion>('horizontal');
  const [guardando, setGuardando] = useState(false);

  const [pieza, setPieza] = useState<Pieza>('rotulo');
  const [codigoAcceso, setCodigoAcceso] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);
  // El diálogo de impresión se abre en un efecto y no dentro del handler: hay
  // que darle a React el render con la pieza correcta ya oculta/mostrada, o el
  // navegador captura la pantalla anterior y sale la pieza equivocada.
  //
  // Es un contador y no un booleano para poder imprimir dos veces seguidas la
  // misma pieza: con un flag habría que apagarlo desde el propio efecto, y eso
  // es justo la cascada de renders que React desaconseja.
  const [solicitudImpresion, setSolicitudImpresion] = useState(0);

  useEffect(() => {
    if (!solicitudImpresion) return;
    window.print();
  }, [solicitudImpresion]);

  const imprimirPieza = (p: Pieza) => {
    setPieza(p);
    setSolicitudImpresion((n) => n + 1);
  };

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
    imprimirPieza('rotulo');
  }

  /**
   * Genera el código de 6 dígitos con el que el cliente reclama su cuenta y lo
   * deja listo para imprimir.
   *
   * Se genera acá y no al emitir el certificado porque el código solo se puede
   * leer UNA vez: guardarlo antes significaría que para cuando alguien va a
   * imprimirlo ya nadie sabe cuál era. Volver a presionar el botón genera otro
   * e invalida el anterior — que es justo lo que hace falta cuando el cliente
   * perdió el volante o agotó sus intentos.
   */
  async function generarEImprimirCodigo() {
    if (!pedido.cliente_uid) {
      setErrorCodigo('Este pedido no tiene una cuenta de cliente asociada, así que no hay cuenta que activar.');
      return;
    }
    setErrorCodigo(null);
    setGenerando(true);
    const res = await generarCodigoActivacion(pedido.cliente_uid);
    setGenerando(false);
    if (!res.ok || !res.codigo) {
      setErrorCodigo(res.motivo || 'No se pudo generar el código de acceso.');
      return;
    }
    setCodigoAcceso(res.codigo);
    imprimirPieza('activacion');
  }

  return (
    <div className="pantalla-rotulo min-h-screen font-body">
      <style>{`
        .hoja-rotulo { display: flex; justify-content: center; padding: 1.5rem; }
        .hoja-activacion { display: flex; justify-content: center; padding: 0 1.5rem 1.5rem; }

        @media print {
          @page {
            size: ${
              pieza === 'activacion'
                ? `${ROLLO_MM}mm auto`
                : orientacion === 'horizontal'
                  ? `${ROLLO_MM}mm ${LARGO_MM}mm`
                  : `${ROLLO_MM}mm auto`
            };
            margin: 0;
          }
          html, body { background: #fff !important; margin: 0; padding: 0; }
          .no-imprimir { display: none !important; }
          .pantalla-rotulo { min-height: 0 !important; background: #fff !important; }

          /* Las dos piezas conviven en pantalla; por la impresora sale solo la elegida. */
          ${pieza === 'activacion' ? '.hoja-rotulo { display: none !important; }' : '.hoja-activacion { display: none !important; }'}
          .hoja-activacion { display: block; padding: 0; }
          .volante { box-shadow: none; margin: 0 auto; }
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
            <div className="aviso err" role="alert" style={{ marginBottom: '.8rem' }}>
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

        <div className="card card-pad">
          <h3 style={{ margin: '0 0 .2rem', fontSize: '.98rem' }}>Código de acceso al aula</h3>

          {/* Un cliente que ya entró tiene su propio correo y contraseña: mandarle
              un código nuevo no le sirve de nada y además invalidaría el anterior.
              Por eso acá no hay botón, hay una explicación. */}
          {cuentaActivadaEn ? (
            <p className="sub" style={{ margin: 0, fontSize: '.82rem' }}>
              Este cliente <strong>ya activó su cuenta</strong> el{' '}
              {new Date(cuentaActivadaEn).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}. No hace falta
              imprimirle ningún volante: entra con su propio correo y contraseña, y si los perdió los recupera desde su correo.
            </p>
          ) : (
            <>
          <p className="sub" style={{ margin: '0 0 .8rem', fontSize: '.82rem' }}>
            Imprime el volante con el código de 6 dígitos que el cliente necesita para activar su cuenta y entrar a ver
            sus certificados. <strong>Va dentro del sobre</strong>, junto al certificado — nunca pegado por fuera: el
            rótulo ya lleva su documento, y los dos datos juntos a la vista permitirían que cualquiera se apodere de la
            cuenta.
          </p>

          {errorCodigo && (
            <div className="aviso err" role="alert" style={{ marginBottom: '.8rem' }}>
              {errorCodigo}
            </div>
          )}

          {codigoAcceso && (
            <div className="aviso ok" role="status" style={{ marginBottom: '.8rem' }}>
              Código generado: <code style={{ fontSize: '1.05rem', letterSpacing: '.15em' }}>{codigoAcceso}</code>
              <br />
              <span style={{ fontSize: '.82rem' }}>
                No se vuelve a mostrar. Si lo pierdes, genera otro — el anterior queda anulado.
              </span>
            </div>
          )}

          <div className="fila">
            <button className="btn sec" onClick={generarEImprimirCodigo} disabled={generando || !pedido.cliente_uid}>
              <KeyRound className="h-4 w-4" style={{ display: 'inline', verticalAlign: '-3px' }} />{' '}
              {generando ? 'Generando…' : codigoAcceso ? 'Generar otro código e imprimir' : 'Generar código e imprimir'}
            </button>
            {codigoAcceso && (
              <button
                className="btn"
                onClick={() => imprimirPieza('activacion')}
              >
                <Printer className="h-4 w-4" style={{ display: 'inline', verticalAlign: '-3px' }} /> Volver a imprimir
              </button>
            )}
          </div>
            </>
          )}
        </div>
      </div>

      <div className="hoja-rotulo">
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

      {codigoAcceso && (
        <div className="hoja-activacion">
          <VolanteActivacion destinatario={pedido.cliente_nombre ?? '—'} documento={documento} codigo={codigoAcceso} />
        </div>
      )}
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

// El rótulo horizontal vive dentro de una caja de alto fijo (el ancho útil del
// rollo), así que la escala tipográfica está presupuestada para que la suma de
// cabecera + cuerpo + pie quepa con holgura en esos 72mm menos borde y padding.
// Si subes algún tamaño, vuelve a hacer la cuenta o el pie se sale del marco.
const PADDING_MM = 2.6;
const MEDIDAS = {
  horizontal: {
    ancho: `${LARGO_MM}mm`,
    alto: `${ANCHO_UTIL_MM}mm`,
    logo: '7.5mm',
    codigo: '14pt',
    nombre: '15pt',
    dato: '11pt',
    certificados: '9pt',
    pie: '11pt',
    separacion: '1.5mm',
    divisor: '1.6mm',
    padPie: '1.3mm 2.2mm',
  },
  vertical: {
    ancho: `${ANCHO_UTIL_MM}mm`,
    alto: 'auto',
    logo: '7mm',
    codigo: '14pt',
    nombre: '13pt',
    dato: '11pt',
    certificados: '9pt',
    pie: '11pt',
    separacion: '1.8mm',
    divisor: '2mm',
    padPie: '1.5mm 2.2mm',
  },
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
        boxSizing: 'border-box',
        border: '0.8mm solid #000',
        padding: `${PADDING_MM}mm`,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Arial, Helvetica, sans-serif',
        lineHeight: 1.15,
        background: '#fff',
        color: '#000',
        // Red de seguridad: si algún pedido trae textos larguísimos, se recorta
        // dentro del marco en vez de desbordarlo.
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: esVertical ? 'flex-start' : 'center',
          flexDirection: esVertical ? 'column' : 'row',
          gap: esVertical ? '1.5mm' : '3mm',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '2.5mm', flex: 1, minWidth: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-ipadecp.webp" alt="IPADECP" style={{ height: m.logo, width: 'auto', objectFit: 'contain' }} />
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
          <p style={{ fontSize: m.codigo, fontWeight: 700, margin: 0, letterSpacing: '0.5pt', overflowWrap: 'anywhere' }}>{codigo}</p>
        </div>
      </div>

      <div style={{ borderTop: '0.5mm solid #000', margin: `${m.divisor} 0`, flexShrink: 0 }} />

      <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: m.separacion }}>
        <Campo etiqueta="DESTINATARIO" valor={destinatario} tamano={m.nombre} lineas={2} />
        <div style={{ display: 'flex', gap: esVertical ? '2mm' : '4mm', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 40%', minWidth: 0 }}>
            <Campo etiqueta="TELÉFONO" valor={telefono} tamano={m.dato} lineas={1} />
          </div>
          {documento && (
            <div style={{ flex: '1 1 40%', minWidth: 0 }}>
              <Campo etiqueta="DOCUMENTO" valor={documento} tamano={m.dato} lineas={1} />
            </div>
          )}
        </div>
        <Campo etiqueta="DISTRITO DE ENTREGA" valor={zonaEntrega} tamano={m.dato} lineas={1} />
        <Campo etiqueta="CERTIFICADO(S)" valor={certificados} tamano={m.certificados} lineas={2} />
      </div>

      <div style={{ display: 'flex', gap: '2.5mm', marginTop: m.separacion, flexShrink: 0, flexDirection: esVertical ? 'column' : 'row' }}>
        <div style={{ flex: 1.4, minWidth: 0, background: '#fff', color: '#000', border: '0.5mm solid #000', padding: m.padPie }}>
          <p style={{ fontSize: '7pt', letterSpacing: '0.5pt', margin: 0 }}>ESTADO DEL PAGO</p>
          <p style={{ fontSize: m.pie, fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>PAGADO — NO COBRAR</p>
        </div>
        <div style={{ flex: 1, minWidth: 0, border: '0.5mm solid #000', padding: m.padPie }}>
          <p style={{ fontSize: '7pt', letterSpacing: '0.5pt', margin: 0 }}>FECHA DE ENTREGA</p>
          <p style={{ fontSize: m.pie, fontWeight: 700, margin: 0, whiteSpace: 'nowrap' }}>{fechaEntrega}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Volante con el código de acceso, para meter DENTRO del sobre junto al
 * certificado. Mismo rollo térmico de 80 mm que el rótulo, siempre vertical
 * (el texto de las instrucciones no entra girado).
 *
 * Deliberadamente no lleva ni el logo del courier ni la dirección: no es una
 * etiqueta de envío. Si se confundiera con una y terminara pegada por fuera,
 * el código quedaría a la vista de toda la cadena de reparto.
 */
function VolanteActivacion({ destinatario, documento, codigo }: { destinatario: string; documento: string | null; codigo: string }) {
  const pasos = [
    <>
      Entra a <strong>{SITIO_PUBLICO}/activar</strong> desde tu celular o computadora.
    </>,
    <>Escribe tu documento{documento ? <> ({documento})</> : null}.</>,
    <>
      Ingresa este código de <strong>6 dígitos</strong>.
    </>,
    <>Crea tu correo y tu contraseña. Con esos entrarás siempre.</>,
  ];

  return (
    <div
      className="volante"
      style={{
        width: `${ANCHO_UTIL_MM}mm`,
        boxSizing: 'border-box',
        border: '0.8mm solid #000',
        padding: `${PADDING_MM}mm`,
        fontFamily: 'Arial, Helvetica, sans-serif',
        lineHeight: 1.2,
        background: '#fff',
        color: '#000',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '2.5mm' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-ipadecp.webp" alt="IPADECP" style={{ height: '7mm', width: 'auto', objectFit: 'contain' }} />
        <div>
          <p style={{ fontSize: '7pt', letterSpacing: '0.5pt', margin: 0 }}>AULA VIRTUAL</p>
          <p style={{ fontSize: '11pt', fontWeight: 700, margin: 0 }}>IPADECP</p>
        </div>
      </div>

      <div style={{ borderTop: '0.5mm solid #000', margin: '2mm 0' }} />

      <p style={{ fontSize: '10.5pt', fontWeight: 700, margin: 0, textTransform: 'uppercase' }}>Tu código de acceso</p>
      <p style={{ fontSize: '8pt', margin: '0.6mm 0 0' }}>
        Para {destinatario.toUpperCase()}
      </p>

      <div style={{ border: '0.6mm solid #000', textAlign: 'center', padding: '2.4mm 1mm', margin: '2.4mm 0' }}>
        <p style={{ fontSize: '26pt', fontWeight: 700, margin: 0, letterSpacing: '0.28em', textIndent: '0.28em' }}>{codigo}</p>
      </div>

      <p style={{ fontSize: '8.5pt', fontWeight: 700, margin: '0 0 1.2mm', textTransform: 'uppercase' }}>Cómo ingresar</p>
      <ol style={{ fontSize: '8.5pt', margin: 0, paddingLeft: '4.5mm', display: 'flex', flexDirection: 'column', gap: '1.1mm' }}>
        {pasos.map((paso, i) => (
          <li key={i}>{paso}</li>
        ))}
      </ol>

      <div style={{ borderTop: '0.5mm solid #000', margin: '2.4mm 0 1.6mm' }} />

      <p style={{ fontSize: '8pt', margin: 0 }}>
        Adentro te esperan <strong>tus certificados</strong> para descargar y el material de tus cursos.
      </p>
      <p style={{ fontSize: '7.5pt', margin: '1.6mm 0 0' }}>
        Este código es personal y de un solo uso. Guárdalo hasta que actives tu cuenta y no se lo compartas a nadie.
      </p>
      <p style={{ fontSize: '7.5pt', margin: '1.2mm 0 0' }}>
        ¿Problemas para entrar? WhatsApp {WHATSAPP_PEDIDOS.replace(/^51/, '')}
      </p>
    </div>
  );
}

function Campo({ etiqueta, valor, tamano, lineas }: { etiqueta: string; valor: string; tamano: string; lineas: number }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ fontSize: '7pt', letterSpacing: '0.5pt', margin: 0 }}>{etiqueta}</p>
      <p
        style={{
          fontSize: tamano,
          fontWeight: 700,
          margin: 0,
          textTransform: 'uppercase',
          overflowWrap: 'anywhere',
          // El alto del rótulo es fijo: un valor muy largo se corta aquí en vez
          // de empujar el pie fuera del marco.
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: lineas,
          overflow: 'hidden',
        }}
      >
        {valor}
      </p>
    </div>
  );
}
