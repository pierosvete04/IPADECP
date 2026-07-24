import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase/client';

const AZUL_IPADECP: [number, number, number] = [16, 40, 77];

/** Datos con los que se rellena cualquier variante del certificado (con o sin plantilla personalizada). */
export interface CertificadoRenderData {
  codigo: string;
  alumnoNombre: string;
  cursoNombre: string;
  fecha: string;
  cargo?: string;
  dni?: string;
  periodoInicio?: string;
  periodoEntrega?: string;
  periodoCierre?: string;
  // Si el curso tiene un diseño asignado (tabla plantillas_certificado_cursos) para el tipo pedido,
  // ese diseño gana sobre el "activo" global del tipo — ver obtenerPlantillaActiva más abajo.
  // `modalidad` distingue el canal (mismo curso, certificado distinto): 'directo' = compró solo el
  // certificado sin rendir nada; 'evaluado' = completó el curso online con tareas/exámenes.
  cursoId?: number;
  modalidad?: ModalidadCertificado;
  // Datos de "libros y registros académicos" — editables por certificado (no se calculan solos)
  // porque cada emisión puede caer en un libro/registro distinto y no siempre en orden de fecha.
  registro?: string;
  libro?: string;
  creditos?: string;
  meses?: string;
  horasLectivas?: string;
  // Tabla de asignaturas y notas del certificado de notas — cada fila trae la nota (0-20);
  // "en letras" y el promedio final se calculan solos al dibujar.
  asignaturas?: { nombre: string; nota: number }[];
}
export type CertificadoData = CertificadoRenderData;
export type CertificadoImprimirData = CertificadoRenderData;

export interface CertificadoPublico {
  alumno_nombre: string;
  curso_nombre: string;
  fecha: string;
  nota: number | null;
  estado: string;
  codigo: string;
  cargo?: string | null;
  modalidad?: string;
  periodo_inicio?: string | null;
  periodo_entrega?: string | null;
  periodo_cierre?: string | null;
  drive_digital_url?: string | null;
}

export async function obtenerCertificadoPublico(codigo: string): Promise<CertificadoPublico | null> {
  const { data, error } = await supabase.rpc('obtener_certificado_publico', { p_codigo: codigo });
  if (error || !data) return null;
  return data as CertificadoPublico;
}

// ---------------------------------------------------------------------------
// Plantillas editables (tabla plantillas_certificado, panel admin → Diseño).
// Cada tipo ('digital' / 'imprimir') puede tener varios diseños guardados con
// nombre; solo uno puede estar "activo" a la vez y es el que se usa al emitir.
// Si no hay ningún diseño activo, se usa el layout fijo de siempre como
// respaldo — ver dibujarDigitalPorDefecto / dibujarImprimirPorDefecto abajo.
// ---------------------------------------------------------------------------

export type TipoPlantilla = 'digital' | 'imprimir';

/** Canal real de un certificado emitido: 'directo' (compró solo el certificado) o 'evaluado'
 * (completó el curso online con tareas/exámenes) — mismo curso, dos certificados distintos. */
export type ModalidadCertificado = 'directo' | 'evaluado';

/** Igual que ModalidadCertificado, más 'general': el valor por defecto de una asignación
 * diseño↔curso, que aplica a ambos canales salvo que se asigne uno específico por canal. */
export type ModalidadAsignacion = 'general' | ModalidadCertificado;

export type FuenteCampo = 'helvetica' | 'times' | 'courier';

/** Catálogo abierto de variables que puede llevar un campo. "texto_fijo" es texto libre
 * (párrafos del diploma) y puede repetirse tantas veces como se necesite; "tabla_notas"
 * dibuja la tabla de asignaturas y notas del certificado de notas. */
export type VariableCampo =
  | 'cargo'
  | 'nombre'
  | 'curso'
  | 'fecha'
  | 'fecha_inicio'
  | 'fecha_termino'
  | 'fecha_entrega'
  | 'periodo'
  | 'creditos'
  | 'meses'
  | 'horas_lectivas'
  | 'registro'
  | 'libro'
  | 'codigo'
  | 'qr'
  | 'tabla_notas'
  | 'texto_fijo';

