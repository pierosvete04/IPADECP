import { redirect } from 'next/navigation';

/**
 * Puerta corta a la pestaña de activación.
 *
 * Existe por el papel: el volante que viaja dentro del sobre dice
 * "ipadecp.com.pe/activar", y eso tiene que ser lo más corto posible para
 * alguien que lo va a tipear a mano en el celular. La pantalla real es una
 * sola — /registro, con sus dos pestañas.
 */
export default async function ActivarPage({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const { doc } = await searchParams;
  redirect(`/registro?modo=activar${doc ? `&doc=${encodeURIComponent(doc)}` : ''}`);
}
