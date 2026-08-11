'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';
import ConfirmDialog from '@/Componentes/ui/ConfirmDialog';
import Aviso from '@/Componentes/ui/Aviso';
import EstadoCarga from './EstadoCarga';
import { useCargaDatos, datosDe } from './useCargaDatos';

interface Nivel {
  nivel: number;
  nombre: string | null;
  minimo: number | null;
  maximo: number | null;
}
interface Logro {
  id: number;
  icono: string | null;
  nombre: string | null;
  descripcion: string | null;
  criterio_tipo: string | null;
  criterio_valor: number | null;
  estado: string | null;
}

/**
 * Solo las REGLAS del juego: niveles y logros. El ranking de alumnos con sus
 * puntos vivía acá y se movió al detalle de cada cliente (ClienteDetalle):
 * los puntos son un dato de la persona, y tener una segunda lista de clientes
 * en esta pantalla obligaba a buscar al mismo cliente en dos lugares para
 * hacer una cosa sola.
 */
export default function GamificacionSection() {
  return (
    <>
      <h1 className="titulo">Gamificación</h1>
      <p className="sub">
        Reglas del sistema de puntos. Los puntos y la racha de cada persona, junto con el botón para ajustarlos, están en
        su ficha dentro de <strong>Clientes</strong>.
      </p>
      <NivelesPanel />
      <LogrosPanel />
    </>
  );
}

function NivelesPanel() {
  const {
    datos: niveles,
    error,
    cargando,
    recargar,
  } = useCargaDatos(() => datosDe<Nivel>(supabase.from('niveles_gamificacion').select('*').order('nivel')));
  const [editar, setEditar] = useState<Nivel | null | undefined>(undefined);

  return (
    <>
      <div className="cabecera-seccion" style={{ marginTop: '1.8rem' }}>
        <h2 className="titulo-seccion">Niveles</h2>
        <button className="btn" onClick={() => setEditar(null)}>
          + Nuevo nivel
        </button>
      </div>
      <p className="sub">Definen en qué nivel cae un alumno según sus puntos. Se usan en el aula virtual (Inicio → Tu progreso).</p>
      <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} cols={5}>
        <DataTable
          entidad={['nivel', 'niveles']}
          columns={[
            { key: 'nivel', header: 'Nivel', align: 'right' },
            { key: 'nombre', header: 'Nombre' },
            { key: 'minimo', header: 'Puntos mínimos', align: 'right' },
            { key: 'maximo', header: 'Puntos máximos', align: 'right' },
          ]}
          rows={(niveles || []).map((n) => ({ ...n, id: n.nivel }))}
          vacio="Sin niveles, el aula no puede mostrarle a nadie su progreso. Crea al menos uno."
          vacioAccion={
            <button className="btn btn-sm" onClick={() => setEditar(null)}>
              Crear el primer nivel
            </button>
          }
          actions={(f) => (
            <button className="btn sec btn-sm" onClick={() => setEditar(f)}>
              Editar
            </button>
          )}
        />
      </EstadoCarga>
      {editar !== undefined && (
        <Modal open title={editar?.nivel ? 'Editar nivel' : 'Nuevo nivel'} onClose={() => setEditar(undefined)}>
          <FormNivel
            nivel={editar}
            onGuardado={() => {
              setEditar(undefined);
              recargar();
            }}
          />
        </Modal>
      )}
    </>
  );
}

