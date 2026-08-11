'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { METODOS_PAGO } from '@/lib/metodos-pago';
import { agregarAlCarritoPublico } from '@/lib/carrito-publico';
import CursoCard, { CursoCardSkeleton, type CursoCardData } from './CursoCard';

interface Curso {
  id: number;
  nombre: string;
  introduccion1: string | null;
  precio_ahora: number | string | null;
  precio_antes: number | string | null;
  img: string | null;
  tipo_curso: string | null;
  enlace_clase_vivo: string | null;
  categoria_id: number | null;
}

interface Modulo {
  id: number;
  titulo: string;
}

interface Promo {
  titulo: string;
  descripcion: string | null;
}

const ICONO_METODO: Record<string, string> = {
  mercadopago: 'credit_card',
  transferencia: 'account_balance',
  yape_plin: 'smartphone',
};

function precio(valor: number | string | null): string {
  const n = Number(valor);
  return Number.isFinite(n) ? `S/ ${n.toFixed(2)}` : '';
}

export default function FichaCursoClient({ cursoId }: { cursoId: number }) {
  const router = useRouter();

  const [curso, setCurso] = useState<Curso | null | undefined>(undefined);
  const [categoriaNombre, setCategoriaNombre] = useState<string | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [metodosPago, setMetodosPago] = useState<string[]>([]);
  const [materialesCount, setMaterialesCount] = useState(0);
  const [promo, setPromo] = useState<Promo | null>(null);
  const [relacionados, setRelacionados] = useState<CursoCardData[] | null>(null);
  const [agregado, setAgregado] = useState(false);
  const [tab, setTab] = useState<'descripcion' | 'temario'>('descripcion');

  useEffect(() => {
    let activo = true;
    supabase
      .from('cursos')
      .select('id,nombre,introduccion1,precio_ahora,precio_antes,img,tipo_curso,enlace_clase_vivo,categoria_id')
      .eq('id', cursoId)
      .eq('estado', '1')
      .eq('mostrar_en_catalogo', true)
      .maybeSingle()
      .then(({ data }) => {
        if (activo) setCurso((data as Curso) ?? null);
      });
    return () => {
      activo = false;
    };
  }, [cursoId]);

  useEffect(() => {
    if (!curso) return;
    let activo = true;
    const hoy = new Date().toISOString().slice(0, 10);

    (async () => {
      const promoQuery = supabase
        .from('promociones')
        .select('titulo,descripcion,categoria_id')
        .eq('estado', '1')
        .lte('fecha_inicio', hoy)
        .gte('fecha_fin', hoy)
        .order('fecha_inicio', { ascending: false });

      const [
        { data: mods },
        { data: metodos },
        { count: materiales },
        { data: cat },
        { data: promos },
        { data: relCursos },
      ] = await Promise.all([
        supabase.from('modulos').select('id,titulo').eq('curso_id', cursoId).eq('estado', '1').order('id'),
        supabase.from('curso_metodos_pago').select('metodo').eq('curso_id', cursoId),
        supabase.from('materiales').select('id', { count: 'exact', head: true }).eq('curso_id', cursoId).eq('estado', '1'),
        curso.categoria_id
          ? supabase.from('categorias').select('cat_descripcion').eq('id', curso.categoria_id).maybeSingle()
          : Promise.resolve({ data: null }),
        promoQuery,
        curso.categoria_id
          ? supabase
              .from('cursos')
              .select('id,nombre,precio_ahora,precio_antes,img')
              .eq('categoria_id', curso.categoria_id)
              .eq('estado', '1')
              .eq('mostrar_en_catalogo', true)
              .neq('id', cursoId)
              .limit(3)
          : Promise.resolve({ data: [] }),
      ]);

      if (!activo) return;
      setModulos((mods as Modulo[]) || []);
      setMetodosPago(((metodos as { metodo: string }[]) || []).map((m) => m.metodo));
      setMaterialesCount(materiales || 0);
      setCategoriaNombre((cat as { cat_descripcion: string } | null)?.cat_descripcion ?? null);
      const promoValida = ((promos as (Promo & { categoria_id: number | null })[]) || []).find(
        (p) => p.categoria_id == null || p.categoria_id === curso.categoria_id,
      );
      setPromo(promoValida ? { titulo: promoValida.titulo, descripcion: promoValida.descripcion } : null);
      setRelacionados((relCursos as CursoCardData[]) || []);
    })();

    return () => {
      activo = false;
    };
  }, [curso, cursoId]);

  function comprarCurso() {
    if (!curso) return;
    agregarAlCarritoPublico({
      id: curso.id,
      nombre: curso.nombre,
      precio: Number(curso.precio_ahora) || 0,
      img: curso.img,
    });
    setAgregado(true);
    router.push('/carrito');
  }

  if (curso === undefined) {
    return (
      <div className="ipd-contenedor px-6 py-16">
        <div className="[display:grid] grid-cols-1 lg:grid-cols-[1fr_380px] gap-10">
          <div className="flex flex-col gap-4 animate-pulse">
            <div className="h-6 rounded-full w-1/3" style={{ background: 'var(--st-superficie-borde)' }} />
            <div className="h-10 rounded-full w-2/3" style={{ background: 'var(--st-superficie-borde)' }} />
            <div className="h-32 rounded-2xl" style={{ background: 'var(--st-superficie-borde)' }} />
          </div>
          <div className="ipd-card h-72 animate-pulse" />
        </div>
      </div>
    );
  }

  if (curso === null) {
    return (
      <div className="ipd-contenedor px-6 py-20 text-center">
        <span className="material-symbols-outlined" style={{ fontSize: 44, color: 'var(--gris)' }}>
          search_off
        </span>
        <p className="mt-4 font-semibold text-lg" style={{ color: 'var(--st-texto-navy)' }}>
          No encontramos este curso.
        </p>
        <Link href="/cursos" className="ipd-btn ipd-btn-primario mt-6">
          Ver todos los cursos
        </Link>
      </div>
    );
  }

  const esPremium = curso.tipo_curso === 'premium';

  return (
    <>
      <section className="px-6 pt-8 pb-4">
        <div className="ipd-contenedor">
          <nav className="flex items-center gap-2 text-sm flex-wrap" style={{ color: 'var(--gris)' }}>
            <Link href="/">Inicio</Link>
            <span>/</span>
            <Link href="/cursos">Cursos</Link>
            {categoriaNombre && (
              <>
                <span>/</span>
                <Link href={`/cursos?categoria=${curso.categoria_id}`}>{categoriaNombre}</Link>
              </>
            )}
            <span>/</span>
            <span style={{ color: 'var(--st-texto-navy)' }}>{curso.nombre}</span>
          </nav>
        </div>
      </section>

      <section className="px-6 pb-16">
        <div className="ipd-contenedor [display:grid] grid-cols-1 lg:grid-cols-[1fr_380px] gap-10 items-start">
          <div className="min-w-0 ipd-ficha-columna-izq">
            <div className="ipd-pill-glass mb-3" style={{ alignSelf: 'flex-start' }}>
              <span className="material-symbols-outlined">verified</span>
              Certificación oficial IPADECP
            </div>

            <h1
              className="font-extrabold leading-tight"
              style={{ fontFamily: 'var(--st-font-titulo)', fontSize: 'clamp(1.4rem,2.4vw,1.9rem)', color: 'var(--st-texto-navy)', letterSpacing: '-.02em' }}
            >
              {curso.nombre}
            </h1>

            <div className="flex flex-wrap gap-2 mt-3">
              <span className="ipd-chip">
                <span className="material-symbols-outlined" style={{ fontSize: 15, marginRight: 4 }}>
                  view_module
                </span>
                {modulos.length} {modulos.length === 1 ? 'módulo' : 'módulos'}
              </span>
              <span className="ipd-chip">
                <span className="material-symbols-outlined" style={{ fontSize: 15, marginRight: 4 }}>
                  devices
                </span>
                100% virtual
              </span>
              <span className="ipd-chip">
                <span className="material-symbols-outlined" style={{ fontSize: 15, marginRight: 4 }}>
                  workspace_premium
                </span>
                Certificación final del curso
              </span>
              {materialesCount > 0 && (
                <span className="ipd-chip">
                  <span className="material-symbols-outlined" style={{ fontSize: 15, marginRight: 4 }}>
                    folder_open
                  </span>
                  Material complementario incluido
                </span>
              )}
              {esPremium && (
                <span className="ipd-chip" style={{ background: 'linear-gradient(135deg, var(--st-premium-gold), #b8902a)', color: '#2e1500' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15, marginRight: 4 }}>
                    star
                  </span>
                  Premium · clases en vivo
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 mt-5 border-b shrink-0" style={{ borderColor: 'var(--st-superficie-borde)' }}>
              {(
                [
                  ['descripcion', 'Descripción'],
                  ...(modulos.length > 0 ? ([['temario', `Temario (${modulos.length})`]] as const) : []),
                ] as const
              ).map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  onClick={() => setTab(valor)}
                  className="px-3 py-2.5 text-sm font-semibold"
                  style={{
                    color: tab === valor ? 'var(--st-secundario)' : 'var(--gris)',
                    borderBottom: tab === valor ? '2px solid var(--st-secundario)' : '2px solid transparent',
                    marginBottom: -1,
                  }}
                >
                  {etiqueta}
                </button>
              ))}
            </div>

            <div className="mt-4 ipd-ficha-panel">
              {tab === 'descripcion' && (
                <p className="leading-relaxed whitespace-pre-line text-sm" style={{ color: 'var(--st-texto-tenue)' }}>
                  {curso.introduccion1 || 'Sin descripción disponible.'}
                </p>
              )}

              {tab === 'temario' && modulos.length > 0 && (
                <div className="flex flex-col gap-2">
                  {modulos.map((mod, i) => (
                    <div key={mod.id} className="ipd-card flex items-center gap-3 px-4 py-2.5">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                        style={{ background: 'var(--st-fondo-suave)', color: 'var(--gris)' }}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1 text-[.9rem] font-medium" style={{ color: 'var(--st-texto-navy)' }}>
                        {mod.titulo}
                      </span>
                      <span className="material-symbols-outlined" style={{ color: 'var(--gris)', fontSize: 18 }}>
                        lock
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="ipd-card p-6 lg:sticky lg:top-24">
            {promo && (
              <div
                className="mb-5 -mx-6 -mt-6 px-6 py-4"
                style={{
                  background: 'linear-gradient(135deg, var(--st-secundario), #063a4c)',
                  borderRadius: 'var(--st-radio-card) var(--st-radio-card) 0 0',
                }}
              >
                <span className="text-[.68rem] font-bold tracking-[.08em] uppercase" style={{ color: 'var(--st-celeste)' }}>
                  Oferta
                </span>
                <p className="text-white font-bold text-[.95rem] mt-0.5">{promo.titulo}</p>
              </div>
            )}

            <div className="flex items-baseline gap-2">
              {curso.precio_antes && (
                <span className="text-sm line-through" style={{ color: 'var(--gris)' }}>
                  {precio(curso.precio_antes)}
                </span>
              )}
              <span className="text-3xl font-extrabold" style={{ fontFamily: 'var(--st-font-titulo)', color: 'var(--st-texto-navy)' }}>
                {precio(curso.precio_ahora)}
              </span>
            </div>

            {metodosPago.length > 0 && (
              <div className="mt-4 flex flex-col gap-2">
                {metodosPago.map((m) => {
                  const label = METODOS_PAGO.find((mp) => mp.value === m)?.label ?? m;
                  return (
                    <div key={m} className="flex items-center gap-2 text-sm" style={{ color: 'var(--st-texto-tenue)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--st-secundario)' }}>
                        {ICONO_METODO[m] ?? 'payments'}
                      </span>
                      {label}
                    </div>
                  );
                })}
              </div>
            )}

            <p className="font-semibold mt-6" style={{ color: 'var(--st-texto-navy)' }}>
              Compra el curso por {precio(curso.precio_ahora)}
            </p>
            <button onClick={comprarCurso} className="ipd-btn ipd-btn-primario w-full mt-2">
              {agregado ? 'Agregado ✓' : 'Comprar curso'}
            </button>
            <p className="text-center text-[.78rem] mt-3" style={{ color: 'var(--gris)' }}>
              Acceso inmediato después del pago
            </p>
          </div>
        </div>
      </section>

      {relacionados !== null && relacionados.length > 0 && (
        <section className="px-6 pb-16">
          <div className="ipd-contenedor">
            <h2 className="ipd-titulo-seccion">Cursos relacionados</h2>
            <div className="[display:grid] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
              {relacionados.map((rel) => (
                <CursoCard key={rel.id} curso={rel} categoriaLabel={categoriaNombre ?? 'Estándar'} />
              ))}
            </div>
          </div>
        </section>
      )}

      {relacionados === null && (
        <section className="px-6 pb-16">
          <div className="ipd-contenedor [display:grid] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <CursoCardSkeleton />
            <CursoCardSkeleton />
            <CursoCardSkeleton />
          </div>
        </section>
      )}
    </>
  );
}
