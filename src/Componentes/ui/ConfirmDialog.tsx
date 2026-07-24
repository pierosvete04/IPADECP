'use client';

import Modal from './Modal';

/**
 * Diálogo de confirmación estándar para acciones destructivas, en reemplazo
 * de `window.confirm()`. Los botones se etiquetan con la acción real
 * ("Borrar curso" / "Cancelar") en vez de "Aceptar"/"Cancelar" genéricos.
 */
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  peligro = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  peligro?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <Modal open={open} title={title} onClose={onCancel}>
      {body && (
        <p className="sub" style={{ marginTop: 0 }}>
          {body}
        </p>
      )}
      <div className="fila" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
        <button className="btn sec" type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button className={peligro ? 'btn peligro' : 'btn'} type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
