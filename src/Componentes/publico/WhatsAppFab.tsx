import { WhatsAppIcon } from '@/Componentes/ui/WhatsAppIcon';
import { WHATSAPP_PEDIDOS, whatsappLink } from '@/lib/site-config';

export default function WhatsAppFab() {
  return (
    <a
      href={whatsappLink(WHATSAPP_PEDIDOS, 'Hola, quisiera más información sobre los cursos de IPADECP.')}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      className="ipd-whatsapp-fab"
    >
      <WhatsAppIcon className="h-6 w-6" />
    </a>
  );
}
