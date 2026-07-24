'use client';

import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import CourseArt from '@/Componentes/ui/CourseArt';
import CheckoutView, { CarritoItem } from './CheckoutView';
import type { Curso } from '@/types/aula';
import { leerCarritoPublico, vaciarCarritoPublico } from '@/lib/carrito-publico';

type FiltroTipo = 'todos' | 'estandar' | 'premium';

interface Promocion {
  id: number;
  titulo: string;
  descripcion?: string | null;
  tipo: string;
  cantidad_minima: number;
  cantidad_gratis?: number;
  precio_promo?: number;
  cumple: boolean;
  n_elegibles: number;
  faltan: number;
}

interface Calc {
  subtotal: number;
  total: number;
  descuento: number;
  promocion: { id: number; titulo: string; ahorro: number } | null;
  items: { curso_id: number; precio_lista: number; precio_final: number }[];
}

const CALC_VACIO: Calc = { subtotal: 0, total: 0, descuento: 0, promocion: null, items: [] };
const POR_PAGINA = 4;

function mecanicaPromo(pr: Promocion): string {
  if (pr.tipo === 'precio_fijo_bundle') return `Compra ${pr.cantidad_minima} cursos y paga solo S/ ${pr.precio_promo} en total`;
  if (pr.tipo === 'compra_n_lleva_m') return `Compra ${pr.cantidad_minima} cursos y llévate ${pr.cantidad_gratis} gratis`;
  if (pr.tipo === 'descuento_pct') return `${pr.precio_promo}% de descuento en ${pr.cantidad_minima}+ cursos`;
  if (pr.tipo === 'descuento_monto') return `S/ ${pr.precio_promo} de descuento en ${pr.cantidad_minima}+ cursos`;
  if (pr.tipo === 'precio_fijo') return `Precio especial: S/ ${pr.precio_promo}`;
  return '';
}

