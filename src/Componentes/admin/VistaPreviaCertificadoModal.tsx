'use client';

import Modal from '@/Componentes/ui/Modal';

export interface VistaPreviaCertificado {
  url: string;
  filename: string;
}

export default function VistaPreviaCertificadoModal({
  previa,
  onClose,
}: {
  previa: VistaPreviaCertificado | null;
  onClose: () => void;
}) {
  return (
    <Modal open={!!previa} title="Vista previa del certificado" onClose={onClose} className="modal-ancho">
      {previa && (
        <>
          <iframe src={previa.url} style={{ width: '100%', height: '70vh', border: 0 }} title="Vista previa del certificado" />
          <div className="fila" style={{ marginTop: '.8rem' }}>
            <a className="btn" href={previa.url} download={previa.filename}>
              Descargar PDF
            </a>
          </div>
        </>
      )}
    </Modal>
  );
}
