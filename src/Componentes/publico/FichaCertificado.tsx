import Link from 'next/link';
import { estaAnulado, urlCertificadoServidor, type CertificadoPublico } from '@/lib/certificado';
import { fechaPeru, fechaSoloDia } from '@/lib/fechas';

/**
 * El resultado de una verificación: la ficha del certificado, válido o anulado.
 *
 * Componente de servidor sin estado — lo usan tanto `/certificado/[codigo]` (entrada por QR)
 * como `/certificado` (entrada por búsqueda), para que las dos vías muestren exactamente lo
 * mismo y no haya dos verdades sobre el mismo certificado.
 */
export default function FichaCertificado({ cert }: { cert: CertificadoPublico }) {
  const anulado = estaAnulado(cert);

  return (
    <div className="card card-pad ficha-certificado">
      {/* El veredicto es lo primero y va como `status`: es lo único que la persona vino a
          saber, y antes era un <div> mudo que un lector de pantalla no anunciaba. */}
      <div className={`aviso ${anulado ? 'err' : 'ok'} ficha-certificado-veredicto`} role="status">
        <span className="material-symbols-outlined" aria-hidden="true">
          {anulado ? 'cancel' : 'verified'}
        </span>
        <span>
          <strong>{anulado ? 'Certificado anulado' : 'Certificado válido'}</strong>
          <span className="ficha-certificado-veredicto-sub">
            {anulado
              ? 'Este certificado fue anulado por IPADECP y ya no acredita nada.'
              : 'Emitido por IPADECP y vigente a la fecha de esta consulta.'}
          </span>
        </span>
      </div>

      {anulado && (
        <dl className="ficha-certificado-datos ficha-certificado-anulacion">
          <div>
            <dt>Fecha de anulación</dt>
            <dd>{fechaPeru(cert.anulado_en) || '—'}</dd>
          </div>
          {cert.motivo_anulacion && (
            <div>
              <dt>Motivo</dt>
              <dd>{cert.motivo_anulacion}</dd>
            </div>
          )}
        </dl>
      )}

      <dl className="ficha-certificado-datos">
        <div>
          <dt>Alumno</dt>
          <dd>{cert.alumno_nombre}</dd>
        </div>
        {cert.cargo && (
          <div>
            <dt>Cargo</dt>
            <dd>{cert.cargo}</dd>
          </div>
        )}
        <div>
          <dt>Curso</dt>
          <dd>{cert.curso_nombre}</dd>
        </div>
        <div>
          <dt>Fecha de emisión</dt>
          <dd>{fechaPeru(cert.fecha)}</dd>
        </div>
        {cert.periodo_inicio && cert.periodo_cierre && (
          <div>
            <dt>Período</dt>
            <dd>
              {fechaSoloDia(cert.periodo_inicio)} – {fechaSoloDia(cert.periodo_cierre)}
              {cert.periodo_entrega && <> · Entrega: {fechaSoloDia(cert.periodo_entrega)}</>}
            </dd>
          </div>
        )}
        {cert.codigo_corto && (
          <div>
            <dt>Código</dt>
            <dd>
              <code>{cert.codigo_corto}</code>
            </dd>
          </div>
        )}
        <div>
          <dt>Código de verificación</dt>
          <dd>
            <code className="ficha-certificado-uuid">{cert.codigo}</code>
          </dd>
        </div>
      </dl>

      {!anulado && (
        <a className="btn bloque" href={urlCertificadoServidor(cert.codigo)} target="_blank" rel="noreferrer">
          Descargar certificado (PDF)
        </a>
      )}

      {/* Salida. Antes esta página era un callejón sin salida: quien la abría desde un QR no
          tenía forma de saber qué es IPADECP ni de verificar otro certificado. */}
      <p className="ficha-certificado-pie">
        <Link href="/certificado">Verificar otro certificado</Link>
        <span aria-hidden="true"> · </span>
        <Link href="/">Conoce IPADECP</Link>
      </p>
    </div>
  );
}
