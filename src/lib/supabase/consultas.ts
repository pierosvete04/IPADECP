/**
 * Ayudas para consultas que pueden crecer más allá de los límites de PostgREST.
 *
 * PostgREST devuelve como máximo 1000 filas por petición y lo hace EN SILENCIO:
 * no hay error ni bandera, simplemente llegan mil filas. Una pantalla que hace
 * `select(...)` sin más y filtra en memoria funciona perfecto durante meses y un
 * día empieza a esconder los registros más antiguos sin que nada lo delate.
 */

/** Lo mínimo que necesitamos de un query builder de Supabase para paginarlo. */
interface ConsultaRangeable<T> {
  range(desde: number, hasta: number): PromiseLike<{ data: T[] | null; error: { message?: string } | null }>;
}

/** Tope de seguridad: 50 páginas de 1000. Si una tabla llega acá, el problema es de diseño, no de paginado. */
const MAX_PAGINAS = 50;

/**
 * Trae todas las filas de una consulta, página por página.
 *
 * `construir` tiene que devolver una consulta NUEVA en cada llamada — los query
 * builders de Supabase no se pueden reutilizar una vez ejecutados.
 */
export async function traerTodo<T>(construir: () => ConsultaRangeable<T>, tamano = 1000): Promise<T[]> {
  const filas: T[] = [];
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const desde = pagina * tamano;
    const { data, error } = await construir().range(desde, desde + tamano - 1);
    if (error) throw new Error(error.message || 'No se pudieron cargar los datos.');
    const lote = data || [];
    filas.push(...lote);
    if (lote.length < tamano) return filas;
  }
  console.warn(`traerTodo alcanzó el tope de ${MAX_PAGINAS} páginas; puede haber filas sin cargar.`);
  return filas;
}

/**
 * Parte una lista de valores para un `.in(...)` en lotes.
 *
 * Un `.in()` con cientos de ids viaja en la query string, y a partir de cierto
 * tamaño el servidor responde 414 (URI demasiado larga) — que se manifiesta como
 * "no hay perfiles" en vez de como un error.
 */
export async function enLotes<V, T>(valores: V[], tamano: number, consultar: (lote: V[]) => Promise<T[]>): Promise<T[]> {
  const salida: T[] = [];
  for (let i = 0; i < valores.length; i += tamano) {
    salida.push(...(await consultar(valores.slice(i, i + tamano))));
  }
  return salida;
}
