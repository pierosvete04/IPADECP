// Carrito público (visitante sin cuenta) — persistido en localStorage, sin
// tocar Supabase. Al llegar a /carrito y continuar, recién ahí se pide login
// y el pago se completa con el checkout real que ya existe en el aula
// (ComprarTab/CheckoutView). Ver DISENO-WEB-PUBLICA-IPADECP.md §9-§10.

const CLAVE = 'ipadecp_carrito_publico';
export const EVENTO_CARRITO = 'ipadecp-carrito-actualizado';

export interface ItemCarritoPublico {
  id: number;
  nombre: string;
  precio: number;
  img: string | null;
}

export function leerCarritoPublico(): ItemCarritoPublico[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CLAVE);
    return raw ? (JSON.parse(raw) as ItemCarritoPublico[]) : [];
  } catch {
    return [];
  }
}

function guardarCarritoPublico(items: ItemCarritoPublico[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CLAVE, JSON.stringify(items));
  window.dispatchEvent(new Event(EVENTO_CARRITO));
}

export function agregarAlCarritoPublico(item: ItemCarritoPublico): ItemCarritoPublico[] {
  const actual = leerCarritoPublico();
  if (actual.some((it) => it.id === item.id)) return actual;
  const nuevo = [...actual, item];
  guardarCarritoPublico(nuevo);
  return nuevo;
}

export function quitarDelCarritoPublico(id: number): ItemCarritoPublico[] {
  const nuevo = leerCarritoPublico().filter((it) => it.id !== id);
  guardarCarritoPublico(nuevo);
  return nuevo;
}

// Se llama al transferir el carrito público al carrito real del aula
// (ComprarTab), justo después de que el alumno inicia sesión — para que no
// se vuelva a importar dos veces si visita /aula?sec=comprar otra vez.
export function vaciarCarritoPublico() {
  guardarCarritoPublico([]);
}
