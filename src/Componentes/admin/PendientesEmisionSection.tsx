'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatSoles } from '@/lib/copy';
import { respaldarCertificadoEnDrive } from '@/lib/certificado';
import { cargarCalendarioHabil, type CalendarioHabil } from '@/lib/diasHabiles';
import { periodoPorId, type Periodo } from '@/lib/periodos';
import {
  emitirCertificadoParaCurso,
  obtenerPedidosPendientesEmision,
  type ItemPendienteEmision,
  type PedidoPendienteEmision,
} from '@/lib/certificadosDirectos';
import type { CargoProfesional } from '@/lib/cargos';
import Aviso from '@/Componentes/ui/Aviso';
import ConfirmDialog from '@/Componentes/ui/ConfirmDialog';
import EstadoCarga from './EstadoCarga';
import ProgresoEmision from './ProgresoEmision';
import SelectorCargo from './SelectorCargo';
import SelectorPeriodoFecha, { fechaSugerida } from './SelectorPeriodoFecha';
import { useCargaDatos } from './useCargaDatos';

/** Lo que el admin completa por cada curso pendiente: solo período y fecha. */
interface DatosItem {
  periodoId: string;
  fecha: string;
}

/**
 * Flujo inverso de la certificación directa.
 *
 * El camino normal es: emites el certificado y el sistema registra el pedido
 * detrás (ver CertificadosDirectosSection). Acá va el otro sentido, que es el
 * que se usa cuando el cliente paga primero y las fechas se deciden después:
 * el pedido se crea en Pedidos → Crear pedido con tipo "Certificado directo",
 * cae en esta bandeja, y lo único que falta es ponerle período, fecha y cargo.
 *
 * Importante: acá NO se crea ningún pedido — ya existe. Solo se emite y se
 * sella `certificados.pedido_id`, que es lo que saca a la fila de esta lista.
 */
