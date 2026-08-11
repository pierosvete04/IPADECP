/**
 * Certificados: tipos, acceso a datos, plantillas y URLs.
 *
 * Este módulo NO dibuja el PDF. El render vive en `lib/certificadoRender.ts`,
 * que es el único que importa jspdf y qrcode (~350 KB juntos).
 *
 * La separación es deliberada. Antes todo estaba acá, y como `jspdf` y `qrcode`
 * se importaban en el nivel superior, cualquiera que necesitara una función de
 * string se los llevaba enteros: la página pública de verificación
 * (`/certificado/[codigo]`) solo usa `urlCertificadoServidor` y le estaba
 * sirviendo el renderizador completo a cada visitante anónimo.
 *
 * Regla para quien edite esto: si una función necesita jspdf, va en
 * `certificadoRender.ts`. Acá solo tipos, consultas y URLs.
 */
import { supabase } from '@/lib/supabase/client';

/**
 * Cliente de Supabase con el que leer.
 *
 * Existe porque este código corre en los dos lados. En el navegador se usa el
 * singleton anónimo; en el servidor (`lib/server/certificadoPdf.ts`) hay que
 * pasar el cliente con service role. Antes no se podía: el módulo usaba el
 * singleton del navegador siempre, así que la ruta oficial del PDF leía los
 * datos del certificado con service role pero resolvía la plantilla y bajaba la
 * imagen de fondo del bucket privado con la clave anónima.
 */
export type ClienteSupabase = typeof supabase;

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
  /** 'emitido' | 'anulado'. Un certificado anulado se sigue mostrando, pero como anulado. */
  estado: string;
  codigo: string;
  /** Código legible impreso en el certificado (IPD-2026-000123). Null si la fila no tiene registro. */
  codigo_corto?: string | null;
  cargo?: string | null;
  modalidad?: string;
  periodo_inicio?: string | null;
  periodo_entrega?: string | null;
  periodo_cierre?: string | null;
  anulado_en?: string | null;
  motivo_anulacion?: string | null;
  drive_digital_url?: string | null;
}

export function estaAnulado(cert: Pick<CertificadoPublico, 'estado'>): boolean {
  return cert.estado === 'anulado';
}

export async function obtenerCertificadoPublico(codigo: string): Promise<CertificadoPublico | null> {
  const { data, error } = await supabase.rpc('obtener_certificado_publico', { p_codigo: codigo });
  if (error || !data) return null;
  return data as CertificadoPublico;
}

/**
 * Busca por lo que la persona tenga a mano: el UUID del QR, el código corto impreso
 * (IPD-2026-000123) o solo el número de registro. La normalización la hace la base
 * de datos — ver `buscar_certificado_publico`.
 */
export async function buscarCertificadoPublico(busqueda: string): Promise<CertificadoPublico | null> {
  const { data, error } = await supabase.rpc('buscar_certificado_publico', { p_busqueda: busqueda });
  if (error || !data) return null;
  return data as CertificadoPublico;
}

