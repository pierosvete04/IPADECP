import type { Metadata } from 'next';
import CheckoutClient from '@/Componentes/publico/CheckoutClient';

export const metadata: Metadata = {
  title: 'Finalizar compra — IPADECP',
  description: 'Completa tus datos y elige tu método de pago para finalizar tu compra.',
};

export default function CheckoutPage() {
  return <CheckoutClient />;
}
