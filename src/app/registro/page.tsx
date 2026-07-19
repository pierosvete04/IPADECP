'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { verificarDni } from '@/lib/dni';
import AuthCard from '@/Componentes/layout/AuthCard';
import PasswordField from '@/Componentes/ui/PasswordField';

type TipoDocumento = 'DNI' | 'CE';

export default function RegistroPage() {
  const router = useRouter();
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>('DNI');
  const [documento, setDocumento] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);
  const [verificacionFallo, setVerificacionFallo] = useState(false);
  const [aceptaResponsabilidad, setAceptaResponsabilidad] = useState(false);

  function cambiarTipoDocumento(t: TipoDocumento) {
    setTipoDocumento(t);
    setDocumento('');
    setVerificacionFallo(false);
    setAceptaResponsabilidad(false);
  }

  function cambiarDocumento(v: string) {
    setDocumento(v);
    setVerificacionFallo(false);
    setAceptaResponsabilidad(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const doc = documento.trim();
    if (tipoDocumento === 'DNI' && !/^\d{8}$/.test(doc)) {
      setAviso({ texto: 'Ingresa un DNI válido de 8 dígitos.', tipo: 'err' });
      return;
    }
    if (tipoDocumento === 'CE' && doc.length < 6) {
      setAviso({ texto: 'Ingresa un número de Carnet de Extranjería válido.', tipo: 'err' });
      return;
    }
    if (pass !== pass2) {
      setAviso({ texto: 'Las contraseñas no coinciden. Vuelve a escribirlas.', tipo: 'err' });
      return;
    }

    const nombreCompleto = `${nombres.trim()} ${apellidos.trim()}`.trim();
    let documentoVerificado = false;

    // El Carnet de Extranjería no se puede verificar contra RENIEC (esa API solo cubre DNI),
    // así que siempre requiere que el alumno acepte responsabilidad por el nombre que escribió.
    if (tipoDocumento === 'CE') {
      if (!aceptaResponsabilidad) {
        setAviso({
          texto: 'El Carnet de Extranjería no se puede verificar automáticamente. Marca la casilla para confirmar que tu nombre es correcto.',
          tipo: 'err',
        });
        return;
      }
      documentoVerificado = false;
    } else if (!aceptaResponsabilidad) {
      setCargando(true);
      const verificacion = await verificarDni(doc, nombreCompleto);
      setCargando(false);
      if (verificacion.ok && verificacion.coincide === true) {
        documentoVerificado = true;
      } else {
        setVerificacionFallo(true);
        setAviso({
          texto: !verificacion.ok
            ? verificacion.motivo || 'No se pudo verificar tu DNI. Intenta nuevamente.'
            : `El nombre ingresado no coincide con el registrado en RENIEC para ese DNI (${verificacion.nombreCompleto}). Corrígelo o marca la casilla de abajo para continuar bajo tu responsabilidad.`,
          tipo: 'err',
        });
        return;
      }
    }
    // tipoDocumento === 'DNI' && aceptaResponsabilidad: el alumno decidió continuar sin verificación tras un intento fallido.

    setCargando(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: pass,
      options: {
        data: {
          nombre: nombreCompleto,
          nombres: nombres.trim(),
          apellidos: apellidos.trim(),
          documento: doc,
          tipo_documento: tipoDocumento,
          documento_verificado: documentoVerificado,
        },
      },
    });
    if (error) {
      setAviso({ texto: error.message, tipo: 'err' });
      setCargando(false);
      return;
    }
    if (data.session) {
      router.push('/aula');
    } else {
      setAviso({ texto: 'Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.', tipo: 'ok' });
      setCargando(false);
    }
  }

  return (
    <AuthCard>
      <h1 className="titulo" style={{ fontSize: '1.3rem', marginBottom: '.3rem' }}>
        Crea tu cuenta
      </h1>
      <p className="sub" style={{ marginTop: 0 }}>
        Regístrate para acceder a tus cursos.
      </p>

      {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}

      <form onSubmit={handleSubmit}>
        <label>Tipo de documento</label>
        <div className="fila" style={{ marginBottom: '.6rem' }}>
          <label className="chk">
            <input type="radio" name="tipo-doc" checked={tipoDocumento === 'DNI'} onChange={() => cambiarTipoDocumento('DNI')} /> DNI
          </label>
          <label className="chk">
            <input type="radio" name="tipo-doc" checked={tipoDocumento === 'CE'} onChange={() => cambiarTipoDocumento('CE')} /> Carnet de Extranjería
          </label>
        </div>

        <label htmlFor="documento">{tipoDocumento === 'DNI' ? 'DNI' : 'Carnet de Extranjería'}</label>
        <input
          id="documento"
          type="text"
          inputMode={tipoDocumento === 'DNI' ? 'numeric' : 'text'}
          maxLength={tipoDocumento === 'DNI' ? 8 : 15}
          required
          placeholder={tipoDocumento === 'DNI' ? '8 dígitos' : 'Número de tu carnet'}
          value={documento}
          onChange={(e) => cambiarDocumento(tipoDocumento === 'DNI' ? e.target.value.replace(/\D/g, '').slice(0, 8) : e.target.value.slice(0, 15))}
        />

        <label htmlFor="nombres">Nombres</label>
        <input id="nombres" type="text" required placeholder="Tus nombres" value={nombres} onChange={(e) => setNombres(e.target.value)} />

        <label htmlFor="apellidos">Apellidos</label>
        <input id="apellidos" type="text" required placeholder="Tus apellidos" value={apellidos} onChange={(e) => setApellidos(e.target.value)} />

        {(tipoDocumento === 'CE' || verificacionFallo) && (
          <label className="chk" style={{ marginTop: '.4rem', alignItems: 'flex-start' }}>
            <input type="checkbox" checked={aceptaResponsabilidad} onChange={(e) => setAceptaResponsabilidad(e.target.checked)} style={{ marginTop: '.2rem' }} />
            <span>
              Confirmo que mis nombres y apellidos están escritos correctamente. Entiendo que este mismo nombre aparecerá en mi certificado y que soy responsable de su
              exactitud.
            </span>
          </label>
        )}

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

        <PasswordField label="Contraseña" value={pass} onChange={setPass} placeholder="Mínimo 6 caracteres" autoComplete="new-password" minLength={6} />
        <PasswordField label="Confirmar contraseña" value={pass2} onChange={setPass2} placeholder="Repite tu contraseña" autoComplete="new-password" minLength={6} />

        <button className="btn bloque celeste" type="submit" disabled={cargando} style={{ marginTop: '1.2rem' }}>
          {cargando ? 'Verificando…' : 'Crear cuenta'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
      </p>
    </AuthCard>
  );
}
