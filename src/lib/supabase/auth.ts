'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { supabase } from './client';

export async function cerrarSesion(destino = '/login') {
  await supabase.auth.signOut();
  window.location.href = destino;
}

// Exige una sesión activa; redirige a /login si no la hay. Si la cuenta es de
// administrador, la saca del panel de cliente y la manda a /admin. Mientras se
// resuelve, loading=true. Equivalente a exigirSesion() del sitio original.
export function useRequireSession() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!activo) return;
      if (!session) {
        // Se manda de vuelta a donde estaba (ej. /checkout) después de loguearse,
        // en vez de dejarlo siempre en /aula.
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        router.push(`/login?next=${next}`);
        return;
      }
      const { data: esAdmin } = await supabase.rpc('es_admin');
      if (!activo) return;
      if (esAdmin) {
        router.push('/admin');
        return;
      }
      setUser(session.user);
      setLoading(false);
    })();
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, loading };
}

// Igual que useRequireSession, pero además exige que la RPC es_admin()
// devuelva true; si no, cierra sesión y redirige a /admin/login.
export function useRequireAdmin() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!activo) return;
      if (!session) {
        router.push('/admin/login');
        return;
      }
      const { data: esAdmin } = await supabase.rpc('es_admin');
      if (!activo) return;
      if (!esAdmin) {
        await supabase.auth.signOut();
        router.push('/admin/login');
        return;
      }
      setUser(session.user);
      setLoading(false);
    })();
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { user, loading };
}
