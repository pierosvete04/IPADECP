'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ChevronDown, ChevronRight, LogOut } from 'lucide-react';
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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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

// El diseño del certificado tampoco pertenece a "Certificación directa", donde
// vivía antes: la plantilla la resuelve `obtenerPlantillaActiva` por tipo y por
// curso, y se aplica igual a los certificados 'evaluado' (certificación web) que
// a los 'directo'. Tenerlo colgado de una sola de las dos ramas hacía creer que
// el diseño era exclusivo de esa rama.
export const ADMIN_DISENO_CERTIFICADO: SidebarItem = { key: 'diseno-certificado', label: 'Diseño del certificado' };

// Ya no hay una entrada "Alumnos" aparte: era la misma gente que Clientes
// vista con otro criterio (toda cuenta del aula vs. quien tiene un pedido), y
// ambas listas abrían el mismo detalle. Clientes ahora lista a todas las
// personas y trae la columna y el filtro de "Certificación" que daba Alumnos.
export const ADMIN_ITEMS_SUELTOS: SidebarItem[] = [ADMIN_INICIO, ADMIN_PEDIDOS, ADMIN_CLIENTES, ADMIN_DISENO_CERTIFICADO];

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
      // "Venta asistida" vivía acá. Se retiró: hacía lo mismo que
      // Pedidos → Crear pedido pero insertaba en `ventas` sin `pedido_id`,
      // dejando ventas huérfanas (id "V-") sin dirección, envío, courier,
      // rótulo ni comprobante. Crear pedido ya da de alta al cliente por DNI
      // y soporta combos, así que no queda nada que solo ella supiera hacer.
      { key: 'gamificacion', label: 'Gamificación' },
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
      // "Diseño del certificado" salió de acá: es transversal a las dos ramas.
      // Ver ADMIN_DISENO_CERTIFICADO arriba.
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

export function categoriaDe(key: string): SidebarCategoria | undefined {
  return ADMIN_CATEGORIAS.find((c) => c.items.some((i) => i.key === key));
}

/** Nombre visible de una sección, para la ruta de la barra superior. */
export function etiquetaDe(key: string): string {
  const suelto = ADMIN_ITEMS_SUELTOS.find((i) => i.key === key);
  if (suelto) return suelto.label;
  for (const cat of ADMIN_CATEGORIAS) {
    const item = cat.items.find((i) => i.key === key);
    if (item) return item.label;
  }
  return 'Panel';
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
  // ?sec=cupones), abrimos automáticamente la categoría a la que pertenece.
  // Solo se fuerza cuando la sección activa vive en OTRA categoría: si el
  // admin abrió una categoría a mano para curiosearla, no se la cerramos.
  useEffect(() => {
    const suya = categoriaDe(activo)?.key;
    if (suya) setAbierta(suya);
  }, [activo]);

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

      {/* Acordeón, no drill-down. Antes abrir una categoría REEMPLAZABA la
          lista entera: estando en "Certificados emitidos" no se veía ni se
          alcanzaba "Pedidos" sin pasar por "Volver al inicio" — dos clics
          para cada salto entre categorías, y en ningún momento se veía dónde
          estabas dentro del árbol. Ahora Inicio / Pedidos / Clientes están
          siempre a la vista y las categorías se despliegan en su sitio. */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {ADMIN_ITEMS_SUELTOS.map((item) => (
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

          <SidebarGroupContent>
            <SidebarMenu>
              {ADMIN_CATEGORIAS.map((cat) => {
                const desplegada = abierta === cat.key;
                const contieneActiva = cat.items.some((i) => i.key === activo);
                return (
                  <SidebarMenuItem key={cat.key}>
                    <SidebarMenuButton
                      onClick={() => setAbierta(desplegada ? null : cat.key)}
                      aria-expanded={desplegada}
                      aria-controls={`sidebar-cat-${cat.key}`}
                      // La categoría que contiene la sección activa se marca
                      // aunque esté plegada: es la migaja de pan que dice
                      // "estás aquí dentro".
                      className={contieneActiva && !desplegada ? 'font-bold' : undefined}
                    >
                      <span className="flex-1 text-left">{cat.label}</span>
                      {desplegada ? <ChevronDown className="size-4 opacity-60" /> : <ChevronRight className="size-4 opacity-60" />}
                    </SidebarMenuButton>

                    {/* La sangría por defecto (`mx-3.5` + `px-2.5`) se come
                        44px de los 230 del sidebar y deja las etiquetas
                        largas sin ancho. Se recorta y se conserva solo la
                        línea vertical que agrupa los ítems. */}
                    {desplegada && (
                      <SidebarMenuSub id={`sidebar-cat-${cat.key}`} className="mx-2 gap-0.5 px-2">
                        {cat.items.map((item) => (
                          <SidebarMenuSubItem key={item.key}>
                            {/* Dos overrides:
                                - `render` como <button>: por defecto pinta un
                                  <a>, y un <a> sin href no entra en el orden
                                  de tabulación — los ítems del submenú
                                  quedaban fuera del alcance del teclado.
                                - alto automático y `whitespace-normal`: la
                                  clase base fija `h-7` con `overflow-hidden`,
                                  así que "Períodos de certificación" partía
                                  en dos líneas dentro de una caja de 28px y
                                  se solapaba con el ítem siguiente. */}
                            <SidebarMenuSubButton
                              render={<button type="button" />}
                              isActive={activo === item.key}
                              style={activo === item.key ? ESTILO_ACTIVO : undefined}
                              onClick={() => onSelect(item.key)}
                              aria-current={activo === item.key ? 'page' : undefined}
                              className="h-auto min-h-7 w-full justify-start py-1.5 text-left leading-snug whitespace-normal"
                            >
                              {item.label}
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
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
