/**
 * Dibujo del PDF del certificado.
 *
 * Único módulo que importa jspdf y qrcode (~350 KB juntos). Todo lo que no
 * necesita dibujar — tipos, consultas, URLs, respaldo en Drive — vive en
 * `lib/certificado.ts`, para que las pantallas que solo enlazan al PDF servido
 * por la app no se lleven el renderizador entero. Ver la cabecera de ese archivo.
 *
 * Corre en los dos lados: el navegador lo usa para previsualizar diseños, y la
 * ruta `/api/certificados/[codigo]/pdf` para servir el certificado oficial. Por
 * eso todas las funciones aceptan un cliente de Supabase (`db`) y una `urlBase`
 * explícitos: en Node no hay `window` del que deducir el origen del QR ni sesión
 * de la que sacar permisos.
 */
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase/client';
import {
  descargarImagenPlantilla,
  nombreArchivoCertificado,
  numeroALetras,
  obtenerPlantillaActiva,
  type CampoPlantilla,
  type CertificadoData,
  type CertificadoImprimirData,
  type CertificadoRenderData,
  type ClienteSupabase,
  type OrientacionPlantilla,
  type PaginaPlantilla,
  type PlantillaCertificado,
  type TipoPlantilla,
  type VariableCampo,
} from '@/lib/certificado';

const AZUL_IPADECP: [number, number, number] = [16, 40, 77];

/**
 * `urlBase` es el origen público del sitio, que va dentro del QR de verificación.
 * En el navegador se deduce del propio origen; en el servidor no hay `window`, así que
 * quien llama lo pasa explícitamente (la ruta lo toma del request).
 */
async function generarQrDataUrl(codigo: string, urlBase?: string): Promise<string> {
  const base = urlBase ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return QRCode.toDataURL(`${base}/certificado/${codigo}`, { margin: 1, width: 240 });
}

