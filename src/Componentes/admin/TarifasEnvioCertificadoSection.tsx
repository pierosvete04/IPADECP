'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatSoles, mensajeError } from '@/lib/copy';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';
import ConfirmDialog from '@/Componentes/ui/ConfirmDialog';
import type { ZonaEnvioCertificado } from '@/lib/envioCertificado';

export default function TarifasEnvioCertificadoSection() {
  const [zonas, setZonas] = useState<ZonaEnvioCertificado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editar, setEditar] = useState<ZonaEnvioCertificado | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [aBorrar, setABorrar] = useState<ZonaEnvioCertificado | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    const { data } = await supabase.from('zonas_envio_certificado').select('*').order('orden');
    setZonas((data as ZonaEnvioCertificado[]) || []);
    setCargando(false);
  }
  useEffect(() => {
    cargar();
  }, []);

  function abrir(z: ZonaEnvioCertificado | null) {
    setEditar(z);
    setModalAbierto(true);
  }

  async function confirmarBorrado() {
    if (!aBorrar) return;
    const { error } = await supabase.from('zonas_envio_certificado').delete().eq('id', aBorrar.id);
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
          Tarifas de envío de certificado
        </h1>
        <button className="btn" onClick={() => abrir(null)}>
          + Nueva zona
        </button>
      </div>
      <p className="sub">
        Zonas y costo de envío del certificado físico. La zona se elige por el departamento del alumno; la que
        queda sin departamentos asignados actúa como tarifa por defecto para cualquier departamento no listado en
        otra zona.
      </p>
      {aviso && <div className="aviso err">{aviso}</div>}
      {cargando ? (
        <p>Cargando…</p>
      ) : (
        <DataTable
          columns={[
            { key: 'orden', header: 'Orden', sortable: true },
            { key: 'nombre', header: 'Zona', sortable: true },
            {
              key: 'departamentos',
              header: 'Departamentos',
              render: (z) => (z.departamentos.length ? z.departamentos.join(', ') : <span className="meta">(por defecto)</span>),
            },
            { key: 'costo_envio', header: 'Costo', align: 'right', sortable: true, render: (z) => formatSoles(z.costo_envio) },
            { key: 'tiempo_estimado', header: 'Tiempo estimado', render: (z) => z.tiempo_estimado || '—' },
            {
              key: 'activo',
              header: 'Estado',
              render: (z) => (z.activo ? <span className="tag activo">Activa</span> : <span className="tag anulado">Inactiva</span>),
            },
          ]}
          rows={zonas}
          vacio="Aún no hay zonas de envío configuradas."
          actions={(z) => (
            <>
              <button className="btn sec btn-sm" onClick={() => abrir(z)}>
                Editar
              </button>{' '}
              <button className="btn peligro btn-sm" onClick={() => setABorrar(z)}>
                Borrar
              </button>
            </>
          )}
        />
      )}
      <FormZona
        open={modalAbierto}
        zona={editar}
        onClose={() => setModalAbierto(false)}
        onGuardado={() => {
          setModalAbierto(false);
          cargar();
        }}
      />
      <ConfirmDialog
        open={!!aBorrar}
        title={`¿Borrar la zona "${aBorrar?.nombre}"?`}
        body="Los pedidos de envío ya creados con esta zona conservan su costo, pero no podrás volver a elegirla."
        confirmLabel="Borrar zona"
        onConfirm={confirmarBorrado}
        onCancel={() => setABorrar(null)}
      />
    </>
  );
}

function FormZona({
  open,
  zona,
  onClose,
  onGuardado,
}: {
  open: boolean;
  zona: ZonaEnvioCertificado | null;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [departamentos, setDepartamentos] = useState('');
  const [costoEnvio, setCostoEnvio] = useState('');
  const [tiempoEstimado, setTiempoEstimado] = useState('');
  const [orden, setOrden] = useState('0');
  const [activo, setActivo] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNombre(zona?.nombre || '');
      setDepartamentos((zona?.departamentos || []).join(', '));
      setCostoEnvio(zona?.costo_envio != null ? String(zona.costo_envio) : '');
      setTiempoEstimado(zona?.tiempo_estimado || '');
      setOrden(zona?.orden != null ? String(zona.orden) : '0');
      setActivo(zona?.activo ?? true);
      setAviso(null);
    }
  }, [open, zona]);

  async function guardar() {
    if (!nombre.trim()) {
      setAviso('Escribe el nombre de la zona.');
      return;
    }
    const row = {
      nombre: nombre.trim(),
      departamentos: departamentos
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean),
      costo_envio: Number(costoEnvio) || 0,
      tiempo_estimado: tiempoEstimado.trim() || null,
      orden: Number(orden) || 0,
      activo,
    };
    const q = zona?.id
      ? supabase.from('zonas_envio_certificado').update(row).eq('id', zona.id)
      : supabase.from('zonas_envio_certificado').insert(row);
    const { error } = await q;
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    onGuardado();
  }

  return (
    <Modal open={open} title={zona?.id ? 'Editar zona de envío' : 'Nueva zona de envío'} onClose={onClose}>
      {aviso && <div className="aviso err">{aviso}</div>}
      <label>Nombre de la zona</label>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Lima Metropolitana y Callao" />
      <label style={{ marginTop: '.6rem' }}>Departamentos (separados por coma)</label>
      <input
        value={departamentos}
        onChange={(e) => setDepartamentos(e.target.value)}
        placeholder="Lima, Callao — vacío = tarifa por defecto"
      />
      <div className="perfil-grid" style={{ marginTop: '.6rem' }}>
        <div>
          <label>Costo de envío (S/)</label>
          <input type="number" step="0.01" value={costoEnvio} onChange={(e) => setCostoEnvio(e.target.value)} />
        </div>
        <div>
          <label>Orden</label>
          <input type="number" value={orden} onChange={(e) => setOrden(e.target.value)} />
        </div>
      </div>
      <label style={{ marginTop: '.6rem' }}>Tiempo estimado</label>
      <input value={tiempoEstimado} onChange={(e) => setTiempoEstimado(e.target.value)} placeholder="Ej: 2-3 días hábiles" />
      <label style={{ marginTop: '.6rem' }}>
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} style={{ width: 'auto', marginRight: '.4rem' }} />
        Zona activa
      </label>
      <button className="btn bloque" onClick={guardar}>
        {zona?.id ? 'Guardar cambios' : 'Crear zona'}
      </button>
    </Modal>
  );
}
