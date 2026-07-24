'use client';

import { useId, type ChangeEvent, type ReactNode } from 'react';

export interface FileButtonProps {
  accept?: string;
  onFile: (file: File) => void;
  children: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  cargando?: boolean;
  textoCargando?: string;
  variant?: 'sec' | 'primario';
  size?: 'sm' | 'normal';
  className?: string;
}

/**
 * Versión "botón" del selector de archivo estándar (ver FileDropzone), para
 * filas angostas donde la caja punteada no entra — ej. subir el PDF de una
 * tarea en la lista de evaluaciones. Se ve exactamente igual que cualquier
 * <button className="btn ...">, porque usa las mismas clases.
 */
export default function FileButton({
  accept,
  onFile,
  children,
  icon,
  disabled = false,
  cargando = false,
  textoCargando = 'Subiendo…',
  variant = 'sec',
  size = 'sm',
  className = '',
}: FileButtonProps) {
  const id = useId();
  const deshabilitado = disabled || cargando;

  function manejarCambio(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onFile(file);
  }

  return (
    <label
      htmlFor={id}
      className={['btn', 'file-btn', variant === 'sec' ? 'sec' : '', size === 'sm' ? 'btn-sm' : '', deshabilitado ? 'disabled' : '', className]
        .filter(Boolean)
        .join(' ')}
      aria-disabled={deshabilitado}
    >
      <input id={id} type="file" accept={accept} disabled={deshabilitado} onChange={manejarCambio} />
      {icon}
      {cargando ? textoCargando : children}
    </label>
  );
}
