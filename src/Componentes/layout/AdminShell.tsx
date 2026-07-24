'use client';

import type { User } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Search } from 'lucide-react';
import Sidebar from './Sidebar';
import BodyClass from './BodyClass';
import CommandPalette from './CommandPalette';
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
  const [paletaAbierta, setPaletaAbierta] = useState(false);

  return (
    <>
      <BodyClass className="admin-shell" />
      <CommandPalette open={paletaAbierta} onOpenChange={setPaletaAbierta} onSelect={onSelect} />
      <SidebarProvider style={{ '--sidebar-width': '230px' } as React.CSSProperties}>
        <Sidebar activo={activo} onSelect={onSelect} user={user} />
        <SidebarInset>
          <div className="topbar">
            <SidebarTrigger />
            <span className="marca">Panel administrable</span>
            <button
              type="button"
              onClick={() => setPaletaAbierta(true)}
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '.5rem',
                padding: '.4rem .7rem',
                fontSize: '.85rem',
                color: 'var(--gris)',
                background: 'transparent',
                border: '1px solid var(--borde)',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              <Search className="h-3.5 w-3.5" />
              Ir a…
              <kbd style={{ fontSize: '.7rem', border: '1px solid var(--borde)', borderRadius: 4, padding: '.05rem .3rem' }}>Ctrl K</kbd>
            </button>
          </div>
          <div className="admin-main">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