function FormNivel({ nivel, onGuardado }: { nivel: Nivel | null; onGuardado: () => void }) {
  const [num, setNum] = useState(nivel?.nivel ? String(nivel.nivel) : '');
  const [nombre, setNombre] = useState(nivel?.nombre || '');
  const [minimo, setMinimo] = useState(nivel?.minimo != null ? String(nivel.minimo) : '');
  const [maximo, setMaximo] = useState(nivel?.maximo != null ? String(nivel.maximo) : '');
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const numNivel = nivel?.nivel || parseInt(num, 10);
    if (!numNivel) {
      setAviso('Indica el número de nivel.');
      return;
    }
    // Un rango invertido deja un tramo de puntos sin nivel asignado y el aula
    // muestra "sin nivel" a alumnos que sí tienen puntos.
    const min = parseInt(minimo, 10) || 0;
    const max = parseInt(maximo, 10) || 0;
    if (max && max < min) {
      setAviso('Los puntos máximos no pueden ser menores que los mínimos.');
      return;
    }
    setGuardando(true);
    setAviso(null);
    const row = { nivel: numNivel, nombre: nombre.trim(), minimo: min, maximo: max };
    const q = nivel?.nivel ? supabase.from('niveles_gamificacion').update(row).eq('nivel', nivel.nivel) : supabase.from('niveles_gamificacion').insert(row);
    const { error } = await q;
    setGuardando(false);
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    onGuardado();
  }

  return (
    <>
      <Aviso mensaje={aviso} />
      <label htmlFor="nivel-num">Número de nivel</label>
      <input id="nivel-num" type="number" min={1} value={num} disabled={!!nivel?.nivel} onChange={(e) => setNum(e.target.value)} />
      {!!nivel?.nivel && <span className="campo-ayuda">El número identifica al nivel y no se puede cambiar.</span>}
      <label htmlFor="nivel-nombre" style={{ marginTop: '.6rem' }}>
        Nombre
      </label>
      <input id="nivel-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Aprendiz" />
      <div className="fila">
        <div style={{ flex: 1 }}>
          <label htmlFor="nivel-min">Puntos mínimos</label>
          <input id="nivel-min" type="number" min={0} value={minimo} onChange={(e) => setMinimo(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="nivel-max">Puntos máximos</label>
          <input id="nivel-max" type="number" min={0} value={maximo} onChange={(e) => setMaximo(e.target.value)} />
        </div>
      </div>
      <button className="btn bloque" onClick={guardar} disabled={guardando}>
        {guardando ? 'Guardando…' : nivel?.nivel ? 'Guardar cambios' : 'Crear nivel'}
      </button>
    </>
  );
}

function LogrosPanel() {
  const {
    datos: logros,
    error,
    cargando,
    recargar,
  } = useCargaDatos(() => datosDe<Logro>(supabase.from('logros').select('*').order('id')));
  const [editar, setEditar] = useState<Logro | null | undefined>(undefined);
  const [aBorrar, setABorrar] = useState<Logro | null>(null);

  async function confirmarBorrado(): Promise<string | void> {
    if (!aBorrar) return;
    const { error: eBorrado } = await supabase.from('logros').delete().eq('id', aBorrar.id);
    if (eBorrado) return mensajeError(eBorrado);
    setABorrar(null);
    await recargar();
  }

  // Los plurales se resuelven con el número real en vez de "día(s)": el
  // paréntesis es un parche de plantilla, no español.
  function criterioTxt(f: Logro) {
    const n = f.criterio_valor ?? 0;
    if (f.criterio_tipo === 'manual') return 'Manual';
    if (f.criterio_tipo === 'puntos_minimos') return `${n} puntos mínimos`;
    if (f.criterio_tipo === 'racha_dias') return n === 1 ? '1 día de racha' : `${n} días de racha seguidos`;
    return n === 1 ? '1 curso completado' : `${n} cursos completados`;
  }

  return (
    <>
      <div className="cabecera-seccion" style={{ marginTop: '1.8rem' }}>
        <h2 className="titulo-seccion">Logros / insignias</h2>
        <button className="btn" onClick={() => setEditar(null)}>
          + Nuevo logro
        </button>
      </div>
      <p className="sub">Se desbloquean automáticamente (por puntos o cursos completados) o las otorgas tú manualmente. El alumno los ve en &quot;Mi perfil&quot;.</p>
      <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} cols={5}>
      <DataTable
        entidad={['logro', 'logros']}
        columns={[
          { key: 'icono', header: '', render: (f) => <span style={{ fontSize: '1.3rem' }}>{f.icono}</span> },
          { key: 'nombre', header: 'Nombre', sortable: true },
          { key: 'criterio', header: 'Criterio', render: criterioTxt },
          {
            key: 'estado',
            header: 'Estado',
            render: (f) => (f.estado === '1' ? <span className="tag activo">Activo</span> : <span className="tag anulado">Inactivo</span>),
          },
        ]}
        rows={logros || []}
        vacio="Los logros son insignias que el alumno ve en su perfil. Crea el primero para empezar a premiar avances."
        vacioAccion={
          <button className="btn btn-sm" onClick={() => setEditar(null)}>
            Crear el primer logro
          </button>
        }
        actions={(f) => (
          <>
            <button className="btn sec btn-sm" onClick={() => setEditar(f)}>
              Editar
            </button>{' '}
            <button className="btn peligro btn-sm" onClick={() => setABorrar(f)}>
              Borrar
            </button>
          </>
        )}
      />
      </EstadoCarga>
      {editar !== undefined && (
        <Modal open title={editar?.id ? 'Editar logro' : 'Nuevo logro'} onClose={() => setEditar(undefined)}>
          <FormLogro
            logro={editar}
            onGuardado={() => {
              setEditar(undefined);
              recargar();
            }}
          />
        </Modal>
      )}
      <ConfirmDialog
        open={!!aBorrar}
        title={`¿Borrar el logro "${aBorrar?.nombre}"?`}
        body="Los alumnos que ya lo desbloquearon lo perderán."
        confirmLabel="Borrar logro"
        onConfirm={confirmarBorrado}
        onCancel={() => setABorrar(null)}
      />
    </>
  );
}

