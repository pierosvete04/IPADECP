'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';
import ConfirmDialog from '@/Componentes/ui/ConfirmDialog';
import Aviso from '@/Componentes/ui/Aviso';
import EstadoCarga from './EstadoCarga';
import { useCargaDatos, datosDe } from './useCargaDatos';

interface Cargo {
  id: number;
  nombre: string;
  estado: string;
}

export default function CargosSection() {
  const {
    datos: filas,
    error,
    cargando,
    recargar,
  } = useCargaDatos(() => datosDe<Cargo>(supabase.from('cargos_profesionales').select('*').order('nombre')));
  const [editar, setEditar] = useState<Cargo | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [aBorrar, setABorrar] = useState<Cargo | null>(null);

  function abrir(c: Cargo | null) {
    setEditar(c);
    setModalAbierto(true);
  }

  // Devuelve el motivo en vez de tragárselo: ConfirmDialog lo muestra dentro
  // del propio diálogo y deja reintentar, en lugar de cerrarse como si nada
  // hubiera pasado.
  async function confirmarBorrado(): Promise<string | void> {
    if (!aBorrar) return;
    const { error: eBorrado } = await supabase.from('cargos_profesionales').delete().eq('id', aBorrar.id);
    if (eBorrado) return mensajeError(eBorrado);
    setABorrar(null);
    await recargar();
  }

  return (
    <>
      <div className="cabecera-seccion">
        <h1 className="titulo">Cargos profesionales</h1>
        <button className="btn" onClick={() => abrir(null)}>
          + Nuevo cargo
        </button>
      </div>
      <p className="sub">
        Estos son los cargos que aparecen en el formulario de &quot;Emitir certificado directo&quot;. Solo los cargos
        activos se muestran ahí.
      </p>
      <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} cols={3}>
        <DataTable
          entidad={['cargo', 'cargos']}
          columns={[
            { key: 'nombre', header: 'Cargo' },
            {
              key: 'estado',
              header: 'Estado',
              render: (f) => (f.estado === '1' ? <span className="tag activo">Activo</span> : <span className="tag anulado">Inactivo</span>),
            },
          ]}
          rows={filas || []}
          vacio="Los cargos que crees aquí aparecerán en el desplegable al emitir un certificado directo."
          vacioAccion={
            <button className="btn btn-sm" onClick={() => abrir(null)}>
              Crear el primer cargo
            </button>
          }
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
      </EstadoCarga>
      <FormCargo
        open={modalAbierto}
        cargo={editar}
        onClose={() => setModalAbierto(false)}
        onGuardado={() => {
          setModalAbierto(false);
          recargar();
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
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setNombre(cargo?.nombre || '');
      setEstado(cargo?.estado || '1');
      setAviso(null);
      setGuardando(false);
    }
  }, [open, cargo]);

  async function guardar() {
    if (!nombre.trim()) {
      setAviso('Escribe el nombre del cargo.');
      return;
    }
    setGuardando(true);
    setAviso(null);
    const row = { nombre: nombre.trim(), estado };
    const q = cargo?.id ? supabase.from('cargos_profesionales').update(row).eq('id', cargo.id) : supabase.from('cargos_profesionales').insert(row);
    const { error } = await q;
    setGuardando(false);
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    onGuardado();
  }

  return (
    <Modal open={open} title={cargo?.id ? 'Editar cargo' : 'Nuevo cargo'} onClose={onClose}>
      <Aviso mensaje={aviso} />
      <label htmlFor="cargo-nombre">Nombre del cargo</label>
      <input
        id="cargo-nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Ej: Enfermera(o)"
        aria-invalid={!!aviso || undefined}
      />
      <label htmlFor="cargo-estado" style={{ marginTop: '.6rem' }}>
        Estado
      </label>
      <select id="cargo-estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
        <option value="1">Activo</option>
        <option value="0">Inactivo</option>
      </select>
      {/* Sin `disabled` el doble clic sobre "Crear cargo" mandaba dos inserts
          y dejaba el cargo duplicado. */}
      <button className="btn bloque" onClick={guardar} disabled={guardando}>
        {guardando ? 'Guardando…' : cargo?.id ? 'Guardar cambios' : 'Crear cargo'}
      </button>
    </Modal>
  );
}
