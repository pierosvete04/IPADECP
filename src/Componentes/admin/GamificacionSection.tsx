'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';
import ConfirmDialog from '@/Componentes/ui/ConfirmDialog';

interface Alumno {
  id: string;
  nombre: string | null;
  email: string | null;
  puntos: number | null;
  racha_dias: number | null;
}
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

export default function GamificacionSection() {
  return (
    <>
      <h1 className="titulo">Gamificación</h1>
      <RankingPanel />
      <NivelesPanel />
      <LogrosPanel />
    </>
  );
}

function RankingPanel() {
  const [todos, setTodos] = useState<Alumno[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [ajustar, setAjustar] = useState<Alumno | null>(null);

  async function cargar() {
    const { data } = await supabase.from('perfiles').select('id,nombre,email,puntos,racha_dias').eq('rol', 'alumno').order('puntos', { ascending: false });
    setTodos(data || []);
  }
  useEffect(() => {
    cargar();
  }, []);

  const q = busqueda.toLowerCase().trim();
  const filtrado = q ? todos.filter((a) => (a.nombre || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q)) : todos;

  return (
    <>
      <div className="barra">
        <h2 className="titulo" style={{ fontSize: '1.1rem' }}>
          Ranking y puntos de alumnos
        </h2>
      </div>
      <div className="fila" style={{ marginBottom: '.8rem' }}>
        <input placeholder="Buscar alumno por nombre o correo…" style={{ minWidth: 280 }} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>
      <DataTable
        columns={[
          { key: 'pos', header: '#', render: (f) => String(filtrado.indexOf(f) + 1) },
          { key: 'nombre', header: 'Alumno', render: (f) => f.nombre || f.email },
          { key: 'email', header: 'Correo' },
          { key: 'puntos', header: 'Puntos' },
          { key: 'racha_dias', header: 'Racha', render: (f) => `${f.racha_dias || 0} día(s)` },
        ]}
        rows={filtrado}
        vacio="Sin alumnos."
        actions={(f) => (
          <button className="btn sec btn-sm" onClick={() => setAjustar(f)}>
            Ajustar puntos
          </button>
        )}
      />
      {ajustar && (
        <Modal open title={`Ajustar puntos — ${ajustar.nombre || ajustar.email}`} onClose={() => setAjustar(null)}>
          <AjustarPuntosForm
            alumno={ajustar}
            onGuardado={() => {
              setAjustar(null);
              cargar();
            }}
          />
        </Modal>
      )}
    </>
  );
}

function AjustarPuntosForm({ alumno, onGuardado }: { alumno: Alumno; onGuardado: () => void }) {
  const [delta, setDelta] = useState(0);
  const [motivo, setMotivo] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);

  async function aplicar() {
    if (!delta) {
      onGuardado();
      return;
    }
    const { error } = await supabase.rpc('admin_ajustar_puntos', { p_alumno: alumno.id, p_delta: delta, p_motivo: motivo.trim() });
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    onGuardado();
  }

  return (
    <>
      {aviso && <div className="aviso err">{aviso}</div>}
      <p className="sub" style={{ marginTop: 0 }}>
        Puntos actuales: <strong>{alumno.puntos || 0}</strong>
      </p>
      <label>Cantidad (usa negativo para restar)</label>
      <input type="number" value={delta} onChange={(e) => setDelta(parseInt(e.target.value, 10) || 0)} />
      <label>Motivo</label>
      <input placeholder="Ej. premio por concurso, corrección de error…" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      <button className="btn bloque" onClick={aplicar}>
        Aplicar
      </button>
    </>
  );
}

