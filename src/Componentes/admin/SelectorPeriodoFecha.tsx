'use client';

import { useId } from 'react';
import { periodoPorId, type Periodo } from '@/lib/periodos';
import { fechaLegible, type CalendarioHabil } from '@/lib/diasHabiles';

/**
 * El par "Período de certificación + Fecha del certificado" que piden los cuatro
 * caminos de emisión (individual, combo, pendientes de emitir y el modal del aula).
 *
 * Estaba copiado en cada uno con reglas distintas: dos acotaban la fecha al rango
 * del período y uno no; ninguno comprobaba que fuera día hábil, que es lo que el
 * RPC exige y por lo que la emisión reventaba a mitad del bucle. Unificarlo deja
 * una sola definición de "fecha válida" y de paso arregla los `<label>` sueltos,
 * que no tenían `htmlFor` y dejaban los controles sin nombre accesible — con N
 * bloques de curso repetidos, N veces.
 */
export default function SelectorPeriodoFecha({
  periodos,
  periodoId,
  fecha,
  onChange,
  calendario,
  deshabilitado = false,
}: {
  periodos: Periodo[];
  periodoId: string;
  fecha: string;
  /** Se llama con el cambio parcial; elegir período reajusta la fecha (ver `fechaSugerida`). */
  onChange: (cambios: { periodoId?: string; fecha?: string }) => void;
  calendario: CalendarioHabil | null;
  deshabilitado?: boolean;
}) {
  const id = useId();
  const periodo = periodoPorId(periodos, periodoId);
  const motivo = calendario && fecha ? calendario.motivoNoHabil(fecha) : null;
  const sugerida =
    motivo && calendario && periodo ? calendario.masCercano(fecha, periodo.fecha_inicio, periodo.fecha_cierre) : null;

  return (
    <>
      <div className="perfil-grid">
        <div>
          <label htmlFor={`${id}-periodo`}>Período de certificación</label>
          <select
            id={`${id}-periodo`}
            value={periodoId}
            disabled={deshabilitado}
            onChange={(e) => onChange({ periodoId: e.target.value })}
          >
            <option value="">— Elige un período —</option>
            {periodos.map((p) => (
              <option value={p.id} key={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-fecha`}>Fecha del certificado</label>
          <input
            id={`${id}-fecha`}
            type="date"
            disabled={deshabilitado || !periodo}
            min={periodo?.fecha_inicio}
            max={periodo?.fecha_cierre}
            value={fecha}
            aria-invalid={!!motivo}
            aria-describedby={motivo ? `${id}-error` : `${id}-nota`}
            onChange={(e) => onChange({ fecha: e.target.value })}
          />
        </div>
      </div>

      {periodo && !motivo && (
        <p className="item-form-nota" id={`${id}-nota`}>
          Debe ser un día hábil entre {fechaLegible(periodo.fecha_inicio)} y {fechaLegible(periodo.fecha_cierre)}.
        </p>
      )}

      {/* El motivo va pegado al campo y no en el banner del formulario: es el
          resultado de UN campo, y con varios cursos abiertos el banner de arriba
          no diría de cuál. El botón de arreglo evita mandar al admin a contar
          días en un calendario aparte. */}
      {motivo && (
        <p className="campo-ayuda err" id={`${id}-error`} role="status">
          {motivo} El certificado no se puede emitir con esta fecha.
          {sugerida && (
            <>
              {' '}
              <button type="button" className="enlace-accion" onClick={() => onChange({ fecha: sugerida })}>
                Usar el {fechaLegible(sugerida)}
              </button>
            </>
          )}
        </p>
      )}
    </>
  );
}

/**
 * Fecha que se propone al elegir un período: su fecha de entrega, o el día hábil
 * más cercano si la entrega cae en fin de semana o feriado.
 *
 * Antes se ponía la fecha de entrega tal cual. Cuando esa fecha no era hábil, el
 * valor por defecto del formulario era justamente el que el RPC iba a rechazar.
 */
export function fechaSugerida(periodo: Periodo | undefined, calendario: CalendarioHabil | null): string {
  if (!periodo) return '';
  if (!calendario || calendario.esHabil(periodo.fecha_entrega)) return periodo.fecha_entrega;
  return calendario.masCercano(periodo.fecha_entrega, periodo.fecha_inicio, periodo.fecha_cierre) || periodo.fecha_entrega;
}