export interface CampoPlantilla {
  id: string; // identificador libre (uuid), no está atado a la variable — puede haber varios del mismo tipo
  variable: VariableCampo;
  x: number; // mm desde el borde izquierdo de la página (A4 horizontal: 297×210)
  y: number; // mm desde el borde superior
  visible: boolean;
  fontSize?: number; // pt — no aplica a "qr" ni "tabla_notas"
  fontFamily?: FuenteCampo;
  color?: string; // hex — no aplica a "qr"
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  texto?: string; // solo "texto_fijo": el párrafo, editable por el admin (admite varias líneas)
  ancho?: number; // mm — ancho máximo de wrap (texto largo) o ancho total de la tabla de notas
  size?: number; // solo "qr": lado del cuadrado en mm
  filaAltura?: number; // solo "tabla_notas": alto de cada fila en mm
}

export interface PaginaPlantilla {
  imagen_url: string | null;
  campos: CampoPlantilla[];
}

export type OrientacionPlantilla = 'horizontal' | 'vertical';

export interface PlantillaCertificado {
  id: number;
  tipo: TipoPlantilla;
  nombre: string;
  activa: boolean;
  orientacion: OrientacionPlantilla;
  paginas: PaginaPlantilla[];
}

export const ANCHO_PAGINA_MM = 297;
export const ALTO_PAGINA_MM = 210;

/** Ancho/alto (mm) de la página según la orientación del diseño — A4 en horizontal o vertical. */
export function dimensionesPagina(orientacion: OrientacionPlantilla): { ancho: number; alto: number } {
  return orientacion === 'vertical' ? { ancho: ALTO_PAGINA_MM, alto: ANCHO_PAGINA_MM } : { ancho: ANCHO_PAGINA_MM, alto: ALTO_PAGINA_MM };
}

/** Página inicial usada al crear un diseño nuevo desde cero — replica el layout clásico de una hoja. */
export function paginaDefaultPlantilla(): PaginaPlantilla {
  const cx = ANCHO_PAGINA_MM / 2;
  const id = () => (typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2));
  return {
    imagen_url: null,
    campos: [
      { id: id(), variable: 'cargo', x: cx, y: 80, visible: true, fontSize: 12, fontFamily: 'helvetica', color: '#5a5a5a', bold: false, align: 'center' },
      { id: id(), variable: 'nombre', x: cx, y: 95, visible: true, fontSize: 22, fontFamily: 'helvetica', color: '#1e1e1e', bold: true, align: 'center' },
      { id: id(), variable: 'texto_fijo', x: cx, y: 108, visible: true, fontSize: 13, fontFamily: 'helvetica', color: '#1e1e1e', bold: false, align: 'center', texto: 'ha completado satisfactoriamente el curso', ancho: 220 },
      { id: id(), variable: 'curso', x: cx, y: 121, visible: true, fontSize: 17, fontFamily: 'helvetica', color: '#1e1e1e', bold: true, align: 'center', ancho: 227 },
      { id: id(), variable: 'fecha', x: cx, y: 150, visible: true, fontSize: 11, fontFamily: 'helvetica', color: '#1e1e1e', bold: false, align: 'center' },
      { id: id(), variable: 'periodo', x: cx, y: 157, visible: true, fontSize: 9, fontFamily: 'helvetica', color: '#5a5a5a', bold: false, align: 'center' },
      { id: id(), variable: 'codigo', x: cx, y: 172, visible: true, fontSize: 8, fontFamily: 'helvetica', color: '#5a5a5a', bold: false, align: 'center' },
      { id: id(), variable: 'qr', x: ANCHO_PAGINA_MM - 44, y: ALTO_PAGINA_MM - 44, visible: true, size: 28 },
    ],
  };
}

/** Página en blanco, usada al agregar una hoja adicional a un diseño (p. ej. la hoja de notas). */
export function paginaVacia(): PaginaPlantilla {
  return { imagen_url: null, campos: [] };
}

