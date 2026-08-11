import type { Metadata } from 'next';
import Topbar from '@/Componentes/layout/Topbar';
import Footer from '@/Componentes/layout/Footer';
import BuscadorCertificado from '@/Componentes/publico/BuscadorCertificado';

/**
 * Entrada pública a la verificación de certificados.
 *
 * Esta página no existía: el inicio prometía "consulta pública, sin registro ni contraseña" y
 * `/certificado` devolvía 404. La única forma de verificar era escanear el QR, así que quien
 * tenía el certificado impreso en la mano —el caso más común para un empleador— no podía hacer
 * nada. Es indexable a propósito: es la puerta, y no contiene datos de nadie.
 */
export const metadata: Metadata = {
  title: 'Verifica un certificado — IPADECP',
  description:
    'Comprueba si un certificado emitido por IPADECP es auténtico. Consulta pública con el código del certificado, sin registro ni contraseña.',
};

export default function BuscarCertificadoPage() {
  return (
    <>
      <Topbar variant="simple" />
      <main className="contenedor" style={{ maxWidth: 640 }}>
        <h1 className="titulo">Verifica un certificado</h1>
        <p className="sub">
          Escribe el código que aparece en el certificado y te diremos si fue emitido por IPADECP y si sigue vigente. No
          necesitas cuenta.
        </p>

        <div className="card card-pad">
          <BuscadorCertificado autoFocus />
        </div>

        <div className="card card-pad" style={{ marginTop: '1rem' }}>
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>¿Dónde está el código?</h2>
          <ul className="lista-ayuda">
            <li>
              Impreso en el propio certificado, con el formato <code>IPD-2026-000123</code>.
            </li>
            <li>Al escanear el código QR del certificado, que abre directamente su verificación.</li>
            <li>
              También sirve el código largo de verificación, si lo tienes: son 36 caracteres con guiones.
            </li>
          </ul>
        </div>
      </main>
      <Footer />
    </>
  );
}
