'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatSoles, mensajeError } from '@/lib/copy';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';
import ConfirmDialog from '@/Componentes/ui/ConfirmDialog';
import Aviso from '@/Componentes/ui/Aviso';
import EstadoCarga from './EstadoCarga';
import { useCargaDatos, datosDe } from './useCargaDatos';
import type { ZonaEnvioCertificado } from '@/lib/envioCertificado';

export default function TarifasEnvioCertificadoSection() {
  const {
    datos: zonas,
    error,
    cargando,
    recargar,
  } = useCargaDatos(() => datosDe<ZonaEnvioCertificado>(supabase.from('zonas_envio_certificado').select('*').order('orden')));
  const [editar, setEditar] = useState<ZonaEnvioCertificado | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [aBorrar, setABorrar] = useState<ZonaEnvioCertificado | null>(null);

  function abrir(z: ZonaEnvioCertificado | null) {
    setEditar(z);
    setModalAbierto(true);
  }

  async function confirmarBorrado(): Promise<string | void> {
    if (!aBorrar) return;
    const { error: eBorrado } = await supabase.from('zonas_envio_certificado').delete().eq('id', aBorrar.id);
    if (eBorrado) return mensajeError(eBorrado);
    setABorrar(null);
    await recargar();
  }

  return (
    <>
      <div className="cabecera-seccion">
        <h1 className="titulo">Tarifas de envío de certificado</h1>
        <button className="btn" onClick={() => abrir(null)}>
          + Nueva zona
        </button>
      </div>
      <p className="sub">
        Zonas y costo de envío del certificado físico. La zona se elige por el departamento del alumno; la que
        queda sin departamentos asignados actúa como tarifa por defecto para cualquier departamento no listado en
        otra zona.
      </p>
      <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} cols={7}>
        <DataTable
          entidad={['zona', 'zonas']}
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
          rows={zonas || []}
          vacio="Sin zonas configuradas no se puede cobrar el envío del certificado físico. Crea al menos una que sirva de tarifa por defecto."
          vacioAccion={
            <button className="btn btn-sm" onClick={() => abrir(null)}>
              Crear la primera zona
            </button>
          }
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
      </EstadoCarga>
      <FormZona
        open={modalAbierto}
        zona={editar}
        onClose={() => setModalAbierto(false)}
        onGuardado={() => {
          setModalAbierto(false);
          recargar();
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
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setNombre(zona?.nombre || '');
      setDepartamentos((zona?.departamentos || []).join(', '));
      setCostoEnvio(zona?.costo_envio != null ? String(zona.costo_envio) : '');
      setTiempoEstimado(zona?.tiempo_estimado || '');
      setOrden(zona?.orden != null ? String(zona.orden) : '0');
      setActivo(zona?.activo ?? true);
      setAviso(null);
      setGuardando(false);
    }
  }, [open, zona]);

  async function guardar() {
    if (!nombre.trim()) {
      setAviso('Escribe el nombre de la zona.');
      return;
    }
    setGuardando(true);
    setAviso(null);
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
    setGuardando(false);
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    onGuardado();
  }

  return (
    <Modal open={open} title={zona?.id ? 'Editar zona de envío' : 'Nueva zona de envío'} onClose={onClose}>
      <Aviso mensaje={aviso} />
      <label htmlFor="zona-nombre">Nombre de la zona</label>
      <input
        id="zona-nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Ej: Lima Metropolitana y Callao"
        aria-invalid={!!aviso || undefined}
      />
      <label htmlFor="zona-deptos" style={{ marginTop: '.6rem' }}>
        Departamentos
      </label>
      <input id="zona-deptos" value={departamentos} onChange={(e) => setDepartamentos(e.target.value)} placeholder="Lima, Callao" />
      {/* La regla del "vacío = por defecto" estaba escondida dentro del
          placeholder, que desaparece en cuanto escribes la primera letra. */}
      <span className="campo-ayuda">Sepáralos por coma. Si lo dejas vacío, esta zona es la tarifa por defecto del resto del país.</span>
      <div className="perfil-grid" style={{ marginTop: '.6rem' }}>
        <div>
          <label htmlFor="zona-costo">Costo de envío (S/)</label>
          <input id="zona-costo" type="number" min={0} step="0.01" value={costoEnvio} onChange={(e) => setCostoEnvio(e.target.value)} />
        </div>
        <div>
          <label htmlFor="zona-orden">Orden</label>
          <input id="zona-orden" type="number" value={orden} onChange={(e) => setOrden(e.target.value)} />
          <span className="campo-ayuda">Menor número, primero en la lista.</span>
        </div>
      </div>
      <label htmlFor="zona-tiempo" style={{ marginTop: '.6rem' }}>
        Tiempo estimado
      </label>
      <input id="zona-tiempo" value={tiempoEstimado} onChange={(e) => setTiempoEstimado(e.target.value)} placeholder="Ej: 2-3 días hábiles" />
      <label className="chk" style={{ marginTop: '.6rem' }}>
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Zona activa
      </label>
      <button className="btn bloque" onClick={guardar} disabled={guardando}>
        {guardando ? 'Guardando…' : zona?.id ? 'Guardar cambios' : 'Crear zona'}
      </button>
    </Modal>
  );
}