/** Lista (sin descargar imágenes) de los diseños guardados de un tipo, para el selector del editor. */
export async function listarPlantillas(tipo: TipoPlantilla): Promise<{ id: number; nombre: string; activa: boolean }[]> {
  const { data } = await supabase
    .from('plantillas_certificado')
    .select('id,nombre,activa')
    .eq('tipo', tipo)
    .order('actualizado_en', { ascending: false });
  return data || [];
}

/** Todos los diseños de ambos tipos (para la pestaña "Diseños" del panel admin). */
export async function listarTodasLasPlantillas(): Promise<{ id: number; tipo: TipoPlantilla; nombre: string; activa: boolean; orientacion: OrientacionPlantilla }[]> {
  const { data } = await supabase
    .from('plantillas_certificado')
    .select('id,tipo,nombre,activa,orientacion')
    .order('tipo')
    .order('nombre');
  return data || [];
}

export interface AsignacionCurso {
  id: number;
  plantilla_id: number;
  curso_id: number;
  tipo: TipoPlantilla;
  modalidad: ModalidadAsignacion;
}

/** Todas las asignaciones diseño↔curso, para armar la lista de cursos de cada diseño en la pestaña "Diseños". */
export async function listarAsignacionesCurso(): Promise<AsignacionCurso[]> {
  const { data } = await supabase.from('plantillas_certificado_cursos').select('id,plantilla_id,curso_id,tipo,modalidad');
  return data || [];
}

/** Asigna un diseño a un curso para un tipo y canal — como un curso solo puede tener un diseño por
 * tipo+canal, esto reemplaza silenciosamente cualquier asignación previa de ese curso+tipo+canal.
 * `modalidad='general'` (el valor por defecto) aplica a ambos canales; 'directo'/'evaluado' solo a ese canal. */
export async function asignarDisenoACurso(plantillaId: number, cursoId: number, tipo: TipoPlantilla, modalidad: ModalidadAsignacion = 'general') {
  return supabase
    .from('plantillas_certificado_cursos')
    .upsert({ plantilla_id: plantillaId, curso_id: cursoId, tipo, modalidad }, { onConflict: 'curso_id,tipo,modalidad' });
}

/** Quita la asignación de un curso para ese tipo+canal (vuelve a usar la siguiente en la cascada — ver obtenerPlantillaActiva). */
export async function quitarAsignacionCurso(cursoId: number, tipo: TipoPlantilla, modalidad: ModalidadAsignacion = 'general') {
  return supabase.from('plantillas_certificado_cursos').delete().eq('curso_id', cursoId).eq('tipo', tipo).eq('modalidad', modalidad);
}

/** Arma la tabla de asignaturas y notas del certificado de notas: cada tarea/examen activo del curso
 * es una "asignatura", con la mejor nota del alumno entre todos sus intentos. Tareas sin ningún
 * intento registrado del alumno se omiten (no se "inventan" notas). */
export async function obtenerAsignaturasParaCertificado(cursoId: number, alumnoUid: string): Promise<{ nombre: string; nota: number }[]> {
  const { data: tareas } = await supabase.from('tareas').select('id,titulo').eq('curso_id', cursoId).eq('estado', '1').order('id');
  if (!tareas?.length) return [];

  const { data: resultados } = await supabase
    .from('resultados_examen')
    .select('tarea_id,nota')
    .eq('alumno_uid', alumnoUid)
    .in('tarea_id', tareas.map((t) => t.id));

  const mejorPorTarea = new Map<number, number>();
  for (const r of resultados || []) {
    if (r.nota == null) continue;
    const actual = mejorPorTarea.get(r.tarea_id);
    if (actual === undefined || r.nota > actual) mejorPorTarea.set(r.tarea_id, r.nota);
  }

  return tareas.filter((t) => mejorPorTarea.has(t.id)).map((t) => ({ nombre: t.titulo || '', nota: mejorPorTarea.get(t.id)! }));
}

