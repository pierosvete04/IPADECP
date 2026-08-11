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

interface Evento {
  id: number;
  titulo: string | null;
  contenido: string | null;
  curso_id: number | null;
  link: string | null;
  categoria: string | null;
  estado: string | null;
}

export default function EventosSection() {
  const { cursos } = useCursosAdmin();
  const [editar, setEditar] = useState<Evento | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [aBorrar, setABorrar] = useState<Evento | null>(null);

  // Solo anuncios GLOBALES (alumno_id null). La tabla `eventos` guarda dos
  // cosas distintas: los anuncios que el admin escribe acá para todo el aula,
  // y las notificaciones personales de un alumno ("¡Gracias por tu compra!",
  // "Examen final desbloqueado") que insertan solos los triggers de Supabase
  // notificar_compra_aprobada y notificar_examen_desbloqueado, con
  // idusu = 'sistema' y el alumno_id puesto. Esas segundas no son
  // administrables — se generan y se leen en el Inicio del aula de cada
  // alumno — y llenaban esta pantalla de filas repetidas que el admin no
  // debía tocar. Ver InicioTab.tsx, que sí lee ambas.
  const {
    datos: filas,
    error,
    cargando,
    recargar,
  } = useCargaDatos(() =>
    datosDe<Evento>(supabase.from('eventos').select('*').is('alumno_id', null).order('id', { ascending: false }))
  );

  async function confirmarBorrado(): Promise<string | void> {
    if (!aBorrar) return;
    const { error: eBorrado } = await supabase.from('eventos').delete().eq('id', aBorrar.id);
    if (eBorrado) return mensajeError(eBorrado);
    setABorrar(null);
    await recargar();
  }

  const cursoNombre = (id: number | null) => cursos.find((c) => c.id === id)?.nombre || (id || 'general');

  function abrir(e: Evento | null) {
    setEditar(e);
    setModalAbierto(true);
  }

  return (
    <>
      <div className="cabecera-seccion">
        <h1 className="titulo">Eventos / Anuncios</h1>
        <button className="btn" onClick={() => abrir(null)}>
          + Nuevo evento
        </button>
      </div>
      <p className="sub">
        Anuncios que ven todos los alumnos en el Inicio del aula. Las notificaciones personales (compras, exámenes
        desbloqueados) las genera el sistema y no se administran desde aquí.
      </p>
      <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} cols={6}>
        <DataTable
          entidad={['evento', 'eventos']}
          columns={[
            { key: 'id', header: 'ID', align: 'right', sortable: true },
            { key: 'titulo', header: 'Título', sortable: true },
            { key: 'curso', header: 'Curso', render: (f) => String(cursoNombre(f.curso_id)) },
            { key: 'categoria', header: 'Tipo' },
            {
              key: 'estado',
              header: 'Estado',
              sortable: true,
              render: (f) => (f.estado === '1' ? <span className="tag activo">Activo</span> : <span className="tag anulado">Inactivo</span>),
            },
          ]}
          rows={filas || []}
          vacio="Publica un anuncio para que aparezca en el Inicio del aula de todos los alumnos."
          vacioAccion={
            <button className="btn btn-sm" onClick={() => abrir(null)}>
              Crear el primer anuncio
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
      <FormEvento
        open={modalAbierto}
        evento={editar}
        cursos={cursos}
        onClose={() => setModalAbierto(false)}
        onGuardado={() => {
          setModalAbierto(false);
          recargar();
        }}
      />
      <ConfirmDialog
        open={!!aBorrar}
        title={`¿Borrar el anuncio "${aBorrar?.titulo}"?`}
        body="Dejará de verse en el Inicio del aula. Esta acción no se puede deshacer."
        confirmLabel="Borrar anuncio"
        onConfirm={confirmarBorrado}
        onCancel={() => setABorrar(null)}
      />
    </>
  );
}

function FormEvento({
  open,
  evento,
  cursos,
  onClose,
  onGuardado,
}: {
  open: boolean;
  evento: Evento | null;
  cursos: { id: number; nombre: string }[];
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [cursoId, setCursoId] = useState('');
  const [contenido, setContenido] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setTitulo(evento?.titulo || '');
      setCursoId(evento?.curso_id ? String(evento.curso_id) : '');
      setContenido(evento?.contenido || '');
      setAviso(null);
      setGuardando(false);
    }
  }, [open, evento]);

  async function guardar() {
    if (!titulo.trim()) {
      setAviso('Escribe el título del anuncio.');
      return;
    }
    setGuardando(true);
    setAviso(null);
    const row = {
      titulo: titulo.trim(),
      contenido,
      curso_id: cursoId ? parseInt(cursoId, 10) : null,
      link: evento?.link || null,
      categoria: evento?.categoria || 'anuncio',
      estado: evento?.estado || '1',
      idusu: 'admin',
    };
    const q = evento?.id ? supabase.from('eventos').update(row).eq('id', evento.id) : supabase.from('eventos').insert(row);
    const { error } = await q;
    setGuardando(false);
    if (error) {
      setAviso(mensajeError(error));
      return;
    }
    onGuardado();
  }

  return (
    <Modal open={open} title={evento?.id ? 'Editar anuncio' : 'Nuevo anuncio'} onClose={onClose}>
      <Aviso mensaje={aviso} />
      <label htmlFor="evento-titulo">Título</label>
      <input id="evento-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} aria-invalid={!!aviso || undefined} />
      <label htmlFor="evento-curso" style={{ marginTop: '.6rem' }}>
        Curso (opcional)
      </label>
      <CursoSelector cursos={cursos.map((c) => ({ ...c, categoria_id: null, estado: '1' }))} value={cursoId} onChange={setCursoId} />
      <span className="campo-ayuda">Si eliges un curso, el anuncio solo lo ven sus alumnos.</span>
      <label htmlFor="evento-contenido" style={{ marginTop: '.6rem' }}>
        Descripción
      </label>
      <textarea id="evento-contenido" rows={4} value={contenido} onChange={(e) => setContenido(e.target.value)} />
      <button className="btn bloque" onClick={guardar} disabled={guardando}>
        {guardando ? 'Guardando…' : evento?.id ? 'Guardar cambios' : 'Publicar anuncio'}
      </button>
    </Modal>
  );
}
