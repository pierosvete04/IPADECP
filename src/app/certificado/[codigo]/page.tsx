'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Topbar from '@/Componentes/layout/Topbar';
import Footer from '@/Componentes/layout/Footer';
import { generarCertificadoPDF, obtenerCertificadoPublico, type CertificadoPublico } from '@/lib/certificado';

export default function CertificadoPublicoPage() {
  const router = useRouter();
  const params = useParams<{ codigo: string }>();
  const [cert, setCert] = useState<CertificadoPublico | null | undefined>(undefined);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    let activo = true;
    obtenerCertificadoPublico(params.codigo).then((data) => {
      if (activo) setCert(data);
    });
    return () => {
      activo = false;
    };
  }, [params.codigo]);

  async function descargar() {
    if (!cert) return;
    setDescargando(true);
    try {
      await generarCertificadoPDF({
        codigo: cert.codigo,
        alumnoNombre: cert.alumno_nombre,
        cursoNombre: cert.curso_nombre,
        fecha: new Date(cert.fecha).toLocaleDateString('es-PE'),
        cargo: cert.cargo || undefined,
        periodoInicio: cert.periodo_inicio ? new Date(cert.periodo_inicio + 'T00:00:00').toLocaleDateString('es-PE') : undefined,
        periodoEntrega: cert.periodo_entrega ? new Date(cert.periodo_entrega + 'T00:00:00').toLocaleDateString('es-PE') : undefined,
        periodoCierre: cert.periodo_cierre ? new Date(cert.periodo_cierre + 'T00:00:00').toLocaleDateString('es-PE') : undefined,
      });
    } finally {
      setDescargando(false);
    }
  }

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
            {cert.drive_digital_url ? (
              <a className="btn bloque" href={cert.drive_digital_url} target="_blank" rel="noreferrer" style={{ marginTop: '1rem' }}>
                Descargar certificado (PDF)
              </a>
            ) : (
              <button className="btn bloque" onClick={descargar} disabled={descargando} style={{ marginTop: '1rem' }}>
                {descargando ? 'Generando…' : 'Descargar certificado (PDF)'}
              </button>
            )}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
