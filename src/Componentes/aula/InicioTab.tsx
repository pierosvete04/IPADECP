'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { revealStagger } from '@/lib/motion';
import CursandoItem from './CursandoItem';
import type { Inscripcion } from '@/types/aula';

interface Gamificacion {
  puntos: number;
  racha_dias: number;
  nivel: number;
  nivel_nombre: string;
  nivel_min: number;
  nivel_max: number;
  ranking: number;
  total_alumnos: number;
  meta_diaria_hechas: number;
  meta_diaria_total: number;
}

const GAM_DEFAULT: Gamificacion = {
  puntos: 0,
  racha_dias: 0,
  nivel: 1,
  nivel_nombre: 'Novato',
  nivel_min: 0,
  nivel_max: 199,
  ranking: 1,
  total_alumnos: 1,
  meta_diaria_hechas: 0,
  meta_diaria_total: 5,
};

interface Anuncio {
  id: number;
  titulo: string | null;
  contenido: string | null;
  fechaini: string | null;
  link: string | null;
}

function formatoFecha(f: string | null): string {
  if (!f) return '';
  const d = new Date(f);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

const POR_PAGINA = 3;

export default function InicioTab({ userId, nombre }: { userId: string; nombre: string }) {
  const [gam, setGam] = useState<Gamificacion>(GAM_DEFAULT);
  const [anuncios, setAnuncios] = useState<Anuncio[] | null>(null);
  const [cursos, setCursos] = useState<Inscripcion[] | null>(null);
  const [notas, setNotas] = useState<Record<number, number>>({});
  const [pagina, setPagina] = useState(0);

  useEffect(() => {
    let activo = true;
    supabase
      .rpc('mi_gamificacion')
      .then(({ data }) => {
        if (activo && data) setGam(data);
      });
    supabase
      .from('eventos')
      .select('*')
      .eq('categoria', 'anuncio')
      .eq('estado', '1')
      .or(`alumno_id.is.null,alumno_id.eq.${userId}`)
      .order('id', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (activo) setAnuncios(data || []);
      });
    supabase
      .from('inscripciones')
      .select('curso_id, inscrito_en, cursos(id, nombre, introduccion1, precio_ahora, img, tipo_clase, tipo_curso)')
      .order('inscrito_en', { ascending: true })
      .then(({ data }) => {
        if (activo) setCursos((data as unknown as Inscripcion[]) || []);
      });
    return () => {
      activo = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!cursos || !cursos.length) return;
    let activo = true;
    Promise.all(
      cursos.map((ins) =>
        supabase
          .rpc('mi_promedio_curso', { p_curso_id: ins.curso_id })
          .then((r) => Number(r.data) || 0, () => 0)
      )
    ).then((vals) => {
      if (!activo) return;
      const mapa: Record<number, number> = {};
      cursos.forEach((ins, i) => (mapa[ins.curso_id] = vals[i]));
      setNotas(mapa);
    });
    return () => {
      activo = false;
    };
  }, [cursos]);

  const rango = Math.max(1, gam.nivel_max - gam.nivel_min + 1);
  const avanceXp = Math.min(100, Math.round(((gam.puntos - gam.nivel_min) / rango) * 100));
  const metaPct = Math.round((gam.meta_diaria_hechas / gam.meta_diaria_total) * 100);

  const totalPag = cursos ? Math.max(1, Math.ceil(cursos.length / POR_PAGINA)) : 1;
  const paginaSegura = Math.min(pagina, totalPag - 1);
  const listaPagina = cursos ? cursos.slice(paginaSegura * POR_PAGINA, paginaSegura * POR_PAGINA + POR_PAGINA) : [];

  const raizRef = useRef<HTMLDivElement>(null);

  // Los stats (racha/ranking/puntos) siempre están en el DOM desde el primer
  // render (parten de GAM_DEFAULT) — se revelan apenas monta la página.
  useEffect(() => {
    revealStagger(raizRef.current, '.gam-stat', { y: 8, stagger: 0.06 });
  }, []);

  // "Continúa aprendiendo" depende de datos async — se revela cuando llega
  // la página actual (incluye cambios de paginación).
  useEffect(() => {
    if (listaPagina.length) revealStagger(raizRef.current, '.gam-aprendiendo-item', { y: 10, stagger: 0.05 });
  }, [paginaSegura, listaPagina.length]);

  return (
    <div className="gam-grid" ref={raizRef}>
      <div>
        <div className="gam-hero">
          <div className="gam-hero-top">
            <div>
              <h2>¡Hola, {nombre}! 👋</h2>
              <p>
                {gam.nivel_max < 999999
                  ? `Vas por buen camino. Te faltan ${Math.max(0, gam.nivel_max + 1 - gam.puntos)} pts para subir al nivel ${gam.nivel + 1}.`
                  : '¡Has alcanzado el nivel máximo! Sigue sumando puntos.'}
              </p>
            </div>
            <div className="gam-nivel-badge">
              <span className="num">{gam.nivel}</span> <span>{gam.nivel_nombre}</span>
            </div>
          </div>
          <div className="gam-xp-bar">
            <div className="pista">
              <div className="relleno" style={{ width: `${avanceXp}%` }} />
            </div>
            <div className="lbl">
              <span>{gam.puntos} pts</span>
              <span>{(gam.nivel_max < 999999 ? gam.nivel_max + 1 : gam.puntos)} pts</span>
            </div>
          </div>
          <div className="gam-stats-row">
            <div className={`gam-stat${gam.racha_dias >= 3 ? ' racha-alta' : ''}`}>
              <div className="ico">🔥</div>
              <div className="n">{gam.racha_dias}</div>
              <div className="l">días de racha</div>
            </div>
            <div className="gam-stat">
              <div className="ico">🏆</div>
              <div className="n">#{gam.ranking}</div>
              <div className="l">en el ranking</div>
            </div>
            <div className="gam-stat">
              <div className="ico">⭐</div>
              <div className="n">{gam.puntos}</div>
              <div className="l">puntos</div>
            </div>
          </div>
        </div>
        <div className="barra" style={{ marginTop: '1.1rem' }}>
          <h2 className="titulo" style={{ fontSize: '1.15rem', margin: 0 }}>
            Continúa aprendiendo
          </h2>
        </div>
        <div style={{ marginTop: '.6rem' }}>
          {cursos === null ? (
            'Cargando…'
          ) : listaPagina.length ? (
            listaPagina.map((ins) => (
              <CursandoItem
                key={ins.curso_id}
                ins={ins}
                pct={notas[ins.curso_id] != null ? Math.min(100, Math.round((notas[ins.curso_id] / 20) * 100)) : null}
                nota={notas[ins.curso_id] != null ? (notas[ins.curso_id] > 0 ? notas[ins.curso_id] : '—') : null}
              />
            ))
          ) : (
            <p className="vacio">
              Aún no tienes cursos. Ve a <Link href="/aula?sec=cursos">Mis cursos</Link> para añadir uno.
            </p>
          )}
        </div>
        {totalPag > 1 && (
          <div className="paginacion">
            <button className="btn sec btn-sm" disabled={paginaSegura === 0} onClick={() => setPagina(paginaSegura - 1)}>
              ← Anterior
            </button>
            <span className="pag-info">
              Página {paginaSegura + 1} de {totalPag}
            </span>
            <button className="btn sec btn-sm" disabled={paginaSegura >= totalPag - 1} onClick={() => setPagina(paginaSegura + 1)}>
              Siguiente →
            </button>
          </div>
        )}
      </div>
      <aside>
        <div className="gam-meta-diaria">
          <h3>🎯 Meta diaria</h3>
          <div className="gam-donut" style={{ ['--pct' as string]: metaPct }}>
            <span>
              {gam.meta_diaria_hechas}/{gam.meta_diaria_total}
            </span>
          </div>
          <p>
            {gam.meta_diaria_hechas >= gam.meta_diaria_total
              ? '¡Meta cumplida hoy! 🎉'
              : `${gam.meta_diaria_total - gam.meta_diaria_hechas} lecciones más para mantener tu racha 🔥`}
          </p>
        </div>
        <div className="gam-posicion" style={{ marginBottom: '1rem' }}>
          <h3>🏆 Tu posición</h3>
          <div className="num">#{gam.ranking}</div>
          <div className="de">
            de {gam.total_alumnos} alumno{gam.total_alumnos === 1 ? '' : 's'}
          </div>
          <div className="ayuda">{gam.ranking <= 5 ? '¡Estás en el Top 5! 🏅' : 'Sigue sumando puntos para subir en el ranking.'}</div>
        </div>
        <aside className="anuncios-panel">
          <h3>
            <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: '-3px' }}>
              campaign
            </span>{' '}
            Anuncios
          </h3>
          <div>
            {anuncios === null ? (
              'Cargando…'
            ) : anuncios.length ? (
              anuncios.map((a) => (
                <div className="anuncio" key={a.id}>
                  <h4>{a.titulo || 'Anuncio'}</h4>
                  <div className="fecha">🗓️ {formatoFecha(a.fechaini)}</div>
                  <p>
                    {(a.contenido || '').slice(0, 110)}
                    {(a.contenido || '').length > 110 ? '…' : ''}
                  </p>
                  {a.link && (
                    <a className="ver" href={a.link} target="_blank" rel="noreferrer">
                      Ver detalle →
                    </a>
                  )}
                </div>
              ))
            ) : (
              <p className="vacio" style={{ color: '#cfe0e6' }}>
                No hay anuncios por el momento.
              </p>
            )}
          </div>
        </aside>
      </aside>
    </div>
  );
}
