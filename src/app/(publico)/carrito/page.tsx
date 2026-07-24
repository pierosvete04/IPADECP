import type { Metadata } from 'next';
import CarritoClient from '@/Componentes/publico/CarritoClient';

export const metadata: Metadata = {
  title: 'Tu carrito — IPADECP',
  description: 'Revisa los cursos que agregaste antes de continuar con tu compra.',
};

export default function CarritoPage() {
  return <CarritoClient />;
}
