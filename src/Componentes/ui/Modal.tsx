'use client';

import { ReactNode, useCallback, useEffect, useId, useRef } from 'react';

/** Todo lo que puede recibir foco dentro del modal. */
const FOCUSABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Cuántos modales hay abiertos a la vez. El bloqueo de scroll del body es
 * global, así que si un modal abre otro encima (ConfirmDialog sobre un
 * formulario) el que se cierra primero no debe devolverle el scroll a la
 * página que sigue tapada.
 */
let abiertos = 0;

/**
 * Diálogo modal del panel. Además de pintar la caja se encarga de las cuatro
 * cosas que un modal DEBE hacer y que antes no hacía ninguna:
 *
 *  1. `role="dialog"` + `aria-modal` + `aria-labelledby`, para que un lector
 *     de pantalla anuncie "diálogo, <título>" en vez de leer la página de
 *     atrás como si nada hubiera pasado.
 *  2. Cierra con Escape. Es el gesto que todo el mundo prueba primero.
 *  3. Atrapa el foco: sin esto el Tab se escapa a los controles de la página
 *     de abajo, que siguen siendo alcanzables aunque el fondo los tape.
 *  4. Devuelve el foco al elemento que lo abrió al cerrar, y bloquea el
 *     scroll del body mientras está abierto.
 *
 * `onClose` se llama tanto al pulsar Escape como al hacer clic fuera. Para un
 * modal del que no se debe poder salir sin decidir (ver `hideClose`), pásale
 * un `onClose` que no haga nada.
 */
export default function Modal({
  open,
  title,
  onClose,
  children,
  hideClose = false,
  className = '',
  /** Descripción corta bajo el título, anunciada junto al diálogo. */
  descripcion,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  hideClose?: boolean;
  className?: string;
  descripcion?: string;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const devolverFocoA = useRef<HTMLElement | null>(null);
  const tituloId = useId();
  const descripcionId = useId();

  // Se guarda en un ref para que el efecto de teclado no se vuelva a montar en
  // cada render solo porque el padre pasó un `onClose` nuevo (lo normal: casi
  // todos lo escriben como arrow function inline). La asignación va en su
  // propio efecto y no en el cuerpo del render, que es donde los refs no se
  // deben tocar.
  const cerrarRef = useRef(onClose);
  useEffect(() => {
    cerrarRef.current = onClose;
  }, [onClose]);

  const enfocarPrimero = useCallback(() => {
    const nodo = caja.current;
    if (!nodo) return;
    const candidatos = nodo.querySelectorAll<HTMLElement>(FOCUSABLES);
    // Se salta el botón de cerrar: abrir un formulario con el foco en la "X"
    // hace que Enter lo descarte. El primer campo real es mejor destino.
    const primero = [...candidatos].find((el) => !el.hasAttribute('data-cerrar')) ?? candidatos[0] ?? nodo;
    primero.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    devolverFocoA.current = document.activeElement as HTMLElement | null;
    abiertos += 1;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // rAF y no llamada directa: el contenido puede montarse en el mismo tick
    // (children condicionales) y todavía no estar en el DOM.
    const raf = requestAnimationFrame(enfocarPrimero);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cerrarRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const nodo = caja.current;
      if (!nodo) return;
      const focusables = [...nodo.querySelectorAll<HTMLElement>(FOCUSABLES)].filter((el) => el.offsetParent !== null);
      if (!focusables.length) {
        e.preventDefault();
        return;
      }
      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];
      const activo = document.activeElement;

      // El ciclo se cierra a mano en los dos extremos. Sin esto el Tab sale
      // del modal hacia la página de atrás en cuanto llega al último control.
      if (e.shiftKey && (activo === primero || !nodo.contains(activo))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (activo === ultimo || !nodo.contains(activo))) {
        e.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      cancelAnimationFrame(raf);
      abiertos = Math.max(0, abiertos - 1);
      if (abiertos === 0) document.body.style.overflow = overflowPrevio;
      devolverFocoA.current?.focus?.();
    };
  }, [open, enfocarPrimero]);

  // Desmontado del todo cuando está cerrado: antes quedaba en el DOM con
  // `display:none`, lo que dejaba su contenido montado (y sus efectos y
  // suscripciones vivos) aunque no se viera.
  if (!open) return null;

  return (
    <div
      className="modal-bg abierto"
      onMouseDown={(e) => {
        // mousedown y no click: si sueltas el mouse fuera de la caja después
        // de seleccionar texto dentro de ella, `click` dispara en el fondo y
        // el modal se cerraba comiéndose lo que estabas escribiendo.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={caja}
        className={`modal-caja${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descripcion ? descripcionId : undefined}
      >
        <div className="modal-cab">
          <h3 id={tituloId}>{title}</h3>
          {!hideClose && (
            <button className="cerrar" onClick={onClose} type="button" aria-label="Cerrar" data-cerrar>
              &times;
            </button>
          )}
        </div>
        <div className="modal-cuerpo">
          {descripcion && (
            <p id={descripcionId} className="sub" style={{ marginTop: 0 }}>
              {descripcion}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
