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

interface MaterialAdmin {
  id: number;
  nombremat: string | null;
  archivo: string | null;
  descrip: string | null;
  estado: string | null;
}

export default function MaterialesSection({ cursoId: cursoIdProp }: { cursoId?: string } = {}) {
  const { cursos } = useCursosAdmin();
  const standalone = cursoIdProp === undefined;
  const [cursoIdState, setCursoIdState] = useState('');
  const cursoId = standalone ? cursoIdState : cursoIdProp;
  const [editar, setEditar] = useState<MaterialAdmin | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [aBorrar, setABorrar] = useState<MaterialAdmin | null>(null);

  const {
    datos: filas,
    error,
    cargando,
    recargar,
  } = useCargaDatos(
    async () => (cursoId ? datosDe<MaterialAdmin>(supabase.from('materiales').select('*').eq('curso_id', cursoId).order('id')) : []),
    [cursoId]
  );

  async function confirmarBorrado(): Promise<string | void> {
    if (!aBorrar) return;
    const { error: eBorrado } = await supabase.from('materiales').delete().eq('id', aBorrar.id);
    if (eBorrado) return mensajeError(eBorrado);
    setABorrar(null);
    await recargar();
  }

  return (
    <>
      {standalone && (
        <>
          <h1 className="titulo">Materiales</h1>
          <p className="sub">Archivos descargables del curso: guías, plantillas y lecturas de apoyo.</p>
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
          + Nuevo material
        </button>
      </div>
      {!cursoId ? (
        <div className="card card-pad">
          <div className="vacio-estado">
            <p className="vacio-estado-titulo">Elige un curso</p>
            <p className="vacio-estado-texto">
              Los materiales pertenecen a un curso. Selecciona uno arriba para ver y editar los suyos.
            </p>
          </div>
        </div>
      ) : (
        <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} cols={5}>
        <DataTable
          entidad={['material', 'materiales']}
          columns={[
            { key: 'id', header: 'ID', align: 'right', sortable: true },
            { key: 'nombremat', header: 'Nombre', sortable: true },
            {
              key: 'archivo',
              header: 'Archivo',
              render: (f) =>
                f.archivo ? (
                  <a target="_blank" rel="noreferrer" href={f.archivo}>
                    Abrir
                  </a>
                ) : (
                  '—'
                ),
            },
            {
              key: 'estado',
              header: 'Estado',
              render: (f) => (f.estado === '1' ? <span className="tag activo">Activo</span> : <span className="tag anulado">Inactivo</span>),
            },
          ]}
          rows={filas || []}
          vacio="Los materiales son los archivos descargables del curso (guías, PDF, plantillas)."
          vacioAccion={
            <button
              className="btn btn-sm"
              onClick={() => {
                setEditar(null);
                setModalAbierto(true);
              }}
            >
              Crear el primer material
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
      <FormMaterial
        open={modalAbierto}
        material={editar}
        cursoId={cursoId || ''}
        onClose={() => setModalAbierto(false)}
        onGuardado={() => {
          setModalAbierto(false);
          recargar();
        }}
      />
      <ConfirmDialog
        open={!!aBorrar}
        title={`¿Borrar el material "${aBorrar?.nombremat}"?`}
        body="Los alumnos dejarán de poder descargarlo. Esta acción no se puede deshacer."
        confirmLabel="Borrar material"
        onConfirm={confirmarBorrado}
        onCancel={() => setABorrar(null)}
      />
    </>
  );
}

function FormMaterial({
  open,
  material,
  cursoId,
  onClose,
  onGuardado,
}: {
  open: boolean;
  material: MaterialAdmin | null;
  cursoId: string;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [archivo, setArchivo] = useState('');
  const [descrip, setDescrip] = useState('');
  const [estado, setEstado] = useState('1');
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setNombre(material?.nombremat || '');
      setArchivo(material?.archivo || '');
      setDescrip(material?.descrip || '');
      setEstado(material?.estado || '1');
      setAviso(null);
      setGuardando(false);
    }
  }, [open, material]);

  async function guardar() {
    if (!nombre.trim()) {
      setAviso('Escribe el nombre del material.');
      return;
    }
    setGuardando(true);
    setAviso(null);
    const row = { curso_id: cursoId, nombremat: nombre.trim(), archivo: archivo.trim(), descrip, estado };
    const q = material?.id ? supabase.from('materiales').update(row).eq('id', material.id) : supabase.from('materiales').insert(row);
    const { error } = await q;
    setGuardando(false);
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    onGuardado();
  }

  return (
    <Modal open={open} title={material?.id ? 'Editar material' : 'Nuevo material'} onClose={onClose}>
      <Aviso mensaje={aviso} />
      <label htmlFor="material-nombre">Nombre</label>
      <input id="material-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} aria-invalid={!!aviso || undefined} />
      <label htmlFor="material-archivo" style={{ marginTop: '.6rem' }}>
        Archivo (URL o enlace de Drive)
      </label>
      <input id="material-archivo" type="url" value={archivo} onChange={(e) => setArchivo(e.target.value)} placeholder="https://…" />
      <span className="campo-ayuda">Si usas Drive, comparte el enlace como &quot;cualquiera con el enlace puede ver&quot;.</span>
      <label htmlFor="material-descrip" style={{ marginTop: '.6rem' }}>
        Descripción
      </label>
      <textarea id="material-descrip" rows={3} value={descrip} onChange={(e) => setDescrip(e.target.value)} />
      <label htmlFor="material-estado" style={{ marginTop: '.6rem' }}>
        Estado
      </label>
      <select id="material-estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
        <option value="1">Activo</option>
        <option value="0">Inactivo</option>
      </select>
      <span className="campo-ayuda">Los materiales inactivos no se ven en el aula.</span>
      <button className="btn bloque" onClick={guardar} disabled={guardando}>
        {guardando ? 'Guardando…' : material?.id ? 'Guardar cambios' : 'Crear material'}
      </button>
    </Modal>
  );
}
