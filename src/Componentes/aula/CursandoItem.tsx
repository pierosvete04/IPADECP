'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { attachHoverLift } from '@/lib/motion';
import type { Inscripcion } from '@/types/aula';

function formatoFecha(f: string): string {
  const d = new Date(f);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CursandoItem({
  ins,
  pct,
  nota,
}: {
  ins: Inscripcion;
  pct: number | null;
  nota: number | string | null;
}) {
  const c = ins.cursos;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => attachHoverLift(ref.current, { y: -4, scale: 1.008 }), []);

  return (
    <div className="gam-aprendiendo-item" ref={ref}>
      <div className="info">
        <h3>{c.nombre || 'Curso'}</h3>
        <div className="fecha">
          <span className="material-symbols-outlined" style={{ fontSize: 13, verticalAlign: '-2px' }}>
            calendar_today
          </span>{' '}
          Inscrito: {formatoFecha(ins.inscrito_en)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className="barra-progreso" style={{ flex: 1 }}>
            <div className="relleno" style={{ width: `${pct ?? 0}%` }} />
          </div>
          <span className="pct">{pct ?? 0}%</span>
        </div>
      </div>
      <div className="nota-box">
        <div className="val">{nota ?? '…'}</div>
        <div className="lbl">Nota</div>
      </div>
      <Link className="btn sec btn-sm" href={`/aula/curso/${c.id}`}>
        Entrar al curso
      </Link>
    </div>
  );
}
