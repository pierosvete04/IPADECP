'use client';

import type { User } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import BodyClass from './BodyClass';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/Componentes/ui/sidebar';

export default function AdminShell({
  user,
  activo,
  onSelect,
  children,
}: {
  user: User | null;
  activo: string;
  onSelect: (key: string) => void;
  children: ReactNode;
}) {
  return (
    <>
      <BodyClass className="admin-shell" />
      <SidebarProvider style={{ '--sidebar-width': '230px' } as React.CSSProperties}>
        <Sidebar activo={activo} onSelect={onSelect} user={user} />
        <SidebarInset>
          <div className="topbar">
            <SidebarTrigger />
            <span className="marca">Panel administrable</span>
          </div>
          <div className="admin-main">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
