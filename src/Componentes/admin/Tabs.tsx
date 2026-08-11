'use client';

import { useId, useRef } from 'react';

export interface TabDef<T extends string> {
  valor: T;
  etiqueta: string;
  /** Pestaña que aún no se puede abrir (ej. requiere guardar antes). */
  deshabilitada?: boolean;
  /** Por qué está deshabilitada. Se muestra bajo las pestañas, no en un `title`. */
  motivo?: string;
}

/**
 * Pestañas del panel, con su panel de contenido incluido.
 *
 * Antes eran `<button className="tab-btn">` sueltos: sin `role="tablist"`,
 * sin `aria-selected` y sin `aria-controls`, así que la pestaña activa se
 * comunicaba ÚNICAMENTE por el color del borde inferior — invisible para un
 * lector de pantalla y para quien no distingue ese tono.
 *
 * Además implementa la navegación con flechas que se espera de un tablist
 * (WAI-ARIA APG): con el patrón de botones sueltos había que tabular una por
 * una, y cada pestaña era una parada más entre el título y el formulario.
 */
export default function Tabs<T extends string>({
  tabs,
  valor,
  onChange,
  /** Etiqueta del grupo, para lectores de pantalla. */
  etiqueta,
  children,
}: {
  tabs: TabDef<T>[];
  valor: T;
  onChange: (valor: T) => void;
  etiqueta: string;
  children: React.ReactNode;
}) {
  const base = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const habilitadas = tabs.filter((t) => !t.deshabilitada);

  function onKeyDown(e: React.KeyboardEvent) {
    // La navegación con flechas salta las deshabilitadas: parar en una
    // pestaña a la que no se puede entrar es un callejón sin salida.
    const i = habilitadas.findIndex((t) => t.valor === valor);
    let destino = -1;
    if (e.key === 'ArrowRight') destino = (i + 1) % habilitadas.length;
    else if (e.key === 'ArrowLeft') destino = (i - 1 + habilitadas.length) % habilitadas.length;
    else if (e.key === 'Home') destino = 0;
    else if (e.key === 'End') destino = habilitadas.length - 1;
    if (destino < 0 || !habilitadas.length) return;
    e.preventDefault();
    const siguiente = habilitadas[destino];
    onChange(siguiente.valor);
    refs.current[siguiente.valor]?.focus();
  }

  // Un solo aviso al pie del grupo en vez de un `title` por pestaña: el
  // tooltip nativo no se alcanza con teclado y desaparece solo.
  const motivoVisible = tabs.find((t) => t.deshabilitada && t.motivo)?.motivo;

  return (
    <>
      <div className="tabs" role="tablist" aria-label={etiqueta} onKeyDown={onKeyDown}>
        {tabs.map((t) => {
          const activo = t.valor === valor;
          return (
            <button
              key={t.valor}
              ref={(el) => {
                refs.current[t.valor] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.valor}`}
              aria-selected={activo}
              aria-controls={`${base}-panel`}
              // Solo la pestaña activa está en el orden de tabulación: dentro
              // del grupo se navega con flechas y el Tab siguiente lleva al
              // contenido. Es el comportamiento estándar de un tablist; con
              // botones sueltos cada pestaña era una parada más antes de
              // llegar al formulario.
              tabIndex={activo ? 0 : -1}
              disabled={t.deshabilitada}
              className={`tab-btn${activo ? ' activo' : ''}`}
              onClick={() => onChange(t.valor)}
            >
              {t.etiqueta}
            </button>
          );
        })}
      </div>
      {motivoVisible && <p className="campo-ayuda tabs-motivo">{motivoVisible}</p>}
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${valor}`}>
        {children}
      </div>
    </>
  );
}