export default function ComprarTab({ user, onFinalizado }: { user: User; onFinalizado: () => void }) {
  const [vista, setVista] = useState<'catalogo' | 'checkout'>('catalogo');
  const [disponibles, setDisponibles] = useState<Curso[] | null>(null);
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');
  const [pagina, setPagina] = useState(0);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [calc, setCalc] = useState<Calc>(CALC_VACIO);
  const [promos, setPromos] = useState<Promocion[]>([]);
  const [promocionActivaId, setPromocionActivaId] = useState<number | null>(null);

  useEffect(() => {
    let activo = true;
    (async () => {
      const { data: inscritos } = await supabase.from('inscripciones').select('curso_id');
      const idsInscritos = new Set((inscritos || []).map((i) => i.curso_id));
      const { data: todos } = await supabase
        .from('cursos')
        .select('id,nombre,precio_ahora,tipo_curso,img')
        .eq('estado', '1')
        .eq('mostrar_en_catalogo', true)
        .order('nombre');
      if (!activo) return;
      setDisponibles(((todos as Curso[]) || []).filter((c) => !idsInscritos.has(c.id)));
    })();
    return () => {
      activo = false;
    };
  }, [user]);

  // Si el alumno agregó cursos al carrito público (sin cuenta, en la web de
  // marketing) y recién inició sesión, se importan una sola vez al carrito
  // real del aula. leerCarritoPublico() se vacía al usarse, así que en
  // renders posteriores esto no vuelve a agregar nada.
  useEffect(() => {
    if (!disponibles) return;
    const pendientes = leerCarritoPublico();
    if (pendientes.length === 0) return;
    setCarrito((prev) => {
      const idsPrev = new Set(prev.map((it) => it.id));
      const nuevos = pendientes
        .filter((it) => !idsPrev.has(it.id) && disponibles.some((c) => c.id === it.id))
        .map((it) => ({ id: it.id, nombre: it.nombre, precio: it.precio }));
      return nuevos.length ? [...prev, ...nuevos] : prev;
    });
    vaciarCarritoPublico();
    setCarritoAbierto(true);
  }, [disponibles]);

  const recalcular = useCallback(async () => {
    if (!carrito.length) {
      setCalc(CALC_VACIO);
      return;
    }
    const { data, error } = await supabase.rpc('calcular_total_carrito', {
      p_curso_ids: carrito.map((it) => it.id),
      p_promocion_id: promocionActivaId,
    });
    if (error || !data) {
      const subtotal = carrito.reduce((s, it) => s + (Number(it.precio) || 0), 0);
      setCalc({ subtotal, total: subtotal, descuento: 0, promocion: null, items: [] });
      return;
    }
    if (promocionActivaId && !data.promocion) setPromocionActivaId(null);
    setCalc(data);
  }, [carrito, promocionActivaId]);

  useEffect(() => {
    recalcular();
  }, [recalcular]);

  const recargarPromos = useCallback(async () => {
    const { data, error } = await supabase.rpc('listar_promociones_disponibles', { p_curso_ids: carrito.map((it) => it.id) });
    if (error || !data) {
      setPromos([]);
      return;
    }
    setPromos(data);
  }, [carrito]);

  useEffect(() => {
    recargarPromos();
  }, [recargarPromos]);

  function agregar(c: Curso) {
    setCarrito((prev) => [...prev, { id: c.id, nombre: c.nombre, precio: c.precio_ahora ?? null }]);
  }
  function quitar(id: number) {
    setCarrito((prev) => prev.filter((it) => it.id !== id));
  }

  const listaFiltrada = (disponibles || []).filter((c) => filtroTipo === 'todos' || (c.tipo_curso || 'estandar') === filtroTipo);
  const totalPag = Math.max(1, Math.ceil(listaFiltrada.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPag - 1);
  const listaPagina = listaFiltrada.slice(paginaSegura * POR_PAGINA, paginaSegura * POR_PAGINA + POR_PAGINA);

  if (vista === 'checkout') {
    return (
      <CheckoutView
        user={user}
        carrito={carrito}
        calc={calc}
        onVolver={() => setVista('catalogo')}
        onFinalizado={() => {
          setCarrito([]);
          setPromocionActivaId(null);
          setVista('catalogo');
          onFinalizado();
        }}
      />
    );
  }

  return (
    <>
      <div className="comprar-cab">
        <h2 className="titulo" style={{ margin: 0 }}>
          Comprar cursos
        </h2>
        <button className="btn-ver-carrito" onClick={() => setCarritoAbierto(true)}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            shopping_cart
          </span>
          Ver carrito ({carrito.length})
        </button>
      </div>

      {promos.length > 0 && (
        <div className="promos-grid">
          {promos.map((pr) => {
            const activa = promocionActivaId === pr.id;
            return (
              <div className={`promo-card ${activa ? 'promo-activa' : ''}`} key={pr.id}>
                <span className="tag-promo">
                  <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: '-2px' }}>
                    local_fire_department
                  </span>{' '}
                  Promoción
                </span>
                <h4>{pr.titulo}</h4>
                <div className="meta">{mecanicaPromo(pr)}</div>
                {pr.descripcion && <p>{pr.descripcion}</p>}
                {activa ? (
                  <button className="btn sec btn-sm" onClick={() => setPromocionActivaId(null)}>
                    ✓ Activada · Desactivar
                  </button>
                ) : pr.cumple ? (
                  <button className="btn btn-sm" onClick={() => setPromocionActivaId(pr.id)}>
                    Activar promoción
                  </button>
                ) : (
                  <div className="promo-progreso">
                    Llevas {pr.n_elegibles} · agrega {pr.faltan} curso{pr.faltan > 1 ? 's' : ''} más para activarla
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="barra">
        <h3 style={{ margin: 0, fontSize: '1rem', fontFamily: 'var(--st-font-titulo)' }}>Cursos disponibles</h3>
        <div className="filtro-tipo">
          {(['todos', 'estandar', 'premium'] as FiltroTipo[]).map((f) => (
            <button
              key={f}
              className={`btn sec btn-sm${filtroTipo === f ? ' activo' : ''}`}
              onClick={() => {
                setFiltroTipo(f);
                setPagina(0);
              }}
            >
              {f === 'premium' && (
                <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: '-3px' }}>
                  star
                </span>
              )}
              {f === 'todos' ? 'Todos' : f === 'estandar' ? 'Estándar' : ' Premium'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-comprar" style={{ marginTop: '1rem' }}>
        {disponibles === null ? (
          'Cargando…'
        ) : listaPagina.length ? (
          listaPagina.map((c) => {
            const enCarrito = carrito.some((it) => it.id === c.id);
            const esPremium = c.tipo_curso === 'premium';
            return (
              <div className="curso-comprar" key={c.id}>
                <div className="banner">
                  <CourseArt id={c.id} nombre={c.nombre} img={c.img} />
                  {esPremium && (
                    <span className="badge-estado pendiente">
                      <span className="material-symbols-outlined" style={{ fontSize: 13, verticalAlign: '-2px' }}>
                        star
                      </span>{' '}
                      Premium
                    </span>
                  )}
                </div>
                <div className="cuerpo">
                  <h3>{c.nombre}</h3>
                  <div className="precio-grande">{c.precio_ahora ? `S/ ${c.precio_ahora}` : 'Consultar precio'}</div>
                  <button className={`btn ${enCarrito ? 'sec' : ''} bloque`} disabled={enCarrito} onClick={() => agregar(c)}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: '-3px' }}>
                      {enCarrito ? 'check' : 'add_shopping_cart'}
                    </span>{' '}
                    {enCarrito ? 'Agregado' : 'Agregar'}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="vacio">Ningún curso disponible con este filtro.</p>
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

      <div className={`carrito-overlay${carritoAbierto ? ' abierto' : ''}`} onClick={() => setCarritoAbierto(false)} />
      <aside className={`carrito-panel${carritoAbierto ? ' abierto' : ''}`}>
        <div className="carrito-cab">
          <h3>
            <span className="material-symbols-outlined" style={{ verticalAlign: '-5px' }}>
              shopping_cart
            </span>{' '}
            Tu carrito{' '}
            <span
              className="contador"
              style={{ background: 'var(--st-fondo-navy)', color: '#fff', borderRadius: '99px', padding: '.1rem .55rem', fontSize: '.78rem', marginLeft: '.3rem' }}
            >
              {carrito.length}
            </span>
          </h3>
          <button className="cerrar" onClick={() => setCarritoAbierto(false)} aria-label="Cerrar carrito">
            &times;
          </button>
        </div>
        <div className="carrito-cuerpo">
          {carrito.length ? (
            carrito.map((it) => (
              <div className="carrito-item" key={it.id}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 11,
                    background: 'var(--st-secundario-cont)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ color: 'var(--st-secundario)', fontSize: 20 }}>
                    school
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{it.nombre}</strong>
                  {it.precio && <div className="precio">S/ {it.precio}</div>}
                </div>
                <button className="quitar" title="Quitar" aria-label={`Quitar ${it.nombre} del carrito`} onClick={() => quitar(it.id)}>
                  &times;
                </button>
              </div>
            ))
          ) : (
            <p className="vacio">Tu carrito está vacío.</p>
          )}
        </div>
        <div className="carrito-pie">
          {promocionActivaId && !calc.promocion && (
            <div className="aviso err" style={{ margin: '0 0 .8rem' }}>
              La promoción se desactivó: ya no cumples la cantidad mínima.
            </div>
          )}
          {calc.promocion && (
            <div className="aviso ok" style={{ margin: '0 0 .8rem' }}>
              🎉 {calc.promocion.titulo} activada · ahorras S/ {calc.promocion.ahorro}
            </div>
          )}
          <div className="carrito-total">
            Total <strong>S/ {calc.total}</strong>
          </div>
          <button
            className="btn bloque"
            disabled={!carrito.length}
            onClick={() => {
              setCarritoAbierto(false);
              setVista('checkout');
            }}
          >
            Confirmar pedido
          </button>
        </div>
      </aside>
    </>
  );
}