function hexARgb(hex: string): [number, number, number] {
  const limpio = hex.replace('#', '');
  const n = parseInt(limpio.length === 3 ? limpio.split('').map((c) => c + c).join('') : limpio, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const VALORES_CAMPO: Partial<Record<VariableCampo, (d: CertificadoRenderData) => string>> = {
  cargo: (d) => d.cargo || '',
  nombre: (d) => d.alumnoNombre,
  // Un solo campo para no tener que colocar y alinear "cargo" y "nombre" como dos
  // cajas sueltas — junta ambos con un punto, tal como se leen en el certificado.
  cargo_persona: (d) => [d.cargo, d.alumnoNombre].filter(Boolean).join('. '),
  curso: (d) => d.cursoNombre,
  // Los campos son datos crudos: la etiqueta ("Fecha:", "Registro N°:", etc.) ya
  // va impresa en el fondo/plantilla de quien diseña el certificado. Antes esta
  // función la agregaba igual, así que salía duplicada ("Registro N°: Registro
  // N°: 008116") o, si el diseño no traía esa etiqueta, sobraba una que nadie pidió.
  fecha: (d) => (d.dni ? `${d.dni}  ·  ${d.fecha}` : d.fecha),
  fecha_inicio: (d) => d.periodoInicio || '',
  fecha_termino: (d) => d.periodoCierre || '',
  fecha_entrega: (d) => d.periodoEntrega || '',
  // "Período (combinado)" sigue mostrando ambas fechas juntas (para eso existe,
  // en vez de usar fecha_inicio/fecha_termino por separado), pero sin la palabra
  // "Período"/"Entrega" delante — el guion y el separador ya comunican qué es qué.
  periodo: (d) => {
    if (!d.periodoInicio || !d.periodoCierre) return '';
    let t = `${d.periodoInicio} – ${d.periodoCierre}`;
    if (d.periodoEntrega) t += `  ·  ${d.periodoEntrega}`;
    return t;
  },
  creditos: (d) => d.creditos || '',
  meses: (d) => d.meses || '',
  horas_lectivas: (d) => d.horasLectivas || '',
  registro: (d) => d.registro || '',
  libro: (d) => d.libro || '',
  codigo: (d) => d.codigo,
  // Promedio de los módulos rendidos, como campo suelto (la tabla de notas ya lo imprime en su
  // última fila, pero no todos los diseños usan la tabla). Sin notas devuelven '' y el campo no
  // se dibuja — ver el `if (!texto) continue` del bucle de campos.
  promedio_letras: (d) => {
    const p = promedioNotas(d.asignaturas || []);
    return p == null ? '' : numeroALetras(p);
  },
  promedio_numero: (d) => {
    const p = promedioNotas(d.asignaturas || []);
    return p == null ? '' : String(p);
  },
};

function aplicarFuente(doc: jsPDF, campo: CampoPlantilla) {
  const familia = campo.fontFamily || 'helvetica';
  const estilo = campo.bold && campo.italic ? 'bolditalic' : campo.bold ? 'bold' : campo.italic ? 'italic' : 'normal';
  doc.setFont(familia, estilo);
}

/** Dibuja texto (una o varias líneas, separadas por "\n" o por wrap automático al ancho del
 * campo) con la tipografía/color/alineación del campo. Común a "texto fijo" (el texto lo escribe
 * el admin) y a las listas de módulos/notas (el texto sale de `data.asignaturas`, línea por
 * módulo) — ver `textoListaModulos` etc. más abajo. */
function dibujarTexto(doc: jsPDF, campo: CampoPlantilla, texto: string) {
  if (!texto) return;
  aplicarFuente(doc, campo);
  doc.setFontSize(campo.fontSize || 12);
  doc.setTextColor(...hexARgb(campo.color || '#1e1e1e'));
  const ancho = campo.ancho || 220;
  // 0.3528 = mm por punto (25.4/72). El multiplicador lo controla el diseño: la lista de módulos
  // suele necesitar más aire que un párrafo corrido para que se lea como filas separadas.
  const alturaLinea = (campo.fontSize || 12) * 0.3528 * (campo.interlineado || 1.15);
  let fila = 0;
  for (const parrafo of texto.split('\n')) {
    const lineas = doc.splitTextToSize(parrafo, ancho) as string[];
    for (const linea of lineas) {
      doc.text(linea, campo.x, campo.y + fila * alturaLinea, { align: campo.align || 'center' });
      fila++;
    }
  }
}

function dibujarTextoFijo(doc: jsPDF, campo: CampoPlantilla) {
  dibujarTexto(doc, campo, campo.texto || '');
}

/** Nombre de cada módulo/asignatura, uno por línea — "Módulo 1: Microsoft Word". Alternativa a
 * `tabla_notas` para quien prefiera columnas sueltas y reposicionables en vez de una tabla fija
 * (útil en diseños verticales angostos, donde una tabla de 3 columnas no siempre entra).
 *
 * Prioriza las asignaturas RENDIDAS (así las tres listas —módulo, nota en letras, nota en
 * números— quedan fila por fila en el mismo orden), y si no hay ninguna cae al temario del curso.
 * Ese respaldo es lo que hace que el campo sirva en un certificado de certificación directa: ahí
 * el alumno no rindió nada, así que `asignaturas` viene vacío y antes el campo no dibujaba NADA
 * — el temario simplemente no salía impreso. */
function textoListaModulos(data: CertificadoRenderData): string {
  const asignaturas = data.asignaturas || [];
  const nombres = asignaturas.length ? asignaturas.map((a) => a.nombre) : data.modulos || [];
  return nombres.map((nombre, i) => `Módulo ${i + 1}: ${sinNumeracionPropia(nombre)}`).join('\n');
}

/**
 * Quita del título su propia numeración ("Unidad 1:", "Módulo 3 -", "Tema 2.") para que al
 * anteponer "Módulo N:" no salga duplicada.
 *
 * Los títulos del temario vienen escritos por quien carga el curso y casi siempre ya traen su
 * numeración: los módulos de "Centro quirúrgico" se llaman "Unidad 1: Generalidades en sala de
 * operaciones", y el certificado imprimía "Módulo 1: Unidad 1: Generalidades…" — dos numeraciones
 * pegadas, y encima con dos nombres distintos para lo mismo.
 *
 * Solo se recorta el prefijo cuando trae número: un módulo llamado "Unidad de cuidados
 * intensivos" (sin numerar) conserva su nombre completo, que es parte del título y no un rótulo.
 */
function sinNumeracionPropia(titulo: string): string {
  const limpio = titulo.replace(/^\s*(?:unidad|m[oó]dulo|tema|cap[ií]tulo|sesi[oó]n)\s*(?:n[°º.]?\s*)?\d+\s*[:.\-–—)]\s*/iu, '').trim();
  // Si el título era SOLO el rótulo numerado ("Unidad 3") no queda nada; en ese caso se conserva
  // el original antes que imprimir "Módulo 3: " con la mitad vacía.
  return limpio || titulo.trim();
}

/** Nota de cada módulo en letras, en el mismo orden que `textoListaModulos` — para usar junto a
 * ese campo (y a `textoListaNotasNumeros`) en vez del bloque completo de `tabla_notas`. */
function textoListaNotasLetras(asignaturas: { nombre: string; nota: number }[]): string {
  return asignaturas.map((a) => numeroALetras(a.nota)).join('\n');
}

/** Igual que `textoListaNotasLetras` pero en números. */
function textoListaNotasNumeros(asignaturas: { nombre: string; nota: number }[]): string {
  return asignaturas.map((a) => String(a.nota)).join('\n');
}

/** Promedio de las notas rendidas, redondeado — el mismo número que `dibujarTablaNotas` imprime
 * en su fila "Promedio Final", pero como campo suelto para colocarlo donde el diseño lo necesite.
 * Devuelve null si no hay notas (certificación directa): así el campo no dibuja un "0" inventado. */
function promedioNotas(asignaturas: { nombre: string; nota: number }[]): number | null {
  if (!asignaturas.length) return null;
  return Math.round(asignaturas.reduce((s, a) => s + a.nota, 0) / asignaturas.length);
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
  // El mismo cálculo que los campos sueltos "Promedio en letras"/"Promedio en número", para que
  // un diseño que use la tabla y otro que use los campos nunca impriman promedios distintos.
  const promedio = promedioNotas(asignaturas)!;
  fila('Promedio Final', numeroALetras(promedio), String(promedio), true);
}

async function dibujarDesdePlantilla(
  doc: jsPDF,
  data: CertificadoRenderData,
  plantilla: PlantillaCertificado,
  urlBase?: string,
  db: ClienteSupabase = supabase
): Promise<void> {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const qrDataUrl = plantilla.paginas.some((p) => p.campos.some((c) => c.variable === 'qr' && c.visible !== false))
    ? await generarQrDataUrl(data.codigo, urlBase)
    : null;

  for (let indice = 0; indice < plantilla.paginas.length; indice++) {
    const pagina = plantilla.paginas[indice];
    if (indice > 0) doc.addPage();

    if (pagina.imagen_url) {
      const imagen = await descargarImagenPlantilla(pagina.imagen_url, db);
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
      if (campo.variable === 'lista_modulos') {
        dibujarTexto(doc, campo, textoListaModulos(data));
        continue;
      }
      if (campo.variable === 'lista_notas_letras') {
        dibujarTexto(doc, campo, textoListaNotasLetras(data.asignaturas || []));
        continue;
      }
      if (campo.variable === 'lista_notas_numeros') {
        dibujarTexto(doc, campo, textoListaNotasNumeros(data.asignaturas || []));
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

async function construirDoc(
  data: CertificadoRenderData,
  tipo: TipoPlantilla,
  urlBase?: string,
  db: ClienteSupabase = supabase
): Promise<jsPDF> {
  const plantilla = await obtenerPlantillaActiva(tipo, data.cursoId, data.modalidad, db);

  if (plantilla && plantilla.paginas.length > 0) {
    const doc = new jsPDF({ orientation: plantilla.orientacion === 'vertical' ? 'portrait' : 'landscape', unit: 'mm', format: 'a4' });
    await dibujarDesdePlantilla(doc, data, plantilla, urlBase, db);
    return doc;
  }

  // Sin diseño activo (ni asignado al curso): respaldo de siempre, A4 horizontal.
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  if (tipo === 'digital') await dibujarDigitalPorDefecto(doc, data, urlBase);
  else await dibujarImprimirPorDefecto(doc, data, urlBase);
  return doc;
}

// ---------------------------------------------------------------------------
// Layout fijo de siempre (respaldo cuando no hay ningún diseño activo).
// ---------------------------------------------------------------------------

async function dibujarDigitalPorDefecto(doc: jsPDF, data: CertificadoRenderData, urlBase?: string): Promise<void> {
  const qrDataUrl = await generarQrDataUrl(data.codigo, urlBase);

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

async function dibujarImprimirPorDefecto(doc: jsPDF, data: CertificadoRenderData, urlBase?: string): Promise<void> {
  const qrDataUrl = await generarQrDataUrl(data.codigo, urlBase);

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
// API pública del render.
// ---------------------------------------------------------------------------

export async function generarCertificadoPDF(data: CertificadoData): Promise<void> {
  const doc = await construirDoc(data, 'digital');
  doc.save(`certificado-${data.codigo.slice(0, 8)}.pdf`);
}

export async function generarCertificadoImprimirPDF(data: CertificadoImprimirData): Promise<void> {
  const doc = await construirDoc(data, 'imprimir');
  doc.save(`certificado-imprimir-${data.codigo.slice(0, 8)}.pdf`);
}

/**
 * Devuelve el blob URL del PDF ya construido.
 *
 * Ojo con el `String(...)`: los typings de jsPDF declaran que `output('bloburl')`
 * devuelve un `URL`, pero en tiempo de ejecución devuelve el string de
 * `URL.createObjectURL()`. Leer `.href` daba `undefined` sin que TypeScript se
 * quejara, y la vista previa salía en blanco.
 */
function blobUrlDe(doc: jsPDF): string {
  return String(doc.output('bloburl'));
}

/** Genera el PDF pero en vez de descargarlo devuelve un blob URL para mostrarlo en un <iframe> (vista previa). */
export async function abrirVistaPreviaCertificado(
  data: CertificadoRenderData,
  tipo: TipoPlantilla
): Promise<{ url: string; filename: string }> {
  const doc = await construirDoc(data, tipo);
  return { url: blobUrlDe(doc), filename: nombreArchivoCertificado(data.codigo, tipo) };
}

/**
 * Genera el PDF como Blob renderizándolo en el navegador.
 *
 * Para un certificado YA emitido usa `descargarPdfCertificado` (lib/certificado.ts):
 * el PDF oficial lo arma el servidor y aplica reglas que acá no están (nombre del
 * perfil por encima del tecleado al emitir, fecha fijada a horario de Lima). Esta
 * función es para previsualizar lo que aún no existe en la base de datos.
 */
export async function generarCertificadoBlob(data: CertificadoRenderData, tipo: TipoPlantilla): Promise<Blob> {
  const doc = await construirDoc(data, tipo);
  return doc.output('blob');
}

/** Genera el PDF como Buffer. Solo se usa desde el servidor (lib/server/certificadoPdf.ts),
 * donde hay que pasar `urlBase` porque no existe `window` para deducir el origen del QR, y el
 * cliente con service role porque no hay sesión de navegador que satisfaga las RLS. */
export async function generarCertificadoBuffer(
  data: CertificadoRenderData,
  tipo: TipoPlantilla,
  urlBase: string,
  db: ClienteSupabase = supabase
): Promise<Buffer> {
  const doc = await construirDoc(data, tipo, urlBase, db);
  return Buffer.from(doc.output('arraybuffer'));
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
  return { url: blobUrlDe(doc), filename: `certificado${tipo === 'imprimir' ? '-imprimir' : ''}-preview.pdf` };
}
