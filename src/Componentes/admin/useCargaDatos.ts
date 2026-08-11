'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { mensajeError } from '@/lib/copy';

/**
 * Carga los datos de una pantalla del panel distinguiendo los TRES estados
 * que puede tener una lista, no dos.
 *
 * El patrón que había antes en 25 secciones era:
 *
 *     const { data } = await supabase.from('x').select('*');
 *     setFilas(data || []);
 *
 * Descarta `error`. Si la consulta falla (RLS, sesión vencida, red caída),
 * `data` llega `null`, el `|| []` lo convierte en lista vacía y la pantalla
 * afirma "Aún no hay registros" — o sea, el panel le dice al admin que no
 * existen datos cuando en realidad no pudo leerlos. En un sistema que emite
 * certificados y registra pedidos eso lleva a duplicar trabajo: alguien
 * concluye que un pedido no existe y lo vuelve a crear.
 *
 * Con este hook "vacío" y "roto" dejan de ser el mismo estado: la función que
 * se le pasa debe LANZAR si la consulta falló, y el error viaja hasta la UI
 * (ver <EstadoCarga>), que ofrece reintentar.
 */
export function useCargaDatos<T>(cargar: () => Promise<T>, deps: React.DependencyList = []) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const montado = useRef(true);
  // Cada recarga lleva número. Si el admin toca "Reintentar" dos veces
  // seguidas y la primera respuesta llega tarde, se descarta: pintar el
  // resultado de una petición vieja encima de una nueva es cómo aparecen las
  // listas que "vuelven" a un estado anterior sola.
  const corrida = useRef(0);

  // La función se guarda en un ref para que `recargar` sea estable aunque el
  // llamador la escriba inline (que es lo normal). La asignación va en un
  // efecto, no en el cuerpo del render, que es donde los refs no se tocan.
  const cargarRef = useRef(cargar);
  useEffect(() => {
    cargarRef.current = cargar;
  });

  // Ningún setState sucede de forma síncrona aquí: todos van después del
  // `await`. Eso permite llamarla desde el efecto de montaje sin provocar la
  // cascada de renders que produce actualizar estado en el cuerpo de un
  // efecto. Como efecto lateral bueno, al reintentar el mensaje de error
  // sigue en pantalla hasta que la nueva consulta responde, en vez de
  // parpadear a esqueleto y volver.
  const recargar = useCallback(async () => {
    const mia = ++corrida.current;
    try {
      const resultado = await cargarRef.current();
      if (!montado.current || mia !== corrida.current) return;
      setError(null);
      setDatos(resultado);
    } catch (e) {
      if (!montado.current || mia !== corrida.current) return;
      setDatos(null);
      setError(mensajeError(e as { message?: string | null }, 'No se pudieron cargar los datos.'));
    }
  }, []);

  useEffect(() => {
    montado.current = true;
    // `set-state-in-effect` marca esto porque `recargar` contiene setState,
    // pero todos ocurren DESPUÉS del await (ver arriba): no hay cascada de
    // renders síncrona, que es lo que la regla previene. La regla no puede
    // distinguirlo, así que se silencia aquí y solo aquí.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recargar();
    return () => {
      montado.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { datos, error, cargando: datos === null && !error, recargar, setDatos };
}

/**
 * Azúcar para el caso más común: una consulta de Supabase que devuelve
 * `{ data, error }`. Lanza si hay error en vez de tragárselo.
 *
 *     const filas = await datosDe(supabase.from('reclamos').select('*'));
 */
export async function datosDe<T>(consulta: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const { data, error } = await consulta;
  if (error) throw error;
  return (data as T[]) || [];
}

/** Igual que `datosDe` pero para consultas de una sola fila (`.single()`, `.maybeSingle()`). */
export async function filaDe<T>(consulta: PromiseLike<{ data: unknown; error: unknown }>): Promise<T | null> {
  const { data, error } = await consulta;
  if (error) throw error;
  return (data as T) ?? null;
}
