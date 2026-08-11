'use client';

/**
 * Progreso de una operación por lotes (emitir certificados, enviar correos).
 *
 * Los tres caminos de emisión mostraban tres cosas distintas para lo mismo: el
 * formulario individual una barra con el nombre del curso y región viva, la
 * carga masiva un párrafo mudo sin barra, y "Pendientes de emitir" solo un
 * "Emitiendo…" en el botón. Son operaciones de decenas de segundos, así que la
 * versión muda se lee como una pantalla colgada.
 *
 * `role="status"` + `aria-live="polite"` y no `alert`: es un avance, no un
 * error, y no debe interrumpir la frase en curso del lector de pantalla.
 */
export default function ProgresoEmision({
  actual,
  total,
  /** Verbo en gerundio: "Emitiendo", "Enviando". */
  accion = 'Emitiendo',
  /** Qué se está procesando ahora mismo (curso, cliente). Opcional. */
  detalle,
}: {
  actual: number;
  total: number;
  accion?: string;
  detalle?: string;
}) {
  return (
    <div className="aviso info" role="status" aria-live="polite" style={{ marginTop: '1rem' }}>
      {accion} {actual} de {total}
      {detalle ? `: ${detalle}` : ''}…
      <progress className="progreso-emision" value={actual} max={total} />
    </div>
  );
}
