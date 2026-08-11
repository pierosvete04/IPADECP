'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';
import ConfirmDialog from '@/Componentes/ui/ConfirmDialog';
import Aviso from '@/Componentes/ui/Aviso';
import CursoSelector from './CursoSelector';
import { useCursosAdmin } from './useCursosAdmin';
import EstadoCarga from './EstadoCarga';
import { useCargaDatos, datosDe } from './useCargaDatos';

interface ModuloAdmin {
  id: number;
  titulo: string | null;
  linkvideo: string | null;
  archivo: string | null;
  estado: string | null;
}

export default function ModulosSection({ cursoId: cursoIdProp }: { cursoId?: string } = {}) {
  const { cursos } = useCursosAdmin();
  const standalone = cursoIdProp === undefined;
  const [cursoIdState, setCursoIdState] = useState('');
  const cursoId = standalone ? cursoIdState : cursoIdProp;
  const [editar, setEditar] = useState<ModuloAdmin | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [aBorrar, setABorrar] = useState<ModuloAdmin | null>(null);

  const {
    datos: filas,
    error,
    cargando,
    recargar,
  } = useCargaDatos(
    async () => (cursoId ? datosDe<ModuloAdmin>(supabase.from('modulos').select('*').eq('curso_id', cursoId).order('id')) : []),
    [cursoId]
  );

  async function confirmarBorrado(): Promise<string | void> {
    if (!aBorrar) return;
    const { error: eBorrado } = await supabase.from('modulos').delete().eq('id', aBorrar.id);
    if (eBorrado) return mensajeError(eBorrado);
    setABorrar(null);
    await recargar();
  }

  return (
    <>
      {standalone && (
        <>
          <h1 className="titulo">Módulos</h1>
          <p className="sub">Las clases de cada curso, con su video y su documento. El alumno las ve en el orden en que están aquí.</p>
        </>
      )}
      <div className="cabecera-seccion">
        {standalone && <CursoSelector cursos={cursos} value={cursoIdState} onChange={setCursoIdState} />}
        <button
          className="btn"
          disabled={!cursoId}
          title={!cursoId ? 'Elige primero un curso' : undefined}
          onClick={() => {
            setEditar(null);
            setModalAbierto(true);
          }}
        >
          + Nuevo módulo
        </button>
      </div>
      {!cursoId ? (
        <div className="card card-pad">
          <div className="vacio-estado">
            <p className="vacio-estado-titulo">Elige un curso</p>
            <p className="vacio-estado-texto">Los módulos pertenecen a un curso. Selecciona uno arriba para ver y editar los suyos.</p>
          </div>
        </div>
      ) : (
        <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} cols={5}>
          <DataTable
            entidad={['módulo', 'módulos']}
            columns={[
              { key: 'titulo', header: 'Título', sortable: true },
              { key: 'video', header: 'Video', render: (f) => (f.linkvideo ? '✔' : '—') },
              { key: 'doc', header: 'Documento', render: (f) => (f.archivo ? '✔' : '—') },
              {
                key: 'estado',
                header: 'Estado',
                render: (f) => (f.estado === '1' ? <span className="tag activo">Activo</span> : <span className="tag anulado">Inactivo</span>),
              },
            ]}
            rows={filas || []}
            vacio="Los módulos son las clases del curso. Crea el primero para que los alumnos tengan contenido que ver."
            vacioAccion={
              <button
                className="btn btn-sm"
                onClick={() => {
                  setEditar(null);
                  setModalAbierto(true);
                }}
              >
                Crear el primer módulo
              </button>
            }
          actions={(f) => (
            <>
              <button
                className="btn sec btn-sm"
                onClick={() => {
                  setEditar(f);
                  setModalAbierto(true);
                }}
              >
                Editar
              </button>{' '}
              <button className="btn peligro btn-sm" onClick={() => setABorrar(f)}>
                Borrar
              </button>
            </>
          )}
          />
        </EstadoCarga>
      )}
      <FormModulo
        open={modalAbierto}
        modulo={editar}
        cursoId={cursoId || ''}
        onClose={() => setModalAbierto(false)}
        onGuardado={() => {
          setModalAbierto(false);
          recargar();
        }}
      />
      <ConfirmDialog
        open={!!aBorrar}
        title={`¿Borrar el módulo "${aBorrar?.titulo}"?`}
        body="Los alumnos dejarán de ver esta clase y su material. Esta acción no se puede deshacer."
        confirmLabel="Borrar módulo"
        onConfirm={confirmarBorrado}
        onCancel={() => setABorrar(null)}
      />
    </>
  );
}

function FormModulo({
  open,
  modulo,
  cursoId,
  onClose,
  onGuardado,
}: {
  open: boolean;
  modulo: ModuloAdmin | null;
  cursoId: string;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [linkvideo, setLinkvideo] = useState('');
  const [archivo, setArchivo] = useState('');
  const [estado, setEstado] = useState('1');
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setTitulo(modulo?.titulo || '');
      setLinkvideo(modulo?.linkvideo || '');
      setArchivo(modulo?.archivo || '');
      setEstado(modulo?.estado || '1');
      setAviso(null);
      setGuardando(false);
    }
  }, [open, modulo]);

  async function guardar() {
    if (!titulo.trim()) {
      setAviso('Escribe el título del módulo.');
      return;
    }
    setGuardando(true);
    setAviso(null);
    const row = { curso_id: parseInt(cursoId, 10), titulo: titulo.trim(), linkvideo: linkvideo.trim(), archivo: archivo.trim(), estado };
    const q = modulo?.id ? supabase.from('modulos').update(row).eq('id', modulo.id) : supabase.from('modulos').insert(row);
    const { error } = await q;
    setGuardando(false);
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    onGuardado();
  }

  return (
    <Modal open={open} title={modulo?.id ? 'Editar módulo' : 'Nuevo módulo'} onClose={onClose}>
      <Aviso mensaje={aviso} />
      <label htmlFor="modulo-titulo">Título</label>
      <input id="modulo-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} aria-invalid={!!aviso || undefined} />
      <label htmlFor="modulo-video" style={{ marginTop: '.6rem' }}>
        Link de video (clases grabadas)
      </label>
      <input id="modulo-video" type="url" value={linkvideo} onChange={(e) => setLinkvideo(e.target.value)} placeholder="https://…" />
      <label htmlFor="modulo-archivo" style={{ marginTop: '.6rem' }}>
        Archivo / documento (URL)
      </label>
      <input id="modulo-archivo" type="url" value={archivo} onChange={(e) => setArchivo(e.target.value)} placeholder="https://…" />
      <label htmlFor="modulo-estado" style={{ marginTop: '.6rem' }}>
        Estado
      </label>
      <select id="modulo-estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
        <option value="1">Activo</option>
        <option value="0">Inactivo</option>
      </select>
      <span className="campo-ayuda">Los módulos inactivos no se ven en el aula.</span>
      <button className="btn bloque" onClick={guardar} disabled={guardando}>
        {guardando ? 'Guardando…' : modulo?.id ? 'Guardar cambios' : 'Crear módulo'}
      </button>
    </Modal>
  );
}
