'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import AuthCard from '@/Componentes/layout/AuthCard';
import PasswordField from '@/Componentes/ui/PasswordField';

// Si venimos de la web pública con ?next=/checkout (carrito → login), volvemos
// ahí después de iniciar sesión en vez de caer siempre en /aula. Los admins
// nunca usan `next`: siempre van a /admin, sin excepción.
function destinoDespuesDeLogin(esAdmin: boolean): string {
  if (esAdmin) return '/admin';
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') ? next : '/aula';
}

function mensajeError(error: { message?: string } | null): string {
  const m = (error?.message || '').toLowerCase();
  if (m.includes('not confirmed') || m.includes('confirm')) {
    return 'Tu correo aún no está confirmado. Revisa tu bandeja de entrada (y la carpeta de spam).';
  }
  if (m.includes('invalid') || m.includes('credentials')) {
    return 'Correo o contraseña incorrectos. Inténtalo de nuevo.';
  }
  return 'No se pudo iniciar sesión: ' + (error?.message || 'error desconocido') + '.';
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' | 'info' } | null>(null);

  const [modoRecuperacion, setModoRecuperacion] = useState(false);
  const [passNueva, setPassNueva] = useState('');
  const [guardandoPass, setGuardandoPass] = useState(false);
  const [hrefRegistro, setHrefRegistro] = useState('/registro');

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get('next');
    if (next && next.startsWith('/')) setHrefRegistro(`/registro?next=${encodeURIComponent(next)}`);

    const esRecovery = window.location.hash.includes('type=recovery');
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setModoRecuperacion(true);
        setAviso({ texto: 'Ingresa tu nueva contraseña.', tipo: 'info' });
      }
    });
    if (!esRecovery) {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) return;
        const { data: esAdmin } = await supabase.rpc('es_admin');
        router.replace(destinoDespuesDeLogin(!!esAdmin));
      });
    }
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setAviso({ texto: 'Ingresando…', tipo: 'info' });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
      if (error) {
        setAviso({ texto: mensajeError(error), tipo: 'err' });
        setCargando(false);
        return;
      }
      const { data: esAdmin } = await supabase.rpc('es_admin');
      router.push(destinoDespuesDeLogin(!!esAdmin));
    } catch {
      setAviso({ texto: 'No se pudo conectar con el servidor. Revisa tu conexión a internet e inténtalo de nuevo.', tipo: 'err' });
      setCargando(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setGuardandoPass(true);
    const { error } = await supabase.auth.updateUser({ password: passNueva });
    if (error) {
      setAviso({ texto: mensajeError(error), tipo: 'err' });
      setGuardandoPass(false);
      return;
    }
    setAviso({ texto: 'Contraseña actualizada. Ya puedes ingresar.', tipo: 'ok' });
    setModoRecuperacion(false);
  }

  return (
    <AuthCard>
      <h1 className="titulo" style={{ fontSize: '1.3rem', marginBottom: '.3rem' }}>
        Iniciar sesión
      </h1>
      <p className="sub" style={{ marginTop: 0 }}>
        Bienvenido de nuevo al Aula Virtual IPADECP.
      </p>

      {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}

      {!modoRecuperacion ? (
        <>
          <form onSubmit={handleLogin}>
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              required
              placeholder="tucorreo@ejemplo.com"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <PasswordField label="Contraseña" value={pass} onChange={setPass} placeholder="Tu contraseña" autoComplete="current-password" />
            <button className="btn bloque celeste" type="submit" disabled={cargando} style={{ marginTop: '1.2rem' }}>
              Ingresar
            </button>
          </form>
          <p style={{ textAlign: 'center', margin: '.8rem 0 0' }}>
            <Link href="/recuperar">¿Olvidaste tu contraseña?</Link>
          </p>
          <p style={{ textAlign: 'center', marginTop: '.4rem' }}>
            ¿No tienes cuenta? <Link href={hrefRegistro}>Crea una aquí</Link>
          </p>
        </>
      ) : (
        <form onSubmit={handleReset}>
          <h2 className="titulo" style={{ fontSize: '1.1rem' }}>
            Crea una nueva contraseña
          </h2>
          <PasswordField
            label="Nueva contraseña"
            value={passNueva}
            onChange={setPassNueva}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
            minLength={6}
          />
          <button className="btn bloque celeste" type="submit" disabled={guardandoPass} style={{ marginTop: '1.2rem' }}>
            Guardar contraseña
          </button>
        </form>
      )}
    </AuthCard>
  );
}
