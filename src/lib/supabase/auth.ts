'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { supabase } from './client';

export async function cerrarSesion(destino = '/login') {
  await supabase.auth.signOut();
  window.location.href = destino;
}

// Exige una sesión activa; redirige a /login si no la hay. Mientras se
// resuelve, loading=true. Equivalente a exigirSesion() del sitio original.
export function useRequireSession() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!activo) return;
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);
      setLoading(false);
    });
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
