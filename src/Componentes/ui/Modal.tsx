'use client';

import { ReactNode } from 'react';

export default function Modal({
  open,
  title,
  onClose,
  children,
  hideClose = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  hideClose?: boolean;
}) {
  return (
    <div
      className={`modal-bg${open ? ' abierto' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-caja">
        <div className="modal-cab">
          <h3>{title}</h3>
          {!hideClose && (
            <button className="cerrar" onClick={onClose} type="button" aria-label="Cerrar">
              &times;
            </button>
          )}
        </div>
        <div className="modal-cuerpo">{children}</div>
      </div>
    </div>
  );
}
