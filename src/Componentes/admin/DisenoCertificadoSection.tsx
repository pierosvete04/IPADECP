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
} from '@/lib/certificado';
import { vistaPreviaDesdePaginas } from '@/lib/certificadoRender';
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
import Aviso from '@/Componentes/ui/Aviso';
import ConfirmDialog from '@/Componentes/ui/ConfirmDialog';
import { BloqueCargando } from './EstadoCarga';

const LADO_LARGO_RENDER_PX = 880;

const CATALOGO_CAMPOS: { variable: VariableCampo; etiqueta: string }[] = [
  { variable: 'cargo', etiqueta: 'Cargo profesional' },
  { variable: 'nombre', etiqueta: 'Nombre del alumno' },
  { variable: 'cargo_persona', etiqueta: 'Cargo + persona (combinado)' },
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
  { variable: 'tabla_notas', etiqueta: 'Tabla de asignaturas y notas (bloque)' },
  { variable: 'lista_modulos', etiqueta: 'Módulos — nombres (lista)' },
  { variable: 'lista_notas_letras', etiqueta: 'Notas en letras (lista)' },
  { variable: 'lista_notas_numeros', etiqueta: 'Notas en números (lista)' },
  { variable: 'texto_fijo', etiqueta: 'Texto fijo (párrafo)' },
];

// Solo el VALOR — sin la etiqueta ("Fecha:", "Registro N°:", etc.) delante. Un campo es un dato
// crudo: la etiqueta, si el diseño la necesita, ya va impresa en la imagen de fondo o en un campo
// de texto fijo aparte (así lo confirma el propio PDF: ver VALORES_CAMPO en certificadoRender.ts,
// que nunca antepuso esas etiquetas salvo en fecha/periodo/codigo — corregido en el mismo cambio).
const VALOR_EJEMPLO: Partial<Record<VariableCampo, string>> = {
  cargo: 'Ingeniero Industrial',
  nombre: 'Juan Pérez García',
  cargo_persona: 'Ingeniero Industrial. Juan Pérez García',
  curso: 'Gestión de la Calidad en Salud',
  fecha: '23/12/2026',
  fecha_inicio: '01/07/2026',
  fecha_termino: '31/12/2026',
  fecha_entrega: '23/12/2026',
  periodo: '01/07/2026 – 31/12/2026',
  creditos: '30',
  meses: '06',
  horas_lectivas: '480',
  registro: '008116',
  libro: '08116',
  codigo: '1234-5678',
};

const EJEMPLO_ASIGNATURAS = [
  { nombre: 'Microsoft Word', nota: 19 },
  { nombre: 'Microsoft Excel', nota: 17 },
];

const VALOR_EJEMPLO_MULTILINEA: Partial<Record<VariableCampo, string>> = {
  lista_modulos: EJEMPLO_ASIGNATURAS.map((a, i) => `Módulo ${i + 1}: ${a.nombre}`).join('\n'),
  lista_notas_letras: 'Diecinueve\nDiecisiete',
  lista_notas_numeros: '19\n17',
};

