'use client';

import { useEffect, useRef, useState } from 'react';
import type { CursoAdmin } from './useCursosAdmin';

export default function CursoSelector({
  cursos,
  value,
  onChange,
}: {
  cursos: CursoAdmin[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const cajaRef = useRef<HTMLDivElement>(null);

  const seleccionado = cursos.find((c) => String(c.id) === value);
  const etiqueta = (c: CursoAdmin) => `${c.nombre}${c.estado !== '1' ? ' (inactivo)' : ''}`;

  // Se cierra al hacer click fuera (no con onBlur, porque onBlur dispara antes
  // que el click en una opción de la lista y la cerraría sin dejar elegir).
  useEffect(() => {
    if (!abierto) return;
    function alHacerClickFuera(e: MouseEvent) {
      if (cajaRef.current && !cajaRef.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', alHacerClickFuera);
    return () => document.removeEventListener('mousedown', alHacerClickFuera);
  }, [abierto]);

  const filtrados = cursos.filter((c) => c.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()));

  return (
    <div className="combo" ref={cajaRef}>
      <input
        type="text"
        placeholder="Busca un curso por nombre…"
        value={abierto ? busqueda : seleccionado ? etiqueta(seleccionado) : ''}
        onFocus={() => {
          setBusqueda('');
          setAbierto(true);
        }}
        onChange={(e) => {
          setBusqueda(e.target.value);
          setAbierto(true);
        }}
      />
      {abierto && (
        <div className="combo-lista">
          {!filtrados.length && <div className="combo-vacio">Sin cursos que coincidan.</div>}
          {filtrados.map((c) => (
            <button
              type="button"
              key={c.id}
              className={`combo-opcion${String(c.id) === value ? ' activo' : ''}`}
              onClick={() => {
                onChange(String(c.id));
                setAbierto(false);
                setBusqueda('');
              }}
            >
              {etiqueta(c)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
