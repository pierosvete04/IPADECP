'use client';

import type { User } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Search } from 'lucide-react';
import Sidebar, { categoriaDe, etiquetaDe } from './Sidebar';
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
  const categoria = categoriaDe(activo);
  const seccion = etiquetaDe(activo);

  return (
    <>
      <BodyClass className="admin-shell" />
      <CommandPalette open={paletaAbierta} onOpenChange={setPaletaAbierta} onSelect={onSelect} />
      <SidebarProvider style={{ '--sidebar-width': '230px' } as React.CSSProperties}>
        <Sidebar activo={activo} onSelect={onSelect} user={user} />
        <SidebarInset>
          <div className="topbar">
            <SidebarTrigger />
            {/* Antes decía siempre "Panel administrable", daba igual en qué
                sección estuvieras. Con el sidebar colapsado no quedaba
                NINGUNA señal de ubicación en pantalla. */}
            <nav className="topbar-ruta" aria-label="Ubicación">
              {categoria && (
                <>
                  <span>{categoria.label}</span>
                  <span className="topbar-ruta-sep" aria-hidden="true">
                    /
                  </span>
                </>
              )}
              <span className="topbar-ruta-actual" aria-current="page">
                {seccion}
              </span>
            </nav>
            {/* "Ir a…" no decía a dónde. Ahora la etiqueta nombra la acción y
                el atajo se declara con aria-keyshortcuts, no solo como un
                adorno visual. */}
            <button
              type="button"
              className="topbar-buscar"
              onClick={() => setPaletaAbierta(true)}
              aria-keyshortcuts="Control+K Meta+K"
              aria-label="Buscar sección (Control K)"
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Buscar sección</span>
              <kbd aria-hidden="true">Ctrl K</kbd>
            </button>
          </div>
          <main className="admin-main">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
