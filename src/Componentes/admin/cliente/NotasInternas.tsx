'use client';

import { useState } from 'react';
import { guardarNotasInternas } from '@/lib/alumno';
import { mensajeError } from '@/lib/copy';

/**
 * Notas internas del equipo sobre un cliente.
 *
 * No existía dónde anotar "pidió factura a nombre de su clínica" o "reclamó por
 * el envío de marzo", así que ese contexto vivía en WhatsApp y se perdía cuando
 * atendía otra persona. Son internas: el alumno no las ve por ningún lado.
 */
export default function NotasInternas({
  clienteId,
  inicial,
  onGuardado,
  onError,
}: {
  clienteId: string;
  inicial: string;
  onGuardado: (texto: string) => void;
  onError: (texto: string) => void;
}) {
  const [notas, setNotas] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const sucio = notas.trim() !== (inicial || '').trim();

  async function guardar() {
    setGuardando(true);
    const { error } = await guardarNotasInternas(clienteId, notas);
    setGuardando(false);
    if (error) {
      onError(mensajeError(error));
      return;
    }
    onGuardado('Notas guardadas.');
  }

  return (
    <section className="card card-pad separado" aria-labelledby="notas-titulo">
      <h2 id="notas-titulo" className="bloque-titulo">
        Notas internas
      </h2>
      <p className="campo-ayuda">Solo las ve el equipo. El cliente no tiene acceso a esto.</p>
      {/* Sin <label> visible: el encabezado de la sección y el texto de ayuda ya
          dicen qué es, y repetirlo sería ruido. El nombre accesible va por
          `aria-label` — el proyecto no tiene utilidad `sr-only`. */}
      <textarea
        id="notas-internas"
        aria-label="Notas internas sobre este cliente"
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        rows={4}
        placeholder="Ej. Pide factura a nombre de su clínica. Prefiere que le escriban por la tarde."
        style={{ width: '100%', marginTop: '.4rem' }}
      />
      <div className="fila" style={{ marginTop: '.6rem' }}>
        <button className="btn sec" type="button" onClick={guardar} disabled={guardando || !sucio}>
          {guardando ? 'Guardando…' : 'Guardar notas'}
        </button>
        {sucio && !guardando && <span className="campo-ayuda">Hay cambios sin guardar.</span>}
      </div>
    </section>
  );
}
