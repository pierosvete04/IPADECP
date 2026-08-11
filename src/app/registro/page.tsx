'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AuthCard from '@/Componentes/layout/AuthCard';
import FormNuevaCuenta from '@/Componentes/auth/FormNuevaCuenta';
import FormActivarCuenta from '@/Componentes/auth/FormActivarCuenta';

type Modo = 'nueva' | 'activar';

/**
 * Una sola pantalla con los dos caminos, elegidos a mano y no adivinados:
 *
 *   - "Registrar cuenta nueva" — el alumno que llega a comprar un curso.
 *   - "Activar cuenta"         — el cliente de certificación directa, cuya
 *                                cuenta ya existe desde que se le emitió el
 *                                certificado. Ese no crea nada: la reclama.
 *
 * `?modo=activar` es la puerta directa a la segunda pestaña, y es la que
 * apunta el volante impreso que viaja dentro del sobre (ver /activar).
 */
function RegistroContenido() {
  const searchParams = useSearchParams();
  const [modo, setModo] = useState<Modo>(searchParams.get('modo') === 'activar' ? 'activar' : 'nueva');
  // Cuando el alta detecta que ese documento ya tiene cuenta, se cambia de
  // pestaña con el número ya escrito: volver a pedirlo sería preguntarle algo
  // que acaba de responder.
  const [documentoParaActivar, setDocumentoParaActivar] = useState(searchParams.get('doc') || '');

  return (
    <AuthCard>
      <h1 className="titulo" style={{ fontSize: '1.3rem', marginBottom: '.6rem' }}>
        {modo === 'nueva' ? 'Crea tu cuenta' : 'Activa tu cuenta'}
      </h1>

      <div className="tabs" role="tablist" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          role="tab"
          aria-selected={modo === 'nueva'}
          className={`tab-btn${modo === 'nueva' ? ' activo' : ''}`}
          onClick={() => setModo('nueva')}
        >
          Registrar cuenta nueva
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={modo === 'activar'}
          className={`tab-btn${modo === 'activar' ? ' activo' : ''}`}
          onClick={() => setModo('activar')}
        >
          Activar cuenta
        </button>
      </div>

      {modo === 'nueva' ? (
        <FormNuevaCuenta
          onIrAActivar={(doc) => {
            setDocumentoParaActivar(doc);
            setModo('activar');
          }}
        />
      ) : (
        <FormActivarCuenta documentoInicial={documentoParaActivar} />
      )}

      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
      </p>
    </AuthCard>
  );
}

export default function RegistroPage() {
  return (
    <Suspense fallback={null}>
      <RegistroContenido />
    </Suspense>
  );
}
