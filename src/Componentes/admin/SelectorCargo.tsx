'use client';

import { useId, useState } from 'react';
import type { CargoProfesional } from '@/lib/cargos';

/** Valor del `<option>` que abre el campo de texto libre. */
const OTRO = 'Otro';

/**
 * Cargo profesional: catálogo + escape a texto libre.
 *
 * Los tres formularios de emisión lo resolvían por su cuenta y ninguno igual:
 *
 *  - Dos dependían de que existiera una fila llamada "Otro" en
 *    `cargos_profesionales` para que apareciera la opción. Existe, pero es un
 *    acoplamiento invisible: si alguien la desactiva desde el panel de Cargos,
 *    el campo de texto libre desaparece de la interfaz sin que nadie lo note.
 *  - El tercero añadía un `<option value="Otro">` fijo ADEMÁS de recorrer el
 *    catálogo, así que mostraba la opción "Otro" dos veces.
 *
 * Acá la opción se añade solo si el catálogo no la trae ya, y el valor inicial
 * que no esté en el catálogo abre el modo libre en vez de quedar en blanco —
 * antes, reabrir un pedido con un cargo escrito a mano mostraba el select vacío
 * y había que volver a teclearlo.
 */
export default function SelectorCargo({
  cargos,
  inicial = '',
  onChange,
  etiqueta = 'Cargo profesional',
}: {
  cargos: CargoProfesional[];
  inicial?: string;
  /** Recibe el cargo final ya resuelto (el del catálogo o el escrito a mano, sin espacios). */
  onChange: (cargoFinal: string) => void;
  etiqueta?: string;
}) {
  const id = useId();
  const enCatalogo = (valor: string) => cargos.some((c) => c.nombre === valor);
  const libreDeEntrada = !!inicial && !enCatalogo(inicial);

  const [seleccion, setSeleccion] = useState(libreDeEntrada ? OTRO : inicial);
  const [libre, setLibre] = useState(libreDeEntrada ? inicial : '');

  const catalogoTraeOtro = cargos.some((c) => c.nombre === OTRO);

  function cambiarSeleccion(valor: string) {
    setSeleccion(valor);
    onChange(valor === OTRO ? libre.trim() : valor);
  }

  function cambiarLibre(valor: string) {
    setLibre(valor);
    onChange(valor.trim());
  }

  return (
    <>
      <label htmlFor={`${id}-cargo`}>{etiqueta}</label>
      <select id={`${id}-cargo`} value={seleccion} onChange={(e) => cambiarSeleccion(e.target.value)}>
        <option value="">— Elige un cargo —</option>
        {cargos.map((c) => (
          <option value={c.nombre} key={c.id}>
            {c.nombre}
          </option>
        ))}
        {!catalogoTraeOtro && <option value={OTRO}>Otro…</option>}
      </select>
      {seleccion === OTRO && (
        <input
          id={`${id}-cargo-libre`}
          style={{ marginTop: '.4rem' }}
          aria-label="Escribe el cargo profesional"
          placeholder="Especifica el cargo"
          value={libre}
          onChange={(e) => cambiarLibre(e.target.value)}
        />
      )}
    </>
  );
}
