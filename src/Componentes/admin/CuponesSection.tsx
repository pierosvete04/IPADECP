'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';

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
  const [filas, setFilas] = useState<Cupon[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editar, setEditar] = useState<Cupon | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  async function cargar() {
    setCargando(true);
    const { data } = await supabase.from('cupones').select('*').order('id', { ascending: false });
    setFilas(data || []);
    setCargando(false);
  }
  useEffect(() => {
    cargar();
  }, []);

  return (
    <>
      <div className="barra">
        <h1 className="titulo">
          Cupones
        </h1>
        <button
          className="btn"
          onClick={() => {
            setEditar(null);
            setModalAbierto(true);
          }}
        >
          + Nuevo cupón
        </button>
      </div>
      {cargando ? (
        <p>Cargando…</p>
      ) : (
        <DataTable
          columns={[
            { key: 'codigo', header: 'Código' },
            { key: 'producto', header: 'Producto' },
            { key: 'precio', header: 'Precio' },
            { key: 'unidades', header: 'Unidades' },
            { key: 'fechafin', header: 'Vence' },
            {
              key: 'estado',
              header: 'Estado',
              render: (f) => (f.estado === '1' ? <span className="tag activo">Activo</span> : <span className="tag anulado">Inactivo</span>),
            },
          ]}
          rows={filas}
          vacio="Aún no hay cupones registrados."
          actions={(f) => (
            <button
              className="btn sec btn-sm"
              onClick={() => {
                setEditar(f);
                setModalAbierto(true);
              }}
            >
              Editar
            </button>
          )}
        />
      )}
      <FormCupon
        open={modalAbierto}
        cupon={editar}
        onClose={() => setModalAbierto(false)}
        onGuardado={() => {
          setModalAbierto(false);
          cargar();
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

  useEffect(() => {
    if (open) {
      setCodigo(cupon?.codigo || '');
      setProducto(cupon?.producto || '');
      setPrecio(cupon?.precio || '');
      setUnidades(cupon?.unidades || '');
      setFechafin(cupon?.fechafin || '');
      setEstado(cupon?.estado || '1');
      setAviso(null);
    }
  }, [open, cupon]);

  async function guardar() {
    const row = { codigo: codigo.trim(), producto: producto.trim(), precio: precio.trim(), unidades: unidades.trim(), fechafin: fechafin.trim() || null, estado };
    const q = cupon?.id ? supabase.from('cupones').update(row).eq('id', cupon.id) : supabase.from('cupones').insert(row);
    const { error } = await q;
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    onGuardado();
  }

  return (
    <Modal open={open} title={cupon?.id ? 'Editar cupón' : 'Nuevo cupón'} onClose={onClose}>
      {aviso && <div className="aviso err">{aviso}</div>}
      <label>Código</label>
      <input value={codigo} onChange={(e) => setCodigo(e.target.value)} />
      <label>Producto</label>
      <input value={producto} onChange={(e) => setProducto(e.target.value)} />
      <div className="fila">
        <div style={{ flex: 1 }}>
          <label>Precio</label>
          <input value={precio} onChange={(e) => setPrecio(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label>Unidades</label>
          <input value={unidades} onChange={(e) => setUnidades(e.target.value)} />
        </div>
      </div>
      <label>Vence</label>
      <input value={fechafin} onChange={(e) => setFechafin(e.target.value)} placeholder="AAAA-MM-DD" />
      <label>Estado</label>
      <select value={estado} onChange={(e) => setEstado(e.target.value)}>
        <option value="1">Activo</option>
        <option value="0">Inactivo</option>
      </select>
      <button className="btn bloque" onClick={guardar}>
        {cupon?.id ? 'Guardar cambios' : 'Crear cupón'}
      </button>
    </Modal>
  );
}