/** Sugiere el siguiente Registro N° / Libro N° a partir de los ya usados (mayor valor numérico + 1),
 * conservando los ceros a la izquierda. Devuelve '' si todavía no hay ninguno (primera vez que se usa). */
export function sugerirSiguienteCodigo(valoresExistentes: (string | null | undefined)[]): string {
  const numericos = valoresExistentes.filter((v): v is string => !!v && /^\d+$/.test(v));
  if (!numericos.length) return '';
  const mayor = numericos.reduce((a, b) => (parseInt(b, 10) > parseInt(a, 10) ? b : a));
  return String(parseInt(mayor, 10) + 1).padStart(mayor.length, '0');
}

/** Cascada de resolución: diseño asignado al curso para este canal específico → diseño asignado
 * al curso en general (ambos canales) → diseño "activo" global del tipo. Así un mismo curso puede
 * tener un certificado distinto para 'directo' y para 'evaluado' sin que se pisen entre sí. */
async function obtenerPlantillaActiva(tipo: TipoPlantilla, cursoId?: number, modalidad?: ModalidadCertificado): Promise<PlantillaCertificado | null> {
  if (cursoId != null) {
    const candidatas: ModalidadAsignacion[] = modalidad ? [modalidad, 'general'] : ['general'];
    for (const m of candidatas) {
      const { data: asignacion } = await supabase
        .from('plantillas_certificado_cursos')
        .select('plantilla_id')
        .eq('curso_id', cursoId)
        .eq('tipo', tipo)
        .eq('modalidad', m)
        .maybeSingle();
      if (asignacion?.plantilla_id) {
        const { data } = await supabase.from('plantillas_certificado').select('id,tipo,nombre,activa,orientacion,paginas').eq('id', asignacion.plantilla_id).maybeSingle();
        if (data) return data as PlantillaCertificado;
      }
    }
  }
  const { data, error } = await supabase.from('plantillas_certificado').select('id,tipo,nombre,activa,orientacion,paginas').eq('tipo', tipo).eq('activa', true).maybeSingle();
  if (error || !data) return null;
  return data as PlantillaCertificado;
}

/** `imagen_url` guarda la ruta dentro del bucket 'certificados' (no una URL pública: el bucket es privado y se
 * lee vía descarga autenticada/RLS, para que tanto el admin como la página pública de verificación puedan acceder). */
export async function descargarImagenPlantilla(ruta: string): Promise<{ dataUrl: string; formato: string } | null> {
  const { data, error } = await supabase.storage.from('certificados').download(ruta);
  if (error || !data) return null;
  const formato = data.type.includes('png') ? 'PNG' : data.type.includes('webp') ? 'WEBP' : 'JPEG';
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result as string);
    lector.onerror = () => reject(new Error('No se pudo leer la imagen de la plantilla.'));
    lector.readAsDataURL(data);
  });
  return { dataUrl, formato };
}

async function generarQrDataUrl(codigo: string): Promise<string> {
  const url = `${window.location.origin}/certificado/${codigo}`;
  return QRCode.toDataURL(url, { margin: 1, width: 240 });
}

