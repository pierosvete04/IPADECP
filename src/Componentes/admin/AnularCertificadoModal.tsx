'use client';

import { useState } from 'react';
import { anularCertificado } from '@/lib/certificadosDirectos';
import Modal from '@/Componentes/ui/Modal';
import Aviso from '@/Componentes/ui/Aviso';

export interface CertificadoAnulable {
  id: number;
  nombre_completo: string | null;
  codigo_verificacion: string;
  cursoNombre: string;
}

/**
 * Anular un certificado emitido.
 *
 * Hasta ahora emitir no tenía vuelta atrás: si salía con el curso equivocado, a nombre de quien
 * no era, o el cliente nunca pagó, el certificado seguía diciendo "válido" en la página pública
 * para siempre. Lo único posible era borrar la fila, que además se lleva el rastro contable.
 *
 * Anular no borra: marca el certificado, la página pública pasa a mostrarlo como anulado y el
 * PDF deja de servirse. Es reversible desde la misma tabla si fue un error.
 */
export default function AnularCertificadoModal({
  fila,
  onClose,
  onAnulado,
}: {
  fila: CertificadoAnulable | null;
  onClose: () => void;
  onAnulado: (id: number) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [anulando, setAnulando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    if (!fila) return;
    setAnulando(true);
    setError(null);
    const res = await anularCertificado(fila.id, motivo);
    setAnulando(false);
    if (!res.ok) {
      setError(res.motivo || 'No se pudo anular el certificado.');
      return;
    }
    setMotivo('');
    onAnulado(fila.id);
  }

  return (
    <Modal open={!!fila} title="Anular certificado" onClose={anulando ? () => {} : onClose} hideClose={anulando}>
      {fila && (
        <>
          <p className="sub" style={{ marginTop: 0 }}>
            <strong>{fila.nombre_completo || 'Sin nombre'}</strong> — {fila.cursoNombre}
          </p>
          <div className="aviso info" role="status">
            Al anularlo, quien consulte su código verá <strong>&quot;Certificado anulado&quot;</strong> con la fecha y el
            motivo, y el PDF dejará de descargarse. El certificado no se borra y esto se puede revertir.
          </div>

          <label htmlFor="anular-motivo">Motivo (opcional, se muestra públicamente)</label>
          <input
            id="anular-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. Emitido por error, curso incorrecto"
            disabled={anulando}
          />
          <span className="campo-ayuda">
            Lo lee cualquiera que consulte el código. Escribe algo que se pueda mostrar a un tercero.
          </span>

          <Aviso tipo="err" mensaje={error} />

          <div className="fila" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button className="btn sec" type="button" onClick={onClose} disabled={anulando}>
              Cancelar
            </button>
            <button className="btn peligro" type="button" onClick={confirmar} disabled={anulando}>
              {anulando ? 'Anulando…' : 'Anular certificado'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
