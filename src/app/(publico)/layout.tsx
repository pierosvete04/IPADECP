import AnuncioBar from '@/Componentes/publico/AnuncioBar';
import HeaderPublico from '@/Componentes/publico/HeaderPublico';
import FooterPublico from '@/Componentes/publico/FooterPublico';
import WhatsAppFab from '@/Componentes/publico/WhatsAppFab';

export default function PublicoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ipd-pub">
      <AnuncioBar />
      <HeaderPublico />
      <main>{children}</main>
      <FooterPublico />
      <WhatsAppFab />
    </div>
  );
}
