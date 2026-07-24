import type { Metadata } from 'next';
import HeroInicio from '@/Componentes/publico/HeroInicio';
import ConfianzaStats from '@/Componentes/publico/ConfianzaStats';
import SeccionMetodologia from '@/Componentes/publico/SeccionMetodologia';
import SeccionCertificacion from '@/Componentes/publico/SeccionCertificacion';
import CursosDestacados from '@/Componentes/publico/CursosDestacados';
import CTAFinal from '@/Componentes/publico/CTAFinal';

export const metadata: Metadata = {
  title: 'IPADECP — Capacitación profesional certificada',
  description: 'Diplomados y cursos especializados 100% virtuales, con certificación oficial verificable por código QR.',
};

export default function Home() {
  return (
    <>
      <HeroInicio />
      <ConfianzaStats />
      <SeccionMetodologia />
      <SeccionCertificacion />
      <CursosDestacados />
      <CTAFinal />
    </>
  );
}
