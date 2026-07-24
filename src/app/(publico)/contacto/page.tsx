import type { Metadata } from 'next';
import ContactoClient from '@/Componentes/publico/ContactoClient';

export const metadata: Metadata = {
  title: 'Contáctanos — IPADECP',
  description: 'Escríbenos por WhatsApp o completa el formulario y te respondemos a la brevedad.',
};

export default function ContactoPage() {
  return <ContactoClient />;
}
