'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Topbar from '@/Componentes/layout/Topbar';
import Footer from '@/Componentes/layout/Footer';
import { obtenerCertificadoPublico, urlCertificadoServidor, type CertificadoPublico } from '@/lib/certificado';

export default function CertificadoPublicoPage() {
  const router = useRouter();
  const params = useParams<{ codigo: string }>();
  const [cert, setCert] = useState<CertificadoPublico | null | undefined>(undefined);

  useEffect(() => {
    let activo = true;
    obtenerCertificadoPublico(params.codigo).then((data) => {
      if (activo) setCert(data);
    });
    return () => {
      activo = false;
    };
  }, [params.codigo]);

  return (
    <>
      <Topbar variant="simple" onSimpleClick={() => router.push('/')} />
      <main className="contenedor" style={{ maxWidth: 620 }}>
        <h1 className="titulo">Verificación de certificado</h1>

        {cert === undefined && <p className="sub">Verificando…</p>}

        {cert === null && (
          <div className="aviso err">Este código de verificación no corresponde a ningún certificado emitido.</div>
        )}

        {cert && (
          <div className="card card-pad" style={{ lineHeight: 1.8 }}>
            <div className="aviso ok" style={{ marginBottom: '1rem' }}>Certificado válido ✓</div>
            {cert.cargo && (
              <p>
                <strong>Cargo:</strong> {cert.cargo}
              </p>
            )}
            <p>
              <strong>Alumno:</strong> {cert.alumno_nombre}
            </p>
            <p>
              <strong>Curso:</strong> {cert.curso_nombre}
            </p>
            <p>
              <strong>Fecha de emisión:</strong> {new Date(cert.fecha).toLocaleDateString('es-PE')}
            </p>
            {cert.periodo_inicio && cert.periodo_cierre && (
              <p>
                <strong>Período:</strong> {new Date(cert.periodo_inicio + 'T00:00:00').toLocaleDateString('es-PE')} –{' '}
                {new Date(cert.periodo_cierre + 'T00:00:00').toLocaleDateString('es-PE')}
                {cert.periodo_entrega && (
                  <> · Entrega: {new Date(cert.periodo_entrega + 'T00:00:00').toLocaleDateString('es-PE')}</>
                )}
              </p>
            )}
            <p className="sub" style={{ fontSize: '.8rem' }}>
              Código: {cert.codigo}
            </p>
            {/* El PDF lo sirve la propia app desde la base de datos (ver /api/certificados/[codigo]/pdf).
                Antes se enlazaba a Google Drive, que ahora queda solo como respaldo interno. */}
            <a
              className="btn bloque"
              href={urlCertificadoServidor(cert.codigo)}
              target="_blank"
              rel="noreferrer"
              style={{ marginTop: '1rem' }}
            >
              Descargar certificado (PDF)
            </a>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
