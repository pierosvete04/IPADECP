'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';
import Aviso from '@/Componentes/ui/Aviso';
import EstadoCarga from './EstadoCarga';
import { useCargaDatos, datosDe } from './useCargaDatos';

interface Periodo {
  id: number;
  nombre: string;
  fecha_inicio: string;
  fecha_entrega: string;
  fecha_cierre: string;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function nombrePeriodoSugerido(mesInicio: string): string {
  if (!mesInicio) return '';
  const [anioStr, mesStr] = mesInicio.split('-');
  const anio = parseInt(anioStr, 10);
  const mesIdx = parseInt(mesStr, 10) - 1;
  const finIdx = (mesIdx + 5) % 12;
  const anioFin = anio + Math.floor((mesIdx + 5) / 12);
  const inicioCap = MESES[mesIdx][0].toUpperCase() + MESES[mesIdx].slice(1);
  const finCap = MESES[finIdx][0].toUpperCase() + MESES[finIdx].slice(1);
  return anio === anioFin ? `${inicioCap} - ${finCap} ${anio}` : `${inicioCap} ${anio} - ${finCap} ${anioFin}`;
}

function siguienteMesInicio(periodos: Periodo[]): string {
  const hoy = new Date();
  if (!periodos.length) {
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  }
  const ultimoCierre = periodos.reduce((max, p) => (p.fecha_cierre > max ? p.fecha_cierre : max), periodos[0].fecha_cierre);
  const d = new Date(ultimoCierre + 'T00:00:00');
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function PeriodosCertificacionSection() {
  const {
    datos: periodos,
    error,
    cargando,
    recargar: cargarPeriodos,
  } = useCargaDatos(() =>
    datosDe<Periodo>(supabase.from('periodos_certificacion').select('*').order('fecha_inicio', { ascending: false }))
  );
  const [modalAbierto, setModalAbierto] = useState(false);

  return (
    <>
      <h1 className="titulo">Períodos de certificación</h1>
      <p className="sub">
        Bloques de 6 meses usados para emitir certificados directos. Cada período calcula automáticamente sus fechas de
        inicio, entrega y cierre, saltando fines de semana y feriados.
      </p>

      <div className="cabecera-seccion" style={{ marginTop: '1.4rem' }}>
        <h2 className="titulo-seccion">Períodos</h2>
        <button className="btn sec" onClick={() => setModalAbierto(true)}>
          + Generar período
        </button>
      </div>
      <EstadoCarga cargando={cargando} error={error} onReintentar={cargarPeriodos} cols={4}>
        <DataTable
          entidad={['período', 'períodos']}
          columns={[
            { key: 'nombre', header: 'Período', sortable: true },
            { key: 'fecha_inicio', header: 'Inicio', sortable: true, render: (f) => new Date(f.fecha_inicio + 'T00:00:00').toLocaleDateString('es-PE') },
            { key: 'fecha_entrega', header: 'Entrega', render: (f) => new Date(f.fecha_entrega + 'T00:00:00').toLocaleDateString('es-PE') },
            { key: 'fecha_cierre', header: 'Cierre', render: (f) => new Date(f.fecha_cierre + 'T00:00:00').toLocaleDateString('es-PE') },
          ]}
          rows={periodos || []}
          vacio="Sin al menos un período no se pueden emitir certificados directos: es lo que define el rango de fechas válido."
          vacioAccion={
            <button className="btn btn-sm" onClick={() => setModalAbierto(true)}>
              Generar el primer período
            </button>
          }
        />
      </EstadoCarga>

      <ModalPeriodo
        open={modalAbierto}
        sugerido={siguienteMesInicio(periodos || [])}
        onClose={() => setModalAbierto(false)}
        onGenerado={() => {
          setModalAbierto(false);
          cargarPeriodos();
        }}
      />
    </>
  );
}

function ModalPeriodo({
  open,
  sugerido,
  onClose,
  onGenerado,
}: {
  open: boolean;
  sugerido: string;
  onClose: () => void;
  onGenerado: () => void;
}) {
  const [mesInicio, setMesInicio] = useState(sugerido);
  const [nombre, setNombre] = useState('');
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    if (open) {
      setMesInicio(sugerido);
      setNombre(nombrePeriodoSugerido(sugerido));
      setAviso(null);
    }
  }, [open, sugerido]);

  async function generar() {
    setGenerando(true);
    setAviso(null);
    const { error } = await supabase.rpc('admin_generar_periodo', {
      p_nombre: nombre.trim() || nombrePeriodoSugerido(mesInicio),
      p_mes_inicio: `${mesInicio}-01`,
    });
    setGenerando(false);
    if (error) {
      setAviso({ texto: mensajeError(error), tipo: 'err' });
      return;
    }
    onGenerado();
  }

  return (
    <Modal open={open} title="Generar período de certificación" onClose={onClose}>
      <p className="sub" style={{ marginTop: 0 }}>
        Se calculan automáticamente las 3 fechas (inicio, entrega y cierre) del bloque de 6 meses, saltando fines de
        semana y feriados.
      </p>
      <Aviso tipo={aviso?.tipo ?? 'err'} mensaje={aviso?.texto} />
      <label htmlFor="periodo-mes">Mes de inicio</label>
      <input
        id="periodo-mes"
        type="month"
        value={mesInicio}
        onChange={(e) => {
          setMesInicio(e.target.value);
          setNombre(nombrePeriodoSugerido(e.target.value));
        }}
      />
      <label htmlFor="periodo-nombre" style={{ marginTop: '.6rem' }}>
        Nombre del período
      </label>
      <input id="periodo-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <span className="campo-ayuda">Se sugiere solo a partir del mes de inicio. Es lo que verás al emitir un certificado.</span>
      <button className="btn bloque" onClick={generar} disabled={generando || !mesInicio}>
        {generando ? 'Generando…' : 'Generar período'}
      </button>
    </Modal>
  );
}
