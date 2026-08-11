import type { Metadata } from 'next';
import Link from 'next/link';
import Topbar from '@/Componentes/layout/Topbar';
import Footer from '@/Componentes/layout/Footer';
import FichaCertificado from '@/Componentes/publico/FichaCertificado';
import BuscadorCertificado from '@/Componentes/publico/BuscadorCertificado';
import { obtenerCertificadoPublicoServidor } from '@/lib/server/certificadoPublico';

/**
 * Verificación de un certificado por su código — la página a la que lleva el QR impreso.
 *
 * Componente de servidor. Antes era de cliente y pedía los datos con `useEffect`: quien
 * escaneaba el QR veía "Verificando…" y recibía un HTML vacío. Es la página más pública del
 * producto, la abre gente que no conoce IPADECP, y a veces desde el móvil de un empleador con
 * mala conexión — no hay razón para que dependa de JavaScript.
 */
export const metadata: Metadata = {
  title: 'Verificación de certificado — IPADECP',
  description: 'Comprueba la autenticidad de un certificado emitido por IPADECP.',
};

export default async function CertificadoPublicoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const cert = await obtenerCertificadoPublicoServidor(codigo);

  return (
    <>
      <Topbar variant="simple" />
      <main className="contenedor" style={{ maxWidth: 640 }}>
        <h1 className="titulo">Verificación de certificado</h1>

        {cert ? (
          <FichaCertificado cert={cert} />
        ) : (
          // No es lo mismo "no existe" que un callejón sin salida: acá mismo se puede
          // reintentar con otro código, que es lo que hará quien se haya equivocado al copiar.
          <div className="card card-pad">
            <div className="aviso err" role="alert">
              <strong>Este código no corresponde a ningún certificado emitido.</strong>
            </div>
            <p className="sub">
              Revisa que lo hayas copiado completo. Si lo tomaste de un certificado impreso, puedes buscarlo por su
              código corto (por ejemplo <code>IPD-2026-000123</code>).
            </p>
            <BuscadorCertificado autoFocus />
            <p className="sub" style={{ marginTop: '1rem', fontSize: '.85rem' }}>
              ¿Crees que el certificado debería existir? Escríbenos desde <Link href="/contacto">contacto</Link> con el
              código y el nombre del titular.
            </p>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