function NivelesPanel() {
  const [niveles, setNiveles] = useState<Nivel[]>([]);
  const [editar, setEditar] = useState<Nivel | null | undefined>(undefined);

  async function cargar() {
    const { data } = await supabase.from('niveles_gamificacion').select('*').order('nivel');
    setNiveles(data || []);
  }
  useEffect(() => {
    cargar();
  }, []);

  return (
    <>
      <div className="barra" style={{ marginTop: '1.8rem' }}>
        <h2 className="titulo" style={{ fontSize: '1.1rem' }}>
          Niveles
        </h2>
        <button className="btn" onClick={() => setEditar(null)}>
          + Nuevo nivel
        </button>
      </div>
      <p className="sub">Definen en qué nivel cae un alumno según sus puntos. Se usan en el aula virtual (Inicio → Tu progreso).</p>
      <DataTable
        columns={[
          { key: 'nivel', header: 'Nivel' },
          { key: 'nombre', header: 'Nombre' },
          { key: 'minimo', header: 'Puntos mínimos' },
          { key: 'maximo', header: 'Puntos máximos' },
        ]}
        rows={niveles.map((n) => ({ ...n, id: n.nivel }))}
        vacio="Sin niveles configurados."
        actions={(f) => (
          <button className="btn sec btn-sm" onClick={() => setEditar(f)}>
            Editar
          </button>
        )}
      />
      {editar !== undefined && (
        <Modal open title={editar?.nivel ? 'Editar nivel' : 'Nuevo nivel'} onClose={() => setEditar(undefined)}>
          <FormNivel
            nivel={editar}
            onGuardado={() => {
              setEditar(undefined);
              cargar();
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

  async function guardar() {
    const numNivel = nivel?.nivel || parseInt(num, 10);
    if (!numNivel) {
      setAviso('Indica el número de nivel');
      return;
    }
    const row = { nivel: numNivel, nombre: nombre.trim(), minimo: parseInt(minimo, 10) || 0, maximo: parseInt(maximo, 10) || 0 };
    const q = nivel?.nivel ? supabase.from('niveles_gamificacion').update(row).eq('nivel', nivel.nivel) : supabase.from('niveles_gamificacion').insert(row);
    const { error } = await q;
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    onGuardado();
  }

  return (
    <>
      {aviso && <div className="aviso err">{aviso}</div>}
      <label>Número de nivel</label>
      <input type="number" value={num} disabled={!!nivel?.nivel} onChange={(e) => setNum(e.target.value)} />
      <label>Nombre</label>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <div className="fila">
        <div style={{ flex: 1 }}>
          <label>Puntos mínimos</label>
          <input type="number" value={minimo} onChange={(e) => setMinimo(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label>Puntos máximos</label>
          <input type="number" value={maximo} onChange={(e) => setMaximo(e.target.value)} />
        </div>
      </div>
      <button className="btn bloque" onClick={guardar}>
        {nivel?.nivel ? 'Guardar cambios' : 'Crear nivel'}
      </button>
    </>
  );
}

function LogrosPanel() {
  const [logros, setLogros] = useState<Logro[]>([]);
  const [editar, setEditar] = useState<Logro | null | undefined>(undefined);
  const [aBorrar, setABorrar] = useState<Logro | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function cargar() {
    const { data } = await supabase.from('logros').select('*').order('id');
    setLogros(data || []);
  }
  useEffect(() => {
    cargar();
  }, []);

  async function confirmarBorrado() {
    if (!aBorrar) return;
    const { error } = await supabase.from('logros').delete().eq('id', aBorrar.id);
    if (error) {
      setAviso(mensajeError(error));
      setABorrar(null);
      return;
    }
    setABorrar(null);
    cargar();
  }

  function criterioTxt(f: Logro) {
    if (f.criterio_tipo === 'manual') return 'Manual';
    if (f.criterio_tipo === 'puntos_minimos') return `${f.criterio_valor} puntos mínimos`;
    if (f.criterio_tipo === 'racha_dias') return `${f.criterio_valor} día(s) de racha seguidos`;
    return `${f.criterio_valor} curso(s) completado(s)`;
  }

  return (
    <>
      <div className="barra" style={{ marginTop: '1.8rem' }}>
        <h2 className="titulo" style={{ fontSize: '1.1rem' }}>
          Logros / insignias
        </h2>
        <button className="btn" onClick={() => setEditar(null)}>
          + Nuevo logro
        </button>
      </div>
      <p className="sub">Se desbloquean automáticamente (por puntos o cursos completados) o las otorgas tú manualmente. El alumno los ve en &quot;Mi perfil&quot;.</p>
      {aviso && <div className="aviso err">{aviso}</div>}
      <DataTable
        columns={[
          { key: 'icono', header: '', render: (f) => <span style={{ fontSize: '1.3rem' }}>{f.icono}</span> },
          { key: 'nombre', header: 'Nombre' },
          { key: 'criterio', header: 'Criterio', render: criterioTxt },
          {
            key: 'estado',
            header: 'Estado',
            render: (f) => (f.estado === '1' ? <span className="tag activo">Activo</span> : <span className="tag anulado">Inactivo</span>),
          },
        ]}
        rows={logros}
        vacio="Sin logros configurados."
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
      {editar !== undefined && (
        <Modal open title={editar?.id ? 'Editar logro' : 'Nuevo logro'} onClose={() => setEditar(undefined)}>
          <FormLogro
            logro={editar}
            onGuardado={() => {
              setEditar(undefined);
              cargar();
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

  async function guardar() {
    const row = {
      icono: icono.trim() || '🏅',
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      criterio_tipo: criterioTipo,
      criterio_valor: parseInt(criterioValor, 10) || null,
      estado,
    };
    const q = logro?.id ? supabase.from('logros').update(row).eq('id', logro.id) : supabase.from('logros').insert(row);
    const { error } = await q;
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    onGuardado();
  }

  return (
    <>
      {aviso && <div className="aviso err">{aviso}</div>}
      <div className="fila">
        <div style={{ flex: 1 }}>
          <label>Ícono (emoji)</label>
          <input value={icono} onChange={(e) => setIcono(e.target.value)} />
        </div>
        <div style={{ flex: 2 }}>
          <label>Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
      </div>
      <label>Descripción</label>
      <textarea rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      <label>Criterio</label>
      <select value={criterioTipo} onChange={(e) => setCriterioTipo(e.target.value)}>
        <option value="manual">Manual (lo otorgas tú a mano)</option>
        <option value="puntos_minimos">Puntos mínimos (automático)</option>
        <option value="cursos_completados">Cursos completados (automático)</option>
        <option value="racha_dias">Racha de días seguidos (automático)</option>
      </select>
      <label>Valor del criterio</label>
      <input
        type="number"
        value={criterioValor}
        onChange={(e) => setCriterioValor(e.target.value)}
        placeholder={criterioTipo === 'racha_dias' ? 'Ej. 10 (días seguidos)' : 'No aplica si es manual'}
      />
      <label>Estado</label>
      <select value={estado} onChange={(e) => setEstado(e.target.value)}>
        <option value="1">Activo</option>
        <option value="0">Inactivo</option>
      </select>
      <button className="btn bloque" onClick={guardar}>
        {logro?.id ? 'Guardar cambios' : 'Crear logro'}
      </button>
    </>
  );
}
