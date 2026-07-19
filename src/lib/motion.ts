'use client';

import { gsap } from 'gsap';

// Lee un token de color/sombra del tema en tiempo real, para que las
// animaciones de GSAP no dupliquen valores hardcodeados que se puedan
// desincronizar de estilos.css/tema-stitch.css.
function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Revela en cascada los hijos directos que matchean `selector` dentro de
 * `container`, al montar o cuando cambia la lista (filtro, paginación).
 * stagger corto (0.03-0.05s) para no sentirse lento en listas de +6 items.
 *
 * Importante: NO anima `opacity`. Si se anima opacity de 0→1 y el tween no
 * llega a completarse por cualquier motivo (el efecto se re-dispara antes de
 * terminar, la pestaña queda en background y el navegador pausa
 * requestAnimationFrame, etc.), el contenido queda invisible — así se rompió
 * "Mis cursos" la primera vez. Animar solo `y` es seguro: en el peor caso
 * (GSAP no llega a correr) el contenido ya está ahí, solo no se desliza.
 */
export function revealStagger(
  container: HTMLElement | null,
  selector: string,
  opts?: { y?: number; stagger?: number; duration?: number; delay?: number }
) {
  if (!container) return;
  const items = container.querySelectorAll<HTMLElement>(selector);
  if (!items.length) return;
  gsap.killTweensOf(items);
  gsap.from(items, {
    y: opts?.y ?? 10,
    duration: opts?.duration ?? 0.35,
    stagger: opts?.stagger ?? 0.04,
    delay: opts?.delay ?? 0,
    ease: 'power1.out',
    clearProps: 'transform',
  });
}

/**
 * Hover "lift" físico (power2.out) para tarjetas clicables — reemplaza el
 * transform/box-shadow por CSS transition, que compite en easing con GSAP.
 * Devuelve una función de limpieza para el useEffect que la llama.
 */
export function attachHoverLift(el: HTMLElement | null, opts?: { y?: number; scale?: number }) {
  if (!el) return () => {};
  const y = opts?.y ?? -6;
  const scale = opts?.scale ?? 1.015;
  const sombraReposo = cssVar('--st-sombra-1', '0px 4px 10px rgba(10,28,56,.12)');
  const sombraHover = '0px 16px 32px rgba(10,28,56,.22)';

  const enter = () => gsap.to(el, { y, scale, boxShadow: sombraHover, duration: 0.28, ease: 'power2.out' });
  const leave = () => gsap.to(el, { y: 0, scale: 1, boxShadow: sombraReposo, duration: 0.28, ease: 'power2.out' });

  el.addEventListener('mouseenter', enter);
  el.addEventListener('mouseleave', leave);
  el.addEventListener('focus', enter);
  el.addEventListener('blur', leave);

  return () => {
    el.removeEventListener('mouseenter', enter);
    el.removeEventListener('mouseleave', leave);
    el.removeEventListener('focus', enter);
    el.removeEventListener('blur', leave);
    gsap.killTweensOf(el);
  };
}

/**
 * Momento celebratorio (certificado emitido, pedido confirmado): el ícono
 * "pop" con expo.out y el contenido que sigue entra en cascada corta.
 * Tampoco anima `opacity` — mismo motivo que revealStagger: el mensaje de
 * "pedido registrado" no puede quedar invisible si la animación no corre.
 */
export function celebrar(container: HTMLElement | null, opts?: { icono?: string; resto?: string }) {
  if (!container) return;
  const icono = container.querySelector<HTMLElement>(opts?.icono ?? '[data-celebrar-icono]');
  const resto = container.querySelectorAll<HTMLElement>(opts?.resto ?? '[data-celebrar-item]');
  const tl = gsap.timeline();
  if (icono) {
    tl.from(icono, { scale: 0.4, duration: 0.5, ease: 'expo.out', clearProps: 'transform' });
  }
  if (resto.length) {
    tl.from(resto, { y: 12, duration: 0.35, stagger: 0.06, ease: 'power1.out', clearProps: 'transform' }, icono ? '-=0.2' : 0);
  }
}
