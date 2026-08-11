import type { Metadata } from 'next';

/**
 * `noindex` para las páginas de verificación de un certificado concreto.
 *
 * Cada una lleva el nombre completo, el cargo y el curso de una persona real. Verificar es una
 * acción puntual de quien ya tiene el código: no necesita estar en Google, y no debe estarlo.
 * La puerta de entrada (`/certificado`) sí es indexable — no contiene datos de nadie.
 *
 * El título y la descripción los pone la propia página.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function LayoutCertificado({ children }: { children: React.ReactNode }) {
  return children;
}
