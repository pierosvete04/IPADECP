'use client';

import { useEffect, useState } from 'react';
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
      {/* El cuerpo se monta por certificado (`key`), así cada apertura arranca en
          "cargando" sin necesidad de un efecto que resetee el estado al abrir. */}
      {previa && <CuerpoPrevia key={previa.url} previa={previa} />}
    </Modal>
  );
}

/** Un blob: URL lo generó el propio navegador y siempre es válido; no hay nada que comprobar. */
const esLocal = (url: string) => url.startsWith('blob:');

function CuerpoPrevia({ previa }: { previa: VistaPreviaCertificado }) {
  // El <iframe> avisa cuando termina de cargar, pero no si lo que cargó es un
  // PDF o el JSON de error que devuelve la ruta cuando algo falla. Por eso se
  // comprueba aparte: sin esto, un 500 se veía como un bloque de texto JSON
  // crudo dentro del visor, sin ninguna explicación.
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error'>(() => (esLocal(previa.url) ? 'ok' : 'cargando'));

  useEffect(() => {
    if (esLocal(previa.url)) return;
    let vivo = true;
    fetch(previa.url, { method: 'HEAD' })
      .then((res) => vivo && setEstado(res.ok ? 'ok' : 'error'))
      .catch(() => vivo && setEstado('error'));
    return () => {
      vivo = false;
    };
  }, [previa.url]);

  return (
    <>
      {estado === 'error' ? (
        <div className="aviso err" role="alert">
          No se pudo generar el certificado. El certificado sigue emitido y es válido — vuelve a intentarlo desde
          &quot;Certificados emitidos&quot;.
        </div>
      ) : (
        <>
          {estado === 'cargando' && (
            <p className="campo-ayuda" role="status">
              Generando el certificado…
            </p>
          )}
          {/* El alto sale del flex del modal y no de un `calc(70vh - 102px)`
              escrito a mano: ese 102 era la suma del padding de .modal-cuerpo
              más la fila del botón, y cualquier cambio en el modal dejaba el
              botón de descarga fuera de la vista sin que nada lo delatara. */}
          <iframe src={previa.url} className="previa-certificado" title="Vista previa del certificado" />
        </>
      )}
      <div className="fila" style={{ marginTop: '.8rem' }}>
        <a className="btn" href={previa.url} download={previa.filename}>
          Descargar PDF
        </a>
      </div>
    </>
  );
}
