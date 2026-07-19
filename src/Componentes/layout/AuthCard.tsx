import type { ReactNode } from 'react';
import Logo from '@/Componentes/brand/Logo';
import Footer from './Footer';
import BodyClass from './BodyClass';

export default function AuthCard({
  children,
  panelTitulo = 'Aula Virtual IPADECP',
  panelTexto = 'Continúa tu formación profesional donde la dejaste.',
}: {
  children: ReactNode;
  panelTitulo?: string;
  panelTexto?: string;
}) {
  return (
    <>
      <BodyClass className="auth-split-page" />
      <div className="auth-split">
        <div className="auth-split-left">
          <div className="auth-split-brand">
            <Logo size={32} />
            <span>IPADECP</span>
          </div>

          <div className="auth-split-body">{children}</div>

          <div className="auth-split-foot">
            <Footer />
          </div>
        </div>

        <div className="auth-split-right">
          <div className="auth-split-badge">
            <Logo size={160} />
          </div>
          <div>
            <h2>{panelTitulo}</h2>
            <p>{panelTexto}</p>
          </div>
          <div className="auth-split-dots">
            <span className="activo" />
            <span />
            <span />
          </div>
        </div>
      </div>
    </>
  );
}
