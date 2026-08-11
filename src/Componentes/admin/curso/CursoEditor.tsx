'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import FileDropzone from '@/Componentes/ui/FileDropzone';
import { METODOS_PAGO } from '@/lib/metodos-pago';
import ModulosSection from '../ModulosSection';
import MaterialesSection from '../MaterialesSection';
import EvaluacionesSection from '../EvaluacionesSection';
import Aviso from '@/Componentes/ui/Aviso';
import Tabs from '../Tabs';

interface Categoria {
  id: number;
  cat_descripcion: string | null;
}

export interface CursoFull {
  id: number;
  nombre: string;
  categoria_id: number | null;
  introduccion1: string | null;
  img: string | null;
  seccion3_link: string | null;
  precio_antes: string | null;
  precio_ahora: string | null;
  tipo_curso: string | null;
  enlace_clase_vivo: string | null;
  estado: string | null;
  mostrar_en_catalogo: boolean | null;
}

type Tab = 'general' | 'modulos' | 'materiales' | 'evaluaciones';

const ETIQUETAS_TAB: { valor: Tab; etiqueta: string }[] = [
  { valor: 'general', etiqueta: 'General' },
  { valor: 'modulos', etiqueta: 'Módulos' },
  { valor: 'materiales', etiqueta: 'Materiales' },
  { valor: 'evaluaciones', etiqueta: 'Tareas y exámenes' },
];

export default function CursoEditor({
  curso,
  cats,
  onVolver,
  onGuardado,
}: {
  curso: CursoFull | null;
  cats: Categoria[];
  onVolver: () => void;
  onGuardado: () => void;
}) {
  const [cursoActual, setCursoActual] = useState<CursoFull | null>(curso);
  const [tab, setTab] = useState<Tab>('general');
  const cursoId = cursoActual?.id;

  return (
    <>
      <div className="barra">
        <button type="button" className="btn sec btn-sm" onClick={onVolver}>
          <ArrowLeft size={16} style={{ marginRight: '.3rem' }} /> Volver a cursos
        </button>
        <h1 className="titulo">{cursoActual?.id ? cursoActual.nombre : 'Nuevo curso'}</h1>
      </div>

      <Tabs
        etiqueta="Secciones del curso"
        valor={tab}
        onChange={setTab}
        tabs={ETIQUETAS_TAB.map((t) => ({
          ...t,
          deshabilitada: t.valor !== 'general' && !cursoId,
          // El motivo era un `title`: invisible para el teclado y para quien
          // no pasa el mouse justo por encima de la pestaña apagada.
          motivo: 'Guarda primero los datos generales para habilitar el resto de las pestañas.',
        }))}
      >
      {tab === 'general' && (
        <FormGeneral
          curso={cursoActual}
          cats={cats}
          onGuardado={(fila) => {
            setCursoActual(fila);
            onGuardado();
          }}
        />
      )}
      {tab === 'modulos' && cursoId && <ModulosSection cursoId={String(cursoId)} />}
      {tab === 'materiales' && cursoId && <MaterialesSection cursoId={String(cursoId)} />}
      {tab === 'evaluaciones' && cursoId && <EvaluacionesSection cursoId={String(cursoId)} />}
      </Tabs>
    </>
  );
}

