'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';

interface Cargo {
  id: number;
  nombre: string;
  estado: string;
}

export default function CargosSection() {
  const [filas, setFilas] = useState<Cargo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editar, setEditar] = useState<Cargo | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  async function cargar() {
    setCargando(true);
    const { data } = await supabase.from('cargos_profesionales').select('*').order('nombre');
    setFilas(data || []);
    setCargando(false);
  }
  useEffect(() => {
    cargar();
  }, []);

  function abrir(c: Cargo | null) {
    setEditar(c);
    setModalAbierto(true);
  }

  async function borrar(id: number) {
    if (!confirm('¿Borrar este cargo profesional? Los certificados ya emitidos con este cargo no se ven afectados.')) return;
    const { error } = await supabase.from('cargos_profesionales').delete().eq('id', id);
    if (error) {
      alert(error.message);
      return;
    }
    cargar();
  }

  return (
    <>
      <div className="barra">
        <h1 className="titulo" style={{ margin: 0 }}>
          Cargos profesionales
        </h1>
        <button className="btn" onClick={() => abrir(null)}>
          + Nuevo cargo
        </button>
      </div>
      <p className="sub" style={{ marginTop: 0 }}>
        Estos son los cargos que aparecen en el formulario de &quot;Emitir certificado directo&quot;. Solo los cargos
        activos se muestran ahí.
      </p>
      {cargando ? (
        <p>Cargando…</p>
      ) : (
        <DataTable
          columns={[
            { key: 'nombre', header: 'Cargo' },
            {
              key: 'estado',
              header: 'Estado',
              render: (f) => (f.estado === '1' ? <span className="tag activo">activo</span> : <span className="tag anulado">inactivo</span>),
            },
          ]}
          rows={filas}
          vacio="Aún no hay cargos profesionales registrados."
          actions={(f) => (
            <>
              <button className="btn sec btn-sm" onClick={() => abrir(f)}>
                Editar
              </button>{' '}
              <button className="btn peligro btn-sm" onClick={() => borrar(f.id)}>
                Borrar
              </button>
            </>
          )}
        />
      )}
      <FormCargo
        open={modalAbierto}
        cargo={editar}
        onClose={() => setModalAbierto(false)}
        onGuardado={() => {
          setModalAbierto(false);
          cargar();
        }}
      />
    </>
  );
}

function FormCargo({
  open,
  cargo,
  onClose,
  onGuardado,
}: {
  open: boolean;
  cargo: Cargo | null;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [estado, setEstado] = useState('1');

  useEffect(() => {
    if (open) {
      setNombre(cargo?.nombre || '');
      setEstado(cargo?.estado || '1');
    }
  }, [open, cargo]);

  async function guardar() {
    if (!nombre.trim()) {
      alert('Escribe el nombre del cargo.');
      return;
    }
    const row = { nombre: nombre.trim(), estado };
    const q = cargo?.id ? supabase.from('cargos_profesionales').update(row).eq('id', cargo.id) : supabase.from('cargos_profesionales').insert(row);
    const { error } = await q;
    if (error) {
      alert(error.message);
      return;
    }
    onGuardado();
  }

  return (
    <Modal open={open} title={cargo?.id ? 'Editar cargo' : 'Nuevo cargo'} onClose={onClose}>
      <label>Nombre del cargo</label>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Enfermera(o)" />
      <label style={{ marginTop: '.6rem' }}>Estado</label>
      <select value={estado} onChange={(e) => setEstado(e.target.value)}>
        <option value="1">Activo</option>
        <option value="0">Inactivo</option>
      </select>
      <button className="btn bloque" style={{ marginTop: '1rem' }} onClick={guardar}>
        Guardar
      </button>
    </Modal>
  );
}