// ---------------------------------------------------------------------------
// Plantillas editables (tabla plantillas_certificado, panel admin → Diseño).
// Cada tipo ('digital' / 'imprimir') puede tener varios diseños guardados con
// nombre; solo uno puede estar "activo" a la vez y es el que se usa al emitir.
// Si no hay ningún diseño activo, se usa el layout fijo de siempre como
// respaldo — ver dibujarDigitalPorDefecto / dibujarImprimirPorDefecto en
// certificadoRender.ts.
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
  | 'cargo_persona'
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
  | 'lista_modulos'
  | 'lista_notas_letras'
  | 'lista_notas_numeros'
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
export async function obtenerAsignaturasParaCertificado(
  cursoId: number,
  alumnoUid: string,
  db: ClienteSupabase = supabase
): Promise<{ nombre: string; nota: number }[]> {
  const { data: tareas } = await db.from('tareas').select('id,titulo').eq('curso_id', cursoId).eq('estado', '1').order('id');
  if (!tareas?.length) return [];

  const { data: resultados } = await db
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
export async function obtenerPlantillaActiva(
  tipo: TipoPlantilla,
  cursoId?: number,
  modalidad?: ModalidadCertificado,
  db: ClienteSupabase = supabase
): Promise<PlantillaCertificado | null> {
  if (cursoId != null) {
    const candidatas: ModalidadAsignacion[] = modalidad ? [modalidad, 'general'] : ['general'];
    for (const m of candidatas) {
      const { data: asignacion } = await db
        .from('plantillas_certificado_cursos')
        .select('plantilla_id')
        .eq('curso_id', cursoId)
        .eq('tipo', tipo)
        .eq('modalidad', m)
        .maybeSingle();
      if (asignacion?.plantilla_id) {
        const { data } = await db.from('plantillas_certificado').select('id,tipo,nombre,activa,orientacion,paginas').eq('id', asignacion.plantilla_id).maybeSingle();
        if (data) return data as PlantillaCertificado;
      }
    }
  }
  const { data, error } = await db.from('plantillas_certificado').select('id,tipo,nombre,activa,orientacion,paginas').eq('tipo', tipo).eq('activa', true).maybeSingle();
  if (error || !data) return null;
  return data as PlantillaCertificado;
}

/** `imagen_url` guarda la ruta dentro del bucket 'certificados' (no una URL pública: el bucket es privado y se
 * lee vía descarga autenticada/RLS, para que tanto el admin como la página pública de verificación puedan acceder). */
export async function descargarImagenPlantilla(ruta: string, db: ClienteSupabase = supabase): Promise<{ dataUrl: string; formato: string } | null> {
  const { data, error } = await db.storage.from('certificados').download(ruta);
  if (error || !data) return null;
  const formato = data.type.includes('png') ? 'PNG' : data.type.includes('webp') ? 'WEBP' : 'JPEG';
  // El mismo render corre en el navegador y en el servidor (ver lib/server/certificadoPdf.ts).
  // FileReader solo existe en el navegador; en Node se arma el data URL desde el ArrayBuffer.
  if (typeof FileReader === 'undefined') {
    const base64 = Buffer.from(await data.arrayBuffer()).toString('base64');
    return { dataUrl: `data:${data.type};base64,${base64}`, formato };
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result as string);
    lector.onerror = () => reject(new Error('No se pudo leer la imagen de la plantilla.'));
    lector.readAsDataURL(data);
  });
  return { dataUrl, formato };
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

// ---------------------------------------------------------------------------
// URLs y respaldo en Drive.
// ---------------------------------------------------------------------------

/** URL pública y estable del certificado, servida por la propia app. Es la que se le entrega al
 * alumno: el PDF se arma en el servidor a partir de la base de datos, no de un archivo subido. */
export function urlCertificadoServidor(codigo: string, tipo: TipoPlantilla = 'digital'): string {
  return `/api/certificados/${encodeURIComponent(codigo)}/pdf${tipo === 'imprimir' ? '?tipo=imprimir' : ''}`;
}

/** Nombre de archivo estándar de un certificado ya emitido. */
export function nombreArchivoCertificado(codigo: string, tipo: TipoPlantilla = 'digital'): string {
  return `certificado${tipo === 'imprimir' ? '-imprimir' : ''}-${codigo.slice(0, 8)}.pdf`;
}

/** Vista previa de un certificado YA emitido, apuntando al PDF del servidor. Se usa en vez de
 * `abrirVistaPreviaCertificado` (que renderiza en el navegador) para que lo que el admin ve sea
 * exactamente el archivo que va a recibir el cliente — incluido el Registro N° que asigna la BD.
 *
 * Asíncrona porque la variante `imprimir` exige sesión y hay que traerla con `fetch`
 * autenticado; un `<iframe src>` no puede mandar cabeceras. Ver `abrirPdfCertificado`. */
export async function previaCertificadoServidor(codigo: string, tipo: TipoPlantilla = 'digital'): Promise<{ url: string; filename: string }> {
  return { url: await abrirPdfCertificado(codigo, tipo), filename: nombreArchivoCertificado(codigo, tipo) };
}

/**
 * Descarga el PDF oficial de un certificado ya emitido, tal cual lo sirve el servidor.
 *
 * Es la única forma correcta de obtener el archivo de un certificado emitido. Volver a
 * renderizarlo en el navegador produce un PDF *distinto*: el servidor sella la fecha en horario
 * de Lima y toma el nombre congelado al emitir, así que el .zip y el adjunto del correo salían
 * con otro día y a veces con otro nombre que el PDF del QR.
 *
 * Manda la sesión en la cabecera porque la variante `imprimir` lleva el DNI impreso y la ruta
 * solo se la sirve al titular o a un admin. La `digital` es pública y no la necesita, pero
 * mandarla igual no cuesta nada y simplifica el llamador.
 */
