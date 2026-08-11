/**
 * Subida de certificados a Google Drive, organizados como:
 *   "Certificados Emitidos" (creada por la propia app la primera vez)
 *     Digitales|Para imprimir
 *       <Mes Año>
 *
 * Server-only. Usa OAuth con un refresh token de la cuenta de Google del usuario
 * (no una cuenta de servicio): en un Drive personal (no Workspace), las cuentas
 * de servicio no tienen cuota de almacenamiento propia y no pueden subir archivos
 * ni siquiera dentro de una carpeta compartida como Editor — con OAuth, en cambio,
 * los archivos quedan subidos por la cuenta real del usuario y cuentan contra su
 * propio Drive. El scope usado es drive.file (solo archivos creados por esta app),
 * que evita el proceso de verificación de Google para scopes sensibles/restringidos.
 */
import { google } from 'googleapis';
import { Readable } from 'node:stream';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const NOMBRE_CARPETA_RAIZ = 'Certificados Emitidos';

export type TipoCertificadoDrive = 'digital' | 'imprimir';

const NOMBRE_CARPETA_TIPO: Record<TipoCertificadoDrive, string> = {
  digital: 'Digitales',
  imprimir: 'Para imprimir',
};

export function nombreCarpetaMes(fecha: Date): string {
  return `${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
}

function clienteDrive() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Faltan las credenciales OAuth de Google (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN).');
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: 'v3', auth });
}

/**
 * Busca una subcarpeta por nombre dentro de `idPadre` (o en la raíz de Mi unidad si se omite);
 * si no existe, la crea.
 *
 * Drive permite varias carpetas con el mismo nombre bajo el mismo padre, y entre listar y crear
 * no hay forma de bloquear: dos subidas simultáneas pueden crear la misma carpeta dos veces y
 * repartir los certificados en dos árboles paralelos. Dos medidas contra eso:
 *   1. el listado ordena por createdTime, así todas las ejecuciones eligen siempre la más antigua
 *      aunque ya existan duplicados — nadie se desvía a la copia equivocada;
 *   2. después de crear se vuelve a mirar: si alguien se nos adelantó, nos quedamos con la suya y
 *      retiramos la nuestra (solo si quedó vacía, para no perder nada).
 */
async function obtenerOCrearSubcarpeta(drive: ReturnType<typeof clienteDrive>, nombre: string, idPadre?: string): Promise<string> {
  const nombreEscapado = nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const filtroPadre = idPadre ? `'${idPadre}' in parents` : `'root' in parents`;
  const consulta = `name='${nombreEscapado}' and ${filtroPadre} and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const listar = async () => {
    const { data } = await drive.files.list({
      q: consulta,
      fields: 'files(id,name,createdTime)',
      spaces: 'drive',
      orderBy: 'createdTime',
      pageSize: 10,
    });
    return data.files ?? [];
  };

  const existentes = await listar();
  if (existentes[0]?.id) return existentes[0].id;

  const { data: creada } = await drive.files.create({
    requestBody: {
      name: nombre,
      mimeType: 'application/vnd.google-apps.folder',
      parents: idPadre ? [idPadre] : undefined,
    },
    fields: 'id',
  });
  if (!creada.id) throw new Error(`No se pudo crear la carpeta "${nombre}" en Drive.`);

  const trasCrear = await listar();
  const ganadoraId = trasCrear[0]?.id ?? creada.id;
  if (ganadoraId !== creada.id) {
    try {
      const { data: hijos } = await drive.files.list({
        q: `'${creada.id}' in parents and trashed=false`,
        fields: 'files(id)',
        pageSize: 1,
      });
      if (!hijos.files?.length) await drive.files.delete({ fileId: creada.id });
    } catch {
      // Si no se puede limpiar, no es crítico: queda una carpeta vacía suelta, pero
      // todos los certificados siguen yendo a `ganadoraId`.
    }
  }
  return ganadoraId;
}

export interface SubirCertificadoInput {
  buffer: Buffer;
  nombreArchivo: string;
  tipo: TipoCertificadoDrive;
  /** Fecha usada para resolver la subcarpeta del mes (por defecto, ahora). */
  fecha?: Date;
}

/** Sube el PDF a la carpeta correspondiente (creando lo que falte) y lo deja visible por link. Devuelve el webViewLink. */
export async function subirCertificadoADrive({ buffer, nombreArchivo, tipo, fecha = new Date() }: SubirCertificadoInput): Promise<string> {
  const drive = clienteDrive();
  const raizId = await obtenerOCrearSubcarpeta(drive, NOMBRE_CARPETA_RAIZ);
  const carpetaTipoId = await obtenerOCrearSubcarpeta(drive, NOMBRE_CARPETA_TIPO[tipo], raizId);
  const carpetaMesId = await obtenerOCrearSubcarpeta(drive, nombreCarpetaMes(fecha), carpetaTipoId);

  const { data: archivo } = await drive.files.create({
    requestBody: { name: nombreArchivo, parents: [carpetaMesId] },
    media: { mimeType: 'application/pdf', body: Readable.from(buffer) },
    fields: 'id,webViewLink',
  });
  if (!archivo.id) throw new Error('No se pudo subir el certificado a Drive.');

  // Mismo nivel de exposición que ya tiene hoy la página pública de verificación
  // (cualquiera con el código/link puede ver nombre, curso y fecha del certificado).
  await drive.permissions.create({
    fileId: archivo.id,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  if (archivo.webViewLink) return archivo.webViewLink;
  const { data: releido } = await drive.files.get({ fileId: archivo.id, fields: 'webViewLink' });
  if (!releido.webViewLink) throw new Error('Drive no devolvió un link para el certificado subido.');
  return releido.webViewLink;
}

/** Extrae el id de archivo de un webViewLink de Drive
 * (https://drive.google.com/file/d/<ID>/view?usp=drivesdk). Devuelve null si la
 * URL no tiene esa forma — el llamador decide si sube uno nuevo en su lugar. */
export function idArchivoDriveDesdeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1] ?? null;
}

/**
 * Pisa el contenido de un PDF ya subido, conservando su id y por lo tanto su link.
 *
 * Se usa al regenerar un certificado tras un cambio de diseño. A propósito NO
 * sube un archivo nuevo: `subirCertificadoADrive` siempre hace `files.create`,
 * así que repetirlo dejaría dos PDF con el mismo nombre en la misma carpeta —el
 * viejo huérfano— y cambiaría el link, rompiendo cualquier sitio donde ya se
 * hubiera compartido el anterior.
 */
export async function reemplazarCertificadoEnDrive(fileId: string, buffer: Buffer): Promise<string> {
  const drive = clienteDrive();
  const { data: archivo } = await drive.files.update({
    fileId,
    media: { mimeType: 'application/pdf', body: Readable.from(buffer) },
    fields: 'id,webViewLink',
  });
  if (archivo.webViewLink) return archivo.webViewLink;
  const { data: releido } = await drive.files.get({ fileId, fields: 'webViewLink' });
  if (!releido.webViewLink) throw new Error('Drive no devolvió un link para el certificado actualizado.');
  return releido.webViewLink;
}
