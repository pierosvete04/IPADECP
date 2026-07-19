import type { User } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import Topbar, { SeccionAula } from './Topbar';
import Footer from './Footer';
import BodyClass from './BodyClass';

export default function AulaShell({
  user,
  activeSec,
  extraBodyClass,
  children,
}: {
  user: User | null;
  activeSec?: SeccionAula;
  extraBodyClass?: string;
  children: ReactNode;
}) {
  return (
    <>
      <BodyClass className={`aula-shell${extraBodyClass ? ' ' + extraBodyClass : ''}`} />
      <Topbar variant="aula" user={user} activeSec={activeSec} />
      <main className="aula-main">{children}</main>
      <Footer />
    </>
  );
}
