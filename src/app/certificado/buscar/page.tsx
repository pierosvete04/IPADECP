import type { Metadata } from 'next';
import Link from 'next/link';
import Topbar from '@/Componentes/layout/Topbar';
import Footer from '@/Componentes/layout/Footer';
import FichaCertificado from '@/Componentes/publico/FichaCertificado';
import BuscadorCertificado from '@/Componentes/publico/BuscadorCertificado';
import { buscarCertificadoPublicoServidor } from '@/lib/server/certificadoPublico';

/**
 * Resultado de una búsqueda por código corto.
 *
 * Vive en su propia ruta con `?q=` en vez de resolverse dentro del formulario para que el
 * resultado sea enlazable: quien verifica un certificado suele querer mandarle el enlace a
 * alguien más. `noindex` porque la URL termina conteniendo los datos de una persona.
 */
export const metadata: Metadata = {
  title: 'Resultado de la verificación — IPADECP',
  robots: { index: false, follow: false, nocache: true },
};

export default async function ResultadoBusquedaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const busqueda = (q || '').trim();
  const cert = busqueda ? await buscarCertificadoPublicoServidor(busqueda) : null;

  return (
    <>
      <Topbar variant="simple" />
      <main className="contenedor" style={{ maxWidth: 640 }}>
        <h1 className="titulo">Verificación de certificado</h1>

        {cert ? (
          <FichaCertificado cert={cert} />
        ) : (
          <div className="card card-pad">
            <div className="aviso err" role="alert">
              <strong>No encontramos ningún certificado con ese código.</strong>
            </div>
            <p className="sub">
              {busqueda ? (
                <>
                  Buscamos <code>{busqueda}</code> y no coincide con ningún certificado emitido. Revisa que esté
                  completo — el código corto tiene la forma <code>IPD-2026-000123</code>.
                </>
              ) : (
                <>Escribe el código que aparece en el certificado.</>
              )}
            </p>
            <BuscadorCertificado autoFocus valorInicial={busqueda} />
            <p className="sub" style={{ marginTop: '1rem', fontSize: '.85rem' }}>
              Si crees que el certificado debería existir, escríbenos desde <Link href="/contacto">contacto</Link> con el
              código y el nombre del titular.
            </p>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
