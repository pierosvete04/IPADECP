'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import { useCursosAdmin } from './useCursosAdmin';
import {
  dimensionesPagina,
  paginaDefaultPlantilla,
  paginaVacia,
  listarPlantillas,
  listarTodasLasPlantillas,
  listarAsignacionesCurso,
  asignarDisenoACurso,
  quitarAsignacionCurso,
  vistaPreviaDesdePaginas,
} from '@/lib/certificado';
import type {
  AsignacionCurso,
  ModalidadAsignacion,
  CampoPlantilla,
  FuenteCampo,
  OrientacionPlantilla,
  PaginaPlantilla,
  TipoPlantilla,
  VariableCampo,
} from '@/lib/certificado';
import VistaPreviaCertificadoModal, { type VistaPreviaCertificado } from './VistaPreviaCertificadoModal';
import FileDropzone from '@/Componentes/ui/FileDropzone';

const LADO_LARGO_RENDER_PX = 880;

const CATALOGO_CAMPOS: { variable: VariableCampo; etiqueta: string }[] = [
  { variable: 'cargo', etiqueta: 'Cargo profesional' },
  { variable: 'nombre', etiqueta: 'Nombre del alumno' },
  { variable: 'curso', etiqueta: 'Nombre del curso' },
  { variable: 'fecha', etiqueta: 'Fecha de emisión' },
  { variable: 'fecha_inicio', etiqueta: 'Fecha de inicio' },
  { variable: 'fecha_termino', etiqueta: 'Fecha de término' },
  { variable: 'fecha_entrega', etiqueta: 'Fecha de entrega' },
  { variable: 'periodo', etiqueta: 'Período (combinado)' },
  { variable: 'creditos', etiqueta: 'Créditos académicos' },
  { variable: 'meses', etiqueta: 'Meses de estudio' },
  { variable: 'horas_lectivas', etiqueta: 'Horas lectivas' },
  { variable: 'registro', etiqueta: 'Registro N°' },
  { variable: 'libro', etiqueta: 'Libro N°' },
  { variable: 'codigo', etiqueta: 'Código de verificación' },
  { variable: 'qr', etiqueta: 'Código QR' },
  { variable: 'tabla_notas', etiqueta: 'Tabla de asignaturas y notas' },
  { variable: 'texto_fijo', etiqueta: 'Texto fijo (párrafo)' },
];

const VALOR_EJEMPLO: Partial<Record<VariableCampo, string>> = {
  cargo: 'Ingeniero Industrial',
  nombre: 'Juan Pérez García',
  curso: 'Gestión de la Calidad en Salud',
  fecha: 'Fecha: 23/12/2026',
  fecha_inicio: 'Inicio: 01/07/2026',
  fecha_termino: 'Término: 31/12/2026',
  fecha_entrega: 'Entrega: 23/12/2026',
  periodo: 'Período: 01/07/2026 – 31/12/2026',
  creditos: 'Créditos Académicos: 30',
  meses: 'Meses: 06',
  horas_lectivas: 'Horas Lectivas: 480',
  registro: 'Registro N°: 008116',
  libro: 'Libro N°: 08116',
  codigo: 'Código de verificación: 1234-5678',
};

