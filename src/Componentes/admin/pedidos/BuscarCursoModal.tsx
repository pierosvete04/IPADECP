'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import Modal from '@/Componentes/ui/Modal';
import { Button } from '@/Componentes/ui/button';
import { Input } from '@/Componentes/ui/input';
import CourseArt from '@/Componentes/ui/CourseArt';
import type { CursoPrecio, ItemNuevoPedido } from '@/lib/pedidos';

interface BuscarCursoModalProps {
  onAgregar: (item: ItemNuevoPedido) => void;
  onClose: () => void;
  /**
   * Restringe la búsqueda a estos cursos. Lo usa el combo de promoción: si el
   * combo solo aplica a ciertos cursos, no tiene sentido dejar agregar otros y
   * que recién al guardar salte el error.
   */
  soloCursoIds?: number[];
}

export default function BuscarCursoModal({ onAgregar, onClose, soloCursoIds }: BuscarCursoModalProps) {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<CursoPrecio[]>([]);
  const [cargando, setCargando] = useState(false);
  const busquedaDebounced = useDebounce(busqueda, 300);

  useEffect(() => {
    let cancelado = false;
    async function buscar() {
      setCargando(true);
      let query = supabase.from('cursos').select('id,nombre,precio_ahora,img').eq('estado', '1').order('nombre').limit(8);
      if (busquedaDebounced.trim()) query = query.ilike('nombre', `%${busquedaDebounced.trim()}%`);
      if (soloCursoIds?.length) query = query.in('id', soloCursoIds);
      const { data } = await query;
      if (!cancelado) {
        setResultados((data as CursoPrecio[]) ?? []);
        setCargando(false);
      }
    }
    buscar();
    return () => {
      cancelado = true;
    };
  }, [busquedaDebounced, soloCursoIds]);

  function agregar(curso: CursoPrecio) {
    onAgregar({ curso_id: curso.id, nombre_curso: curso.nombre, precio: Number(curso.precio_ahora) || 0 });
    onClose();
  }

  return (
    <Modal open title="Agregar curso" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Input autoFocus placeholder="Buscar curso por nombre…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {!cargando && resultados.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No se encontraron cursos.</p>}
          {resultados.map((c) => (
            <button key={c.id} type="button" onClick={() => agregar(c)} className="flex items-center gap-3 rounded-md p-2 text-left hover:bg-muted">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md">
                <CourseArt id={c.id} nombre={c.nombre} img={c.img} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{c.nombre}</p>
                <p className="text-xs text-muted-foreground">S/ {(Number(c.precio_ahora) || 0).toFixed(2)}</p>
              </div>
              <Button type="button" size="sm" variant="ghost" tabIndex={-1}>
                Agregar
              </Button>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
