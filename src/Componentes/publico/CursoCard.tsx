'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CourseArt from '@/Componentes/ui/CourseArt';
import { agregarAlCarritoPublico } from '@/lib/carrito-publico';

export interface CursoCardData {
  id: number;
  nombre: string;
  precio_ahora: number | string | null;
  precio_antes: number | string | null;
  img: string | null;
}

function precio(valor: number | string | null): string {
  const n = Number(valor);
  return Number.isFinite(n) ? `S/ ${n.toFixed(2)}` : '';
}

export function CursoCardSkeleton() {
  return (
    <div className="ipd-card overflow-hidden animate-pulse">
      <div className="h-[168px]" style={{ background: 'var(--st-superficie-borde)' }} />
      <div className="p-5 flex flex-col gap-3">
        <div className="h-3 rounded-full w-2/3" style={{ background: 'var(--st-superficie-borde)' }} />
        <div className="h-3 rounded-full w-1/2" style={{ background: 'var(--st-superficie-borde)' }} />
        <div className="h-5 rounded-full w-1/3 mt-2" style={{ background: 'var(--st-superficie-borde)' }} />
      </div>
    </div>
  );
}

export default function CursoCard({ curso, categoriaLabel }: { curso: CursoCardData; categoriaLabel: string }) {
  const router = useRouter();
  const [agregado, setAgregado] = useState(false);

  function itemCarrito() {
    return { id: curso.id, nombre: curso.nombre, precio: Number(curso.precio_ahora) || 0, img: curso.img };
  }

  function agregarAlCarrito() {
    agregarAlCarritoPublico(itemCarrito());
    setAgregado(true);
  }

  function comprarAhora() {
    agregarAlCarritoPublico(itemCarrito());
    router.push('/carrito');
  }

  return (
    <div className="ipd-card ipd-curso-card">
      <a href={`/curso/${curso.id}`} className="ipd-curso-card-link">
        <div className="miniatura">
          <div className="franja">
            <span className="ipd-chip">{categoriaLabel}</span>
          </div>
          <CourseArt id={curso.id} nombre={curso.nombre} img={curso.img} />
        </div>
        <div className="cuerpo">
          <h3>{curso.nombre}</h3>
          <div className="precio">
            {curso.precio_antes ? <span className="antes">{precio(curso.precio_antes)}</span> : null}
            <span className="ahora">{precio(curso.precio_ahora)}</span>
          </div>
        </div>
      </a>
      <div className="acciones-cursocard">
        <button type="button" onClick={agregarAlCarrito} className="ipd-btn ipd-btn-claro">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            {agregado ? 'check' : 'add_shopping_cart'}
          </span>
          {agregado ? 'Agregado' : 'Agregar'}
        </button>
        <button type="button" onClick={comprarAhora} className="ipd-btn ipd-btn-primario">
          Comprar ahora
        </button>
      </div>
    </div>
  );
}
