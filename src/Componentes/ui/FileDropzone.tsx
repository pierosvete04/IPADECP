'use client';

import { useId, type ChangeEvent, type ReactNode } from 'react';

export interface FileDropzoneProps {
  accept?: string;
  onFile: (file: File) => void;
  icon?: ReactNode;
  label?: string;
  ayuda?: string;
  cargando?: boolean;
  textoCargando?: string;
  nombreArchivo?: string | null;
  disabled?: boolean;
  compacto?: boolean;
  className?: string;
}

/**
 * Reemplazo estándar del <input type="file"> nativo (el botón gris feo del
 * navegador, sin estilo propio): una caja punteada clickeable con ícono,
 * texto y estado de "archivo elegido". El input real sigue existiendo pero
 * oculto solo visualmente (ver .dropzone input[type="file"] en
 * estilos.css) — no con el atributo `hidden`, que lo saca del tab order y
 * lo esconde de lectores de pantalla.
 */
export default function FileDropzone({
  accept,
  onFile,
  icon,
  label = 'Subir archivo',
  ayuda,
  cargando = false,
  textoCargando = 'Subiendo…',
  nombreArchivo,
  disabled = false,
  compacto = false,
  className = '',
}: FileDropzoneProps) {
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
      className={['dropzone', nombreArchivo && !cargando ? 'con-archivo' : '', deshabilitado ? 'disabled' : '', compacto ? 'compacto' : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      <input id={id} type="file" accept={accept} disabled={deshabilitado} onChange={manejarCambio} />
      <span className="dropzone-icono">{icon ?? <span className="material-symbols-outlined">upload_file</span>}</span>
      <span className="dropzone-info">{cargando ? textoCargando : label}</span>
      {ayuda && !cargando && (
        <span className="dropzone-info" style={{ opacity: 0.7 }}>
          {ayuda}
        </span>
      )}
      {nombreArchivo && !cargando && <span className="dropzone-nombre">{nombreArchivo}</span>}
    </label>
  );
}