export async function descargarPdfCertificado(codigo: string, tipo: TipoPlantilla = 'digital'): Promise<Blob> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(urlCertificadoServidor(codigo, tipo), {
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
  });
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    throw new Error(cuerpo?.error || 'No se pudo obtener el certificado.');
  }
  return res.blob();
}

/**
 * URL lista para abrir en una pestaña o en un `<iframe>`.
 *
 * `window.open` y `<iframe src>` no pueden mandar cabeceras, así que la variante `imprimir`
 * —que exige sesión— se descarga con `fetch` autenticado y se expone como blob URL. La
 * `digital` es pública y se enlaza directo, sin descargar nada de más.
 *
 * Quien la use debe llamar a `URL.revokeObjectURL` cuando termine (ver `esBlobUrl`).
 */
export async function abrirPdfCertificado(codigo: string, tipo: TipoPlantilla = 'digital'): Promise<string> {
  if (tipo === 'digital') return urlCertificadoServidor(codigo, tipo);
  return URL.createObjectURL(await descargarPdfCertificado(codigo, tipo));
}

export function esBlobUrl(url: string | null | undefined): boolean {
  return !!url && url.startsWith('blob:');
}

/**
 * Garantiza que el certificado (digital o imprimir) esté respaldado en Google Drive y devuelve su link.
 * Si `urlExistente` ya viene (columna drive_digital_url/drive_imprimir_url de la fila en BD), la
 * devuelve tal cual — así cada certificado se sube una sola vez.
 *
 * El PDF ya no se genera aquí ni se envía: lo arma el servidor leyendo la base de datos. Antes se
 * mandaba el archivo desde el navegador, lo que permitía que un alumno subiera un PDF adulterado
 * como si fuera su propio certificado. Ahora el cliente solo pide "respalda el certificado N".
 * Requiere sesión activa (admin o el propio alumno dueño del certificado).
 */
export async function asegurarCertificadoEnDrive(
  _data: CertificadoRenderData | null,
  tipo: TipoPlantilla,
  certificadoId: number,
  urlExistente: string | null | undefined
): Promise<string> {
  if (urlExistente) return urlExistente;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Debes iniciar sesión para subir el certificado a Drive.');

  const res = await fetch('/api/certificados/subir-drive', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo, certificadoId }),
  });
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    throw new Error(cuerpo?.error || 'No se pudo subir el certificado a Drive.');
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}

/**
 * Vuelve a generar el certificado y pisa su copia de Drive, conservando el link.
 *
 * Para qué sirve, exactamente: el PDF que la app entrega (QR, "Digital", "Para imprimir", el .zip
 * y el adjunto del correo) se arma en cada descarga desde la base de datos y resolviendo la
 * plantilla vigente, así que un cambio de diseño YA se ve reflejado ahí sin hacer nada. Lo único
 * que no se entera es el archivo respaldado en Drive, que se subió una vez y quedó congelado con
 * el diseño de ese día. Esto lo pone al día.
 *
 * A diferencia de `respaldarCertificadoEnDrive`, esta sí espera y sí propaga el error: la lanza
 * un admin a propósito y necesita saber si funcionó.
 */
export async function regenerarCertificadoEnDrive(tipo: TipoPlantilla, certificadoId: number): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Debes iniciar sesión para regenerar el certificado.');

  const res = await fetch('/api/certificados/subir-drive', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo, certificadoId, forzar: true }),
  });
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    throw new Error(cuerpo?.error || 'No se pudo regenerar el certificado.');
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}

/**
 * Respalda el certificado en Drive sin bloquear a quien lo llamó ni romper si falla.
 *
 * Drive es SOLO respaldo: lo que se abre, se descarga y se verifica sale de
 * `urlCertificadoServidor`, que arma el PDF en el momento a partir de la base de
 * datos. Por eso acá no se espera el resultado ni se muestra error — que el
 * respaldo se demore o falle no puede impedir que el admin vea el certificado.
 */
export function respaldarCertificadoEnDrive(
  tipo: TipoPlantilla,
  certificadoId: number,
  urlExistente: string | null | undefined
): void {
  if (urlExistente) return;
  void asegurarCertificadoEnDrive(null, tipo, certificadoId, urlExistente).catch((e) => {
    console.error(`No se pudo respaldar en Drive el certificado ${certificadoId} (${tipo}):`, e);
  });
}
