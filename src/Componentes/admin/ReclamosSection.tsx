'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import DataTable from '@/Componentes/ui/DataTable';
import Aviso from '@/Componentes/ui/Aviso';
import EstadoCarga from './EstadoCarga';
import { useCargaDatos, datosDe } from './useCargaDatos';

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
  const {
    datos: filas,
    error,
    cargando,
    recargar,
  } = useCargaDatos(() => datosDe<Reclamo>(supabase.from('reclamos').select('*').order('id', { ascending: false })));
  const [verId, setVerId] = useState<number | null>(null);
  const [buscar, setBuscar] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(false);

  const q = buscar.toLowerCase().trim();
  const filtradas = useMemo(
    () =>
      (filas || []).filter((r) => {
        if (soloPendientes && r.estado === 'atendido') return false;
        if (!q) return true;
        return [r.nombrecomplet, r.correo, r.numerodoc, r.mensaje].some((v) => (v || '').toLowerCase().includes(q));
      }),
    [filas, q, soloPendientes]
  );

  // El detalle es una pantalla, no un modal: un reclamo se lee entero, se
  // responde y se cambia de estado, y eso no cabe cómodo en una ventanita
  // que además tapa la lista. Mismo patrón que Pedidos y Clientes — toda fila
  // del panel lleva a una vista de detalle.
  const reclamo = verId === null ? null : (filas || []).find((r) => r.id === verId) || null;
  if (reclamo) {
    return (
      <ReclamoDetalle
        reclamo={reclamo}
        onVolver={() => setVerId(null)}
        onGuardado={() => {
          setVerId(null);
          recargar();
        }}
      />
    );
  }

  return (
    <>
      <h1 className="titulo">Reclamos</h1>
      <p className="sub">
        Libro de reclamaciones de la web. Toca cualquier fila para leer el reclamo completo y cambiar su estado.
      </p>
      <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} cols={5}>
        <DataTable
          entidad={['reclamo', 'reclamos']}
          encabezadoExtra={
            <div className="filtros">
              <div>
                <label className="campo-label" htmlFor="buscar-reclamo">
                  Buscar
                </label>
                <input
                  id="buscar-reclamo"
                  className="campo-ancho"
                  placeholder="Nombre, correo, documento o texto…"
                  value={buscar}
                  onChange={(e) => setBuscar(e.target.value)}
                />
              </div>
              <div>
                <label className="chk" style={{ marginBottom: 0 }}>
                  <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} /> Solo en
                  revisión
                </label>
              </div>
            </div>
          }
          columns={[
            { key: 'id', header: 'ID', sortable: true, align: 'right' },
            { key: 'fehareg', header: 'Fecha', sortable: true, render: (f) => (f.fehareg ? new Date(f.fehareg).toLocaleDateString('es-PE') : '—') },
            {
              key: 'nombrecomplet',
              header: 'Reclamante',
              sortable: true,
              render: (f) => (
                <span className="celda-principal">
                  <b>{f.nombrecomplet || 'Sin nombre'}</b>
                  <small>{f.correo || '—'}</small>
                </span>
              ),
            },
            {
              key: 'mensaje',
              header: 'Mensaje',
              render: (f) => (
                <span className="celda-corta" title={f.mensaje || ''}>
                  {f.mensaje || '—'}
                </span>
              ),
            },
            {
              key: 'estado',
              header: 'Estado',
              sortable: true,
              render: (f) =>
                f.estado === 'atendido' ? <span className="tag activo">Atendido</span> : <span className="tag canjeado">En revisión</span>,
            },
          ]}
          rows={filtradas}
          filtrosActivos={!!q || soloPendientes}
          onLimpiarFiltros={() => {
            setBuscar('');
            setSoloPendientes(false);
          }}
          vacio="Los reclamos que envíen desde el libro de reclamaciones de la web aparecerán aquí."
          onRowClick={(f) => setVerId(f.id)}
          rowClickLabel={(f) => `Ver reclamo #${f.id}`}
        />
      </EstadoCarga>
    </>
  );
}

function Dato({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <label>{label}</label>
      <p style={{ margin: 0 }}>{value}</p>
    </div>
  );
}

function ReclamoDetalle({ reclamo, onVolver, onGuardado }: { reclamo: Reclamo; onVolver: () => void; onGuardado: () => void }) {
  const [estado, setEstado] = useState(reclamo.estado || 'revision');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    const { error } = await supabase.from('reclamos').update({ estado }).eq('id', reclamo.id);
    setGuardando(false);
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    onGuardado();
  }

  return (
    <>
      <div className="barra">
        <button type="button" className="btn sec btn-sm" onClick={onVolver}>
          <ArrowLeft size={16} style={{ marginRight: '.3rem' }} /> Volver a reclamos
        </button>
        <h1 className="titulo">Reclamo #{reclamo.id}</h1>
        {reclamo.estado === 'atendido' ? <span className="tag activo">Atendido</span> : <span className="tag canjeado">En revisión</span>}
      </div>

      <Aviso mensaje={aviso} />

      <div className="card card-pad separado">
        <h3>Datos del reclamante</h3>
        <div className="perfil-grid">
          <Dato label="Fecha" value={reclamo.fehareg ? new Date(reclamo.fehareg).toLocaleString('es-PE') : ''} />
          <Dato label="Nombre completo" value={reclamo.nombrecomplet} />
          <Dato label="Tipo de documento" value={reclamo.tpodoc} />
          <Dato label="N° de documento" value={reclamo.numerodoc} />
          <Dato label="Correo" value={reclamo.correo} />
          <Dato label="Celular" value={reclamo.numcel} />
          <Dato label="Departamento" value={reclamo.departamento} />
          <Dato label="Provincia" value={reclamo.provincia} />
          <Dato label="Distrito" value={reclamo.distrito} />
          <Dato label="Dirección" value={reclamo.direccion} />
        </div>
      </div>

      <div className="card card-pad separado">
        <h3>Mensaje del reclamo</h3>
        <div className="panel" style={{ whiteSpace: 'pre-line' }}>
          {reclamo.mensaje || <span className="campo-ayuda">(sin mensaje)</span>}
        </div>
      </div>

      <div className="card card-pad">
        <h3>Estado del reclamo</h3>
        <div className="fila">
          <select
            aria-label="Estado del reclamo"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            style={{ maxWidth: 220 }}
          >
            <option value="revision">En revisión</option>
            <option value="atendido">Atendido</option>
          </select>
          {/* El botón nombra el resultado, no la mecánica: "Guardar" a secas
              no dice qué queda guardado. */}
          <button className="btn" onClick={guardar} disabled={guardando || estado === (reclamo.estado || 'revision')}>
            {guardando ? 'Guardando…' : 'Guardar estado'}
          </button>
        </div>
      </div>
    </>
  );
}
