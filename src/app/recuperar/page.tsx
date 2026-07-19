'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import AuthCard from '@/Componentes/layout/AuthCard';

function mensajeError(error: { message?: string } | null): string {
  const m = (error?.message || '').toLowerCase();
  if (m.includes('invalid')) return 'Ese correo no parece válido.';
  return 'No se pudo enviar el enlace: ' + (error?.message || 'error desconocido') + '.';
}

export default function RecuperarPage() {
  const [email, setEmail] = useState('');
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' | 'info' } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setAviso({ texto: 'Enviando…', tipo: 'info' });
    try {
      const destino = `${window.location.origin}/login`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: destino });
      if (error) {
        setAviso({ texto: mensajeError(error), tipo: 'err' });
        setCargando(false);
        return;
      }
      setAviso({ texto: 'Te enviamos un correo para restablecer tu contraseña. Revisa tu bandeja (y spam).', tipo: 'ok' });
      setCargando(false);
    } catch {
      setAviso({ texto: 'No se pudo conectar con el servidor. Revisa tu conexión a internet e inténtalo de nuevo.', tipo: 'err' });
      setCargando(false);
    }
  }

  return (
    <AuthCard>
      <h1 className="titulo" style={{ fontSize: '1.3rem', marginBottom: '.3rem' }}>
        Recuperar contraseña
      </h1>
      <p className="sub" style={{ marginTop: 0 }}>
        Escribe el correo con el que te registraste. Te enviaremos un enlace para crear una nueva contraseña.
      </p>

      {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}

      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Correo electrónico</label>
        <input
          id="email"
          type="email"
          required
          placeholder="tucorreo@ejemplo.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="btn bloque celeste" type="submit" disabled={cargando} style={{ marginTop: '1.2rem' }}>
          Enviar enlace
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        <Link href="/login">← Volver a iniciar sesión</Link>
      </p>
    </AuthCard>
  );
}
