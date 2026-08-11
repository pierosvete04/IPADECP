import Logo from '@/Componentes/brand/Logo';
import { WhatsAppIcon } from '@/Componentes/ui/WhatsAppIcon';
import { WHATSAPP_PEDIDOS, whatsappLink } from '@/lib/site-config';

const MENU = [
  { href: '/', label: 'Inicio' },
  { href: '/cursos', label: 'Cursos' },
  { href: '/nosotros', label: 'Nosotros' },
  { href: '/contacto', label: 'Contáctanos' },
];

const POLITICAS = [
  { href: '/terminos-servicio', label: 'Términos y condiciones' },
  { href: '/politica-privacidad', label: 'Política de privacidad' },
  { href: '/politica-reembolso', label: 'Política de reembolso' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/reclamos', label: 'Libro de Reclamaciones' },
];

export default function FooterPublico() {
  return (
    <footer className="ipd-footer">
      <div className="ipd-contenedor px-6 py-14 [display:grid] grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 mb-3">
            <Logo size={30} />
            <span className="text-white font-bold" style={{ fontFamily: 'var(--st-font-titulo)' }}>
              IPADECP
            </span>
          </div>
          <p className="text-sm leading-relaxed max-w-xs mx-auto sm:mx-0">
            Instituto de capacitación virtual para el personal de salud del Perú, con
            certificación oficial verificable.
          </p>
          <a
            href={whatsappLink(WHATSAPP_PEDIDOS)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: '#4ade80' }}
          >
            <WhatsAppIcon className="h-4 w-4" />
            Escríbenos por WhatsApp
          </a>
        </div>

        <div className="text-center sm:text-left">
          <h4>Menú</h4>
          {MENU.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </div>

        <div className="text-center sm:text-left">
          <h4>Políticas</h4>
          {POLITICAS.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </div>

        <div className="text-center sm:text-left">
          <h4>Síguenos</h4>
          <p className="text-sm">Redes sociales próximamente.</p>
        </div>
      </div>

      <div className="border-t" style={{ borderColor: 'rgba(255,255,255,.1)' }}>
        <p className="ipd-contenedor px-6 py-5 text-xs text-center sm:text-left" style={{ color: 'rgba(255,255,255,.45)' }}>
          &copy;&nbsp;{new Date().getFullYear()} IPADECP · RUC 20600819420 · Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
