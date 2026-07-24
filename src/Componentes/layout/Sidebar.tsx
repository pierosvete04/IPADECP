'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { cerrarSesion } from '@/lib/supabase/auth';
import Avatar from '@/Componentes/ui/Avatar';
import Logo from '@/Componentes/brand/Logo';
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/Componentes/ui/sidebar';

export interface SidebarItem {
  key: string;
  label: string;
}

export interface SidebarCategoria {
  key: string;
  label: string;
  items: SidebarItem[];
}

export const ADMIN_INICIO: SidebarItem = { key: 'dashboard', label: 'Inicio' };

// Pedidos vive fuera de las categorías (a la vista siempre, igual que
// "Inicio"), no dentro de "Reportes" — se usa todos los días, no es un
// reporte que se consulta de vez en cuando.
export const ADMIN_PEDIDOS: SidebarItem = { key: 'pedidos', label: 'Pedidos' };

// Clientes tampoco vive dentro de una categoría: agrega a cualquier persona
// con al menos un pedido sin importar el flujo (compra de curso online,
// certificado directo o envío de certificado), así que meterlo dentro de
// "Certificación web" o "Certificación directa" sería engañoso — es
// transversal a ambas, igual que Pedidos.
export const ADMIN_CLIENTES: SidebarItem = { key: 'clientes', label: 'Clientes' };

export const ADMIN_ITEMS_SUELTOS: SidebarItem[] = [ADMIN_INICIO, ADMIN_PEDIDOS, ADMIN_CLIENTES];

// Categorías del menú admin. "Certificación web" (flujo 2: compran, ven el
// curso y el certificado se emite automático) y "Certificación directa"
// (flujo 1: el admin emite el certificado a mano, sin curso online) van
// separadas porque son procesos de negocio distintos, no una sola lista de
// "alumnos". Lo que sí es transversal a ambas (Clientes, Pedidos) vive fuera,
// ver ADMIN_ITEMS_SUELTOS.
export const ADMIN_CATEGORIAS: SidebarCategoria[] = [
  {
    key: 'contenido',
    label: 'Gestión de contenido',
    items: [
      { key: 'categorias', label: 'Categorías' },
      { key: 'cursos', label: 'Cursos' },
      { key: 'eventos', label: 'Eventos / Anuncios' },
      { key: 'promociones', label: 'Promociones' },
      { key: 'metodospago', label: 'Métodos de pago' },
    ],
  },
  {
    key: 'certificacion-web',
    label: 'Certificación web',
    items: [
      { key: 'certificados-clientes', label: 'Certificados' },
      { key: 'alumnos', label: 'Alumnos' },
      { key: 'gamificacion', label: 'Gamificación' },
      { key: 'ventas-asistidas', label: 'Venta asistida' },
      { key: 'codigos', label: 'Códigos de acceso' },
      { key: 'cupones', label: 'Cupones' },
    ],
  },
  {
    key: 'certificacion-directa',
    label: 'Certificación directa',
    items: [
      { key: 'certificados-directos', label: 'Certificados directos' },
      { key: 'certificados-emitidos', label: 'Certificados emitidos' },
      { key: 'diseno-certificado', label: 'Diseño del certificado' },
      { key: 'periodos-certificacion', label: 'Períodos de certificación' },
      { key: 'cargos', label: 'Cargos profesionales' },
    ],
  },
  {
    key: 'reportes',
    label: 'Reportes',
    items: [{ key: 'reclamos', label: 'Reclamos' }],
  },
];

function categoriaDe(key: string): SidebarCategoria | undefined {
  return ADMIN_CATEGORIAS.find((c) => c.items.some((i) => i.key === key));
}

// Los correos del admin siguen la convención nombre.apellido@ipadecp.com.pe
// (ver ipadecp_cuentas_correo). Se usa solo como respaldo mientras carga o si
// el perfil no tiene "nombre" cargado en la BD.
function nombreDesdeEmail(email: string): string {
  const local = email.split('@')[0];
  return local
    .split(/[._]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function useDatosPerfilAdmin(user: User | null) {
  const [perfil, setPerfil] = useState<{ nombre: string; avatar_key: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    let activo = true;
    supabase
      .from('perfiles')
      .select('nombre,avatar_key')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!activo) return;
        setPerfil({
          nombre: data?.nombre || (user.email ? nombreDesdeEmail(user.email) : '—'),
          avatar_key: data?.avatar_key || null,
        });
      });
    return () => {
      activo = false;
    };
  }, [user]);

  return perfil;
}

// Estado activo del ítem de menú: mismo chip celeste-claro que usaba
// `.sidebar a.activo` en tema-stitch.css.
const ESTILO_ACTIVO: React.CSSProperties = {
  backgroundColor: 'var(--st-secundario-cont)',
  color: 'var(--st-on-secundario-cont)',
  fontWeight: 400,
  boxShadow: 'var(--st-sombra-1)',
};

export default function Sidebar({
  activo,
  onSelect,
  user,
}: {
  activo: string;
  onSelect: (key: string) => void;
  user: User | null;
}) {
  const [abierta, setAbierta] = useState<string | null>(() => categoriaDe(activo)?.key ?? null);
  const perfil = useDatosPerfilAdmin(user);

  // Si la sección activa cambia por fuera (ej. al recargar la página con
  // ?sec=ventas), abrimos automáticamente la categoría a la que pertenece.
  useEffect(() => {
    setAbierta(categoriaDe(activo)?.key ?? null);
  }, [activo]);

  const categoriaActiva = abierta ? ADMIN_CATEGORIAS.find((c) => c.key === abierta) : null;
  const nombre = perfil?.nombre || user?.email || '—';

  return (
    <SidebarRoot variant="floating">
      <SidebarHeader className="gap-3">
        <div className="flex items-center gap-2 px-2 py-1">
          <Logo size={28} />
          <span className="font-bold text-sidebar-foreground">IPADECP</span>
        </div>
        <div className="flex items-center gap-3 border-t border-sidebar-border px-2 pt-3">
          <Avatar avatarKey={perfil?.avatar_key} nombreRef={nombre} size={40} />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-sidebar-foreground">{nombre}</div>
            <div className="text-xs text-sidebar-foreground/70">Administrador</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!categoriaActiva && (
            <SidebarMenu>
              {ADMIN_ITEMS_SUELTOS.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    isActive={activo === item.key}
                    style={activo === item.key ? ESTILO_ACTIVO : undefined}
                    onClick={() => {
                      setAbierta(null);
                      onSelect(item.key);
                    }}
                  >
                    {item.label}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          )}

          {categoriaActiva ? (
            <>
              <SidebarMenuButton onClick={() => setAbierta(null)}>
                <ChevronLeft className="size-4" /> Volver al inicio
              </SidebarMenuButton>
              <SidebarGroupLabel>{categoriaActiva.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {categoriaActiva.items.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        isActive={activo === item.key}
                        style={activo === item.key ? ESTILO_ACTIVO : undefined}
                        onClick={() => onSelect(item.key)}
                      >
                        {item.label}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </>
          ) : (
            <SidebarMenu>
              {ADMIN_CATEGORIAS.map((cat) => (
                <SidebarMenuItem key={cat.key}>
                  <SidebarMenuButton onClick={() => setAbierta(cat.key)}>
                    <span className="flex-1">{cat.label}</span>
                    <ChevronRight className="size-4 opacity-60" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          )}
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={(e) => {
                e.preventDefault();
                cerrarSesion('/admin/login');
              }}
            >
              <LogOut className="size-4" /> Cerrar sesión
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </SidebarRoot>
  );
}