function hexARgb(hex: string): [number, number, number] {
  const limpio = hex.replace('#', '');
  const n = parseInt(limpio.length === 3 ? limpio.split('').map((c) => c + c).join('') : limpio, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Conversor de números a letras en español — cubre notas (0-20), créditos y demás valores
// que aparecen escritos en palabras en el certificado de notas.
const UNIDADES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const ESPECIALES_10_19 = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
const DECENAS = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

export function numeroALetras(valor: number): string {
  const n = Math.round(valor);
  if (n < 0) return '';
  if (n === 0) return 'cero';
  if (n === 100) return 'cien';
  if (n < 10) return UNIDADES[n];
  if (n < 20) return ESPECIALES_10_19[n - 10];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return DECENAS[d];
    if (n < 30) return `veinti${UNIDADES[u]}`;
    return `${DECENAS[d]} y ${UNIDADES[u]}`;
  }
  if (n < 1000) {
    const c = Math.floor(n / 100);
    const resto = n % 100;
    return resto === 0 ? CENTENAS[c] : `${CENTENAS[c]} ${numeroALetras(resto)}`;
  }
  return String(n);
}

const VALORES_CAMPO: Partial<Record<VariableCampo, (d: CertificadoRenderData) => string>> = {
  cargo: (d) => d.cargo || '',
  nombre: (d) => d.alumnoNombre,
  curso: (d) => d.cursoNombre,
  fecha: (d) => (d.dni ? `DNI: ${d.dni}  ·  Fecha: ${d.fecha}` : `Fecha: ${d.fecha}`),
  fecha_inicio: (d) => d.periodoInicio || '',
  fecha_termino: (d) => d.periodoCierre || '',
  fecha_entrega: (d) => d.periodoEntrega || '',
  periodo: (d) => {
    if (!d.periodoInicio || !d.periodoCierre) return '';
    let t = `Período: ${d.periodoInicio} – ${d.periodoCierre}`;
    if (d.periodoEntrega) t += `  ·  Entrega: ${d.periodoEntrega}`;
    return t;
  },
  creditos: (d) => d.creditos || '',
  meses: (d) => d.meses || '',
  horas_lectivas: (d) => d.horasLectivas || '',
  registro: (d) => d.registro || '',
  libro: (d) => d.libro || '',
  codigo: (d) => `Código de verificación: ${d.codigo}`,
};

function aplicarFuente(doc: jsPDF, campo: CampoPlantilla) {
  const familia = campo.fontFamily || 'helvetica';
  const estilo = campo.bold && campo.italic ? 'bolditalic' : campo.bold ? 'bold' : campo.italic ? 'italic' : 'normal';
  doc.setFont(familia, estilo);
}

function dibujarTextoFijo(doc: jsPDF, campo: CampoPlantilla) {
  const texto = campo.texto || '';
  if (!texto) return;
  aplicarFuente(doc, campo);
  doc.setFontSize(campo.fontSize || 12);
  doc.setTextColor(...hexARgb(campo.color || '#1e1e1e'));
  const ancho = campo.ancho || 220;
  const lineas = doc.splitTextToSize(texto, ancho) as string[];
  const alturaLinea = (campo.fontSize || 12) * 0.3528 * 1.15;
  lineas.forEach((linea, i) => {
    doc.text(linea, campo.x, campo.y + i * alturaLinea, { align: campo.align || 'center' });
  });
}

function dibujarTablaNotas(doc: jsPDF, campo: CampoPlantilla, asignaturas: { nombre: string; nota: number }[]) {
  if (!asignaturas.length) return;
  const anchoTotal = campo.ancho || 180;
  const alturaFila = campo.filaAltura || 8;
  const fontSize = campo.fontSize || 10;
  const colorTexto = hexARgb(campo.color || '#1e1e1e');
  const colAsignatura = anchoTotal * 0.6;
  const colNota = anchoTotal * 0.2;
  const x0 = campo.x;
  let y = campo.y;

  function fila(asignatura: string, letras: string, numero: string, negrita: boolean) {
    doc.setFont(campo.fontFamily || 'helvetica', negrita ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(...colorTexto);
    doc.text(asignatura, x0 + 2, y + alturaFila / 2 + fontSize * 0.12, { align: 'left', maxWidth: colAsignatura - 4 });
    doc.text(letras, x0 + colAsignatura + colNota / 2, y + alturaFila / 2 + fontSize * 0.12, { align: 'center' });
    doc.text(numero, x0 + colAsignatura + colNota + colNota / 2, y + alturaFila / 2 + fontSize * 0.12, { align: 'center' });
    doc.setDrawColor(200, 200, 200);
    doc.rect(x0, y, colAsignatura, alturaFila);
    doc.rect(x0 + colAsignatura, y, colNota, alturaFila);
    doc.rect(x0 + colAsignatura + colNota, y, colNota, alturaFila);
    y += alturaFila;
  }

  fila('Asignaturas', 'en letras', 'en números', true);
  for (const a of asignaturas) fila(a.nombre, numeroALetras(a.nota), String(a.nota), false);
  const promedio = Math.round(asignaturas.reduce((s, a) => s + a.nota, 0) / asignaturas.length);
  fila('Promedio Final', numeroALetras(promedio), String(promedio), true);
}

async function dibujarDesdePlantilla(doc: jsPDF, data: CertificadoRenderData, plantilla: PlantillaCertificado): Promise<void> {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const qrDataUrl = plantilla.paginas.some((p) => p.campos.some((c) => c.variable === 'qr' && c.visible !== false))
    ? await generarQrDataUrl(data.codigo)
    : null;

  for (let indice = 0; indice < plantilla.paginas.length; indice++) {
    const pagina = plantilla.paginas[indice];
    if (indice > 0) doc.addPage();

    if (pagina.imagen_url) {
      const imagen = await descargarImagenPlantilla(pagina.imagen_url);
      if (imagen) doc.addImage(imagen.dataUrl, imagen.formato, 0, 0, w, h);
    }
    for (const campo of pagina.campos) {
      if (campo.visible === false) continue;
      if (campo.variable === 'qr') {
        if (qrDataUrl) {
          const size = campo.size || 28;
          doc.addImage(qrDataUrl, 'PNG', campo.x, campo.y, size, size);
        }
        continue;
      }
      if (campo.variable === 'texto_fijo') {
        dibujarTextoFijo(doc, campo);
        continue;
      }
      if (campo.variable === 'tabla_notas') {
        dibujarTablaNotas(doc, campo, data.asignaturas || []);
        continue;
      }
      const texto = VALORES_CAMPO[campo.variable]?.(data) || '';
      if (!texto) continue;
      aplicarFuente(doc, campo);
      doc.setFontSize(campo.fontSize || 12);
      doc.setTextColor(...hexARgb(campo.color || '#1e1e1e'));
      const opciones: { align: 'left' | 'center' | 'right'; maxWidth?: number } = { align: campo.align || 'center' };
      if (campo.ancho) opciones.maxWidth = campo.ancho;
      doc.text(texto, campo.x, campo.y, opciones);
    }
  }
}

async function construirDoc(data: CertificadoRenderData, tipo: TipoPlantilla): Promise<jsPDF> {
  const plantilla = await obtenerPlantillaActiva(tipo, data.cursoId, data.modalidad);

  if (plantilla && plantilla.paginas.length > 0) {
    const doc = new jsPDF({ orientation: plantilla.orientacion === 'vertical' ? 'portrait' : 'landscape', unit: 'mm', format: 'a4' });
    await dibujarDesdePlantilla(doc, data, plantilla);
    return doc;
  }

  // Sin diseño activo (ni asignado al curso): respaldo de siempre, A4 horizontal.
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  if (tipo === 'digital') await dibujarDigitalPorDefecto(doc, data);
  else await dibujarImprimirPorDefecto(doc, data);
  return doc;
}

// ---------------------------------------------------------------------------
// Layout fijo de siempre (respaldo cuando no hay ningún diseño activo).
// ---------------------------------------------------------------------------

async function dibujarDigitalPorDefecto(doc: jsPDF, data: CertificadoRenderData): Promise<void> {
  const qrDataUrl = await generarQrDataUrl(data.codigo);

  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  doc.setDrawColor(...AZUL_IPADECP);
  doc.setLineWidth(1.2);
  doc.rect(8, 8, w - 16, h - 16);

  doc.setFillColor(...AZUL_IPADECP);
  doc.rect(8, 8, w - 16, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('IPADECP', w / 2, 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Instituto Peruano de Alta Dirección y Estudios en Ciencias de la Salud', w / 2, 27, { align: 'center' });

  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('CERTIFICADO DE FINALIZACIÓN', w / 2, 55, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text('Se certifica que', w / 2, 70, { align: 'center' });

  let yNombre = 83;
  if (data.cargo) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(90, 90, 90);
    doc.text(data.cargo, w / 2, 80, { align: 'center' });
    doc.setTextColor(30, 30, 30);
    yNombre = 93;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(data.alumnoNombre, w / 2, yNombre, { align: 'center' });

  const yDespuesNombre = data.cargo ? 105 : 95;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text('ha completado satisfactoriamente el curso', w / 2, yDespuesNombre, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(data.cursoNombre, w / 2, yDespuesNombre + 13, { align: 'center', maxWidth: w - 70 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Fecha de emisión: ${data.fecha}`, w / 2, h - 32, { align: 'center' });

  if (data.periodoInicio && data.periodoCierre) {
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    let periodoTxt = `Período: ${data.periodoInicio} – ${data.periodoCierre}`;
    if (data.periodoEntrega) periodoTxt += `  ·  Entrega: ${data.periodoEntrega}`;
    doc.text(periodoTxt, w / 2, h - 38, { align: 'center' });
    doc.setTextColor(30, 30, 30);
  }

  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text(`Código de verificación: ${data.codigo}`, w / 2, h - 26, { align: 'center' });

  const qrSize = 28;
  const qrX = w - qrSize - 16;
  const qrY = h - qrSize - 16;
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
  doc.setFontSize(7);
  doc.text('Escanea para verificar', qrX + qrSize / 2, qrY + qrSize + 4, { align: 'center' });
}

// Posiciones (mm) del PDF "para imprimir": sin bordes, sin fondo, solo los datos + QR,
// pensado para imprimirse sobre el papel membretado físico que ya tiene el instituto.
// Si al imprimirlo de prueba contra el membretado algo no calza, ajustar estos valores
// (o, mejor, subir el membretado como plantilla en Diseño del certificado y ajustarlo ahí).
const IMPRIMIR_POS = {
  cargo: 95,
  nombre: 110,
  cuerpo: 124,
  curso: 136,
  fecha: 157,
  periodo: 164,
  codigo: 170,
  qrDesdeBordeX: 34,
  qrDesdeBordeY: 34,
  qrSize: 26,
};

async function dibujarImprimirPorDefecto(doc: jsPDF, data: CertificadoRenderData): Promise<void> {
  const qrDataUrl = await generarQrDataUrl(data.codigo);

  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  doc.setTextColor(20, 20, 20);

  if (data.cargo) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(data.cargo, w / 2, IMPRIMIR_POS.cargo, { align: 'center' });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(data.alumnoNombre, w / 2, IMPRIMIR_POS.nombre, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text('ha completado satisfactoriamente el curso', w / 2, IMPRIMIR_POS.cuerpo, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(data.cursoNombre, w / 2, IMPRIMIR_POS.curso, { align: 'center', maxWidth: w - 90 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const dniTexto = data.dni ? `DNI: ${data.dni}  ·  ` : '';
  doc.text(`${dniTexto}Fecha: ${data.fecha}`, w / 2, IMPRIMIR_POS.fecha, { align: 'center' });

  if (data.periodoInicio && data.periodoCierre) {
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    let periodoTxt = `Período: ${data.periodoInicio} – ${data.periodoCierre}`;
    if (data.periodoEntrega) periodoTxt += `  ·  Entrega: ${data.periodoEntrega}`;
    doc.text(periodoTxt, w / 2, IMPRIMIR_POS.periodo, { align: 'center' });
  }

  doc.setFontSize(7);
  doc.setTextColor(110, 110, 110);
  doc.text(`Código de verificación: ${data.codigo}`, w / 2, IMPRIMIR_POS.codigo, { align: 'center' });

  const qrSize = IMPRIMIR_POS.qrSize;
  const qrX = w - qrSize - IMPRIMIR_POS.qrDesdeBordeX;
  const qrY = h - qrSize - IMPRIMIR_POS.qrDesdeBordeY;
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
}

// ---------------------------------------------------------------------------
// API pública usada por el resto de la app.
// ---------------------------------------------------------------------------

export async function generarCertificadoPDF(data: CertificadoData): Promise<void> {
  const doc = await construirDoc(data, 'digital');
  doc.save(`certificado-${data.codigo.slice(0, 8)}.pdf`);
}

export async function generarCertificadoImprimirPDF(data: CertificadoImprimirData): Promise<void> {
  const doc = await construirDoc(data, 'imprimir');
  doc.save(`certificado-imprimir-${data.codigo.slice(0, 8)}.pdf`);
}

/** Genera el PDF pero en vez de descargarlo devuelve un blob URL para mostrarlo en un <iframe> (vista previa). */
export async function abrirVistaPreviaCertificado(
  data: CertificadoRenderData,
  tipo: TipoPlantilla
): Promise<{ url: string; filename: string }> {
  const doc = await construirDoc(data, tipo);
  const filename = `certificado${tipo === 'imprimir' ? '-imprimir' : ''}-${data.codigo.slice(0, 8)}.pdf`;
  const url = doc.output('bloburl').href;
  return { url, filename };
}

/** Genera el PDF como Blob (sin descargarlo ni previsualizarlo), para empaquetarlo en un .zip o adjuntarlo a un correo. */
export async function generarCertificadoBlob(data: CertificadoRenderData, tipo: TipoPlantilla): Promise<Blob> {
  const doc = await construirDoc(data, tipo);
  return doc.output('blob');
}

/**
 * Garantiza que el certificado (digital o imprimir) esté subido a Google Drive y devuelve su link.
 * Si `urlExistente` ya viene (columna drive_digital_url/drive_imprimir_url de la fila en BD), la
 * devuelve tal cual sin volver a generar ni subir nada — así cada certificado se sube una sola vez.
 * Requiere sesión activa (admin o el propio alumno dueño del certificado, ver /api/certificados/subir-drive).
 */
export async function asegurarCertificadoEnDrive(
  data: CertificadoRenderData,
  tipo: TipoPlantilla,
  certificadoId: number,
  urlExistente: string | null | undefined
): Promise<string> {
  if (urlExistente) return urlExistente;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Debes iniciar sesión para subir el certificado a Drive.');

  const blob = await generarCertificadoBlob(data, tipo);
  const form = new FormData();
  form.append('archivo', blob, `certificado-${tipo}-${data.codigo.slice(0, 8)}.pdf`);
  form.append('tipo', tipo);
  form.append('certificadoId', String(certificadoId));
  form.append('fecha', new Date().toISOString());

  const res = await fetch('/api/certificados/subir-drive', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: form,
  });
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    throw new Error(cuerpo?.error || 'No se pudo subir el certificado a Drive.');
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}

/** Renderiza un PDF directamente a partir de un arreglo de páginas en memoria (sin leer la BD) —
 * usado por el editor de Diseño para previsualizar el diseño que se está editando, sea o no el activo. */
export async function generarPdfDesdePaginas(
  data: CertificadoRenderData,
  paginas: PaginaPlantilla[],
  orientacion: OrientacionPlantilla = 'horizontal'
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: orientacion === 'vertical' ? 'portrait' : 'landscape', unit: 'mm', format: 'a4' });
  if (paginas.length > 0) {
    await dibujarDesdePlantilla(doc, data, { id: 0, tipo: 'digital', nombre: '', activa: false, orientacion, paginas });
  }
  return doc;
}

/** Igual que abrirVistaPreviaCertificado, pero a partir de páginas en memoria en vez de la plantilla activa en BD. */
export async function vistaPreviaDesdePaginas(
  data: CertificadoRenderData,
  paginas: PaginaPlantilla[],
  tipo: TipoPlantilla,
  orientacion: OrientacionPlantilla = 'horizontal'
): Promise<{ url: string; filename: string }> {
  const doc = await generarPdfDesdePaginas(data, paginas, orientacion);
  const filename = `certificado${tipo === 'imprimir' ? '-imprimir' : ''}-preview.pdf`;
  return { url: doc.output('bloburl').href, filename };
}