function FormLogro({ logro, onGuardado }: { logro: Logro | null; onGuardado: () => void }) {
  const [icono, setIcono] = useState(logro?.icono || '🏅');
  const [nombre, setNombre] = useState(logro?.nombre || '');
  const [descripcion, setDescripcion] = useState(logro?.descripcion || '');
  const [criterioTipo, setCriterioTipo] = useState(logro?.criterio_tipo || 'manual');
  const [criterioValor, setCriterioValor] = useState(logro?.criterio_valor != null ? String(logro.criterio_valor) : '');
  const [estado, setEstado] = useState(logro?.estado !== '0' ? '1' : '0');
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const esManual = criterioTipo === 'manual';

  async function guardar() {
    if (!nombre.trim()) {
      setAviso('Escribe el nombre del logro.');
      return;
    }
    // Un logro automático sin valor nunca se desbloquea: se queda configurado
    // pero inerte, y desde la lista parece que funciona.
    if (!esManual && !(parseInt(criterioValor, 10) > 0)) {
      setAviso('Los logros automáticos necesitan un valor mayor que cero para poder desbloquearse.');
      return;
    }
    setGuardando(true);
    setAviso(null);
    const row = {
      icono: icono.trim() || '🏅',
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      criterio_tipo: criterioTipo,
      criterio_valor: esManual ? null : parseInt(criterioValor, 10) || null,
      estado,
    };
    const q = logro?.id ? supabase.from('logros').update(row).eq('id', logro.id) : supabase.from('logros').insert(row);
    const { error } = await q;
    setGuardando(false);
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    onGuardado();
  }

  return (
    <>
      <Aviso mensaje={aviso} />
      <div className="fila">
        <div style={{ flex: 1 }}>
          <label htmlFor="logro-icono">Ícono (emoji)</label>
          <input id="logro-icono" value={icono} onChange={(e) => setIcono(e.target.value)} />
        </div>
        <div style={{ flex: 2 }}>
          <label htmlFor="logro-nombre">Nombre</label>
          <input id="logro-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} aria-invalid={!!aviso || undefined} />
        </div>
      </div>
      <label htmlFor="logro-desc" style={{ marginTop: '.6rem' }}>
        Descripción
      </label>
      <textarea id="logro-desc" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      <label htmlFor="logro-criterio" style={{ marginTop: '.6rem' }}>
        Criterio
      </label>
      <select id="logro-criterio" value={criterioTipo} onChange={(e) => setCriterioTipo(e.target.value)}>
        <option value="manual">Manual (lo otorgas tú a mano)</option>
        <option value="puntos_minimos">Puntos mínimos (automático)</option>
        <option value="cursos_completados">Cursos completados (automático)</option>
        <option value="racha_dias">Racha de días seguidos (automático)</option>
      </select>
      {/* El campo se deshabilita cuando el criterio es manual en vez de
          explicarlo dentro del placeholder, que desaparece al escribir. */}
      <label htmlFor="logro-valor" style={{ marginTop: '.6rem' }}>
        Valor del criterio
      </label>
      <input
        id="logro-valor"
        type="number"
        min={1}
        disabled={esManual}
        value={esManual ? '' : criterioValor}
        onChange={(e) => setCriterioValor(e.target.value)}
        placeholder={criterioTipo === 'racha_dias' ? 'Ej. 10' : 'Ej. 500'}
      />
      <span className="campo-ayuda">
        {esManual
          ? 'Los logros manuales no usan valor: se los das tú desde la ficha del cliente.'
          : criterioTipo === 'racha_dias'
            ? 'Días seguidos entrando al aula.'
            : criterioTipo === 'puntos_minimos'
              ? 'Puntos acumulados a partir de los cuales se desbloquea.'
              : 'Cursos que debe terminar para desbloquearlo.'}
      </span>
      <label htmlFor="logro-estado" style={{ marginTop: '.6rem' }}>
        Estado
      </label>
      <select id="logro-estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
        <option value="1">Activo</option>
        <option value="0">Inactivo</option>
      </select>
      <button className="btn bloque" onClick={guardar} disabled={guardando}>
        {guardando ? 'Guardando…' : logro?.id ? 'Guardar cambios' : 'Crear logro'}
      </button>
    </>
  );
}
