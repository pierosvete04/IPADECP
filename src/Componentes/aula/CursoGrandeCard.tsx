'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import CourseArt from '@/Componentes/ui/CourseArt';
import { attachHoverLift } from '@/lib/motion';
import type { Curso } from '@/types/aula';

export default function CursoGrandeCard({
  curso,
  estado,
  nota,
}: {
  curso: Curso;
  estado?: 'completado' | 'progreso';
  nota?: number;
}) {
  const completado = estado === 'completado';
  const pct = completado ? 100 : Math.min(100, Math.round(((Number(nota) || 0) / 20) * 100));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => attachHoverLift(ref.current), []);

  return (
    <div className="curso-grande" ref={ref}>
      <div className="miniatura">
        <CourseArt id={curso.id} nombre={curso.nombre} img={curso.img} />
        {estado && (
          <span className={`badge-estado${completado ? ' completado' : ''}`}>
            {completado ? (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: 13, verticalAlign: '-2px' }}>
                  verified
                </span>{' '}
                Completado
              </>
            ) : (
              'En Curso'
            )}
          </span>
        )}
        {curso.tipo_curso === 'premium' && (
          <span className="tag-premium-inline" style={{ position: 'absolute', bottom: '.6rem', left: '.6rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13, verticalAlign: '-2px' }}>
              star
            </span>{' '}
            Premium
          </span>
        )}
      </div>
      <div className="cuerpo">
        <h3>{curso.nombre || 'Curso'}</h3>
        <div className="pie">
          <div className="progreso-fila">
            <span>{completado ? 'Calificación final' : 'Progreso'}</span>
            <strong>{completado ? `${nota || 0}/20` : `${pct}%`}</strong>
          </div>
          <div className="barra-progreso">
            <div className={`relleno${completado ? ' completado' : ''}`} style={{ width: `${pct}%` }} />
          </div>
          <Link className={`btn ${completado ? 'sec' : ''} bloque`} href={`/aula/curso/${curso.id}`}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: '-3px' }}>
              {completado ? 'inventory_2' : 'arrow_forward'}
            </span>{' '}
            {completado ? 'Revisar material' : 'Entrar al curso'}
          </Link>
        </div>
      </div>
    </div>
  );
}
