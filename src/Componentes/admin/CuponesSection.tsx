'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';
import Aviso from '@/Componentes/ui/Aviso';
import EstadoCarga from './EstadoCarga';
import { useCargaDatos, datosDe } from './useCargaDatos';

interface Cupon {
  id: number;
  codigo: string | null;
  producto: string | null;
  precio: string | null;
  unidades: string | null;
  fechafin: string | null;
  estado: string | null;
}

export default function CuponesSection() {
  const {
    datos: filas,
    error,
    cargando,
    recargar,
  } = useCargaDatos(() => datosDe<Cupon>(supabase.from('cupones').select('*').order('id', { ascending: false })));
  const [editar, setEditar] = useState<Cupon | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [buscar, setBuscar] = useState('');

  function abrir(c: Cupon | null) {
    setEditar(c);
    setModalAbierto(true);
  }

  // La lista solo tenía paginación de 15 en 15: encontrar un código concreto
  // significaba pasar páginas a mano. Es una tabla que crece sin techo.
  const q = buscar.toLowerCase().trim();
  const filtradas = (filas || []).filter(
    (c) => !q || [c.codigo, c.producto].some((v) => (v || '').toLowerCase().includes(q))
  );

  return (
    <>
      <div className="cabecera-seccion">
        <h1 className="titulo">Cupones</h1>
        <button className="btn" onClick={() => abrir(null)}>
          + Nuevo cupón
        </button>
      </div>
      <p className="sub">Códigos de descuento que el cliente aplica al pagar. Solo los activos y sin vencer se aceptan.</p>
      <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} cols={7}>
        <DataTable
          entidad={['cupón', 'cupones']}
          encabezadoExtra={
            <div className="filtros">
              <div>
                <label className="campo-label" htmlFor="buscar-cupon">
                  Buscar
                </label>
                <input
                  id="buscar-cupon"
                  className="campo-ancho"
                  placeholder="Código o producto…"
                  value={buscar}
                  onChange={(e) => setBuscar(e.target.value)}
                />
              </div>
            </div>
          }
          columns={[
            { key: 'codigo', header: 'Código', sortable: true, render: (f) => <span className="codigo-fila">{f.codigo || '—'}</span> },
            { key: 'producto', header: 'Producto', sortable: true },
            { key: 'precio', header: 'Precio', align: 'right' },
            { key: 'unidades', header: 'Unidades', align: 'right' },
            { key: 'fechafin', header: 'Vence', sortable: true },
            {
              key: 'estado',
              header: 'Estado',
              sortable: true,
              render: (f) => (f.estado === '1' ? <span className="tag activo">Activo</span> : <span className="tag anulado">Inactivo</span>),
            },
          ]}
          rows={filtradas}
          filtrosActivos={!!q}
          onLimpiarFiltros={() => setBuscar('')}
          vacio="Los cupones dan un descuento al pagar. Crea el primero para poder repartirlo entre tus clientes."
          vacioAccion={
            <button className="btn btn-sm" onClick={() => abrir(null)}>
              Crear el primer cupón
            </button>
          }
          actions={(f) => (
            <button className="btn sec btn-sm" onClick={() => abrir(f)}>
              Editar
            </button>
          )}
        />
      </EstadoCarga>
      <FormCupon
        open={modalAbierto}
        cupon={editar}
        onClose={() => setModalAbierto(false)}
        onGuardado={() => {
          setModalAbierto(false);
          recargar();
        }}
      />
    </>
  );
}

function FormCupon({ open, cupon, onClose, onGuardado }: { open: boolean; cupon: Cupon | null; onClose: () => void; onGuardado: () => void }) {
  const [codigo, setCodigo] = useState('');
  const [producto, setProducto] = useState('');
  const [precio, setPrecio] = useState('');
  const [unidades, setUnidades] = useState('');
  const [fechafin, setFechafin] = useState('');
  const [estado, setEstado] = useState('1');
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setCodigo(cupon?.codigo || '');
      setProducto(cupon?.producto || '');
      setPrecio(cupon?.precio || '');
      setUnidades(cupon?.unidades || '');
      setFechafin(cupon?.fechafin || '');
      setEstado(cupon?.estado || '1');
      setAviso(null);
      setGuardando(false);
    }
  }, [open, cupon]);

  async function guardar() {
    // Sin código el cupón no se puede canjear: guardarlo vacío crea una fila
    // inservible que además no se distingue de las otras en la lista.
    if (!codigo.trim()) {
      setAviso('Escribe el código que el cliente va a ingresar al pagar.');
      return;
    }
    setGuardando(true);
    setAviso(null);
    const row = { codigo: codigo.trim(), producto: producto.trim(), precio: precio.trim(), unidades: unidades.trim(), fechafin: fechafin.trim() || null, estado };
    const q = cupon?.id ? supabase.from('cupones').update(row).eq('id', cupon.id) : supabase.from('cupones').insert(row);
    const { error } = await q;
    setGuardando(false);
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    onGuardado();
  }

  return (
    <Modal open={open} title={cupon?.id ? 'Editar cupón' : 'Nuevo cupón'} onClose={onClose}>
      <Aviso mensaje={aviso} />
      <label htmlFor="cupon-codigo">Código</label>
      <input
        id="cupon-codigo"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        placeholder="Ej: BIENVENIDA20"
        aria-invalid={!!aviso || undefined}
      />
      <span className="campo-ayuda">Es lo que el cliente escribe al pagar. Sin espacios y fácil de dictar.</span>
      <label htmlFor="cupon-producto" style={{ marginTop: '.6rem' }}>
        Producto
      </label>
      <input id="cupon-producto" value={producto} onChange={(e) => setProducto(e.target.value)} />
      <div className="fila">
        <div style={{ flex: 1 }}>
          <label htmlFor="cupon-precio">Precio</label>
          <input id="cupon-precio" value={precio} onChange={(e) => setPrecio(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="cupon-unidades">Unidades</label>
          <input id="cupon-unidades" value={unidades} onChange={(e) => setUnidades(e.target.value)} />
        </div>
      </div>
      <label htmlFor="cupon-vence" style={{ marginTop: '.6rem' }}>
        Vence
      </label>
      {/* type="date" y no texto libre: pedía "AAAA-MM-DD" a mano y cualquier
          otro formato se guardaba igual, dejando el cupón sin vencimiento
          efectivo. */}
      <input id="cupon-vence" type="date" value={fechafin} onChange={(e) => setFechafin(e.target.value)} />
      <span className="campo-ayuda">Déjalo vacío si el cupón no vence.</span>
      <label htmlFor="cupon-estado" style={{ marginTop: '.6rem' }}>
        Estado
      </label>
      <select id="cupon-estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
        <option value="1">Activo</option>
        <option value="0">Inactivo</option>
      </select>
      <button className="btn bloque" onClick={guardar} disabled={guardando}>
        {guardando ? 'Guardando…' : cupon?.id ? 'Guardar cambios' : 'Crear cupón'}
      </button>
    </Modal>
  );
}
