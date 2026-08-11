'use client';

import { useState } from 'react';
import Modal from './Modal';
import Aviso from './Aviso';

/**
 * Diálogo de confirmación estándar para acciones destructivas, en reemplazo
 * de `window.confirm()`. Los botones se etiquetan con la acción real
 * ("Borrar curso" / "Cancelar") en vez de "Aceptar"/"Cancelar" genéricos.
 *
 * `onConfirm` puede devolver una promesa. Si lo hace, el diálogo se queda
 * abierto con el botón en "Anulando…" hasta que resuelva:
 *
 *  - si resuelve a un string, lo trata como el motivo del fallo y lo muestra
 *    DENTRO del diálogo, sin cerrarlo, para que se pueda reintentar;
 *  - si resuelve a nada, cierra.
 *
 * Antes cerraba al instante y sin esperar: si la mutación fallaba (RLS, red),
 * el admin veía el diálogo desaparecer y la tabla recargar sin cambios, sin
 * ninguna pista de que la acción no se había hecho.
 */
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  peligro?: boolean;
  onConfirm: () => void | string | Promise<void | string>;
  onCancel: () => void;
}

export default function ConfirmDialog(props: ConfirmDialogProps) {
  // El cuerpo se monta solo mientras está abierto, así cada apertura arranca
  // con el estado limpio de fábrica — sin un efecto que resetee al abrir. Sin
  // esto, el error del intento anterior seguiría en pantalla al volver a
  // abrir el diálogo para otra fila.
  if (!props.open) return null;
  return <CuerpoConfirmDialog {...props} />;
}

function CuerpoConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  peligro = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [ejecutando, setEjecutando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setEjecutando(true);
    setError(null);
    try {
      const motivo = await onConfirm();
      if (typeof motivo === 'string' && motivo) {
        setError(motivo);
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción. Inténtalo de nuevo.');
      return;
    } finally {
      setEjecutando(false);
    }
  }

  return (
    <Modal open={open} title={title} onClose={ejecutando ? () => {} : onCancel} hideClose={ejecutando}>
      {/* `pre-line`: los resúmenes de varias líneas (cliente / cursos / total
          antes de emitir) se leen como una lista, no como un párrafo corrido
          donde el DNI se pega al nombre del curso. */}
      {body && (
        <p className="sub" style={{ marginTop: 0, whiteSpace: 'pre-line' }}>
          {body}
        </p>
      )}
      <Aviso tipo="err" mensaje={error} />
      <div className="fila" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
        <button className="btn sec" type="button" onClick={onCancel} disabled={ejecutando}>
          {cancelLabel}
        </button>
        <button className={peligro ? 'btn peligro' : 'btn'} type="button" onClick={confirmar} disabled={ejecutando}>
          {ejecutando ? 'Un momento…' : error ? 'Reintentar' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
