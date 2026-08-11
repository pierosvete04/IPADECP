'use client';

import { useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { TableSkeleton } from './table/TableSkeleton';

/**
 * Los tres estados de una pantalla del panel, en un solo sitio.
 *
 * Antes había tres tratamientos distintos para lo mismo — `<p>Cargando…</p>`
 * en 22 sitios, `<TableSkeleton>` en 3 y `<Skeleton>` de shadcn solo en el
 * Dashboard — y NINGUNO para el error, que se confundía con la lista vacía.
 *
 * `cols` alimenta al esqueleto para que reserve la misma forma que tendrá la
 * tabla real y los datos no empujen la página al llegar.
 */
export default function EstadoCarga({
  cargando,
  error,
  onReintentar,
  cols = 5,
  children,
  /** Para pantallas que no son una tabla (formularios, detalles). */
  variante = 'tabla',
}: {
  cargando: boolean;
  error?: string | null;
  onReintentar?: () => void | Promise<void>;
  cols?: number;
  children: React.ReactNode;
  variante?: 'tabla' | 'bloque';
}) {
  if (error) {
    return <ErrorCarga error={error} onReintentar={onReintentar} />;
  }
  if (cargando) {
    return variante === 'tabla' ? <TableSkeleton cols={cols} /> : <BloqueCargando />;
  }
  return <>{children}</>;
}

export function ErrorCarga({ error, onReintentar }: { error: string; onReintentar?: () => void | Promise<void> }) {
  const [reintentando, setReintentando] = useState(false);

  async function reintentar() {
    if (!onReintentar) return;
    setReintentando(true);
    try {
      await onReintentar();
    } finally {
      setReintentando(false);
    }
  }

  return (
    <div className="card card-pad estado-error" role="alert">
      <AlertTriangle className="estado-error-icono" aria-hidden="true" />
      <div>
        <p className="estado-error-titulo">No se pudieron cargar los datos</p>
        {/* El motivo va tal cual lo devuelve mensajeError: "No tienes permisos
            para realizar esta acción" es accionable; "error" a secas no. */}
        <p className="estado-error-motivo">{error}</p>
      </div>
      {onReintentar && (
        <button type="button" className="btn sec btn-sm" onClick={reintentar} disabled={reintentando}>
          <RefreshCw size={14} className={reintentando ? 'animate-spin' : undefined} aria-hidden="true" />{' '}
          {reintentando ? 'Reintentando…' : 'Reintentar'}
        </button>
      )}
    </div>
  );
}

/** Esqueleto para pantallas que no son una tabla. */
export function BloqueCargando() {
  return (
    <div className="card card-pad" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <div className="bloque-skeleton" />
      <div className="bloque-skeleton corto" />
      <div className="bloque-skeleton" />
    </div>
  );
}
