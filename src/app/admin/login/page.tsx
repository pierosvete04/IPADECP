'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import AuthCard from '@/Componentes/layout/AuthCard';
import PasswordField from '@/Componentes/ui/PasswordField';

function mensajeError(error: { message?: string } | null): string {
  const m = (error?.message || '').toLowerCase();
  if (m.includes('not confirmed') || m.includes('confirm')) return 'Tu correo aún no está confirmado.';
  if (m.includes('invalid') || m.includes('credentials')) return 'Correo o contraseña incorrectos. Inténtalo de nuevo.';
  return 'No se pudo iniciar sesión: ' + (error?.message || 'error desconocido') + '.';
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' | 'info' } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
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
      if (!esAdmin) {
        setAviso({ texto: 'Esta cuenta no tiene permisos de administrador.', tipo: 'err' });
        await supabase.auth.signOut();
        setCargando(false);
        return;
      }
      router.push('/admin');
    } catch {
      setAviso({ texto: 'No se pudo conectar con el servidor. Revisa tu conexión a internet e inténtalo de nuevo.', tipo: 'err' });
      setCargando(false);
    }
  }

  return (
    <AuthCard
      panelTitulo="Panel administrativo IPADECP"
      panelTexto="Gestiona cursos, alumnos y certificados desde un solo lugar."
    >
      <h1 className="titulo" style={{ fontSize: '1.3rem', marginBottom: '.3rem' }}>
        Panel administrativo
      </h1>
      <p className="sub">
        Ingresa con tu cuenta de administrador.
      </p>

      {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}

      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Correo</label>
        <input id="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField label="Contraseña" value={pass} onChange={setPass} placeholder="Tu contraseña" autoComplete="current-password" />
        <button className="btn bloque celeste" type="submit" disabled={cargando} style={{ marginTop: '1.2rem' }}>
          Ingresar
        </button>
      </form>
    </AuthCard>
  );
}
