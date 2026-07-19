'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';

interface Reclamo {
  id: number;
  fehareg: string | null;
  nombrecomplet: string | null;
  correo: string | null;
  numcel: string | null;
  tpodoc: string | null;
  numerodoc: string | null;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
  direccion: string | null;
  mensaje: string | null;
  estado: string | null;
}

export default function ReclamosSection() {
  const [filas, setFilas] = useState<Reclamo[] | null>(null);
  const [ver, setVer] = useState<Reclamo | null>(null);

  async function cargar() {
    const { data } = await supabase.from('reclamos').select('*').order('id', { ascending: false });
    setFilas(data || []);
  }
  useEffect(() => {
    cargar();
  }, []);

  return (
    <>
      <h1 className="titulo">Libro de reclamaciones</h1>
      <p className="sub">Haz clic en &quot;Ver&quot; para leer el reclamo completo.</p>
      {filas === null ? (
        <p>Cargando…</p>
      ) : (
        <DataTable
          contador={`${filas.length} reclamo(s)`}
          columns={[
            { key: 'id', header: 'ID', sortable: true },
            { key: 'fehareg', header: 'Fecha', sortable: true, render: (f) => (f.fehareg ? new Date(f.fehareg).toLocaleDateString('es-PE') : '') },
            { key: 'nombrecomplet', header: 'Nombre', sortable: true },
            { key: 'correo', header: 'Correo', sortable: true },
            {
              key: 'mensaje',
              header: 'Mensaje',
              render: (f) => (f.mensaje || '').slice(0, 50) + ((f.mensaje || '').length > 50 ? '…' : ''),
            },
            { key: 'estado', header: 'Estado', sortable: true, render: (f) => <span className="tag canjeado">{f.estado}</span> },
          ]}
          rows={filas}
          actions={(f) => (
            <button className="btn sec btn-sm" onClick={() => setVer(f)}>
              Ver
            </button>
          )}
        />
      )}
      {ver && (
        <VerReclamoModal
          reclamo={ver}
          onClose={() => setVer(null)}
          onGuardado={() => {
            setVer(null);
            cargar();
          }}
        />
      )}
    </>
  );
}

function Fila({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: '.45rem' }}>
      <strong>{label}:</strong> {value}
    </div>
  );
}

function VerReclamoModal({ reclamo, onClose, onGuardado }: { reclamo: Reclamo; onClose: () => void; onGuardado: () => void }) {
  const [estado, setEstado] = useState(reclamo.estado || 'revision');

  async function guardar() {
    const { error } = await supabase.from('reclamos').update({ estado }).eq('id', reclamo.id);
    if (error) {
      alert(error.message);
      return;
    }
    onGuardado();
  }

  return (
    <Modal open title={`Reclamo #${reclamo.id}`} onClose={onClose}>
      <Fila label="Fecha" value={reclamo.fehareg ? new Date(reclamo.fehareg).toLocaleString('es-PE') : ''} />
      <Fila label="Nombre completo" value={reclamo.nombrecomplet} />
      <Fila label="Tipo de documento" value={reclamo.tpodoc} />
      <Fila label="N° de documento" value={reclamo.numerodoc} />
      <Fila label="Correo" value={reclamo.correo} />
      <Fila label="Celular" value={reclamo.numcel} />
      <Fila label="Departamento" value={reclamo.departamento} />
      <Fila label="Provincia" value={reclamo.provincia} />
      <Fila label="Distrito" value={reclamo.distrito} />
      <Fila label="Dirección" value={reclamo.direccion} />
      <hr />
      <strong>Mensaje / reclamo:</strong>
      <div className="card card-pad" style={{ marginTop: '.5rem', whiteSpace: 'pre-line' }}>
        {reclamo.mensaje || <span className="meta" style={{ color: 'var(--gris)' }}>(sin mensaje)</span>}
      </div>
      <hr />
      <label>Estado del reclamo</label>
      <div className="fila">
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="revision">En revisión</option>
          <option value="atendido">Atendido</option>
        </select>
        <button className="btn" onClick={guardar}>
          Guardar
        </button>
      </div>
    </Modal>
  );
}
