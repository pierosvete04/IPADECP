'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { ADMIN_CATEGORIAS, ADMIN_ITEMS_SUELTOS, type SidebarItem } from './Sidebar';

interface Entrada extends SidebarItem {
  categoria?: string;
}

function todasLasEntradas(): Entrada[] {
  const sueltas = ADMIN_ITEMS_SUELTOS.map((i) => ({ ...i }));
  const deCategorias = ADMIN_CATEGORIAS.flatMap((cat) => cat.items.map((i) => ({ ...i, categoria: cat.label })));
  return [...sueltas, ...deCategorias];
}

const TODAS_LAS_ENTRADAS = todasLasEntradas();

/**
 * Ir a cualquiera de las 21 secciones del panel en un solo paso (Ctrl/Cmd+K),
 * en vez de navegar el Sidebar por categorías (hasta 3 clicks entre
 * secciones de categorías distintas, ver ADMIN_CATEGORIAS en Sidebar.tsx).
 */
export default function CommandPalette({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (key: string) => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  return (
    <div
      className={`modal-bg${open ? ' abierto' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      {/* Montado solo mientras está abierto: cada apertura arranca con
          estado (busqueda/activo) limpio de fábrica, sin necesitar un
          efecto ni un ref que compare el valor anterior de `open`. */}
      {open && <CommandPaletteBody onClose={() => onOpenChange(false)} onSelect={onSelect} />}
    </div>
  );
}

function CommandPaletteBody({ onClose, onSelect }: { onClose: () => void; onSelect: (key: string) => void }) {
  const [busqueda, setBusqueda] = useState('');
  const [activo, setActivo] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const filtradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return TODAS_LAS_ENTRADAS;
    return TODAS_LAS_ENTRADAS.filter((e) => e.label.toLowerCase().includes(q) || e.categoria?.toLowerCase().includes(q));
  }, [busqueda]);

  function elegir(item: Entrada) {
    onSelect(item.key);
    onClose();
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActivo((i) => Math.min(i + 1, filtradas.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtradas[activo];
      if (item) elegir(item);
    }
  }

  return (
    <div className="modal-caja" style={{ maxWidth: 480, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.9rem 1.1rem', borderBottom: '1px solid var(--borde)' }}>
        <Search className="h-4 w-4" style={{ color: 'var(--gris)', flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setActivo(0);
          }}
          onKeyDown={onInputKeyDown}
          placeholder="Ir a una sección…"
          aria-label="Buscar sección del panel"
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '.95rem' }}
        />
        <kbd style={{ fontSize: '.7rem', color: 'var(--gris)', border: '1px solid var(--borde)', borderRadius: 4, padding: '.1rem .35rem' }}>Esc</kbd>
      </div>
      <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '.4rem' }}>
        {filtradas.length === 0 && (
          <p className="vacio" style={{ padding: '1rem' }}>
            Sin resultados.
          </p>
        )}
        {filtradas.map((item, i) => (
          <button
            key={item.key}
            type="button"
            onClick={() => elegir(item)}
            onMouseEnter={() => setActivo(i)}
            style={{
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '.5rem',
              textAlign: 'left',
              padding: '.55rem .7rem',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: i === activo ? 'var(--primario-claro)' : 'transparent',
              color: 'inherit',
              font: 'inherit',
            }}
          >
            <span>{item.label}</span>
            {item.categoria && <span style={{ fontSize: '.75rem', color: 'var(--gris)' }}>{item.categoria}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