function idUnico(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function nuevoCampoPorVariable(variable: VariableCampo, anchoMM: number, altoMM: number): CampoPlantilla {
  const base = {
    id: idUnico(),
    variable,
    x: anchoMM / 2,
    y: altoMM / 2,
    visible: true,
    fontFamily: 'helvetica' as FuenteCampo,
    color: '#1e1e1e',
    align: 'center' as const,
  };
  if (variable === 'qr') return { ...base, size: 28 };
  if (variable === 'texto_fijo') return { ...base, fontSize: 12, texto: '', ancho: 220 };
  if (variable === 'tabla_notas') return { ...base, fontSize: 10, ancho: 180, filaAltura: 8 };
  return { ...base, fontSize: 12, bold: false };
}

function etiquetaCampo(campo: CampoPlantilla): string {
  if (campo.variable === 'texto_fijo') {
    return campo.texto ? `Texto: "${campo.texto.slice(0, 24)}${campo.texto.length > 24 ? '…' : ''}"` : 'Texto fijo (vacío)';
  }
  return CATALOGO_CAMPOS.find((c) => c.variable === campo.variable)?.etiqueta || campo.variable;
}

export default function DisenoCertificadoSection() {
  const [tipo, setTipo] = useState<TipoPlantilla>('digital');
  const [mostrarLista, setMostrarLista] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [lista, setLista] = useState<{ id: number; nombre: string; activa: boolean }[]>([]);
  const [plantillaId, setPlantillaId] = useState<number | null>(null);
  const [nombre, setNombre] = useState('Nuevo diseño');
  const [activa, setActiva] = useState(false);
  const [orientacion, setOrientacion] = useState<OrientacionPlantilla>('horizontal');
  const [paginas, setPaginas] = useState<PaginaPlantilla[]>([paginaDefaultPlantilla()]);
  const [imagenesPreview, setImagenesPreview] = useState<(string | null)[]>([null]);
  const [paginaActual, setPaginaActual] = useState(0);
  const [campoSel, setCampoSel] = useState<string | null>(null);
  const [variableNueva, setVariableNueva] = useState<VariableCampo>('texto_fijo');
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);
  const [previa, setPrevia] = useState<VistaPreviaCertificado | null>(null);
  const idAlCambiarTipo = useRef<number | undefined>(undefined);
  const lienzoWrapRef = useRef<HTMLDivElement>(null);
  const [anchoDisponible, setAnchoDisponible] = useState(LADO_LARGO_RENDER_PX);

  // El lienzo se dibuja en píxeles fijos (LADO_LARGO_RENDER_PX), así que en
  // pantallas angostas lo reescalamos al ancho real disponible: si no, el
  // <div> con width fijo fuerza la columna del grid a desbordarse en vez de
  // encogerse (grid-template-columns no encoge un item más allá de su
  // contenido si ese contenido tiene un ancho fijo en px).
  useEffect(() => {
    const el = lienzoWrapRef.current;
    if (!el) return;
    const observador = new ResizeObserver((entradas) => {
      const ancho = entradas[0]?.contentRect.width;
      if (ancho) setAnchoDisponible(Math.floor(ancho));
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const { ancho: anchoPaginaMM, alto: altoPaginaMM } = dimensionesPagina(orientacion);
  const ladoRenderPx = Math.min(LADO_LARGO_RENDER_PX, anchoDisponible);
  const escala = ladoRenderPx / Math.max(anchoPaginaMM, altoPaginaMM);

  function nuevoDiseno() {
    setPlantillaId(null);
    setNombre('Nuevo diseño');
    setActiva(false);
    setOrientacion('horizontal');
    setPaginas([paginaDefaultPlantilla()]);
    setImagenesPreview([null]);
    setPaginaActual(0);
    setCampoSel(null);
  }

  async function cargarDiseno(id: number) {
    const { data } = await supabase.from('plantillas_certificado').select('id,tipo,nombre,activa,orientacion,paginas').eq('id', id).maybeSingle();
    if (!data) return;
    const fila = data as { id: number; tipo: TipoPlantilla; nombre: string; activa: boolean; orientacion: OrientacionPlantilla; paginas: PaginaPlantilla[] };
    setPlantillaId(fila.id);
    setNombre(fila.nombre);
    setActiva(fila.activa);
    setOrientacion(fila.orientacion || 'horizontal');
    const paginasFila = fila.paginas.length ? fila.paginas : [paginaDefaultPlantilla()];
    setPaginas(paginasFila);
    setPaginaActual(0);
    setCampoSel(null);
    const previews = await Promise.all(
      paginasFila.map(async (p) => {
        if (!p.imagen_url) return null;
        const { data: blob } = await supabase.storage.from('certificados').download(p.imagen_url);
        return blob ? URL.createObjectURL(blob) : null;
      })
    );
    setImagenesPreview(previews);
  }

  async function cargarTipo(tipoElegido: TipoPlantilla, idForzado?: number) {
    setCargando(true);
    setAviso(null);
    const l = await listarPlantillas(tipoElegido);
    setLista(l);
    const objetivo = idForzado ?? (l.find((d) => d.activa) || l[0])?.id;
    if (objetivo != null) await cargarDiseno(objetivo);
    else nuevoDiseno();
    setCargando(false);
  }

  useEffect(() => {
    const forzado = idAlCambiarTipo.current;
    idAlCambiarTipo.current = undefined;
    cargarTipo(tipo, forzado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  function alCambiarSelector(valor: string) {
    if (valor === 'nuevo') nuevoDiseno();
    else cargarDiseno(Number(valor));
  }

  function irAlEditor(tipoDelDiseno: TipoPlantilla, idDiseno: number) {
    setMostrarLista(false);
    if (tipoDelDiseno === tipo) cargarDiseno(idDiseno);
    else {
      idAlCambiarTipo.current = idDiseno;
      setTipo(tipoDelDiseno);
    }
  }

  async function subirImagenPagina(file: File, indice: number) {
    setAviso(null);
    if (!file.type.startsWith('image/')) {
      setAviso({ texto: 'Selecciona un archivo de imagen (JPG, PNG, WEBP).', tipo: 'err' });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setAviso({ texto: 'La imagen supera 8 MB.', tipo: 'err' });
      return;
    }
    setSubiendo(true);
    const ruta = `plantillas/${tipo}-${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const { error } = await supabase.storage.from('certificados').upload(ruta, file);
    if (error) {
      setAviso({ texto: 'No se pudo subir la imagen: ' + error.message, tipo: 'err' });
      setSubiendo(false);
      return;
    }
    setPaginas((prev) => prev.map((p, i) => (i !== indice ? p : { ...p, imagen_url: ruta })));
    setImagenesPreview((prev) => prev.map((u, i) => (i !== indice ? u : URL.createObjectURL(file))));
    setSubiendo(false);
  }

  function actualizarCampo(id: string, cambios: Partial<CampoPlantilla>) {
    setPaginas((prev) => prev.map((p, i) => (i !== paginaActual ? p : { ...p, campos: p.campos.map((c) => (c.id === id ? { ...c, ...cambios } : c)) })));
  }

  function agregarCampo() {
    const nuevo = nuevoCampoPorVariable(variableNueva, anchoPaginaMM, altoPaginaMM);
    setPaginas((prev) => prev.map((p, i) => (i !== paginaActual ? p : { ...p, campos: [...p.campos, nuevo] })));
    setCampoSel(nuevo.id);
  }

  function eliminarCampo(id: string) {
    setPaginas((prev) => prev.map((p, i) => (i !== paginaActual ? p : { ...p, campos: p.campos.filter((c) => c.id !== id) })));
    setCampoSel(null);
  }

  function duplicarCampo(campo: CampoPlantilla) {
    const copia: CampoPlantilla = { ...campo, id: idUnico(), x: Math.min(anchoPaginaMM, campo.x + 8), y: Math.min(altoPaginaMM, campo.y + 8) };
    setPaginas((prev) => prev.map((p, i) => (i !== paginaActual ? p : { ...p, campos: [...p.campos, copia] })));
    setCampoSel(copia.id);
  }

  function agregarPagina() {
    setPaginas((prev) => [...prev, paginaVacia()]);
    setImagenesPreview((prev) => [...prev, null]);
    setPaginaActual(paginas.length);
    setCampoSel(null);
  }

  function eliminarPaginaActual() {
    if (paginas.length <= 1) return;
    if (!window.confirm(`¿Eliminar la Hoja ${paginaActual + 1}? Se perderán sus campos.`)) return;
    setPaginas((prev) => prev.filter((_, i) => i !== paginaActual));
    setImagenesPreview((prev) => prev.filter((_, i) => i !== paginaActual));
    setPaginaActual(0);
    setCampoSel(null);
  }

  function alPresionarCampo(e: React.PointerEvent, campo: CampoPlantilla) {
    e.preventDefault();
    setCampoSel(campo.id);
    const inicioX = e.clientX;
    const inicioY = e.clientY;
    const campoXinicial = campo.x;
    const campoYinicial = campo.y;

    function alMover(ev: PointerEvent) {
      const deltaXmm = (ev.clientX - inicioX) / escala;
      const deltaYmm = (ev.clientY - inicioY) / escala;
      const x = Math.min(anchoPaginaMM, Math.max(0, campoXinicial + deltaXmm));
      const y = Math.min(altoPaginaMM, Math.max(0, campoYinicial + deltaYmm));
      actualizarCampo(campo.id, { x, y });
    }
    function alSoltar() {
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('pointerup', alSoltar);
    }
    window.addEventListener('pointermove', alMover);
    window.addEventListener('pointerup', alSoltar);
  }

  async function guardar() {
    setGuardando(true);
    setAviso(null);
    if (plantillaId == null) {
      const { data, error } = await supabase.from('plantillas_certificado').insert({ tipo, nombre, activa: false, orientacion, paginas }).select('id').single();
      setGuardando(false);
      if (error) {
        setAviso({ texto: mensajeError(error), tipo: 'err' });
        return;
      }
      setPlantillaId(data.id);
      setLista((prev) => [{ id: data.id, nombre, activa: false }, ...prev]);
      setAviso({ texto: 'Diseño creado y guardado.', tipo: 'ok' });
      return;
    }
    const { error } = await supabase
      .from('plantillas_certificado')
      .update({ nombre, orientacion, paginas, actualizado_en: new Date().toISOString() })
      .eq('id', plantillaId);
    setGuardando(false);
    if (error) {
      setAviso({ texto: mensajeError(error), tipo: 'err' });
      return;
    }
    setLista((prev) => prev.map((d) => (d.id === plantillaId ? { ...d, nombre } : d)));
    setAviso({ texto: 'Diseño guardado.', tipo: 'ok' });
  }

  async function guardarComoNuevo() {
    setGuardando(true);
    setAviso(null);
    const nombreNuevo = nombre.trim() ? `${nombre} (copia)` : 'Nuevo diseño';
    const { data, error } = await supabase.from('plantillas_certificado').insert({ tipo, nombre: nombreNuevo, activa: false, orientacion, paginas }).select('id').single();
    setGuardando(false);
    if (error) {
      setAviso({ texto: mensajeError(error), tipo: 'err' });
      return;
    }
    setPlantillaId(data.id);
    setNombre(nombreNuevo);
    setActiva(false);
    setLista((prev) => [{ id: data.id, nombre: nombreNuevo, activa: false }, ...prev]);
    setAviso({ texto: 'Diseño duplicado y guardado.', tipo: 'ok' });
  }

  async function marcarActiva() {
    if (plantillaId == null) {
      setAviso({ texto: 'Primero guarda el diseño.', tipo: 'err' });
      return;
    }
    setGuardando(true);
    setAviso(null);
    await supabase.from('plantillas_certificado').update({ activa: false }).eq('tipo', tipo).eq('activa', true);
    const { error } = await supabase.from('plantillas_certificado').update({ activa: true }).eq('id', plantillaId);
    setGuardando(false);
    if (error) {
      setAviso({ texto: mensajeError(error), tipo: 'err' });
      return;
    }
    setActiva(true);
    setLista((prev) => prev.map((d) => ({ ...d, activa: d.id === plantillaId })));
    setAviso({ texto: 'Este diseño ahora es el que se usa al emitir certificados.', tipo: 'ok' });
  }

  async function eliminar() {
    if (plantillaId == null) return;
    if (!window.confirm(`¿Eliminar el diseño "${nombre}"? Esta acción no se puede deshacer.`)) return;
    setGuardando(true);
    setAviso(null);
    const { error } = await supabase.from('plantillas_certificado').delete().eq('id', plantillaId);
    setGuardando(false);
    if (error) {
      setAviso({ texto: mensajeError(error), tipo: 'err' });
      return;
    }
    const restante = lista.filter((d) => d.id !== plantillaId);
    setLista(restante);
    if (restante[0]) await cargarDiseno(restante[0].id);
    else nuevoDiseno();
    setAviso({ texto: 'Diseño eliminado.', tipo: 'ok' });
  }

  async function copiarAOtroTipo() {
    const otroTipo: TipoPlantilla = tipo === 'digital' ? 'imprimir' : 'digital';
    const paginasCopia: PaginaPlantilla[] = paginas.map((p) => ({ imagen_url: null, campos: p.campos.map((c) => ({ ...c })) }));
    const nombreCopia = `${nombre} (desde ${tipo === 'digital' ? 'digital' : 'imprimir'})`;
    setGuardando(true);
    setAviso(null);
    const { error } = await supabase.from('plantillas_certificado').insert({ tipo: otroTipo, nombre: nombreCopia, activa: false, orientacion, paginas: paginasCopia });
    setGuardando(false);
    if (error) {
      setAviso({ texto: mensajeError(error), tipo: 'err' });
      return;
    }
    setAviso({
      texto: `Estructura copiada a "Certificado para ${otroTipo === 'imprimir' ? 'imprimir' : 'digital'}" como diseño nuevo "${nombreCopia}" (sin imagen de fondo). Cambia de pestaña para revisarlo y márcalo como activo cuando quieras.`,
      tipo: 'ok',
    });
  }

  async function verVistaPrevia() {
    const res = await vistaPreviaDesdePaginas(
      {
        codigo: '00000000-0000-0000-0000-000000000000',
        alumnoNombre: VALOR_EJEMPLO.nombre || 'Juan Pérez García',
        cursoNombre: VALOR_EJEMPLO.curso || 'Curso de ejemplo',
        fecha: '23/12/2026',
        cargo: VALOR_EJEMPLO.cargo,
        dni: tipo === 'imprimir' ? '12345678' : undefined,
        periodoInicio: '01/07/2026',
        periodoEntrega: '23/12/2026',
        periodoCierre: '31/12/2026',
        registro: '008116',
        libro: '08116',
        creditos: '30',
        meses: '06',
        horasLectivas: '480',
        asignaturas: [
          { nombre: 'Diseño y Manejo de Base de Datos', nota: 17 },
          { nombre: 'Microsoft Word', nota: 19 },
          { nombre: 'Microsoft Power Point', nota: 18 },
          { nombre: 'Microsoft Excel', nota: 17 },
        ],
      },
      paginas,
      tipo,
      orientacion
    );
    setPrevia(res);
  }

  const paginaObj = paginas[paginaActual];
  const campoActual = paginaObj?.campos.find((c) => c.id === campoSel) || null;
  const otroTipoLabel = tipo === 'digital' ? 'imprimir' : 'digital';

  return (
    <>
      <h1 className="titulo">Diseño del certificado</h1>
      <p className="sub">
        Crea y guarda tantos diseños como quieras por tipo de certificado, con tantas hojas y campos como necesites.
        Solo el diseño marcado como &quot;activo&quot; es el que se usa al emitir certificados.
      </p>

      <div className="tabs">
        <button type="button" className={`tab-btn${!mostrarLista && tipo === 'digital' ? ' activo' : ''}`} onClick={() => { setMostrarLista(false); setTipo('digital'); }}>
          Certificado digital
        </button>
        <button type="button" className={`tab-btn${!mostrarLista && tipo === 'imprimir' ? ' activo' : ''}`} onClick={() => { setMostrarLista(false); setTipo('imprimir'); }}>
          Certificado para imprimir
        </button>
        <button type="button" className={`tab-btn${mostrarLista ? ' activo' : ''}`} onClick={() => setMostrarLista(true)}>
          Diseños
        </button>
      </div>

      {mostrarLista ? (
        <GestionDisenos onEditar={irAlEditor} />
      ) : (
        <>
          <div className="card card-pad" style={{ marginTop: '.8rem', marginBottom: '1rem' }}>
            <div className="fila" style={{ flexWrap: 'wrap', gap: '.6rem', alignItems: 'flex-end' }}>
              <div>
                <label>Diseño</label>
                <select value={plantillaId ?? 'nuevo'} onChange={(e) => alCambiarSelector(e.target.value)}>
                  <option value="nuevo">— Nuevo diseño —</option>
                  {lista.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                      {d.activa ? ' ✓ activo' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label>Nombre del diseño</label>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Diseño 2026 - diplomado" />
              </div>
              <div>
                <label>Orientación</label>
                <select value={orientacion} onChange={(e) => setOrientacion(e.target.value as OrientacionPlantilla)}>
                  <option value="horizontal">Horizontal</option>
                  <option value="vertical">Vertical</option>
                </select>
              </div>
              {activa && <span className="tag activo">Activo</span>}
            </div>
            <div className="fila" style={{ flexWrap: 'wrap', gap: '.5rem', marginTop: '.7rem' }}>
              <button type="button" className="btn" onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando…' : plantillaId == null ? 'Crear diseño' : 'Guardar cambios'}
              </button>
              <button type="button" className="btn sec" onClick={guardarComoNuevo} disabled={guardando}>
                Guardar como nuevo
              </button>
              <button type="button" className="btn sec" onClick={marcarActiva} disabled={guardando || activa || plantillaId == null}>
                Marcar como activo
              </button>
              <button type="button" className="btn sec" onClick={copiarAOtroTipo} disabled={guardando}>
                Copiar estructura → Certificado para {otroTipoLabel}
              </button>
              <button type="button" className="btn sec" onClick={eliminar} disabled={guardando || plantillaId == null}>
                Eliminar diseño
              </button>
            </div>
            {aviso && <div className={`aviso ${aviso.tipo}`} style={{ marginTop: '.6rem' }}>{aviso.texto}</div>}
          </div>

          {cargando ? (
        <p>Cargando…</p>
      ) : (
        <div className="diseno-layout">
          <div className="card card-pad">
            <div className="tabs" style={{ marginBottom: '.6rem' }}>
              {paginas.map((_, i) => (
                <button key={i} type="button" className={`tab-btn${paginaActual === i ? ' activo' : ''}`} onClick={() => { setPaginaActual(i); setCampoSel(null); }}>
                  Hoja {i + 1}
                </button>
              ))}
              <button type="button" className="tab-btn" onClick={agregarPagina}>
                + Hoja
              </button>
              {paginas.length > 1 && (
                <button type="button" className="tab-btn" onClick={eliminarPaginaActual}>
                  Eliminar esta hoja
                </button>
              )}
            </div>

            <label>Imagen de fondo (Hoja {paginaActual + 1})</label>
            <FileDropzone
              accept="image/*"
              cargando={subiendo}
              onFile={(file) => subirImagenPagina(file, paginaActual)}
              icon={<span className="material-symbols-outlined">image</span>}
              label={imagenesPreview[paginaActual] ? 'Cambiar imagen' : 'Subir imagen'}
              ayuda="Imagen a página completa, A4 horizontal (opcional: puede quedar en blanco/transparente)"
            />

            <div ref={lienzoWrapRef} style={{ width: '100%' }}>
            <div
              className="diseno-lienzo"
              style={{
                width: anchoPaginaMM * escala,
                height: altoPaginaMM * escala,
                backgroundImage: imagenesPreview[paginaActual] ? `url(${imagenesPreview[paginaActual]})` : undefined,
              }}
            >
              {!imagenesPreview[paginaActual] && <p className="vacio">Sube una imagen o deja esta hoja transparente.</p>}
              {paginaObj?.campos.map((campo) => (
                <div
                  key={campo.id}
                  onPointerDown={(e) => alPresionarCampo(e, campo)}
                  className={`diseno-campo${campoSel === campo.id ? ' seleccionado' : ''}${campo.visible === false ? ' oculto' : ''}`}
                  style={{
                    left: campo.x * escala,
                    top: campo.y * escala,
                    fontFamily: campo.fontFamily === 'times' ? 'Georgia, serif' : campo.fontFamily === 'courier' ? '"Courier New", monospace' : undefined,
                    fontSize: campo.variable === 'qr' || campo.variable === 'tabla_notas' ? undefined : Math.max(9, (campo.fontSize || 12) * escala * 0.6),
                    fontWeight: campo.bold ? 700 : 400,
                    fontStyle: campo.italic ? 'italic' : 'normal',
                    color: campo.variable === 'qr' || campo.variable === 'tabla_notas' ? undefined : campo.color || '#1e1e1e',
                    maxWidth: campo.ancho ? campo.ancho * escala : undefined,
                    whiteSpace: campo.variable === 'texto_fijo' ? 'pre-wrap' : undefined,
                    textAlign: campo.align,
                  }}
                >
                  {campo.variable === 'qr' ? (
                    <div className="diseno-qr" style={{ width: (campo.size || 28) * escala, height: (campo.size || 28) * escala }}>
                      QR
                    </div>
                  ) : campo.variable === 'tabla_notas' ? (
                    <div className="diseno-tabla-notas" style={{ width: (campo.ancho || 180) * escala, fontSize: Math.max(9, (campo.fontSize || 10) * escala * 0.6) }}>
                      <div className="fila-tabla enc">Asignatura · en letras · en N°</div>
                      <div className="fila-tabla">Ej. Microsoft Word · Diecinueve · 19</div>
                      <div className="fila-tabla">Ej. Microsoft Excel · Diecisiete · 17</div>
                    </div>
                  ) : campo.variable === 'texto_fijo' ? (
                    campo.texto || '(texto vacío — escríbelo en el panel derecho)'
                  ) : (
                    VALOR_EJEMPLO[campo.variable] || campo.variable
                  )}
                </div>
              ))}
            </div>
            </div>
          </div>

          <div className="card card-pad">
            <h3 style={{ marginTop: 0 }}>Agregar campo</h3>
            <div className="fila" style={{ gap: '.4rem' }}>
              <select value={variableNueva} onChange={(e) => setVariableNueva(e.target.value as VariableCampo)} style={{ flex: 1 }}>
                {CATALOGO_CAMPOS.map((c) => (
                  <option key={c.variable} value={c.variable}>
                    {c.etiqueta}
                  </option>
                ))}
              </select>
              <button type="button" className="btn" onClick={agregarCampo}>
                + Agregar
              </button>
            </div>

            <h3 style={{ marginTop: '1rem' }}>Campos de esta hoja</h3>
            <div className="diseno-campos-lista">
              {paginaObj?.campos.length ? (
                paginaObj.campos.map((campo) => (
                  <button
                    key={campo.id}
                    type="button"
                    className={`diseno-campo-btn${campoSel === campo.id ? ' activo' : ''}`}
                    onClick={() => setCampoSel(campo.id)}
                  >
                    {etiquetaCampo(campo)}
                    {campo.visible === false && <span className="sub"> (oculto)</span>}
                  </button>
                ))
              ) : (
                <p className="sub">Esta hoja no tiene campos todavía.</p>
              )}
            </div>

            {campoActual && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--borde)', paddingTop: '.8rem' }}>
                <div className="fila" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="chk">
                    <input
                      type="checkbox"
                      checked={campoActual.visible !== false}
                      onChange={(e) => actualizarCampo(campoActual.id, { visible: e.target.checked })}
                    />
                    Visible
                  </label>
                  <div style={{ display: 'flex', gap: '.4rem' }}>
                    <button type="button" className="btn sec" onClick={() => duplicarCampo(campoActual)}>
                      Duplicar
                    </button>
                    <button type="button" className="btn sec" onClick={() => eliminarCampo(campoActual.id)}>
                      Eliminar
                    </button>
                  </div>
                </div>

                {campoActual.variable === 'texto_fijo' && (
                  <>
                    <label style={{ marginTop: '.6rem' }}>Texto (admite varias líneas)</label>
                    <textarea
                      rows={4}
                      value={campoActual.texto || ''}
                      onChange={(e) => actualizarCampo(campoActual.id, { texto: e.target.value })}
                    />
                  </>
                )}

                {campoActual.variable === 'qr' ? (
                  <>
                    <label style={{ marginTop: '.6rem' }}>Tamaño (mm)</label>
                    <input
                      type="number"
                      min={10}
                      max={80}
                      value={campoActual.size || 28}
                      onChange={(e) => actualizarCampo(campoActual.id, { size: Number(e.target.value) })}
                    />
                  </>
                ) : campoActual.variable === 'tabla_notas' ? (
                  <>
                    <label style={{ marginTop: '.6rem' }}>Ancho de la tabla (mm)</label>
                    <input
                      type="number"
                      min={80}
                      max={280}
                      value={campoActual.ancho || 180}
                      onChange={(e) => actualizarCampo(campoActual.id, { ancho: Number(e.target.value) })}
                    />
                    <label style={{ marginTop: '.4rem' }}>Alto de fila (mm)</label>
                    <input
                      type="number"
                      min={4}
                      max={20}
                      value={campoActual.filaAltura || 8}
                      onChange={(e) => actualizarCampo(campoActual.id, { filaAltura: Number(e.target.value) })}
                    />
                    <label style={{ marginTop: '.4rem' }}>Tamaño de letra</label>
                    <input
                      type="number"
                      min={6}
                      max={20}
                      value={campoActual.fontSize || 10}
                      onChange={(e) => actualizarCampo(campoActual.id, { fontSize: Number(e.target.value) })}
                    />
                    <label style={{ marginTop: '.4rem' }}>Tipografía</label>
                    <select value={campoActual.fontFamily || 'helvetica'} onChange={(e) => actualizarCampo(campoActual.id, { fontFamily: e.target.value as FuenteCampo })}>
                      <option value="helvetica">Helvetica</option>
                      <option value="times">Times</option>
                      <option value="courier">Courier</option>
                    </select>
                    <label style={{ marginTop: '.4rem' }}>Color</label>
                    <input
                      type="color"
                      value={campoActual.color || '#1e1e1e'}
                      onChange={(e) => actualizarCampo(campoActual.id, { color: e.target.value })}
                      style={{ padding: 2, height: 38 }}
                    />
                  </>
                ) : (
                  <>
                    <label style={{ marginTop: '.6rem' }}>Tamaño de letra</label>
                    <input
                      type="number"
                      min={6}
                      max={40}
                      value={campoActual.fontSize || 12}
                      onChange={(e) => actualizarCampo(campoActual.id, { fontSize: Number(e.target.value) })}
                    />
                    <label style={{ marginTop: '.6rem' }}>Tipografía</label>
                    <select value={campoActual.fontFamily || 'helvetica'} onChange={(e) => actualizarCampo(campoActual.id, { fontFamily: e.target.value as FuenteCampo })}>
                      <option value="helvetica">Helvetica</option>
                      <option value="times">Times</option>
                      <option value="courier">Courier</option>
                    </select>
                    <label style={{ marginTop: '.6rem' }}>Color</label>
                    <input
                      type="color"
                      value={campoActual.color || '#1e1e1e'}
                      onChange={(e) => actualizarCampo(campoActual.id, { color: e.target.value })}
                      style={{ padding: 2, height: 38 }}
                    />
                    <label className="chk" style={{ marginTop: '.4rem' }}>
                      <input type="checkbox" checked={!!campoActual.bold} onChange={(e) => actualizarCampo(campoActual.id, { bold: e.target.checked })} />
                      Negrita
                    </label>
                    <label className="chk" style={{ marginTop: '.2rem' }}>
                      <input type="checkbox" checked={!!campoActual.italic} onChange={(e) => actualizarCampo(campoActual.id, { italic: e.target.checked })} />
                      Cursiva
                    </label>
                    <label style={{ marginTop: '.4rem' }}>Alineación</label>
                    <select
                      value={campoActual.align || 'center'}
                      onChange={(e) => actualizarCampo(campoActual.id, { align: e.target.value as 'left' | 'center' | 'right' })}
                    >
                      <option value="left">Izquierda</option>
                      <option value="center">Centro</option>
                      <option value="right">Derecha</option>
                    </select>
                    <label style={{ marginTop: '.4rem' }}>Ancho máx. de wrap (mm, opcional)</label>
                    <input
                      type="number"
                      min={0}
                      max={280}
                      value={campoActual.ancho || ''}
                      onChange={(e) => actualizarCampo(campoActual.id, { ancho: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </>
                )}
                <p className="sub" style={{ fontSize: '.78rem', marginTop: '.6rem' }}>
                  Arrastra el campo sobre la imagen para moverlo.
                </p>
              </div>
            )}

            <button className="btn sec bloque" style={{ marginTop: '1rem' }} onClick={verVistaPrevia} type="button">
              Vista previa
            </button>
          </div>
        </div>
          )}
        </>
      )}

      <VistaPreviaCertificadoModal previa={previa} onClose={() => setPrevia(null)} />
    </>
  );
}

function GestionDisenos({ onEditar }: { onEditar: (tipo: TipoPlantilla, id: number) => void }) {
  const [cargando, setCargando] = useState(true);
  const [plantillas, setPlantillas] = useState<{ id: number; tipo: TipoPlantilla; nombre: string; activa: boolean; orientacion: OrientacionPlantilla }[]>([]);
  const [asignaciones, setAsignaciones] = useState<AsignacionCurso[]>([]);
  const [expandido, setExpandido] = useState<number | null>(null);
  const [filtroCurso, setFiltroCurso] = useState('');
  const [modalidadSel, setModalidadSel] = useState<ModalidadAsignacion>('general');
  const [guardandoAsignacion, setGuardandoAsignacion] = useState(false);
  const { cursos } = useCursosAdmin();

  async function cargar() {
    setCargando(true);
    const [p, a] = await Promise.all([listarTodasLasPlantillas(), listarAsignacionesCurso()]);
    setPlantillas(p);
    setAsignaciones(a);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  function cursosDe(plantillaId: number): AsignacionCurso[] {
    return asignaciones.filter((a) => a.plantilla_id === plantillaId);
  }

  function cursosDeEnModalidad(plantillaId: number, modalidad: ModalidadAsignacion): AsignacionCurso[] {
    return asignaciones.filter((a) => a.plantilla_id === plantillaId && a.modalidad === modalidad);
  }

  function asignadoAOtroEnModalidad(cursoId: number, tipo: TipoPlantilla, modalidad: ModalidadAsignacion, plantillaId: number): boolean {
    return asignaciones.some((a) => a.curso_id === cursoId && a.tipo === tipo && a.modalidad === modalidad && a.plantilla_id !== plantillaId);
  }

  async function alternarCurso(plantilla: { id: number; tipo: TipoPlantilla }, cursoId: number, modalidad: ModalidadAsignacion, yaAsignadoAEsta: boolean) {
    setGuardandoAsignacion(true);
    if (yaAsignadoAEsta) await quitarAsignacionCurso(cursoId, plantilla.tipo, modalidad);
    else await asignarDisenoACurso(plantilla.id, cursoId, plantilla.tipo, modalidad);
    await cargar();
    setGuardandoAsignacion(false);
  }

  const cursosFiltrados = cursos.filter((c) => c.nombre.toLowerCase().includes(filtroCurso.toLowerCase()));

  if (cargando) return <p>Cargando…</p>;

  return (
    <div className="card card-pad" style={{ marginTop: '.8rem' }}>
      <p className="sub" style={{ marginTop: 0 }}>
        Todos los diseños guardados, de ambos tipos. Asigna un diseño a uno o varios cursos para que ese curso use
        ese diseño puntual en vez del diseño &quot;activo&quot; general — útil cuando un curso necesita un certificado
        distinto al resto.
      </p>
      {plantillas.length === 0 ? (
        <p className="sub">Todavía no hay diseños guardados.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
          {plantillas.map((p) => {
            const cursosAsignados = cursosDe(p.id);
            return (
              <div key={p.id} className="card" style={{ padding: '.7rem .9rem' }}>
                <div className="fila" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.5rem' }}>
                  <div>
                    <strong>{p.nombre}</strong>{' '}
                    <span className="sub">
                      · {p.tipo === 'digital' ? 'Certificado digital' : 'Certificado para imprimir'} · {p.orientacion === 'vertical' ? 'Vertical' : 'Horizontal'}
                    </span>
                    {p.activa && (
                      <span className="tag activo" style={{ marginLeft: '.4rem' }}>
                        Activo por defecto
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '.4rem' }}>
                    <button type="button" className="btn sec" onClick={() => onEditar(p.tipo, p.id)}>
                      Editar
                    </button>
                    <button type="button" className="btn sec" onClick={() => setExpandido(expandido === p.id ? null : p.id)}>
                      {expandido === p.id ? 'Ocultar cursos' : `Cursos asignados (${cursosAsignados.length})`}
                    </button>
                  </div>
                </div>

                {expandido === p.id && (
                  <div style={{ marginTop: '.7rem', borderTop: '1px solid var(--borde)', paddingTop: '.6rem' }}>
                    <p className="sub" style={{ fontSize: '.78rem' }}>
                      Un mismo curso emite un certificado distinto según el canal: <strong>Directo</strong> (compró solo
                      el certificado) o <strong>Web</strong> (completó el curso con tareas/exámenes). Elige aquí a cuál
                      canal aplica esta asignación — <strong>General</strong> cubre ambos salvo que asignes uno
                      específico, que gana sobre el general. Un curso solo puede tener un diseño por tipo+canal —
                      marcarlo aquí se lo quita a cualquier otro diseño que ya lo tuviera en ese mismo canal.
                    </p>
                    <div className="fila" style={{ gap: '.4rem', marginBottom: '.5rem', flexWrap: 'wrap' }}>
                      <select value={modalidadSel} onChange={(e) => setModalidadSel(e.target.value as ModalidadAsignacion)} style={{ maxWidth: 220 }}>
                        <option value="general">General (ambos canales)</option>
                        <option value="directo">Solo certificados directos</option>
                        <option value="evaluado">Solo certificados web (evaluado)</option>
                      </select>
                      <input
                        placeholder="Buscar curso…"
                        value={filtroCurso}
                        onChange={(e) => setFiltroCurso(e.target.value)}
                        style={{ flex: 1, minWidth: 160 }}
                      />
                    </div>
                    <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
                      {cursosFiltrados.map((c) => {
                        const cursosEnModalidad = cursosDeEnModalidad(p.id, modalidadSel);
                        const yaAsignadoAEsta = cursosEnModalidad.some((a) => a.curso_id === c.id);
                        const enOtro = !yaAsignadoAEsta && asignadoAOtroEnModalidad(c.id, p.tipo, modalidadSel, p.id);
                        return (
                          <label key={c.id} className="chk">
                            <input
                              type="checkbox"
                              checked={yaAsignadoAEsta}
                              disabled={guardandoAsignacion}
                              onChange={() => alternarCurso(p, c.id, modalidadSel, yaAsignadoAEsta)}
                            />
                            {c.nombre}
                            {enOtro && <span className="sub"> (actualmente en otro diseño para este canal)</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
