'use client';

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import { Button } from '@/Componentes/ui/button';
import { Input } from '@/Componentes/ui/input';
import type { PerfilCliente } from '@/lib/pedidos';

interface ClienteSelectorProps {
  value: PerfilCliente | null;
  onChange: (cliente: PerfilCliente | null) => void;
}

export function ClienteSelector({ value, onChange }: ClienteSelectorProps) {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<PerfilCliente[]>([]);
  const busquedaDebounced = useDebounce(busqueda, 300);

  useEffect(() => {
    let cancelado = false;
    async function buscar() {
      const termino = busquedaDebounced.trim();
      if (termino.length < 2) {
        setResultados([]);
        return;
      }
      const { data } = await supabase
        .from('perfiles')
        .select('id,nombre,email,telefono')
        .neq('rol', 'admin')
        .or(`nombre.ilike.%${termino}%,email.ilike.%${termino}%`)
        .limit(8);
      if (!cancelado) setResultados((data as PerfilCliente[]) ?? []);
    }
    buscar();
    return () => {
      cancelado = true;
    };
  }, [busquedaDebounced]);

  if (value) {
    return (
      <div className="flex items-start justify-between gap-2 rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">{value.nombre || 'Sin nombre'}</p>
          <p className="text-xs text-muted-foreground">{value.email}</p>
          {value.telefono && <p className="text-xs text-muted-foreground">{value.telefono}</p>}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          <X className="h-4 w-4" /> Cambiar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Busca un cliente por nombre o correo…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>
      {resultados.length > 0 && (
        <div className="flex flex-col gap-1">
          {resultados.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c)}
              className="rounded-md p-2 text-left text-sm hover:bg-muted"
            >
              <span className="font-medium">{c.nombre || 'Sin nombre'}</span>
              <span className="ml-2 text-xs text-muted-foreground">{c.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
