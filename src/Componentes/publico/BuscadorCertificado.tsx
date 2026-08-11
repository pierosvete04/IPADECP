'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Campo para verificar un certificado por su código.
 *
 * El inicio prometía "verifica en línea con tu código de certificado" y esa página no existía:
 * `/certificado` daba 404 y la única entrada real era escanear el QR. Alguien con el diploma
 * impreso delante no tenía dónde escribir nada.
 *
 * Acepta lo que la persona tenga a mano —el código corto impreso, solo el número de registro,
 * o el UUID del QR—; la normalización la hace `buscar_certificado_publico` en la base de datos.
 * No consulta acá: navega a `/certificado/buscar?q=…`, que resuelve en el servidor. Así el
 * resultado es enlazable y compartible, que es justo lo que hace quien verifica algo.
 */
export default function BuscadorCertificado({ autoFocus = false, valorInicial = '' }: { autoFocus?: boolean; valorInicial?: string }) {
  const id = useId();
  const router = useRouter();
  const [valor, setValor] = useState(valorInicial);
  const [error, setError] = useState<string | null>(null);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const limpio = valor.trim();
    if (!limpio) {
      setError('Escribe el código que aparece en el certificado.');
      return;
    }
    setError(null);
    router.push(`/certificado/buscar?q=${encodeURIComponent(limpio)}`);
  }

  return (
    <form onSubmit={enviar} className="buscador-certificado">
      <label htmlFor={`${id}-codigo`}>Código del certificado</label>
      <div className="buscador-certificado-fila">
        <input
          id={`${id}-codigo`}
          value={valor}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          placeholder="IPD-2026-000123"
          aria-describedby={error ? `${id}-error` : `${id}-ayuda`}
          aria-invalid={!!error}
          onChange={(e) => {
            setValor(e.target.value);
            if (error) setError(null);
          }}
        />
        <button className="btn" type="submit">
          Verificar
        </button>
      </div>
      {error ? (
        <p className="campo-ayuda err" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : (
        <p className="campo-ayuda" id={`${id}-ayuda`}>
          Sirve el código corto impreso en el certificado, solo su número, o el código largo que
          entrega el QR.
        </p>
      )}
    </form>
  );
}
