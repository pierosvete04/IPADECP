'use client';

import { useMemo, useState } from 'react';
import { Checkbox } from '@/Componentes/ui/checkbox';
import { Input } from '@/Componentes/ui/input';
import { Label } from '@/Componentes/ui/label';
import { ScrollArea } from '@/Componentes/ui/scroll-area';
import { formatSoles } from '@/lib/copy';
import { cn } from '@/lib/utils';

export interface CursoSeleccionable {
  id: number;
  nombre: string;
  precio_ahora?: string | null;
}

/** Checklist buscable de cursos, compartida por Venta Asistida y Generar código de acceso. */
export default function CursoMultiSelector({
  cursos,
  seleccion,
  onChange,
  label = 'Cursos',
  maxSeleccion,
}: {
  cursos: CursoSeleccionable[];
  seleccion: Set<number>;
  onChange: (next: Set<number>) => void;
  label?: string;
  /** Si se indica (ej. combo de promoción con cupo fijo), no deja marcar más de este número. */
  maxSeleccion?: number;
}) {
  const [busqueda, setBusqueda] = useState('');

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return cursos;
    return cursos.filter((c) => c.nombre.toLowerCase().includes(q));
  }, [cursos, busqueda]);

  function toggle(id: number) {
    const next = new Set(seleccion);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (maxSeleccion && next.size >= maxSeleccion) return;
      next.add(id);
    }
    onChange(next);
  }

  function seleccionarVisibles() {
    const next = new Set(seleccion);
    filtrados.forEach((c) => next.add(c.id));
    onChange(next);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label>
          {label} {maxSeleccion ? `(${seleccion.size}/${maxSeleccion})` : seleccion.size > 0 && `(${seleccion.size} seleccionado${seleccion.size > 1 ? 's' : ''})`}
        </Label>
        <div className="flex gap-3 text-xs">
          {!maxSeleccion && (
            <button type="button" className="text-[var(--primario)] hover:underline" onClick={seleccionarVisibles}>
              Seleccionar todos
            </button>
          )}
          {seleccion.size > 0 && (
            <button type="button" className="text-muted-foreground hover:underline" onClick={() => onChange(new Set())}>
              Limpiar
            </button>
          )}
        </div>
      </div>
      <Input className="mt-1.5" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar curso…" />
      <div className="mt-1.5 overflow-hidden rounded-lg border border-input">
        <ScrollArea className="h-60">
          <div className="divide-y divide-border">
            {filtrados.length ? (
              filtrados.map((c) => {
                const marcado = seleccion.has(c.id);
                const bloqueado = !marcado && !!maxSeleccion && seleccion.size >= maxSeleccion;
                return (
                  <label
                    key={c.id}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 text-sm transition-colors',
                      bloqueado ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-muted/60',
                      marcado && 'bg-primary/5'
                    )}
                  >
                    <Checkbox checked={marcado} disabled={bloqueado} onCheckedChange={() => toggle(c.id)} />
                    <span className="flex-1 truncate" title={c.nombre}>
                      {c.nombre}
                    </span>
                    {c.precio_ahora && (
                      <span className="shrink-0 font-medium tabular-nums text-muted-foreground">{formatSoles(c.precio_ahora)}</span>
                    )}
                  </label>
                );
              })
            ) : (
              <p className="vacio px-3 py-4">Ningún curso coincide con la búsqueda.</p>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
