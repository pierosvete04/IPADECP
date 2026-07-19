'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Modal from '@/Componentes/ui/Modal';
import CourseArt from '@/Componentes/ui/CourseArt';
import { METODOS_PAGO } from '@/lib/metodos-pago';

interface Categoria {
  id: number;
  cat_descripcion: string | null;
}

interface CursoFull {
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

const POR_PAGINA = 12;

export default function CursosSection() {
  const [todos, setTodos] = useState<CursoFull[]>([]);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [editar, setEditar] = useState<CursoFull | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  async function cargar() {
    setCargando(true);
    const { data: catsData } = await supabase.from('categorias').select('id,cat_descripcion');
    setCats(catsData || []);
    const { data } = await supabase.from('cursos').select('*').order('id', { ascending: false });
    setTodos(data || []);
    setCargando(false);
  }
  useEffect(() => {
    cargar();
  }, []);

  const catName = (id: number | null) => cats.find((c) => c.id === id)?.cat_descripcion || '—';

  async function toggle(c: CursoFull) {
    const nuevoEstado = c.estado === '1' ? '0' : '1';
    const { error } = await supabase.from('cursos').update({ estado: nuevoEstado }).eq('id', c.id);
    if (error) {
      alert(error.message);
      return;
    }
    setTodos((prev) => prev.map((x) => (x.id === c.id ? { ...x, estado: nuevoEstado } : x)));
  }

  async function borrar(c: CursoFull) {
    if (!confirm(`¿Borrar el curso "${c.nombre}"?\n\nEsto elimina sus módulos, materiales, tareas/exámenes, inscripciones y ventas. No se puede deshacer.`)) return;
    const { error } = await supabase.rpc('borrar_curso', { p_id: c.id });
    if (error) {
      alert(error.message);
      return;
    }
    setTodos((prev) => prev.filter((x) => x.id !== c.id));
  }

  const totalPag = Math.max(1, Math.ceil(todos.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPag);
  const pageItems = todos.slice((paginaSegura - 1) * POR_PAGINA, (paginaSegura - 1) * POR_PAGINA + POR_PAGINA);

  return (
    <>
      <div className="barra">
        <h1 className="titulo" style={{ margin: 0 }}>
          Cursos
        </h1>
        <button
          className="btn"
          onClick={() => {
            setEditar(null);
            setModalAbierto(true);
          }}
        >
          + Nuevo curso
        </button>
      </div>
      {cargando ? (
        <p>Cargando…</p>
      ) : pageItems.length ? (
        <div className="cursos-grid-admin">
          {pageItems.map((f) => (
            <div
              className="curso-comprar curso-admin"
              key={f.id}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('[data-tog],[data-del]')) return;
                setEditar(f);
                setModalAbierto(true);
              }}
            >
              <div className="banner">
                <CourseArt id={f.id} nombre={f.nombre} img={f.img} />
                {f.tipo_curso === 'premium' && <span className="badge-estado pendiente">Premium</span>}
                {f.estado !== '1' && (
                  <span className="badge-estado" style={{ background: '#6b7280' }}>
                    Inactivo
                  </span>
                )}
                {f.mostrar_en_catalogo === false && (
                  <span className="badge-estado" style={{ background: '#8b5cf6' }}>
                    Oculto
                  </span>
                )}
              </div>
              <div className="cuerpo">
                <h3>{f.nombre}</h3>
                <div className="meta" style={{ color: 'var(--gris)', fontSize: '.78rem', margin: '.1rem 0 .3rem' }}>
                  {catName(f.categoria_id)}
                </div>
                <div className="precio-grande">{f.precio_ahora ? `S/ ${f.precio_ahora}` : '—'}</div>
                <div className="fila" style={{ marginTop: 'auto', gap: '.4rem' }}>
                  <button
                    className="btn sec btn-sm"
                    style={{ flex: 1 }}
                    data-tog
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(f);
                    }}
                  >
                    {f.estado === '1' ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    className="btn peligro btn-sm"
                    data-del
                    onClick={(e) => {
                      e.stopPropagation();
                      borrar(f);
                    }}
                  >
                    Borrar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="vacio">Aún no hay cursos.</p>
      )}
      {totalPag > 1 && (
        <div className="fila" style={{ justifyContent: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
          <button className="btn sec btn-sm" disabled={paginaSegura === 1} onClick={() => setPagina(paginaSegura - 1)}>
            ‹
          </button>
          <span className="pag-info">
            Página {paginaSegura} de {totalPag}
          </span>
          <button className="btn sec btn-sm" disabled={paginaSegura === totalPag} onClick={() => setPagina(paginaSegura + 1)}>
            ›
          </button>
        </div>
      )}
      <FormCurso
        open={modalAbierto}
        curso={editar}
        cats={cats}
        onClose={() => setModalAbierto(false)}
        onGuardado={() => {
          setModalAbierto(false);
          cargar();
        }}
      />
    </>
  );
}

function FormCurso({
  open,
  curso,
  cats,
  onClose,
  onGuardado,
}: {
  open: boolean;
  curso: CursoFull | null;
  cats: Categoria[];
  onClose: () => void;
  onGuardado: () => void;
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

  useEffect(() => {
    if (open) {
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
    }
  }, [open, curso]);

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
      ? supabase.from('cursos').update(row).eq('id', curso.id).select('id').single()
      : supabase.from('cursos').insert(row).select('id').single();
    const { data: guardado, error } = await q;
    if (error || !guardado) {
      alert(error?.message || 'No se pudo guardar.');
      return;
    }
    await supabase.from('curso_metodos_pago').delete().eq('curso_id', guardado.id);
    if (metodosPago.length) {
      await supabase.from('curso_metodos_pago').insert(metodosPago.map((metodo) => ({ curso_id: guardado.id, metodo })));
    }
    onGuardado();
  }

  return (
    <Modal open={open} title={curso?.id ? 'Editar curso' : 'Nuevo curso'} onClose={onClose}>
      <label>Nombre</label>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <label>Categoría</label>
      <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
        {cats.map((c) => (
          <option value={c.id} key={c.id}>
            {c.cat_descripcion}
          </option>
        ))}
      </select>
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
          <input
            type="file"
            accept="image/*"
            disabled={subiendoImg}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) subirImagen(file);
            }}
          />
          {subiendoImg && <p className="sub" style={{ margin: '.3rem 0 0' }}>Subiendo…</p>}
          {errorImg && <p className="sub" style={{ margin: '.3rem 0 0', color: 'var(--error)' }}>{errorImg}</p>}
        </div>
      </div>
      <p className="sub" style={{ marginTop: '.2rem' }}>
        La foto se guarda en Supabase (bucket <code>cursos-imagenes</code>), así nunca se pierde. Si no subes ninguna, el curso se muestra con un color e inicial
        generados automáticamente.
      </p>
      <label>Video de presentación (YouTube/Drive)</label>
      <input value={video} onChange={(e) => setVideo(e.target.value)} />
      <div className="fila">
        <div style={{ flex: 1 }}>
          <label>Precio antes</label>
          <input value={precioAntes} onChange={(e) => setPrecioAntes(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label>Precio ahora (S/)</label>
          <input value={precioAhora} onChange={(e) => setPrecioAhora(e.target.value)} />
        </div>
      </div>
      <label>Tipo de curso</label>
      <select value={tipo} onChange={(e) => setTipo(e.target.value as 'estandar' | 'premium')}>
        <option value="estandar">Estándar</option>
        <option value="premium">Premium (estándar + clases sincrónicas en vivo)</option>
      </select>
      {tipo === 'premium' && (
        <div>
          <label>Enlace de la clase en vivo (Zoom/Meet/Drive)</label>
          <input value={enlaceVivo} onChange={(e) => setEnlaceVivo(e.target.value)} />
        </div>
      )}
      <label>Estado</label>
      <select value={estado} onChange={(e) => setEstado(e.target.value)}>
        <option value="1">Activo</option>
        <option value="0">Inactivo</option>
      </select>

      <label className="chk" style={{ marginTop: '.8rem' }}>
        <input type="checkbox" checked={mostrarCatalogo} onChange={(e) => setMostrarCatalogo(e.target.checked)} /> Mostrar en catálogo de venta
      </label>
      <p className="sub" style={{ marginTop: '.2rem' }}>
        Si lo desmarcas, el curso deja de aparecer en &quot;Comprar cursos&quot; pero se puede seguir asignando manualmente desde Alumnos.
      </p>

      <label style={{ marginTop: '.6rem' }}>Métodos de pago aceptados</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
        {METODOS_PAGO.map((m) => (
          <label className="chk" key={m.value}>
            <input type="checkbox" checked={metodosPago.includes(m.value)} onChange={() => toggleMetodo(m.value)} /> {m.label}
          </label>
        ))}
      </div>
      <p className="sub" style={{ marginTop: '.2rem' }}>
        Si no marcas ninguno, se aceptan todos los métodos disponibles.
      </p>

      <button className="btn bloque" style={{ marginTop: '1rem' }} onClick={guardar}>
        Guardar
      </button>
    </Modal>
  );
}
