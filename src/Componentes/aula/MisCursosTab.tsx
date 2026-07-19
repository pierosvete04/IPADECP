'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { revealStagger } from '@/lib/motion';
import CursoGrandeCard from './CursoGrandeCard';
import type { Inscripcion } from '@/types/aula';

const UMBRAL_COMPLETADO = 14;
const UMBRAL_APROBADO = 13;
const POR_PAGINA = 6;

type Filtro = 'todos' | 'progreso' | 'completado';

interface ConDatos {
  curso: Inscripcion['cursos'];
  estado: 'completado' | 'progreso';
  nota: number;
}

export default function MisCursosTab({ userId, onAbrirCodigo }: { userId: string; onAbrirCodigo: () => void }) {
  const [inscripciones, setInscripciones] = useState<Inscripcion[] | null>(null);
  const [promedios, setPromedios] = useState<number[]>([]);
  const [examenesAprobados, setExamenesAprobados] = useState(0);
  const [promedioGeneral, setPromedioGeneral] = useState<string>('—');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [pagina, setPagina] = useState(0);

  useEffect(() => {
    let activo = true;
    supabase
      .from('inscripciones')
      .select('curso_id, inscrito_en, cursos(id, nombre, introduccion1, precio_ahora, img, tipo_clase, tipo_curso)')
      .order('inscrito_en', { ascending: true })
      .then(({ data }) => {
        if (activo) setInscripciones((data as unknown as Inscripcion[]) || []);
      });
    supabase
      .from('resultados_examen')
      .select('tarea_id,nota')
      .eq('alumno_uid', userId)
      .then(({ data }) => {
        if (!activo) return;
        const mejorPorTarea: Record<number, number> = {};
        (data || []).forEach((r) => {
          mejorPorTarea[r.tarea_id] = Math.max(mejorPorTarea[r.tarea_id] || 0, r.nota || 0);
        });
        const notas = Object.values(mejorPorTarea);
        setExamenesAprobados(notas.filter((n) => n >= UMBRAL_APROBADO).length);
        setPromedioGeneral(notas.length ? (notas.reduce((s, n) => s + n, 0) / notas.length).toFixed(1) : '—');
      });
    return () => {
      activo = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!inscripciones || !inscripciones.length) {
      setPromedios([]);
      return;
    }
    let activo = true;
    Promise.all(
      inscripciones.map((ins) =>
        supabase
          .rpc('mi_promedio_curso', { p_curso_id: ins.curso_id })
          .then((r) => Number(r.data) || 0, () => 0)
      )
    ).then((vals) => {
      if (activo) setPromedios(vals);
    });
    return () => {
      activo = false;
    };
  }, [inscripciones]);

  const cursosConDatos: ConDatos[] = useMemo(() => {
    if (!inscripciones) return [];
    return inscripciones.map((ins, i) => ({
      curso: ins.cursos,
      estado: (promedios[i] || 0) >= UMBRAL_COMPLETADO ? 'completado' : 'progreso',
      nota: promedios[i] || 0,
    }));
  }, [inscripciones, promedios]);

  const completados = cursosConDatos.filter((c) => c.estado === 'completado').length;
  const enProgreso = cursosConDatos.length - completados;

  const filtrados = filtro === 'todos' ? cursosConDatos : cursosConDatos.filter((c) => c.estado === filtro);
  const totalPag = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPag - 1);
  const listaPagina = filtrados.slice(paginaSegura * POR_PAGINA, paginaSegura * POR_PAGINA + POR_PAGINA);

  const grillaRef = useRef<HTMLDivElement>(null);

  // Re-revela la grilla cada vez que cambia lo que se ve (filtro, página) —
  // no solo al montar — para que cambiar de filtro también se sienta vivo.
  useEffect(() => {
    if (listaPagina.length) revealStagger(grillaRef.current, '.curso-grande', { y: 12, stagger: 0.05 });
  }, [filtro, paginaSegura, listaPagina.length]);

  if (inscripciones === null) {
    return <p>Cargando…</p>;
  }

  return (
    <>
      <div className="barra">
        <h2 className="titulo" style={{ margin: 0 }}>
          Mis cursos
        </h2>
        <a href="#" className="btn btn-sm" onClick={(e) => { e.preventDefault(); onAbrirCodigo(); }}>
          + Añadir curso
        </a>
      </div>

      {!inscripciones.length ? (
        <div className="vacio">
          Aún no tienes cursos.{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); onAbrirCodigo(); }}>
            Añade uno con tu código de acceso
          </a>
          .
        </div>
      ) : (
        <>
          <div className="stat-grid" style={{ marginBottom: '.7rem' }}>
            {[
              ['Cursos completados', completados, 'task_alt'],
              ['Cursos en progreso', enProgreso, 'hourglass_top'],
              ['Exámenes aprobados', examenesAprobados, 'workspace_premium'],
              ['Promedio general', promedioGeneral, 'insights'],
            ].map(([l, n, ico]) => (
              <div className="stat" key={l as string}>
                <span className="material-symbols-outlined stat-ico">{ico}</span>
                <div className="stat-texto">
                  <div className="n">{n}</div>
                  <div className="l">{l}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="barra">
            <div className="filtro-tipo">
              {(['todos', 'progreso', 'completado'] as Filtro[]).map((f) => (
                <button
                  key={f}
                  className={`btn sec btn-sm${filtro === f ? ' activo' : ''}`}
                  onClick={() => {
                    setFiltro(f);
                    setPagina(0);
                  }}
                >
                  {f === 'todos' ? 'Todos' : f === 'progreso' ? 'En progreso' : 'Completados'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid-grande" style={{ marginTop: '1rem' }} ref={grillaRef}>
            {listaPagina.length ? (
              listaPagina.map((c) => <CursoGrandeCard key={c.curso.id} curso={c.curso} estado={c.estado} nota={c.nota} />)
            ) : (
              <p className="vacio">Ningún curso con este filtro.</p>
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
        </>
      )}
    </>
  );
}
