'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';
import ConfirmDialog from '@/Componentes/ui/ConfirmDialog';

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
  const [aBorrar, setABorrar] = useState<Cargo | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

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

  async function confirmarBorrado() {
    if (!aBorrar) return;
    const { error } = await supabase.from('cargos_profesionales').delete().eq('id', aBorrar.id);
    if (error) {
      setAviso(mensajeError(error));
      setABorrar(null);
      return;
    }
    setABorrar(null);
    cargar();
  }

  return (
    <>
      <div className="barra">
        <h1 className="titulo">
          Cargos profesionales
        </h1>
        <button className="btn" onClick={() => abrir(null)}>
          + Nuevo cargo
        </button>
      </div>
      <p className="sub">
        Estos son los cargos que aparecen en el formulario de &quot;Emitir certificado directo&quot;. Solo los cargos
        activos se muestran ahí.
      </p>
      {aviso && <div className="aviso err">{aviso}</div>}
      {cargando ? (
        <p>Cargando…</p>
      ) : (
        <DataTable
          columns={[
            { key: 'nombre', header: 'Cargo' },
            {
              key: 'estado',
              header: 'Estado',
              render: (f) => (f.estado === '1' ? <span className="tag activo">Activo</span> : <span className="tag anulado">Inactivo</span>),
            },
          ]}
          rows={filas}
          vacio="Aún no hay cargos profesionales registrados."
          actions={(f) => (
            <>
              <button className="btn sec btn-sm" onClick={() => abrir(f)}>
                Editar
              </button>{' '}
              <button className="btn peligro btn-sm" onClick={() => setABorrar(f)}>
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
      <ConfirmDialog
        open={!!aBorrar}
        title={`¿Borrar el cargo "${aBorrar?.nombre}"?`}
        body="Los certificados ya emitidos con este cargo no se ven afectados."
        confirmLabel="Borrar cargo"
        onConfirm={confirmarBorrado}
        onCancel={() => setABorrar(null)}
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
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNombre(cargo?.nombre || '');
      setEstado(cargo?.estado || '1');
      setAviso(null);
    }
  }, [open, cargo]);

  async function guardar() {
    if (!nombre.trim()) {
      setAviso('Escribe el nombre del cargo.');
      return;
    }
    const row = { nombre: nombre.trim(), estado };
    const q = cargo?.id ? supabase.from('cargos_profesionales').update(row).eq('id', cargo.id) : supabase.from('cargos_profesionales').insert(row);
    const { error } = await q;
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    onGuardado();
  }

  return (
    <Modal open={open} title={cargo?.id ? 'Editar cargo' : 'Nuevo cargo'} onClose={onClose}>
      {aviso && <div className="aviso err">{aviso}</div>}
      <label>Nombre del cargo</label>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Enfermera(o)" />
      <label style={{ marginTop: '.6rem' }}>Estado</label>
      <select value={estado} onChange={(e) => setEstado(e.target.value)}>
        <option value="1">Activo</option>
        <option value="0">Inactivo</option>
      </select>
      <button className="btn bloque" onClick={guardar}>
        {cargo?.id ? 'Guardar cambios' : 'Crear cargo'}
      </button>
    </Modal>
  );
}
