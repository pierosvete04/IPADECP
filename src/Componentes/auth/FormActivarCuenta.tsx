'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { activarCuenta } from '@/lib/activacion';
import { WHATSAPP_PEDIDOS, whatsappLink } from '@/lib/site-config';
import PasswordField from '@/Componentes/ui/PasswordField';

/**
 * Activación: el cliente de certificación directa reclama la cuenta que ya
 * existe con su documento y le pone su propio correo y contraseña.
 *
 * No pide nombres y apellidos como el alta normal, y por eso tampoco verifica
 * contra RENIEC: el nombre ya está en su perfil desde que se le emitió el
 * certificado, y no hay nada que contrastar contra el registro. Quien prueba
 * que es él no es el nombre, es el código de 6 dígitos del volante.
 */
export default function FormActivarCuenta({ documentoInicial = '' }: { documentoInicial?: string }) {
  const router = useRouter();
  const [documento, setDocumento] = useState(documentoInicial);
  const [codigo, setCodigo] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [cargando, setCargando] = useState(false);
  const [bloqueada, setBloqueada] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);
  // Antes de crear el acceso se le lee el correo de vuelta. Es el único dato de
  // los cuatro que no se puede comprobar contra nada: si lo escribe mal, la
  // cuenta queda con una dirección que él no controla y ya no puede recuperar
  // su contraseña. El documento y el código los valida el servidor, y la
  // contraseña la escribe dos veces.
  const [confirmando, setConfirmando] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);

    if (pass !== pass2) {
      setAviso({ texto: 'Las contraseñas no coinciden. Vuelve a escribirlas.', tipo: 'err' });
      return;
    }
    if (!/^\d{6}$/.test(codigo.trim())) {
      setAviso({ texto: 'El código de acceso son 6 dígitos. Míralo en el volante que vino con tu certificado.', tipo: 'err' });
      return;
    }

    setConfirmando(true);
  }

  async function activar() {
    setAviso(null);
    setCargando(true);
    const res = await activarCuenta({ documento, codigo, email, password: pass });
    if (!res.ok) {
      setCargando(false);
      setConfirmando(false);
      setBloqueada(!!res.bloqueada);
      setAviso({ texto: res.motivo || 'No se pudo activar tu cuenta.', tipo: 'err' });
      return;
    }

    // La cuenta ya es suya y la contraseña es la que acaba de elegir: iniciar
    // sesión acá solo le ahorra volver a escribirla en /login.
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    setCargando(false);
    if (error) {
      setAviso({ texto: 'Tu cuenta quedó activada. Inicia sesión con tu correo y tu nueva contraseña.', tipo: 'ok' });
      return;
    }
    router.push('/aula');
  }

  const linkWhatsapp = whatsappLink(
    WHATSAPP_PEDIDOS,
    `Hola, quiero activar mi cuenta del aula virtual. Mi documento es ${documento.trim() || '(escríbelo aquí)'} y necesito un código de acceso nuevo.`
  );

  return (
    <>
      <p className="sub" style={{ marginTop: 0 }}>
        Si ya te certificaste con nosotros, tu cuenta ya existe con tus certificados adentro. Actívala con el código que
        vino junto a tu certificado.
      </p>

      {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}

      {confirmando && (
        <div className="card card-pad" style={{ marginBottom: '1rem' }} role="alertdialog" aria-label="Confirma tu correo">
          <p style={{ margin: '0 0 .4rem' }}>Vas a entrar siempre con este correo:</p>
          <p style={{ margin: '0 0 .6rem', fontWeight: 700, fontSize: '1.05rem', overflowWrap: 'anywhere' }}>{email.trim()}</p>
          <p className="campo-ayuda" style={{ marginTop: 0 }}>
            Revísalo con calma. Si tiene un error, no vas a poder recuperar tu contraseña más adelante.
          </p>
          <div className="fila" style={{ marginTop: '.8rem' }}>
            <button type="button" className="btn celeste" onClick={activar} disabled={cargando}>
              {cargando ? 'Activando…' : 'Sí, está correcto'}
            </button>
            <button type="button" className="btn sec" onClick={() => setConfirmando(false)} disabled={cargando}>
              Corregir
            </button>
          </div>
        </div>
      )}

      {bloqueada && (
        <p style={{ margin: '0 0 1rem' }}>
          <a href={linkWhatsapp} target="_blank" rel="noopener noreferrer">
            Escríbenos por WhatsApp
          </a>{' '}
          y te generamos un código nuevo.
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <label htmlFor="ac-documento">Tu documento (DNI o Carnet de Extranjería)</label>
        <input
          id="ac-documento"
          type="text"
          required
          maxLength={15}
          placeholder="El mismo con el que te certificaste"
          value={documento}
          onChange={(e) => setDocumento(e.target.value.slice(0, 15))}
        />

        <label htmlFor="ac-codigo">Código de acceso</label>
        <input
          id="ac-codigo"
          type="text"
          inputMode="numeric"
          required
          maxLength={6}
          placeholder="6 dígitos"
          style={{ letterSpacing: '.35em', fontWeight: 700 }}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        <span className="campo-ayuda">Está en el volante que llegó dentro del sobre, junto a tu certificado.</span>

        <label htmlFor="ac-email" style={{ marginTop: '.8rem' }}>
          Tu correo electrónico
        </label>
        <input
          id="ac-email"
          type="email"
          required
          placeholder="tucorreo@ejemplo.com"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <span className="campo-ayuda">Con este correo entrarás de ahora en adelante y podrás recuperar tu contraseña.</span>

        <div style={{ marginTop: '.8rem' }}>
          <PasswordField label="Crea tu contraseña" value={pass} onChange={setPass} placeholder="Mínimo 6 caracteres" autoComplete="new-password" minLength={6} />
        </div>
        <PasswordField label="Repite tu contraseña" value={pass2} onChange={setPass2} placeholder="Repite tu contraseña" autoComplete="new-password" minLength={6} />

        <button className="btn bloque celeste" type="submit" disabled={cargando || confirmando} style={{ marginTop: '1.2rem' }}>
          Activar cuenta
        </button>
      </form>
    </>
  );
}
