'use client';

import { useEffect, useState } from 'react';
import { embed } from '@/lib/embed';

export interface Modulo {
  id: number;
  titulo: string | null;
  linkvideo: string | null;
  archivo: string | null;
}

export interface Material {
  id: number;
  nombremat: string | null;
  archivo: string | null;
  modulo_id: number | null;
}

export default function ModulosTab({
  modulos,
  materiales,
  onVerModulo,
}: {
  modulos: Modulo[];
  materiales: Material[];
  onVerModulo: (moduloId: number) => void;
}) {
  const [abierto, setAbierto] = useState<number | null>(modulos[0]?.id ?? null);
  const vistos = useModulosVistos(abierto, modulos, onVerModulo);

  if (!modulos.length) return <p className="vacio">Aún no hay módulos publicados.</p>;

  const matsPorModulo: Record<number, Material[]> = {};
  materiales.forEach((m) => {
    if (!m.modulo_id) return;
    (matsPorModulo[m.modulo_id] = matsPorModulo[m.modulo_id] || []).push(m);
  });

  return (
    <>
      {modulos.map((m, i) => {
        const estaAbierto = abierto === m.id;
        const lista = matsPorModulo[m.id];
        return (
          <div className={`acc-item${estaAbierto ? ' abierto activo-modulo' : ''}`} key={m.id}>
            <button
              className="acc-head"
              onClick={() => {
                if (estaAbierto) return;
                setAbierto(m.id);
                if (m.linkvideo) vistos.marcar(m.id);
              }}
            >
              <span className="acc-head-info">
                <span className="estado-ico">{i + 1}</span>
                <span>{m.titulo || `Módulo ${i + 1}`}</span>
              </span>
              <span className="material-symbols-outlined flecha">chevron_right</span>
            </button>
            {estaAbierto && (
              <div className="acc-body">
                <div className="visor-layout">
                  <div className="descripcion">
                    <div className="fila">
                      {m.linkvideo && (
                        <a className="btn sec" target="_blank" rel="noreferrer" href={m.linkvideo} onClick={() => onVerModulo(m.id)}>
                          Ver clase
                        </a>
                      )}
                      {m.archivo && (
                        <a className="btn sec" target="_blank" rel="noreferrer" href={m.archivo} onClick={() => onVerModulo(m.id)}>
                          Ver presentación
                        </a>
                      )}
                    </div>
                    {!m.linkvideo && !m.archivo && <p className="vacio">Sin recursos en este módulo.</p>}
                    {lista && lista.length > 0 && (
                      <div className="materiales-modulo">
                        <h4>Material para la sesión</h4>
                        <div className="fila">
                          {lista.map((mat) =>
                            mat.archivo ? (
                              <a className="btn sec" target="_blank" rel="noreferrer" href={mat.archivo} key={mat.id}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: '-3px' }}>
                                  description
                                </span>{' '}
                                {mat.nombremat || 'Material'}
                              </a>
                            ) : (
                              <span className="btn sec" style={{ opacity: 0.55, cursor: 'default' }} key={mat.id}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: '-3px' }}>
                                  description
                                </span>{' '}
                                {mat.nombremat || 'Material'}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {m.linkvideo && (
                    <div className="visor-caja visor-video">
                      <iframe src={embed(m.linkvideo)} allowFullScreen allow="autoplay; fullscreen" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// El módulo abierto por defecto también otorga puntos "al abrir" (igual que
// el original marca el que ya viene abierto), solo una vez por módulo.
function useModulosVistos(abierto: number | null, modulos: Modulo[], onVer: (id: number) => void) {
  const [vistos] = useState(() => new Set<number>());

  useEffect(() => {
    if (abierto == null) return;
    const mod = modulos.find((m) => m.id === abierto);
    if (!mod?.linkvideo || vistos.has(abierto)) return;
    vistos.add(abierto);
    onVer(abierto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  return {
    marcar(id: number) {
      if (vistos.has(id)) return;
      vistos.add(id);
      onVer(id);
    },
  };
}
