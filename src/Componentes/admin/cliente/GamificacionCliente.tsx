'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import {
  calcularProgresoNivel,
  etiquetaMovimiento,
  type GamificacionAlumno,
} from '@/lib/gamificacion';

/**
 * Gamificación de un cliente.
 *
 * Antes era un renglón ("N punto(s) · racha de N día(s)") y un formulario para
 * sumar puntos. Eso no permitía responder ninguna de las preguntas que uno se
 * hace al abrir la ficha: en qué nivel va, cuánto le falta para el siguiente,
 * qué logros tiene, y —sobre todo— de dónde salen sus puntos. Ese último dato
 * existía en `actividad_puntos` desde siempre; solo que nadie lo mostraba.
 */
export default function GamificacionCliente({
  clienteId,
  puntos,
  rachaDias,
  datos,
  onCambio,
  onError,
}: {
  clienteId: string;
  puntos: number;
  rachaDias: number;
  datos: GamificacionAlumno | null;
  onCambio: (texto: string) => void;
  onError: (texto: string) => void;
}) {
  const progreso = datos ? calcularProgresoNivel(puntos, datos.niveles) : null;

  return (
    <section className="card card-pad separado" aria-labelledby="gam-titulo">
      <h2 id="gam-titulo" className="bloque-titulo">
        Gamificación
      </h2>

      <div className="gam-cabecera">
        {/* El nivel es la unidad que significa algo. "1.240 puntos" no le dice
            nada a nadie; "Practicante, faltan 760 para Especialista" sí. */}
        <div className="gam-nivel">
          <span className="gam-nivel-etq">Nivel {progreso?.actual?.nivel ?? '—'}</span>
          <strong className="gam-nivel-nombre">{progreso?.actual?.nombre ?? 'Sin nivel'}</strong>
          {progreso?.siguiente ? (
            <span className="campo-ayuda">
              {progreso.puntosParaSiguiente === 0
                ? `Listo para pasar a ${progreso.siguiente.nombre}.`
                : `Faltan ${progreso.puntosParaSiguiente} puntos para ${progreso.siguiente.nombre}.`}
            </span>
          ) : (
            <span className="campo-ayuda">Es el nivel más alto.</span>
          )}
          <div
            className="gam-barra"
            role="progressbar"
            aria-valuenow={progreso?.porcentaje ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Avance dentro del nivel actual"
          >
            <span style={{ width: `${progreso?.porcentaje ?? 0}%` }} />
          </div>
        </div>

        <dl className="gam-cifras">
          <div>
            <dt>Puntos</dt>
            <dd>{puntos.toLocaleString('es-PE')}</dd>
          </div>
          <div>
            <dt>Racha</dt>
            <dd>
              {rachaDias} {rachaDias === 1 ? 'día' : 'días'}
            </dd>
          </div>
          <div>
            <dt>Logros</dt>
            <dd>
              {datos ? `${datos.logrosObtenidos.length} de ${datos.logrosObtenidos.length + datos.logrosPendientes.length}` : '—'}
            </dd>
          </div>
        </dl>
      </div>

      {datos && (datos.logrosObtenidos.length > 0 || datos.logrosPendientes.length > 0) && (
        <div className="gam-seccion">
          <h3 className="gam-subtitulo">Logros</h3>
          <ul className="gam-logros">
            {datos.logrosObtenidos.map((l) => (
              <li key={l.id} className="gam-logro obtenido" title={l.descripcion || undefined}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  {l.icono || 'military_tech'}
                </span>
                <span>
                  <strong>{l.nombre}</strong>
                  {l.obtenido_en && <small>{new Date(l.obtenido_en).toLocaleDateString('es-PE')}</small>}
                </span>
              </li>
            ))}
            {/* Los pendientes se muestran apagados y no se ocultan: saber qué le
                falta a alguien es tan útil como saber qué consiguió. */}
            {datos.logrosPendientes.map((l) => (
              <li key={l.id} className="gam-logro" title={l.descripcion || undefined}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  lock
                </span>
                <span>
                  <strong>{l.nombre}</strong>
                  <small>Pendiente</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {datos && (
        <div className="gam-seccion">
          <h3 className="gam-subtitulo">De dónde salen sus puntos</h3>
          {datos.movimientos.length ? (
            <ul className="gam-movimientos">
              {datos.movimientos.map((m) => (
                <li key={m.id}>
                  <span className={`gam-delta${m.puntos < 0 ? ' negativo' : ''}`}>
                    {m.puntos > 0 ? '+' : ''}
                    {m.puntos}
                  </span>
                  <span className="gam-movimiento-texto">{etiquetaMovimiento(m)}</span>
                  <span className="campo-ayuda">{new Date(m.creado_en).toLocaleDateString('es-PE')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="campo-ayuda">Todavía no hay movimientos registrados.</p>
          )}
        </div>
      )}

      <div className="gam-seccion">
        <h3 className="gam-subtitulo">Ajustar puntos a mano</h3>
        <AjustarPuntos clienteId={clienteId} puntos={puntos} onAjustado={onCambio} onError={onError} />
      </div>
    </section>
  );
}

/**
 * Sumar o restar puntos a mano. Va por el RPC `admin_ajustar_puntos` y no por
 * un UPDATE directo a `perfiles.puntos` porque el RPC además deja registrado el
 * motivo del ajuste — sin eso, un saldo raro después no se puede explicar. Ese
 * registro es el que ahora se lee en "De dónde salen sus puntos".
 */
function AjustarPuntos({
  clienteId,
  puntos,
  onAjustado,
  onError,
}: {
  clienteId: string;
  puntos: number;
  onAjustado: (texto: string) => void;
  onError: (texto: string) => void;
}) {
  const [delta, setDelta] = useState('');
  const [motivo, setMotivo] = useState('');
  const [aplicando, setAplicando] = useState(false);

  const n = parseInt(delta, 10);
  const valido = Number.isFinite(n) && n !== 0;
  // El RPC hace `greatest(0, puntos + delta)`: restar de más no deja saldo
  // negativo, lo deja en cero. Mejor decirlo antes que sorprender después.
  const resultado = valido ? Math.max(0, puntos + n) : puntos;

  async function aplicar() {
    if (!valido) {
      onError('Indica cuántos puntos sumar, o un número negativo para restar.');
      return;
    }
    if (!motivo.trim()) {
      onError('Escribe el motivo del ajuste: es lo que explica este saldo más adelante.');
      return;
    }
    setAplicando(true);
    const { error } = await supabase.rpc('admin_ajustar_puntos', { p_alumno: clienteId, p_delta: n, p_motivo: motivo.trim() });
    setAplicando(false);
    if (error) {
      onError(mensajeError(error));
      return;
    }
    setDelta('');
    setMotivo('');
    onAjustado(`Puntos ajustados: ${n > 0 ? '+' : ''}${n}. Saldo nuevo: ${resultado}.`);
  }

  return (
    <div className="gam-ajuste">
      <div>
        <label htmlFor="gam-delta">Puntos a sumar o restar</label>
        <input
          id="gam-delta"
          type="number"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          placeholder="Ej. 50 o -20"
        />
      </div>
      <div className="gam-ajuste-motivo">
        <label htmlFor="gam-motivo">Motivo</label>
        <input
          id="gam-motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej. premio por concurso interno"
        />
      </div>
      <button className="btn sec" type="button" onClick={aplicar} disabled={aplicando}>
        {aplicando ? 'Aplicando…' : 'Aplicar'}
      </button>
      {valido && (
        <p className="campo-ayuda gam-ajuste-previa" role="status">
          Quedaría con <strong>{resultado}</strong> puntos.
        </p>
      )}
    </div>
  );
}