function idUnico(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

/** Convierte un tamaño de letra en puntos (la unidad que usa jsPDF, `doc.setFontSize`) a los
 * mismos px del lienzo del editor que usa `escala` (px por mm) para las posiciones. Antes esto
 * mezclaba pt con mm sin convertir y encima aplicaba un `* 0.6` inventado con un piso de 9px —
 * el resultado no guardaba relación con el tamaño real, así que el editor se veía "grandote" con
 * mucho margen entre campos y la vista previa (que sí usa los pt reales) salía chica y apretada
 * en comparación: dos escalas distintas para el mismo dato. 0.3528 es mm por punto (25.4/72),
 * el mismo factor que ya usa certificadoRender.ts para calcular el alto de línea. */
function fontSizePxDesdeEscala(pt: number, escala: number): number {
  return pt * 0.3528 * escala;
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
  if (variable === 'lista_modulos' || variable === 'lista_notas_letras' || variable === 'lista_notas_numeros') {
    return { ...base, fontSize: 11, ancho: 90 };
  }
  return { ...base, fontSize: 12, bold: false };
}

function etiquetaCampo(campo: CampoPlantilla): string {
  if (campo.variable === 'texto_fijo') {
    return campo.texto ? `Texto: "${campo.texto.slice(0, 24)}${campo.texto.length > 24 ? '…' : ''}"` : 'Texto fijo (vacío)';
  }
  return CATALOGO_CAMPOS.find((c) => c.variable === campo.variable)?.etiqueta || campo.variable;
}

/** Valor de ejemplo que se ve en el lienzo del editor para un campo de dato (no qr/tabla_notas,
 * que dibujan su propio contenido aparte). Con `mostrarLeyenda` antepone el nombre del campo del
 * catálogo — solo una ayuda visual para ubicarlo; nunca se guarda ni sale así en el PDF real (ver
 * VALORES_CAMPO en certificadoRender.ts, que jamás antepone el nombre del campo al dato). */
function contenidoCampo(campo: CampoPlantilla, mostrarLeyenda: boolean): string {
  const valor =
    campo.variable === 'texto_fijo'
      ? campo.texto || '(texto vacío — escríbelo en el panel derecho)'
      : VALOR_EJEMPLO_MULTILINEA[campo.variable] ?? VALOR_EJEMPLO[campo.variable] ?? campo.variable;
  if (!mostrarLeyenda || campo.variable === 'texto_fijo') return valor;
  return `${etiquetaCampo(campo)}: ${valor}`;
}

/** Misma familia tipográfica que usa el lienzo (y una aproximación razonable de las 3 fuentes
 * fijas que dibuja jsPDF: helvetica/times/courier) — la reutilizan tanto el estilo inline del
 * campo como `medirAnchoTextoPx`, para que "lo que se mide" sea "lo que se ve". */
function fontFamilyCss(fontFamily?: FuenteCampo): string {
  if (fontFamily === 'times') return 'Georgia, serif';
  if (fontFamily === 'courier') return '"Courier New", monospace';
  return 'Arial, Helvetica, sans-serif';
}

let ctxMedicionTexto: CanvasRenderingContext2D | null | undefined;

/** Ancho en px (del lienzo) de la línea más larga de `texto`, con la tipografía dada — usa
 * `CanvasRenderingContext2D.measureText`, la única forma de saber cuánto ocupa un texto sin
 * medir el DOM real. La usa `limitesHorizontalesCampo` para alinear por borde real, no por punto
 * de anclaje (ver ahí el porqué). Devuelve 0 en el servidor (no hay `document` en el primer render). */
function medirAnchoTextoPx(texto: string, fontFamilyCssStr: string, fontSizePx: number, bold: boolean, italic: boolean): number {
  if (typeof document === 'undefined') return 0;
  if (ctxMedicionTexto === undefined) ctxMedicionTexto = document.createElement('canvas').getContext('2d');
  if (!ctxMedicionTexto) return 0;
  ctxMedicionTexto.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSizePx}px ${fontFamilyCssStr}`;
  return Math.max(0, ...texto.split('\n').map((linea) => ctxMedicionTexto!.measureText(linea).width));
}

/** Borde izquierdo/derecho REAL de un campo en mm — no su punto de anclaje (x). Para casi todos
 * los campos, x es el punto de anclaje que jsPDF usa según `align` (izquierda/centro/derecha del
 * texto — ver VALORES_CAMPO y dibujarTexto en certificadoRender.ts), así que "alinear por x" solo
 * da un alineado de bordes real cuando además se sabe el ancho del texto. qr/tabla_notas son la
 * excepción: ahí x SIEMPRE es la esquina superior izquierda, sin importar `align`. */
function limitesHorizontalesCampo(campo: CampoPlantilla, escala: number): { izquierda: number; derecha: number } {
  if (campo.variable === 'qr') {
    const anchoMm = campo.size || 28;
    return { izquierda: campo.x, derecha: campo.x + anchoMm };
  }
  if (campo.variable === 'tabla_notas') {
    const anchoMm = campo.ancho || 180;
    return { izquierda: campo.x, derecha: campo.x + anchoMm };
  }
  const fontSizePx = fontSizePxDesdeEscala(campo.fontSize || 12, escala);
  const anchoPx = medirAnchoTextoPx(contenidoCampo(campo, false), fontFamilyCss(campo.fontFamily), fontSizePx, !!campo.bold, !!campo.italic);
  const anchoMm = anchoPx / escala;
  if (campo.align === 'left') return { izquierda: campo.x, derecha: campo.x + anchoMm };
  if (campo.align === 'right') return { izquierda: campo.x - anchoMm, derecha: campo.x };
  return { izquierda: campo.x - anchoMm / 2, derecha: campo.x + anchoMm / 2 };
}

interface PlantillaResumen {
  id: number;
  tipo: TipoPlantilla;
  nombre: string;
  activa: boolean;
  orientacion: OrientacionPlantilla;
}

/** Un diseño digital y uno para imprimir que comparten nombre (p. ej. uno creado a mano con el
 * mismo nombre en las dos pestañas, o el par que arma "Crear diseño"/"Copiar estructura" — que
 * los nombra "X (desde digital)"/"X (desde imprimir)") se muestran como una sola fila en la
 * pestaña "Diseños", en vez de dos filas sueltas que no dejan ver que son el mismo certificado
 * en sus dos formatos. */
interface GrupoDiseno {
  nombreBase: string;
  digital?: PlantillaResumen;
  imprimir?: PlantillaResumen;
}

function esGrupoDiseno(item: GrupoDiseno | PlantillaResumen): item is GrupoDiseno {
  return 'nombreBase' in item;
}

/** Agrupa por nombre base (quitando el sufijo "(desde digital)"/"(desde imprimir)" que agrega la
 * copia automática). Solo agrupa cuando hay COMO MUCHO un diseño de cada tipo con ese nombre —
 * si dos diseños del mismo tipo coinciden en nombre (nombres repetidos a mano), la agrupación es
 * ambigua y se listan sueltos: mejor una fila de más que ocultar un diseño que existe. */
function agruparPlantillas(plantillas: PlantillaResumen[]): (GrupoDiseno | PlantillaResumen)[] {
  const porNombre = new Map<string, PlantillaResumen[]>();
  for (const p of plantillas) {
    const base = p.nombre.replace(/ \(desde (digital|imprimir)\)$/, '');
    const filas = porNombre.get(base);
    if (filas) filas.push(p);
    else porNombre.set(base, [p]);
  }
  const resultado: (GrupoDiseno | PlantillaResumen)[] = [];
  for (const [nombreBase, filas] of porNombre) {
    const digitales = filas.filter((f) => f.tipo === 'digital');
    const imprimires = filas.filter((f) => f.tipo === 'imprimir');
    if (digitales.length <= 1 && imprimires.length <= 1) {
      resultado.push({ nombreBase, digital: digitales[0], imprimir: imprimires[0] });
    } else {
      resultado.push(...filas);
    }
  }
  return resultado;
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
  // Varios campos pueden estar seleccionados a la vez (clic con Ctrl/Cmd/Shift, o arrastrando
  // uno que ya forma parte de la selección) — para mover, alinear o cambiarles el estilo juntos.
  const [camposSel, setCamposSel] = useState<string[]>([]);
  // Rectángulo de selección "por lazo" en curso (px relativos al lienzo) — null cuando no se
  // está arrastrando uno. Ver `alPresionarLienzo`.
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [variableNueva, setVariableNueva] = useState<VariableCampo>('texto_fijo');
  // Solo ayuda visual mientras se posicionan los campos — nunca se guarda ni sale en el PDF (ver
  // VALORES_CAMPO en certificadoRender.ts, que nunca antepone el nombre del campo al dato).
  const [mostrarLeyenda, setMostrarLeyenda] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  // Confirmaciones que antes eran window.confirm().
  const [paginaABorrar, setPaginaABorrar] = useState<number | null>(null);
  const [disenoABorrar, setDisenoABorrar] = useState(false);
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
    setCamposSel([]);
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
    setCamposSel([]);
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

  /** Aplica los mismos cambios a varios campos a la vez — la usan tanto el panel de un solo
   * campo (`actualizarCampo`, un id) como el panel de selección múltiple (tamaño, color, etc.
   * para todos los seleccionados de una vez). */
  function actualizarCampos(ids: string[], cambios: Partial<CampoPlantilla>) {
    setPaginas((prev) => prev.map((p, i) => (i !== paginaActual ? p : { ...p, campos: p.campos.map((c) => (ids.includes(c.id) ? { ...c, ...cambios } : c)) })));
  }

  /** Igual que `actualizarCampos`, pero cada campo recibe un cambio DISTINTO — la usa `alinearCampos`,
   * donde cada campo se corre una cantidad distinta (su propia distancia al borde/centro objetivo). */
  function actualizarCamposIndividualmente(cambiosPorId: Map<string, Partial<CampoPlantilla>>) {
    setPaginas((prev) =>
      prev.map((p, i) => (i !== paginaActual ? p : { ...p, campos: p.campos.map((c) => (cambiosPorId.has(c.id) ? { ...c, ...cambiosPorId.get(c.id) } : c)) }))
    );
  }

  function actualizarCampo(id: string, cambios: Partial<CampoPlantilla>) {
    actualizarCampos([id], cambios);
  }

  function agregarCampo() {
    const nuevo = nuevoCampoPorVariable(variableNueva, anchoPaginaMM, altoPaginaMM);
    setPaginas((prev) => prev.map((p, i) => (i !== paginaActual ? p : { ...p, campos: [...p.campos, nuevo] })));
    setCamposSel([nuevo.id]);
  }

  function eliminarCampos(ids: string[]) {
    setPaginas((prev) => prev.map((p, i) => (i !== paginaActual ? p : { ...p, campos: p.campos.filter((c) => !ids.includes(c.id)) })));
    setCamposSel([]);
  }

  function eliminarCampo(id: string) {
    eliminarCampos([id]);
  }

  function duplicarCampo(campo: CampoPlantilla) {
    const copia: CampoPlantilla = { ...campo, id: idUnico(), x: Math.min(anchoPaginaMM, campo.x + 8), y: Math.min(altoPaginaMM, campo.y + 8) };
    setPaginas((prev) => prev.map((p, i) => (i !== paginaActual ? p : { ...p, campos: [...p.campos, copia] })));
    setCamposSel([copia.id]);
  }

  function duplicarSeleccionados() {
    const seleccionados = paginaObj?.campos.filter((c) => camposSel.includes(c.id)) || [];
    const copias: CampoPlantilla[] = seleccionados.map((c) => ({ ...c, id: idUnico(), x: Math.min(anchoPaginaMM, c.x + 8), y: Math.min(altoPaginaMM, c.y + 8) }));
    setPaginas((prev) => prev.map((p, i) => (i !== paginaActual ? p : { ...p, campos: [...p.campos, ...copias] })));
    setCamposSel(copias.map((c) => c.id));
  }

  /** Alinea los campos seleccionados entre sí — igual que "alinear objetos" en Illustrator/Figma.
   * Necesita ≥2 campos: con uno solo no hay contra qué alinear (para centrar un campo en la hoja
   * está `centrarEnPagina`).
   *
   * Horizontal: antes esto igualaba directamente el `x` (el punto de anclaje) de todos los
   * campos — pero x NO es el borde izquierdo del texto, es el punto que jsPDF usa según `align`
   * (izquierda/centro/derecha del texto, ver VALORES_CAMPO en certificadoRender.ts). Como casi
   * todos los campos usan align "centro", igualar x en realidad alineaba sus CENTROS —
   * "Izquierda" terminaba viéndose igual que "Centro H". Ahora se calcula el borde real de cada
   * campo con `limitesHorizontalesCampo` (que sí conoce su align y mide el ancho del texto) y se
   * corre cada uno la distancia que le falta a SU PROPIO x para llegar al borde objetivo. */
  function alinearCampos(ids: string[], modo: 'izquierda' | 'centroH' | 'derecha' | 'arriba' | 'centroV' | 'abajo') {
    const seleccionados = paginaObj?.campos.filter((c) => ids.includes(c.id)) || [];
    if (seleccionados.length < 2) return;

    if (modo === 'izquierda' || modo === 'centroH' || modo === 'derecha') {
      const limites = seleccionados.map((c) => ({ campo: c, ...limitesHorizontalesCampo(c, escala) }));
      const objetivo =
        modo === 'izquierda'
          ? Math.min(...limites.map((l) => l.izquierda))
          : modo === 'derecha'
            ? Math.max(...limites.map((l) => l.derecha))
            : (Math.min(...limites.map((l) => l.izquierda)) + Math.max(...limites.map((l) => l.derecha))) / 2;
      const cambios = new Map<string, Partial<CampoPlantilla>>();
      for (const l of limites) {
        const bordeActual = modo === 'izquierda' ? l.izquierda : modo === 'derecha' ? l.derecha : (l.izquierda + l.derecha) / 2;
        cambios.set(l.campo.id, { x: l.campo.x + (objetivo - bordeActual) });
      }
      actualizarCamposIndividualmente(cambios);
      return;
    }

    // Vertical: y sigue siendo el punto de anclaje (aprox. la línea base del texto en el PDF) sin
    // medir alto de línea — el desfase entre campos de tamaños de letra muy distintos es mucho
    // menor que el del eje horizontal, así que alinear directo por y es una aproximación razonable.
    const ys = seleccionados.map((c) => c.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    if (modo === 'arriba') actualizarCampos(ids, { y: minY });
    else if (modo === 'abajo') actualizarCampos(ids, { y: maxY });
    else actualizarCampos(ids, { y: (minY + maxY) / 2 });
  }

  /** Centra cada campo seleccionado en el eje de la hoja (uno o varios a la vez) — cada campo
   * queda en el centro exacto, no en el centro del grupo (para eso está `alinearCampos`). */
  function centrarEnPagina(ids: string[], eje: 'x' | 'y') {
    if (eje === 'x') actualizarCampos(ids, { x: anchoPaginaMM / 2 });
    else actualizarCampos(ids, { y: altoPaginaMM / 2 });
  }

  function agregarPagina() {
    setPaginas((prev) => [...prev, paginaVacia()]);
    setImagenesPreview((prev) => [...prev, null]);
    setPaginaActual(paginas.length);
    setCamposSel([]);
  }

  // `window.confirm` bloquea el hilo, no se puede estilar, sale del contexto
  // de la app y sus botones dicen "Aceptar"/"Cancelar" en vez de nombrar la
  // acción. ConfirmDialog existe justamente para reemplazarlo (ver su
  // docstring) y ya lo usan el resto de las secciones.
  function confirmarEliminarPagina() {
    setPaginas((prev) => prev.filter((_, i) => i !== paginaActual));
    setImagenesPreview((prev) => prev.filter((_, i) => i !== paginaActual));
    setPaginaActual(0);
    setCamposSel([]);
    setPaginaABorrar(null);
  }

  function alPresionarCampo(e: React.PointerEvent, campo: CampoPlantilla) {
    e.preventDefault();
    // Sin esto, el mismo pointerdown también le llega al lienzo (los eventos suben) y
    // `alPresionarLienzo` interpretaría el clic sobre el campo como el arranque de un
    // rectángulo de selección en el fondo, en vez de una selección/arrastre del campo.
    e.stopPropagation();

    // Clic con Ctrl/Cmd/Shift: solo suma o quita el campo de la selección — como en
    // Illustrator/Figma — sin arrastrar nada en ese mismo gesto.
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      setCamposSel((prev) => (prev.includes(campo.id) ? prev.filter((id) => id !== campo.id) : [...prev, campo.id]));
      return;
    }

    // Un clic simple sobre un campo que YA forma parte de la selección arrastra el grupo entero
    // (misma convención); sobre cualquier otro campo, colapsa la selección a ese campo solo.
    const grupo = camposSel.includes(campo.id) && camposSel.length > 1 ? camposSel : [campo.id];
    setCamposSel(grupo);

    const inicioX = e.clientX;
    const inicioY = e.clientY;
    const posicionesIniciales = new Map((paginaObj?.campos || []).filter((c) => grupo.includes(c.id)).map((c) => [c.id, { x: c.x, y: c.y }]));

    function alMover(ev: PointerEvent) {
      const deltaXmm = (ev.clientX - inicioX) / escala;
      const deltaYmm = (ev.clientY - inicioY) / escala;
      setPaginas((prev) =>
        prev.map((p, i) =>
          i !== paginaActual
            ? p
            : {
                ...p,
                campos: p.campos.map((c) => {
                  const inicial = posicionesIniciales.get(c.id);
                  if (!inicial) return c;
                  return {
                    ...c,
                    x: Math.min(anchoPaginaMM, Math.max(0, inicial.x + deltaXmm)),
                    y: Math.min(altoPaginaMM, Math.max(0, inicial.y + deltaYmm)),
                  };
                }),
              }
        )
      );
    }
    function alSoltar() {
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('pointerup', alSoltar);
    }
    window.addEventListener('pointermove', alMover);
    window.addEventListener('pointerup', alSoltar);
  }

  /** Selección "por lazo": clic y arrastre sobre el fondo del lienzo (no sobre un campo — esos
   * paran la propagación en `alPresionarCampo`) dibuja un rectángulo, y todo campo cuyo punto de
   * anclaje (x,y) cae dentro queda seleccionado al soltar. Sin Ctrl/Cmd/Shift reemplaza la
   * selección; con alguno de esos mantenidos, suma a la que ya había — igual que Illustrator/Figma. */
  function alPresionarLienzo(e: React.PointerEvent<HTMLDivElement>) {
    const lienzo = e.currentTarget;
    const rectLienzo = lienzo.getBoundingClientRect();
    const inicioXpx = e.clientX - rectLienzo.left;
    const inicioYpx = e.clientY - rectLienzo.top;
    const sumar = e.ctrlKey || e.metaKey || e.shiftKey;
    const seleccionPrevia = sumar ? camposSel : [];
    const campos = paginaObj?.campos || [];

    setMarquee({ x0: inicioXpx, y0: inicioYpx, x1: inicioXpx, y1: inicioYpx });

    function alMover(ev: PointerEvent) {
      const xPx = ev.clientX - rectLienzo.left;
      const yPx = ev.clientY - rectLienzo.top;
      setMarquee({ x0: inicioXpx, y0: inicioYpx, x1: xPx, y1: yPx });

      const minX = Math.min(inicioXpx, xPx);
      const maxX = Math.max(inicioXpx, xPx);
      const minY = Math.min(inicioYpx, yPx);
      const maxY = Math.max(inicioYpx, yPx);
      const dentro = campos
        .filter((c) => c.x * escala >= minX && c.x * escala <= maxX && c.y * escala >= minY && c.y * escala <= maxY)
        .map((c) => c.id);
      setCamposSel(Array.from(new Set([...seleccionPrevia, ...dentro])));
    }
    function alSoltar() {
      setMarquee(null);
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('pointerup', alSoltar);
    }
    window.addEventListener('pointermove', alMover);
    window.addEventListener('pointerup', alSoltar);
  }

  /** Copia la estructura actual (páginas + campos, sin imagen de fondo) como un diseño nuevo del
   * otro tipo. La usan tanto `guardar` (automático al crear) como `copiarAOtroTipo` (manual). */
  async function crearCopiaEnOtroTipo(nombreBase: string) {
    const otroTipo: TipoPlantilla = tipo === 'digital' ? 'imprimir' : 'digital';
    const paginasCopia: PaginaPlantilla[] = paginas.map((p) => ({ imagen_url: null, campos: p.campos.map((c) => ({ ...c })) }));
    const nombreCopia = `${nombreBase} (desde ${tipo === 'digital' ? 'digital' : 'imprimir'})`;
    const { error } = await supabase.from('plantillas_certificado').insert({ tipo: otroTipo, nombre: nombreCopia, activa: false, orientacion, paginas: paginasCopia });
    return { otroTipo, nombreCopia, error };
  }

  async function guardar() {
    setGuardando(true);
    setAviso(null);
    if (plantillaId == null) {
      const { data, error } = await supabase.from('plantillas_certificado').insert({ tipo, nombre, activa: false, orientacion, paginas }).select('id').single();
      if (error) {
        setGuardando(false);
        setAviso({ texto: mensajeError(error), tipo: 'err' });
        return;
      }
      setPlantillaId(data.id);
      setLista((prev) => [{ id: data.id, nombre, activa: false }, ...prev]);

      // Todo certificado se emite en los dos formatos a la vez (digital + para imprimir — ver
      // GenerarCertificadoModal), así que al crear el primer diseño de un tipo conviene que el
      // otro tipo también arranque con la misma estructura, en vez de quedarse con el layout fijo
      // de respaldo hasta que alguien se acuerde de entrar a la otra pestaña y darle a "Copiar
      // estructura" a mano. Si esta parte falla, el diseño principal ya quedó guardado igual —
      // se avisa pero no se trata como error de la acción que el admin pidió.
      const { otroTipo, nombreCopia, error: errorOtro } = await crearCopiaEnOtroTipo(nombre);
      setGuardando(false);
      const otroLabel = otroTipo === 'imprimir' ? 'para imprimir' : 'digital';
      if (errorOtro) {
        setAviso({
          texto: `Diseño creado y guardado. Aviso: no se pudo crear automáticamente la versión "${otroLabel}" (${mensajeError(errorOtro)}) — usa "Copiar estructura" para intentarlo de nuevo.`,
          tipo: 'err',
        });
        return;
      }
      setAviso({
        texto: `Diseño creado y guardado. También se creó automáticamente "${nombreCopia}" en Certificado ${otroLabel} con la misma estructura (sin imagen de fondo) — revísalo y márcalo como activo cuando quieras.`,
        tipo: 'ok',
      });
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

  async function eliminar(): Promise<string | void> {
    if (plantillaId == null) return;
    setGuardando(true);
    setAviso(null);
    const { error } = await supabase.from('plantillas_certificado').delete().eq('id', plantillaId);
    setGuardando(false);
    if (error) return mensajeError(error);
    setDisenoABorrar(false);
    const restante = lista.filter((d) => d.id !== plantillaId);
    setLista(restante);
    if (restante[0]) await cargarDiseno(restante[0].id);
    else nuevoDiseno();
    setAviso({ texto: 'Diseño eliminado.', tipo: 'ok' });
  }

  async function copiarAOtroTipo() {
    setGuardando(true);
    setAviso(null);
    const { otroTipo, nombreCopia, error } = await crearCopiaEnOtroTipo(nombre);
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
    setAviso(null);
    try {
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
    } catch (e) {
      // Antes, si jsPDF fallaba a mitad de dibujo (una imagen de fondo corrupta, un campo con
      // datos raros), la promesa rechazaba sin que nadie la esperara — el botón "Vista previa"
      // no hacía nada visible y el único rastro quedaba en la consola del navegador, que un admin
      // no revisa. Ahora se avisa con el motivo real en vez de dejar el modal en blanco o cerrado
      // sin explicación.
      setAviso({ texto: `No se pudo generar la vista previa: ${e instanceof Error ? e.message : 'error desconocido'}`, tipo: 'err' });
    }
  }

  const paginaObj = paginas[paginaActual];
  // El panel de un solo campo (con todos sus controles específicos por variable) solo tiene
  // sentido con exactamente un campo seleccionado; con 0 o 2+ manda el panel de selección múltiple.
  const campoActual = camposSel.length === 1 ? paginaObj?.campos.find((c) => c.id === camposSel[0]) || null : null;
  const otroTipoLabel = tipo === 'digital' ? 'imprimir' : 'digital';

  return (
    <>
      <h1 className="titulo">Diseño del certificado</h1>
      <p className="sub">
        Crea y guarda tantos diseños como quieras por tipo de certificado, con tantas hojas y campos como necesites.
        Solo el diseño marcado como &quot;activo&quot; es el que se usa al emitir certificados.
      </p>

      {/* Tres estados excluyentes en una sola dimensión: son pestañas de
          verdad, así que van con role="tablist" y navegación por flechas en
          vez de tres <button> que solo se distinguen por el color del borde. */}
      <div className="tabs" role="tablist" aria-label="Tipo de certificado">
        <button
          type="button"
          role="tab"
          aria-selected={!mostrarLista && tipo === 'digital'}
          tabIndex={!mostrarLista && tipo === 'digital' ? 0 : -1}
          className={`tab-btn${!mostrarLista && tipo === 'digital' ? ' activo' : ''}`}
          onClick={() => {
            setMostrarLista(false);
            setTipo('digital');
          }}
        >
          Certificado digital
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!mostrarLista && tipo === 'imprimir'}
          tabIndex={!mostrarLista && tipo === 'imprimir' ? 0 : -1}
          className={`tab-btn${!mostrarLista && tipo === 'imprimir' ? ' activo' : ''}`}
          onClick={() => {
            setMostrarLista(false);
            setTipo('imprimir');
          }}
        >
          Certificado para imprimir
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mostrarLista}
          tabIndex={mostrarLista ? 0 : -1}
          className={`tab-btn${mostrarLista ? ' activo' : ''}`}
          onClick={() => setMostrarLista(true)}
        >
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
              <button type="button" className="btn sec" onClick={() => setDisenoABorrar(true)} disabled={guardando || plantillaId == null}>
                Eliminar diseño
              </button>
            </div>
            <Aviso tipo={aviso?.tipo ?? 'err'} mensaje={aviso?.texto} />
          </div>

          {cargando ? (
        <BloqueCargando />
      ) : (
        <div className="diseno-layout">
          <div className="card card-pad">
            {/* Selector de hoja + acciones. No es un tablist (mezcla
                selección con "añadir" y "eliminar"), así que la hoja activa
                se marca con aria-pressed: la señal no puede ser solo el
                color del borde inferior. */}
            <div className="tabs" style={{ marginBottom: '.6rem' }}>
              {paginas.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={paginaActual === i}
                  className={`tab-btn${paginaActual === i ? ' activo' : ''}`}
                  onClick={() => {
                    setPaginaActual(i);
                    setCamposSel([]);
                  }}
                >
                  Hoja {i + 1}
                </button>
              ))}
              <button type="button" className="tab-btn" onClick={agregarPagina}>
                + Hoja
              </button>
              {paginas.length > 1 && (
                <button
                  type="button"
                  className="tab-btn"
                  onClick={() => setPaginaABorrar(paginaActual)}
                  disabled={paginas.length <= 1}
                >
                  Eliminar la hoja {paginaActual + 1}
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

            <label className="chk sep-md">
              <input type="checkbox" checked={mostrarLeyenda} onChange={(e) => setMostrarLeyenda(e.target.checked)} />
              Mostrar nombre de campo (leyenda) — solo para ubicar, no sale en el certificado
            </label>

            <div ref={lienzoWrapRef} style={{ width: '100%' }}>
            <div
              className="diseno-lienzo"
              onPointerDown={alPresionarLienzo}
              style={{
                width: anchoPaginaMM * escala,
                height: altoPaginaMM * escala,
                backgroundImage: imagenesPreview[paginaActual] ? `url(${imagenesPreview[paginaActual]})` : undefined,
              }}
            >
              {!imagenesPreview[paginaActual] && <p className="vacio">Sube una imagen o deja esta hoja transparente.</p>}
              {marquee && (
                <div
                  className="diseno-marquee"
                  style={{
                    left: Math.min(marquee.x0, marquee.x1),
                    top: Math.min(marquee.y0, marquee.y1),
                    width: Math.abs(marquee.x1 - marquee.x0),
                    height: Math.abs(marquee.y1 - marquee.y0),
                  }}
                />
              )}
              {paginaObj?.campos.map((campo) => {
                // El ancla (x,y) de qr/tabla_notas SIEMPRE es su esquina superior izquierda en el
                // PDF real (ver dibujarTablaNotas y el addImage del QR en certificadoRender.ts),
                // sin importar `align`; para el resto, x es izquierda/centro/derecha del texto
                // según `align` — igual que interpreta jsPDF. Antes el CSS centraba TODO en (x,y)
                // sin mirar ninguna de las dos cosas, así que el punto donde arrastrabas un campo
                // no era el punto que terminaba en el PDF.
                const esBloque = campo.variable === 'qr' || campo.variable === 'tabla_notas';
                const transformX = esBloque ? '0' : campo.align === 'left' ? '0' : campo.align === 'right' ? '-100%' : '-50%';
                const transformY = esBloque ? '0' : '-50%';
                return (
                <div
                  key={campo.id}
                  onPointerDown={(e) => alPresionarCampo(e, campo)}
                  className={`diseno-campo${camposSel.includes(campo.id) ? ' seleccionado' : ''}${campo.visible === false ? ' oculto' : ''}`}
                  style={{
                    left: campo.x * escala,
                    top: campo.y * escala,
                    transform: `translate(${transformX}, ${transformY})`,
                    fontFamily: esBloque ? undefined : fontFamilyCss(campo.fontFamily),
                    fontSize: esBloque ? undefined : fontSizePxDesdeEscala(campo.fontSize || 12, escala),
                    fontWeight: campo.bold ? 700 : 400,
                    fontStyle: campo.italic ? 'italic' : 'normal',
                    color: esBloque ? undefined : campo.color || '#1e1e1e',
                    maxWidth: campo.ancho ? campo.ancho * escala : undefined,
                    whiteSpace: campo.variable === 'texto_fijo' || campo.variable in VALOR_EJEMPLO_MULTILINEA ? 'pre-wrap' : undefined,
                    textAlign: campo.align,
                  }}
                >
                  {campo.variable === 'qr' ? (
                    <div className="diseno-qr" style={{ width: (campo.size || 28) * escala, height: (campo.size || 28) * escala }}>
                      QR
                    </div>
                  ) : campo.variable === 'tabla_notas' ? (
                    <div className="diseno-tabla-notas" style={{ width: (campo.ancho || 180) * escala, fontSize: fontSizePxDesdeEscala(campo.fontSize || 10, escala) }}>
                      <div className="fila-tabla enc">Asignatura · en letras · en N°</div>
                      <div className="fila-tabla">Ej. Microsoft Word · Diecinueve · 19</div>
                      <div className="fila-tabla">Ej. Microsoft Excel · Diecisiete · 17</div>
                    </div>
                  ) : (
                    contenidoCampo(campo, mostrarLeyenda)
                  )}
                </div>
                );
              })}
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

            <h3 className="sep-lg">Campos de esta hoja</h3>
            <p className="sub" style={{ marginTop: '-.3rem', fontSize: '.78rem' }}>
              Ctrl/Cmd/Shift + clic (aquí o en el lienzo) para seleccionar varios a la vez.
            </p>
            <div className="diseno-campos-lista">
              {paginaObj?.campos.length ? (
                paginaObj.campos.map((campo) => (
                  <button
                    key={campo.id}
                    type="button"
                    className={`diseno-campo-btn${camposSel.includes(campo.id) ? ' activo' : ''}`}
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey || e.shiftKey) {
                        setCamposSel((prev) => (prev.includes(campo.id) ? prev.filter((id) => id !== campo.id) : [...prev, campo.id]));
                      } else {
                        setCamposSel([campo.id]);
                      }
                    }}
                  >
                    {etiquetaCampo(campo)}
                    {campo.visible === false && <span className="sub"> (oculto)</span>}
                  </button>
                ))
              ) : (
                <p className="sub">Esta hoja no tiene campos todavía.</p>
              )}
            </div>

            {camposSel.length >= 1 && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--borde)', paddingTop: '.8rem' }}>
                <label className="sep-sm">
                  Centrar en la hoja {camposSel.length > 1 ? `(${camposSel.length} campos, cada uno a su propio centro)` : ''}
                </label>
                <div className="fila" style={{ gap: '.4rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn sec" onClick={() => centrarEnPagina(camposSel, 'x')}>
                    Centrar horizontal
                  </button>
                  <button type="button" className="btn sec" onClick={() => centrarEnPagina(camposSel, 'y')}>
                    Centrar vertical
                  </button>
                </div>
              </div>
            )}

            {camposSel.length > 1 && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--borde)', paddingTop: '.8rem' }}>
                <div className="fila" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.4rem' }}>
                  <strong>{camposSel.length} campos seleccionados</strong>
                  <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                    <button type="button" className="btn sec" onClick={duplicarSeleccionados}>
                      Duplicar
                    </button>
                    <button type="button" className="btn sec" onClick={() => eliminarCampos(camposSel)}>
                      Eliminar
                    </button>
                    <button type="button" className="btn sec" onClick={() => setCamposSel([])}>
                      Deseleccionar
                    </button>
                  </div>
                </div>

                <label className="sep-md">Alinear entre sí (borde/centro de la propia selección)</label>
                <div className="fila" style={{ gap: '.3rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn sec" onClick={() => alinearCampos(camposSel, 'izquierda')}>
                    ⟸ Izquierda
                  </button>
                  <button type="button" className="btn sec" onClick={() => alinearCampos(camposSel, 'centroH')}>
                    Centro H
                  </button>
                  <button type="button" className="btn sec" onClick={() => alinearCampos(camposSel, 'derecha')}>
                    Derecha ⟹
                  </button>
                  <button type="button" className="btn sec" onClick={() => alinearCampos(camposSel, 'arriba')}>
                    ⟰ Arriba
                  </button>
                  <button type="button" className="btn sec" onClick={() => alinearCampos(camposSel, 'centroV')}>
                    Centro V
                  </button>
                  <button type="button" className="btn sec" onClick={() => alinearCampos(camposSel, 'abajo')}>
                    Abajo ⟱
                  </button>
                </div>

                <label className="sep-md">Cambiar estilo a los {camposSel.length} a la vez</label>
                <p className="sub" style={{ fontSize: '.78rem', marginTop: '-.2rem' }}>
                  Vacío = no tocar ese campo en los que no lo cambies.
                </p>
                <label className="sep-sm">Tamaño de letra</label>
                <input
                  type="number"
                  min={6}
                  max={40}
                  placeholder="— sin cambiar —"
                  onChange={(e) => e.target.value && actualizarCampos(camposSel, { fontSize: Number(e.target.value) })}
                />
                <label className="sep-sm">Tipografía</label>
                <select defaultValue="" onChange={(e) => e.target.value && actualizarCampos(camposSel, { fontFamily: e.target.value as FuenteCampo })}>
                  <option value="">— sin cambiar —</option>
                  <option value="helvetica">Helvetica</option>
                  <option value="times">Times</option>
                  <option value="courier">Courier</option>
                </select>
                <label className="sep-sm">Color</label>
                <input type="color" defaultValue="#1e1e1e" onChange={(e) => actualizarCampos(camposSel, { color: e.target.value })} style={{ padding: 2, height: 38 }} />
                <div className="fila" style={{ gap: '.6rem', marginTop: '.4rem' }}>
                  <button type="button" className="btn sec" onClick={() => actualizarCampos(camposSel, { bold: true })}>
                    Negrita
                  </button>
                  <button type="button" className="btn sec" onClick={() => actualizarCampos(camposSel, { bold: false })}>
                    Quitar negrita
                  </button>
                  <button type="button" className="btn sec" onClick={() => actualizarCampos(camposSel, { italic: true })}>
                    Cursiva
                  </button>
                  <button type="button" className="btn sec" onClick={() => actualizarCampos(camposSel, { italic: false })}>
                    Quitar cursiva
                  </button>
                </div>
                <label className="sep-sm">Alineación de texto</label>
                <select defaultValue="" onChange={(e) => e.target.value && actualizarCampos(camposSel, { align: e.target.value as 'left' | 'center' | 'right' })}>
                  <option value="">— sin cambiar —</option>
                  <option value="left">Izquierda</option>
                  <option value="center">Centro</option>
                  <option value="right">Derecha</option>
                </select>
              </div>
            )}

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
                    <label className="sep-md">Texto (admite varias líneas)</label>
                    <textarea
                      rows={4}
                      value={campoActual.texto || ''}
                      onChange={(e) => actualizarCampo(campoActual.id, { texto: e.target.value })}
                    />
                  </>
                )}

                {campoActual.variable === 'qr' ? (
                  <>
                    <label className="sep-md">Tamaño (mm)</label>
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
                    <label className="sep-md">Ancho de la tabla (mm)</label>
                    <input
                      type="number"
                      min={80}
                      max={280}
                      value={campoActual.ancho || 180}
                      onChange={(e) => actualizarCampo(campoActual.id, { ancho: Number(e.target.value) })}
                    />
                    <label className="sep-sm">Alto de fila (mm)</label>
                    <input
                      type="number"
                      min={4}
                      max={20}
                      value={campoActual.filaAltura || 8}
                      onChange={(e) => actualizarCampo(campoActual.id, { filaAltura: Number(e.target.value) })}
                    />
                    <label className="sep-sm">Tamaño de letra</label>
                    <input
                      type="number"
                      min={6}
                      max={20}
                      value={campoActual.fontSize || 10}
                      onChange={(e) => actualizarCampo(campoActual.id, { fontSize: Number(e.target.value) })}
                    />
                    <label className="sep-sm">Tipografía</label>
                    <select value={campoActual.fontFamily || 'helvetica'} onChange={(e) => actualizarCampo(campoActual.id, { fontFamily: e.target.value as FuenteCampo })}>
                      <option value="helvetica">Helvetica</option>
                      <option value="times">Times</option>
                      <option value="courier">Courier</option>
                    </select>
                    <label className="sep-sm">Color</label>
                    <input
                      type="color"
                      value={campoActual.color || '#1e1e1e'}
                      onChange={(e) => actualizarCampo(campoActual.id, { color: e.target.value })}
                      style={{ padding: 2, height: 38 }}
                    />
                  </>
                ) : (
                  <>
                    <label className="sep-md">Tamaño de letra</label>
                    <input
                      type="number"
                      min={6}
                      max={40}
                      value={campoActual.fontSize || 12}
                      onChange={(e) => actualizarCampo(campoActual.id, { fontSize: Number(e.target.value) })}
                    />
                    <label className="sep-md">Tipografía</label>
                    <select value={campoActual.fontFamily || 'helvetica'} onChange={(e) => actualizarCampo(campoActual.id, { fontFamily: e.target.value as FuenteCampo })}>
                      <option value="helvetica">Helvetica</option>
                      <option value="times">Times</option>
                      <option value="courier">Courier</option>
                    </select>
                    <label className="sep-md">Color</label>
                    <input
                      type="color"
                      value={campoActual.color || '#1e1e1e'}
                      onChange={(e) => actualizarCampo(campoActual.id, { color: e.target.value })}
                      style={{ padding: 2, height: 38 }}
                    />
                    <label className="chk sep-sm">
                      <input type="checkbox" checked={!!campoActual.bold} onChange={(e) => actualizarCampo(campoActual.id, { bold: e.target.checked })} />
                      Negrita
                    </label>
                    <label className="chk sep-xs">
                      <input type="checkbox" checked={!!campoActual.italic} onChange={(e) => actualizarCampo(campoActual.id, { italic: e.target.checked })} />
                      Cursiva
                    </label>
                    <label className="sep-sm">Alineación</label>
                    <select
                      value={campoActual.align || 'center'}
                      onChange={(e) => actualizarCampo(campoActual.id, { align: e.target.value as 'left' | 'center' | 'right' })}
                    >
                      <option value="left">Izquierda</option>
                      <option value="center">Centro</option>
                      <option value="right">Derecha</option>
                    </select>
                    <label className="sep-sm">Ancho máx. de wrap (mm, opcional)</label>
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

            <button className="btn sec bloque sep-lg" onClick={verVistaPrevia} type="button">
              Vista previa
            </button>
          </div>
        </div>
          )}
        </>
      )}

      <VistaPreviaCertificadoModal previa={previa} onClose={() => setPrevia(null)} />

      <ConfirmDialog
        open={paginaABorrar !== null}
        title={`¿Eliminar la hoja ${(paginaABorrar ?? 0) + 1}?`}
        body="Se pierden todos los campos que hayas colocado en ella. Esta acción no se puede deshacer."
        confirmLabel="Eliminar hoja"
        onConfirm={confirmarEliminarPagina}
        onCancel={() => setPaginaABorrar(null)}
      />

      <ConfirmDialog
        open={disenoABorrar}
        title={`¿Eliminar el diseño "${nombre}"?`}
        body="Los certificados ya emitidos no se ven afectados: su PDF se rearma con el diseño activo en ese momento. Esta acción no se puede deshacer."
        confirmLabel="Eliminar diseño"
        onConfirm={eliminar}
        onCancel={() => setDisenoABorrar(false)}
      />
    </>
  );
}

function GestionDisenos({ onEditar }: { onEditar: (tipo: TipoPlantilla, id: number) => void }) {
  const [cargando, setCargando] = useState(true);
  const [plantillas, setPlantillas] = useState<PlantillaResumen[]>([]);
  const [asignaciones, setAsignaciones] = useState<AsignacionCurso[]>([]);
  // Clave de la fila expandida: el nombre base para un grupo, "id:<id>" para una fila suelta.
  const [expandido, setExpandido] = useState<string | null>(null);
  // A qué tipo (digital/imprimir) del grupo expandido corresponden los cursos que se están
  // mostrando — un grupo puede traer las dos, así que hace falta saber cuál de las dos mirar.
  const [tipoExpandido, setTipoExpandido] = useState<TipoPlantilla>('digital');
  const [filtroCurso, setFiltroCurso] = useState('');
  const [modalidadSel, setModalidadSel] = useState<ModalidadAsignacion>('general');
  const [guardandoAsignacion, setGuardandoAsignacion] = useState(false);
  const [aBorrar, setABorrar] = useState<{ ids: number[]; nombre: string } | null>(null);
  const [borrando, setBorrando] = useState(false);
  const [avisoBorrado, setAvisoBorrado] = useState<string | null>(null);
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

  function cursosDe(plantillaId: number | undefined): AsignacionCurso[] {
    return plantillaId == null ? [] : asignaciones.filter((a) => a.plantilla_id === plantillaId);
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

  async function eliminarPlantilla() {
    if (!aBorrar) return;
    setBorrando(true);
    setAvisoBorrado(null);
    const { error } = await supabase.from('plantillas_certificado').delete().in('id', aBorrar.ids);
    setBorrando(false);
    if (error) {
      setAvisoBorrado(mensajeError(error));
      return;
    }
    setABorrar(null);
    await cargar();
  }

  const cursosFiltrados = cursos.filter((c) => c.nombre.toLowerCase().includes(filtroCurso.toLowerCase()));
  const filas = agruparPlantillas(plantillas);

  if (cargando) return <BloqueCargando />;

  return (
    <div className="card card-pad sep-lg">
      <p className="sub" style={{ marginTop: 0 }}>
        Todos los diseños guardados, de ambos tipos. Asigna un diseño a uno o varios cursos para que ese curso use
        ese diseño puntual en vez del diseño &quot;activo&quot; general — útil cuando un curso necesita un certificado
        distinto al resto.
      </p>
      {plantillas.length === 0 ? (
        <p className="sub">Todavía no hay diseños guardados.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
          {filas.map((item) => {
            const esGrupo = esGrupoDiseno(item);
            const nombreMostrado = esGrupo ? item.nombreBase : item.nombre;
            const digital = esGrupo ? item.digital : item.tipo === 'digital' ? item : undefined;
            const imprimir = esGrupo ? item.imprimir : item.tipo === 'imprimir' ? item : undefined;
            const clave = esGrupo ? item.nombreBase : `id:${item.id}`;
            const cursosAsignados = cursosDe(digital?.id).length + cursosDe(imprimir?.id).length;
            // Cuando el grupo trae las dos versiones y no coinciden de orientación (poco común,
            // pero posible si alguien las editó por separado) se listan ambas en vez de una sola
            // línea que solo sería cierta para una de las dos.
            const mismaOrientacion = digital && imprimir ? digital.orientacion === imprimir.orientacion : true;
            const plantillaExpandida = tipoExpandido === 'digital' ? digital : imprimir;

            function alternarExpandido() {
              if (expandido === clave) {
                setExpandido(null);
                return;
              }
              setTipoExpandido(digital ? 'digital' : 'imprimir');
              setExpandido(clave);
            }

            return (
              <div key={clave} className="card" style={{ padding: '.7rem .9rem' }}>
                <div className="fila" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.5rem' }}>
                  <div>
                    <strong>{nombreMostrado}</strong>{' '}
                    <span className="sub">
                      · {digital && imprimir ? 'Digital + para imprimir' : digital ? 'Certificado digital' : 'Certificado para imprimir'}
                      {mismaOrientacion ? (
                        <> · {(digital || imprimir)!.orientacion === 'vertical' ? 'Vertical' : 'Horizontal'}</>
                      ) : (
                        <>
                          {' '}
                          (digital: {digital!.orientacion === 'vertical' ? 'vertical' : 'horizontal'}, imprimir:{' '}
                          {imprimir!.orientacion === 'vertical' ? 'vertical' : 'horizontal'})
                        </>
                      )}
                    </span>
                    {(digital?.activa || imprimir?.activa) && (
                      <span className="tag activo" style={{ marginLeft: '.4rem' }}>
                        Activo por defecto{digital?.activa && imprimir?.activa ? ' (los dos)' : digital?.activa ? ' (digital)' : ' (imprimir)'}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                    {digital && (
                      <button type="button" className="btn sec" onClick={() => onEditar('digital', digital.id)}>
                        Editar digital
                      </button>
                    )}
                    {imprimir && (
                      <button type="button" className="btn sec" onClick={() => onEditar('imprimir', imprimir.id)}>
                        Editar para imprimir
                      </button>
                    )}
                    <button type="button" className="btn sec" onClick={alternarExpandido}>
                      {expandido === clave ? 'Ocultar cursos' : `Cursos asignados (${cursosAsignados})`}
                    </button>
                    <button
                      type="button"
                      className="btn sec"
                      onClick={() => setABorrar({ ids: [digital?.id, imprimir?.id].filter((id): id is number => id != null), nombre: nombreMostrado })}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                {expandido === clave && plantillaExpandida && (
                  <div style={{ marginTop: '.7rem', borderTop: '1px solid var(--borde)', paddingTop: '.6rem' }}>
                    <p className="sub" style={{ fontSize: '.78rem' }}>
                      Un mismo curso emite un certificado distinto según el canal: <strong>Directo</strong> (compró solo
                      el certificado) o <strong>Web</strong> (completó el curso con tareas/exámenes). Elige aquí a cuál
                      canal aplica esta asignación — <strong>General</strong> cubre ambos salvo que asignes uno
                      específico, que gana sobre el general. Un curso solo puede tener un diseño por tipo+canal —
                      marcarlo aquí se lo quita a cualquier otro diseño que ya lo tuviera en ese mismo canal.
                    </p>
                    <div className="fila" style={{ gap: '.4rem', marginBottom: '.5rem', flexWrap: 'wrap' }}>
                      {digital && imprimir && (
                        <div className="tabs" style={{ marginBottom: 0 }}>
                          <button
                            type="button"
                            className={`tab-btn${tipoExpandido === 'digital' ? ' activo' : ''}`}
                            onClick={() => setTipoExpandido('digital')}
                          >
                            Digital
                          </button>
                          <button
                            type="button"
                            className={`tab-btn${tipoExpandido === 'imprimir' ? ' activo' : ''}`}
                            onClick={() => setTipoExpandido('imprimir')}
                          >
                            Para imprimir
                          </button>
                        </div>
                      )}
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
                        const cursosEnModalidad = cursosDeEnModalidad(plantillaExpandida.id, modalidadSel);
                        const yaAsignadoAEsta = cursosEnModalidad.some((a) => a.curso_id === c.id);
                        const enOtro = !yaAsignadoAEsta && asignadoAOtroEnModalidad(c.id, plantillaExpandida.tipo, modalidadSel, plantillaExpandida.id);
                        return (
                          <label key={c.id} className="chk">
                            <input
                              type="checkbox"
                              checked={yaAsignadoAEsta}
                              disabled={guardandoAsignacion}
                              onChange={() => alternarCurso(plantillaExpandida, c.id, modalidadSel, yaAsignadoAEsta)}
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

      <Aviso tipo="err" mensaje={avisoBorrado ?? undefined} />

      <ConfirmDialog
        open={aBorrar !== null}
        title={`¿Eliminar el diseño "${aBorrar?.nombre}"?`}
        body={`${
          (aBorrar?.ids.length ?? 0) > 1
            ? 'Se eliminan las dos versiones (digital y para imprimir). '
            : ''
        }Los certificados ya emitidos no se ven afectados: su PDF se rearma con el diseño activo en ese momento. Si este diseño está asignado a algún curso, esa asignación también se pierde. Esta acción no se puede deshacer.`}
        confirmLabel={borrando ? 'Eliminando…' : 'Eliminar diseño'}
        onConfirm={eliminarPlantilla}
        onCancel={() => setABorrar(null)}
      />
    </div>
  );
}