export default function PendientesEmisionSection({ periodos, cargos }: { periodos: Periodo[]; cargos: CargoProfesional[] }) {
  const [abierto, setAbierto] = useState<number | null>(null);
  const [calendario, setCalendario] = useState<CalendarioHabil | null>(null);
  // Confirmación de lo último emitido. Vive en el padre y no en la tarjeta
  // porque al emitir bien la tarjeta desaparece de la lista: antes el éxito no
  // se anunciaba de ninguna forma — el pedido simplemente se esfumaba y no
  // quedaba claro si se había emitido o si algo había fallado.
  const [ultimaEmision, setUltimaEmision] = useState<string | null>(null);

  const {
    datos: pendientes,
    error,
    cargando,
    recargar: cargar,
  } = useCargaDatos(() => obtenerPedidosPendientesEmision());

  useEffect(() => {
    let vivo = true;
    cargarCalendarioHabil().then((c) => vivo && setCalendario(c));
    return () => {
      vivo = false;
    };
  }, []);

  if (cargando || error) {
    return (
      <EstadoCarga cargando={cargando} error={error} onReintentar={cargar} variante="bloque">
        <></>
      </EstadoCarga>
    );
  }
  if (!pendientes) return null;

  const aviso = ultimaEmision ? <Aviso tipo="ok" mensaje={ultimaEmision} /> : null;

  if (!pendientes.length) {
    return (
      <>
        {aviso}
        <div className="card card-pad">
          <p className="vacio" style={{ margin: 0 }}>
            No hay pedidos esperando emisión. Los pedidos que crees en <strong>Pedidos → Crear pedido</strong> con tipo
            &quot;Certificado directo&quot; aparecen acá.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {aviso}
      <p className="sub">
        {pendientes.length === 1
          ? '1 pedido de certificación directa espera período y fecha.'
          : `${pendientes.length} pedidos de certificación directa esperan período y fecha.`}{' '}
        Al emitir, el certificado queda vinculado a su pedido y la fila desaparece de esta lista.
      </p>
      {pendientes.map((p) => (
        <PedidoPendiente
          key={p.pedidoId}
          pedido={p}
          periodos={periodos}
          cargos={cargos}
          calendario={calendario}
          abierto={abierto === p.pedidoId}
          onAbrir={() => setAbierto(abierto === p.pedidoId ? null : p.pedidoId)}
          onEmitido={(mensaje) => {
            setUltimaEmision(mensaje);
            cargar();
          }}
        />
      ))}
    </>
  );
}

function PedidoPendiente({
  pedido,
  periodos,
  cargos,
  calendario,
  abierto,
  onAbrir,
  onEmitido,
}: {
  pedido: PedidoPendienteEmision;
  periodos: Periodo[];
  cargos: CargoProfesional[];
  calendario: CalendarioHabil | null;
  abierto: boolean;
  onAbrir: () => void;
  onEmitido: (mensaje: string | null) => void;
}) {
  const [dni, setDni] = useState(pedido.dni || '');
  const [cargoFinal, setCargoFinal] = useState(pedido.cargo || '');
  const [datos, setDatos] = useState<Record<number, DatosItem>>({});
  const [emitiendo, setEmitiendo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [progreso, setProgreso] = useState<{ actual: number; total: number; curso: string } | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);

  function datosDe(cursoId: number): DatosItem {
    return datos[cursoId] || { periodoId: '', fecha: '' };
  }

  // Elegir período precarga su fecha de entrega: es la fecha correcta en la
  // gran mayoría de los casos y el admin solo la corrige si el cliente pidió
  // otra. Mismo comportamiento que el formulario de emisión individual.
  function cambiarItem(cursoId: number, cambios: Partial<DatosItem>) {
    setDatos((prev) => {
      const actual = prev[cursoId] || { periodoId: '', fecha: '' };
      const siguiente = { ...actual, ...cambios };
      if (cambios.periodoId !== undefined) {
        siguiente.fecha = fechaSugerida(periodoPorId(periodos, cambios.periodoId), calendario);
      }
      return { ...prev, [cursoId]: siguiente };
    });
  }

  /** Cursos con período y fecha puestos, y con una fecha que la BD va a aceptar. */
  const listos = pedido.items.filter((it) => {
    const d = datosDe(it.cursoId);
    return d.periodoId && d.fecha && (!calendario || calendario.esHabil(d.fecha));
  });

  /** Primer problema del formulario, o null si está listo para emitir. */
  function primerProblema(): string | null {
    if (!/^\d{8}$/.test(dni)) return 'El cliente necesita un DNI de 8 dígitos para poder emitir.';
    if (!cargoFinal.trim()) return 'Elige o escribe el cargo profesional.';
    // El nombre sale impreso en el certificado: si el pedido se guardó sin él
    // no hay forma de emitir algo válido, y es mejor mandar a corregir el
    // perfil que emitir un certificado en blanco.
    if (!pedido.clienteNombre?.trim())
      return 'Este cliente no tiene nombre registrado. Complétalo en su ficha de Clientes antes de emitir.';
    const conFechaMala = pedido.items.find((it) => {
      const d = datosDe(it.cursoId);
      return d.periodoId && d.fecha && calendario && !calendario.esHabil(d.fecha);
    });
    if (conFechaMala) return `Corrige la fecha de "${conFechaMala.cursoNombre}": no es un día hábil.`;
    if (!listos.length) return 'Completa el período y la fecha de al menos un curso.';
    return null;
  }

  function revisarAntesDeEmitir() {
    const problema = primerProblema();
    if (problema) {
      setAviso({ texto: problema, tipo: 'err' });
      return;
    }
    setAviso(null);
    setConfirmando(true);
  }

  async function emitirTodo() {
    setConfirmando(false);
    setAviso(null);
    setEmitiendo(true);
    try {
      // Si el DNI o el cargo se corrigieron acá, se guardan en el perfil: son
      // datos de la persona, no de este pedido, y el próximo certificado suyo
      // debe salir con lo mismo.
      if (pedido.clienteUid) {
        await supabase.from('perfiles').update({ documento: dni, cargo: cargoFinal.trim() }).eq('id', pedido.clienteUid);
      }

      const fallidos: string[] = [];
      let emitidos = 0;
      for (const [i, it] of listos.entries()) {
        setProgreso({ actual: i + 1, total: listos.length, curso: it.cursoNombre });
        const d = datosDe(it.cursoId);
        const res = await emitirCertificadoParaCurso({
          alumnoUid: pedido.clienteUid,
          cursoId: it.cursoId,
          periodoId: parseInt(d.periodoId, 10),
          fecha: d.fecha,
          dni,
          nombreCompleto: pedido.clienteNombre || '',
          cargo: cargoFinal.trim(),
          pedidoId: pedido.pedidoId,
        });

        if (!res.ok || !res.row) {
          fallidos.push(`${it.cursoNombre}: ${res.motivo || 'error desconocido'}`);
          continue;
        }
        emitidos += 1;

        // Respaldo en Drive: se dispara y no se espera. El certificado YA está emitido y
        // verificable por QR, y el PDF lo sirve la propia app — que Drive falle o se
        // demore no puede frenar ni invalidar la emisión.
        respaldarCertificadoEnDrive('digital', res.row.id, res.row.drive_digital_url);
        respaldarCertificadoEnDrive('imprimir', res.row.id, res.row.drive_imprimir_url);
      }

      if (fallidos.length) {
        // Se queda en la tarjeta: hay algo que corregir acá mismo.
        setAviso({ texto: `No se pudo emitir: ${fallidos.join(' · ')}`, tipo: 'err' });
        onEmitido(null);
        return;
      }

      onEmitido(
        `${emitidos === 1 ? 'Certificado emitido' : `${emitidos} certificados emitidos`} para ${
          pedido.clienteNombre || 'el cliente'
        } (pedido P-${String(pedido.pedidoId).padStart(4, '0')}). Ya están en "Certificados emitidos".`
      );
    } catch (e) {
      setAviso({ texto: e instanceof Error ? e.message : 'No se pudo completar la emisión.', tipo: 'err' });
    } finally {
      setEmitiendo(false);
      setProgreso(null);
    }
  }

  const cursosListos = listos.map((it) => it.cursoNombre).join(', ');

  return (
    <div className="card card-pad separado">
      <div className="fila-entre">
        <div>
          <strong>Pedido P-{String(pedido.pedidoId).padStart(4, '0')}</strong> — {pedido.clienteNombre || pedido.clienteEmail || 'Sin nombre'}
          <p className="campo-ayuda" style={{ margin: '.2rem 0 0' }}>
            {pedido.creadoEn ? new Date(pedido.creadoEn).toLocaleDateString('es-PE') : ''} · {formatSoles(pedido.total)} ·{' '}
            {pedido.estadoPago} ·{' '}
            {pedido.items.length === 1 ? '1 curso por emitir' : `${pedido.items.length} cursos por emitir`}
          </p>
        </div>
        <button type="button" className="btn sec btn-sm" onClick={onAbrir} aria-expanded={abierto}>
          {abierto ? 'Cerrar' : 'Completar fechas'}
        </button>
      </div>

      {abierto && (
        <>
          <hr />
          <Aviso tipo={aviso?.tipo ?? 'err'} mensaje={aviso?.texto} />

          <div className="perfil-grid">
            <div>
              <label htmlFor={`dni-${pedido.pedidoId}`}>DNI</label>
              <input
                id={`dni-${pedido.pedidoId}`}
                inputMode="numeric"
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="8 dígitos"
              />
            </div>
            <div>
              <SelectorCargo cargos={cargos} inicial={pedido.cargo || ''} onChange={setCargoFinal} />
            </div>
          </div>

          {pedido.items.map((it: ItemPendienteEmision, i) => {
            const d = datosDe(it.cursoId);
            return (
              // Mismo bloque .item-form que usa "Emitir a un cliente": las dos
              // pantallas piden lo mismo (curso + período + fecha) y deben
              // verse igual.
              <div className="item-form" key={it.ventaId}>
                <div className="item-form-cab">
                  <span className="item-form-num">
                    <i>{i + 1}</i> {it.cursoNombre}
                  </span>
                  <span className="campo-ayuda">{formatSoles(it.monto)}</span>
                </div>
                <SelectorPeriodoFecha
                  periodos={periodos}
                  periodoId={d.periodoId}
                  fecha={d.fecha}
                  calendario={calendario}
                  onChange={(cambios) => cambiarItem(it.cursoId, cambios)}
                />
              </div>
            );
          })}

          {progreso && <ProgresoEmision actual={progreso.actual} total={progreso.total} detalle={progreso.curso} />}

          <button className="btn" onClick={revisarAntesDeEmitir} disabled={emitiendo} style={{ marginTop: '.6rem' }}>
            {emitiendo
              ? 'Emitiendo…'
              : listos.length <= 1
                ? 'Revisar y emitir certificado'
                : `Revisar y emitir ${listos.length} certificados`}
          </button>

          {/* Emitir tampoco se deshace desde acá: deja certificados con código de
              verificación público sellados contra este pedido. El formulario
              individual ya preguntaba antes de hacer exactamente lo mismo. */}
          <ConfirmDialog
            open={confirmando}
            peligro={false}
            title={listos.length === 1 ? 'Emitir 1 certificado' : `Emitir ${listos.length} certificados`}
            body={
              `${pedido.clienteNombre?.trim() || 'Cliente'} · DNI ${dni} · ${cargoFinal.trim()}\n` +
              `${cursosListos}\n` +
              (listos.length < pedido.items.length
                ? `${pedido.items.length - listos.length === 1 ? 'Queda 1 curso' : `Quedan ${pedido.items.length - listos.length} cursos`} de este pedido sin fecha: seguirán en esta lista.\n`
                : '') +
              'El nombre y el DNI se imprimen tal cual en el certificado y no se pueden cambiar después de emitir.'
            }
            confirmLabel={listos.length === 1 ? 'Emitir certificado' : `Emitir ${listos.length} certificados`}
            cancelLabel="Revisar de nuevo"
            onConfirm={emitirTodo}
            onCancel={() => setConfirmando(false)}
          />
        </>
      )}
    </div>
  );
}
