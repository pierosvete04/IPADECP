import type { Metadata } from 'next';

/**
 * El layout raíz titula todo como "IPADECP — Aula virtual", así que el panel
 * y el aula compartían nombre en la pestaña del navegador: con tres pestañas
 * abiertas (lo normal cuando cruzas un pedido con un certificado) las tres se
 * llamaban igual y no se podía volver a la correcta sin abrirlas una a una.
 */
export const metadata: Metadata = {
  title: 'Panel administrable — IPADECP',
  // El panel no debe indexarse ni aparecer en resultados de búsqueda.
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
