'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import Avatar from '@/Componentes/ui/Avatar';
import Logo from '@/Componentes/brand/Logo';

export type SeccionAula = 'inicio' | 'cursos' | 'comprar' | 'perfil' | 'historial' | 'certificado-fisico';

const NAV_ITEMS: { sec: SeccionAula; label: string; icon: string; relleno?: boolean }[] = [
  { sec: 'inicio', label: 'Inicio', icon: 'home', relleno: true },
  { sec: 'cursos', label: 'Mis cursos', icon: 'library_books' },
  { sec: 'comprar', label: 'Comprar cursos', icon: 'shopping_cart' },
  { sec: 'certificado-fisico', label: 'Certificado físico', icon: 'local_shipping' },
];

interface PerfilTopbar {
  nombre: string;
  avatar_key: string | null;
}

// `activeSec` entra como dependencia a propósito: Topbar vive dentro de
// AulaShell y NO se remonta al navegar entre secciones (inicio/cursos/
// comprar/perfil son la misma página, solo cambia `?sec=`), así que si el
// alumno cambia su avatar en "Mi perfil" y esa fue la única fuente de
// verdad al montar, el encabezado se queda con la foto vieja (o sin foto)
// hasta un refresh completo. Recargar estos datos en cada cambio de sección
// es la forma más simple de mantenerlo al día sin levantar un context global
// solo para esto.
function useDatosTopbar(user: User | null, activeSec?: SeccionAula) {
  const [perfil, setPerfil] = useState<PerfilTopbar | null>(null);
  const [gam, setGam] = useState({ racha_dias: 0, puntos: 0 });

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
        setPerfil({ nombre: data?.nombre || user.email || '—', avatar_key: data?.avatar_key || null });
      });
    supabase
      .rpc('mi_gamificacion')
      .then(({ data }) => {
        if (!activo || !data) return;
        setGam({ racha_dias: data.racha_dias, puntos: data.puntos });
      });
    return () => {
      activo = false;
    };
  }, [user, activeSec]);

  return { perfil, gam };
}

export default function Topbar({
  variant,
  user,
  activeSec,
  onSimpleClick,
  /** Destino de la marca cuando no se pasa `onSimpleClick` (variante simple). */
  hrefSimple = '/',
  etiquetaSimple = 'Aula virtual',
}: {
  variant: 'aula' | 'simple';
  user?: User | null;
  activeSec?: SeccionAula;
  onSimpleClick?: () => void;
  hrefSimple?: string;
  etiquetaSimple?: string;
}) {
  const { perfil, gam } = useDatosTopbar(user ?? null, activeSec);
  const nombre = perfil?.nombre || user?.email || '—';

  if (variant === 'simple') {
    // Sin `onSimpleClick` la marca era un <span> muerto, y con él un <a href="#"> que no se
    // puede abrir en otra pestaña ni entiende un lector de pantalla. En la página pública de
    // verificación —que abre gente que no conoce el sitio— ese logo es la única salida, así
    // que por defecto es un enlace de verdad al inicio.
    return (
      <div className="topbar">
        {onSimpleClick ? (
          <button
            type="button"
            className="marca marca-boton"
            onClick={onSimpleClick}
          >
            <Logo /> {etiquetaSimple}
          </button>
        ) : (
          <Link href={hrefSimple} className="marca">
            <Logo /> {etiquetaSimple}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="topbar">
      <Link href="/aula" className="marca">
        <Logo /> Aula virtual
      </Link>
      <nav className="aula-topnav">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.sec}
            href={`/aula?sec=${item.sec}`}
            className={activeSec === item.sec ? 'activo' : ''}
          >
            <span className="ico material-symbols-outlined" data-relleno={item.relleno ? '1' : undefined}>
              {item.icon}
            </span>{' '}
            {item.label}
          </Link>
        ))}
      </nav>
      <nav className="perfil-nav">
        <span className="gam-pill gam-racha">🔥 <span>{gam.racha_dias}</span></span>
        <span className="gam-pill gam-puntos">⭐ <span>{gam.puntos}</span><span className="gam-pill-sufijo"> pts</span></span>
        <span className="topbar-divisor"></span>
        <Link className="perfil-pill" href="/aula?sec=perfil">
          <span className="perfil-pill-avatar">
            <Avatar avatarKey={perfil?.avatar_key} nombreRef={nombre} size={34} />
          </span>
          <span>{nombre}</span>
        </Link>
      </nav>
    </div>
  );
}
