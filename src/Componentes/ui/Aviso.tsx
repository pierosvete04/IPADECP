'use client';

import { useEffect, useRef } from 'react';

export type TipoAviso = 'ok' | 'err' | 'info';

/**
 * Banner de resultado de una acción (guardado, error de validación, aviso).
 * Sustituye a los ~190 `<div className="aviso err">{texto}</div>` sueltos que
 * había repartidos por el panel, que tenían dos problemas serios:
 *
 *  1. Eran mudos. No había un solo `aria-live` ni `role="alert"` en todo el
 *     panel, así que quien usa lector de pantalla pulsaba "Guardar" y no se
 *     enteraba de nada — ni del éxito ni del error.
 *  2. En los formularios largos el banner vive ARRIBA y el botón de enviar
 *     ABAJO. Al fallar la validación de un formulario de 600px el mensaje
 *     aparecía fuera de la pantalla y el síntoma que reportaba el admin era
 *     "el botón no hace nada".
 *
 * Por eso este componente además de anunciar se DESPLAZA a la vista cuando
 * aparece un error. `ok`/`info` no se desplazan: son confirmaciones, y robar
 * el scroll después de una acción que salió bien desorienta más de lo que
 * ayuda.
 *
 * El rol depende del tipo, no es cosmético: `alert` interrumpe al lector de
 * pantalla (lo correcto para un error que bloquea), `status` espera a que
 * termine la frase en curso (lo correcto para una confirmación).
 */
export default function Aviso({
  tipo = 'err',
  mensaje,
  /** Contenido enriquecido, si el aviso no es solo una frase. */
  children,
  className = '',
}: {
  tipo?: TipoAviso;
  mensaje?: string | null;
  children?: React.ReactNode;
  className?: string;
}) {
  const nodo = useRef<HTMLDivElement>(null);
  const hayContenido = !!mensaje || !!children;

  useEffect(() => {
    if (!hayContenido || tipo !== 'err') return;
    // `block: 'center'` y no `'start'`: con `start` el banner queda pegado al
    // borde superior del viewport, tapado por la topbar del panel.
    nodo.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [hayContenido, tipo, mensaje]);

  if (!hayContenido) return null;

  return (
    <div
      ref={nodo}
      className={`aviso ${tipo}${className ? ` ${className}` : ''}`}
      role={tipo === 'err' ? 'alert' : 'status'}
      aria-live={tipo === 'err' ? 'assertive' : 'polite'}
    >
      {mensaje}
      {children}
    </div>
  );
}