function FormGeneral({
  curso,
  cats,
  onGuardado,
}: {
  curso: CursoFull | null;
  cats: Categoria[];
  onGuardado: (fila: CursoFull) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [intro, setIntro] = useState('');
  const [img, setImg] = useState('');
  const [video, setVideo] = useState('');
  const [precioAntes, setPrecioAntes] = useState('');
  const [precioAhora, setPrecioAhora] = useState('');
  const [tipo, setTipo] = useState<'estandar' | 'premium'>('estandar');
  const [enlaceVivo, setEnlaceVivo] = useState('');
  const [estado, setEstado] = useState('1');
  const [mostrarCatalogo, setMostrarCatalogo] = useState(true);
  const [metodosPago, setMetodosPago] = useState<string[]>([]);
  const [subiendoImg, setSubiendoImg] = useState(false);
  const [errorImg, setErrorImg] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setNombre(curso?.nombre || '');
    setCategoriaId(curso?.categoria_id ? String(curso.categoria_id) : '');
    setIntro(curso?.introduccion1 || '');
    setImg(curso?.img || '');
    setVideo(curso?.seccion3_link || '');
    setPrecioAntes(curso?.precio_antes || '');
    setPrecioAhora(curso?.precio_ahora || '');
    setTipo(curso?.tipo_curso === 'premium' ? 'premium' : 'estandar');
    setEnlaceVivo(curso?.enlace_clase_vivo || '');
    setEstado(curso?.estado || '1');
    setMostrarCatalogo(curso?.mostrar_en_catalogo !== false);
    if (curso?.id) {
      supabase
        .from('curso_metodos_pago')
        .select('metodo')
        .eq('curso_id', curso.id)
        .then(({ data }) => setMetodosPago((data || []).map((m) => m.metodo)));
    } else {
      setMetodosPago([]);
    }
    setAviso(null);
    setErrorImg('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curso?.id]);

  function toggleMetodo(m: string) {
    setMetodosPago((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  async function subirImagen(file: File) {
    setErrorImg('');
    if (!file.type.startsWith('image/')) {
      setErrorImg('Selecciona un archivo de imagen (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorImg('La imagen supera 5 MB.');
      return;
    }
    setSubiendoImg(true);
    const nombreArchivo = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const { error } = await supabase.storage.from('cursos-imagenes').upload(nombreArchivo, file);
    if (error) {
      setErrorImg('No se pudo subir la imagen: ' + error.message);
      setSubiendoImg(false);
      return;
    }
    const { data } = supabase.storage.from('cursos-imagenes').getPublicUrl(nombreArchivo);
    setImg(data.publicUrl);
    setSubiendoImg(false);
  }

  async function guardar() {
    setGuardando(true);
    const row = {
      nombre: nombre.trim(),
      categoria_id: parseInt(categoriaId, 10) || null,
      introduccion1: intro,
      img: img.trim() || null,
      seccion3_link: video.trim(),
      precio_antes: precioAntes.trim(),
      precio_ahora: precioAhora.trim(),
      estado,
      tipo_curso: tipo,
      enlace_clase_vivo: tipo === 'premium' ? enlaceVivo.trim() : null,
      mostrar_en_catalogo: mostrarCatalogo,
    };
    const q = curso?.id
      ? supabase.from('cursos').update(row).eq('id', curso.id).select('*').single()
      : supabase.from('cursos').insert(row).select('*').single();
    const { data: guardado, error } = await q;
    if (error || !guardado) {
      setAviso(mensajeError(error, 'No se pudo guardar el curso.'));
      setGuardando(false);
      return;
    }
    await supabase.from('curso_metodos_pago').delete().eq('curso_id', guardado.id);
    if (metodosPago.length) {
      await supabase.from('curso_metodos_pago').insert(metodosPago.map((metodo) => ({ curso_id: guardado.id, metodo })));
    }
    setGuardando(false);
    onGuardado(guardado as CursoFull);
  }

  return (
    <div className="card card-pad" style={{ maxWidth: 960 }}>
      <Aviso mensaje={aviso} />
      <label>Nombre</label>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} />

      <div className="perfil-grid" style={{ marginTop: '.4rem' }}>
        <div>
          <label>Categoría</label>
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            {cats.map((c) => (
              <option value={c.id} key={c.id}>
                {c.cat_descripcion}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Estado</label>
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="1">Activo</option>
            <option value="0">Inactivo</option>
          </select>
        </div>
      </div>

      <label>Introducción</label>
      <textarea rows={4} value={intro} onChange={(e) => setIntro(e.target.value)} />
      <label>Foto del curso</label>
      <div className="fila" style={{ alignItems: 'center', gap: '.8rem' }}>
        {img && (
          <img
            src={img}
            alt=""
            style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
          />
        )}
        <div style={{ flex: 1 }}>
          <FileDropzone compacto accept="image/*" cargando={subiendoImg} onFile={subirImagen} label={img ? 'Cambiar imagen' : 'Subir imagen'} />
          {errorImg && <p className="sub" style={{ margin: '.3rem 0 0', color: 'var(--error)' }}>{errorImg}</p>}
        </div>
      </div>
      <p className="sub" style={{ marginTop: '.2rem' }}>
        La foto se guarda en Supabase (bucket <code>cursos-imagenes</code>), así nunca se pierde. Si no subes ninguna, el curso se muestra con un color e inicial
        generados automáticamente.
      </p>
      <label>Video de presentación o sílabo (YouTube o Google Drive)</label>
      <input value={video} onChange={(e) => setVideo(e.target.value)} />
      <p className="sub" style={{ marginTop: '.2rem' }}>
        Se muestra en la pestaña &quot;General&quot; del curso para el alumno. Pega un enlace de YouTube para un video de
        presentación, o un enlace de Google Drive/Docs (por ejemplo el sílabo en PDF) para mostrarlo como documento.
      </p>

      <div className="perfil-grid">
        <div>
          <label>Precio antes</label>
          <input value={precioAntes} onChange={(e) => setPrecioAntes(e.target.value)} />
        </div>
        <div>
          <label>Precio ahora (S/)</label>
          <input value={precioAhora} onChange={(e) => setPrecioAhora(e.target.value)} />
        </div>
      </div>

      <div className="perfil-grid">
        <div>
          <label>Tipo de curso</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as 'estandar' | 'premium')}>
            <option value="estandar">Estándar</option>
            <option value="premium">Premium (estándar + clases sincrónicas en vivo)</option>
          </select>
        </div>
        {tipo === 'premium' && (
          <div>
            <label>Enlace de la clase en vivo (Zoom/Meet/Drive)</label>
            <input value={enlaceVivo} onChange={(e) => setEnlaceVivo(e.target.value)} />
          </div>
        )}
      </div>

      <label className="chk" style={{ marginTop: '.8rem' }}>
        <input type="checkbox" checked={mostrarCatalogo} onChange={(e) => setMostrarCatalogo(e.target.checked)} /> Mostrar en catálogo de venta
      </label>
      <p className="sub" style={{ marginTop: '.2rem' }}>
        Si lo desmarcas, el curso deja de aparecer en &quot;Comprar cursos&quot; pero se puede seguir asignando manualmente desde Alumnos.
      </p>

      <label style={{ marginTop: '.6rem' }}>Métodos de pago aceptados</label>
      <div className="fila">
        {METODOS_PAGO.map((m) => (
          <label className="chk" key={m.value}>
            <input type="checkbox" checked={metodosPago.includes(m.value)} onChange={() => toggleMetodo(m.value)} /> {m.label}
          </label>
        ))}
      </div>
      <p className="sub" style={{ marginTop: '.2rem' }}>
        Si no marcas ninguno, se aceptan todos los métodos disponibles.
      </p>

      {!curso?.id && (
        <p className="sub" style={{ marginTop: '.6rem' }}>
          Guarda el curso para habilitar las pestañas de Módulos, Materiales y Tareas y exámenes.
        </p>
      )}

      <button className="btn bloque" onClick={guardar} disabled={guardando} style={{ maxWidth: 320 }}>
        {guardando ? 'Guardando…' : curso?.id ? 'Guardar cambios' : 'Crear curso'}
      </button>
    </div>
  );
}
