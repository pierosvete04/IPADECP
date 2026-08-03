/**
 * Generación del PDF del certificado en el servidor, a partir de la base de datos.
 *
 * Server-only. Es la fuente de verdad del certificado: antes el PDF se armaba en el navegador
 * y se subía, lo que permitía que el propio alumno enviara un archivo adulterado y quedara
 * publicado como su certificado oficial. Ahora el cliente solo pide el certificado por su
 * código y el servidor lo dibuja con los datos de la BD.
 *
 * Reutiliza el mismo render que el navegador (lib/certificado.ts) para que el PDF servido, el
 * que se descarga desde el panel y el que se respalda en Drive sean idénticos.
 */
import { createClient } from '@supabase/supabase-js';
import {
  generarCertificadoBuffer,
  obtenerAsignaturasParaCertificado,
  type CertificadoRenderData,
  type ModalidadCertificado,
  type TipoPlantilla,
} from '@/lib/certificado';

function clienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el servidor.');
  return createClient(url, serviceKey);
}

/**
 * `fecha` es timestamptz: el navegador del alumno la formatea en hora de Lima, pero el servidor
 * corre en UTC. Sin fijar la zona, un certificado emitido de noche saldría con un día de
 * diferencia según dónde se genere el PDF.
 */
function fechaPeru(valor: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima',
  }).format(new Date(valor));
}

/** Las fechas de período son `date` (sin hora): se formatean tal cual, sin pasar por zonas horarias. */
function fechaSoloDia(valor: string | null | undefined): string | undefined {
  if (!valor) return undefined;
  const [a, m, d] = valor.slice(0, 10).split('-');
  return a && m && d ? `${d}/${m}/${a}` : undefined;
}

export interface CertificadoDesdeBd {
  id: number;
  alumnoUid: string | null;
  driveDigitalUrl: string | null;
  driveImprimirUrl: string | null;
  data: CertificadoRenderData;
}

/** Arma los datos de render de un certificado leyéndolos de la BD con la service role.
 * Devuelve null si el código no corresponde a ningún certificado emitido. */
export async function obtenerDatosCertificado(codigo: string): Promise<CertificadoDesdeBd | null> {
  const admin = clienteAdmin();

  const { data: cert } = await admin
    .from('certificados')
    .select('id,curso_id,alumno_uid,fecha,codigo_verificacion,dni,nombre_completo,cargo,periodo_id,modalidad,registro,libro,creditos,meses,horas_lectivas,drive_digital_url,drive_imprimir_url')
    .eq('codigo_verificacion', codigo)
    .maybeSingle();
  if (!cert) return null;

  const [{ data: curso }, { data: periodo }, { data: perfil }] = await Promise.all([
    admin.from('cursos').select('nombre').eq('id', cert.curso_id).maybeSingle(),
    cert.periodo_id
      ? admin.from('periodos_certificacion').select('fecha_inicio,fecha_entrega,fecha_cierre').eq('id', cert.periodo_id).maybeSingle()
      : Promise.resolve({ data: null }),
    cert.alumno_uid
      ? admin.from('perfiles').select('nombres,apellidos,nombre').eq('id', cert.alumno_uid).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Mismo orden de preferencia que la RPC obtener_certificado_publico, para que el nombre del
  // PDF y el de la página de verificación no se contradigan.
  const nombrePerfil = perfil?.nombres && perfil?.apellidos ? `${perfil.nombres} ${perfil.apellidos}` : perfil?.nombre;
  const alumnoNombre = nombrePerfil || cert.nombre_completo || '';

  const modalidad = (cert.modalidad === 'evaluado' || cert.modalidad === 'directo' ? cert.modalidad : undefined) as
    | ModalidadCertificado
    | undefined;

  const asignaturas =
    modalidad === 'evaluado' && cert.alumno_uid && cert.curso_id
      ? await obtenerAsignaturasParaCertificado(cert.curso_id, cert.alumno_uid)
      : [];

  return {
    id: cert.id,
    alumnoUid: cert.alumno_uid,
    driveDigitalUrl: cert.drive_digital_url,
    driveImprimirUrl: cert.drive_imprimir_url,
    data: {
      codigo: cert.codigo_verificacion,
      alumnoNombre,
      cursoNombre: curso?.nombre || '',
      fecha: fechaPeru(cert.fecha),
      cargo: cert.cargo || undefined,
      dni: cert.dni || undefined,
      cursoId: cert.curso_id ?? undefined,
      modalidad,
      periodoInicio: fechaSoloDia(periodo?.fecha_inicio),
      periodoEntrega: fechaSoloDia(periodo?.fecha_entrega),
      periodoCierre: fechaSoloDia(periodo?.fecha_cierre),
      registro: cert.registro || undefined,
      libro: cert.libro || undefined,
      creditos: cert.creditos || undefined,
      meses: cert.meses || undefined,
      horasLectivas: cert.horas_lectivas || undefined,
      asignaturas: asignaturas.length ? asignaturas : undefined,
    },
  };
}

export interface PdfGenerado {
  buffer: Buffer;
  nombreArchivo: string;
}

/** Genera el PDF de un certificado ya resuelto. `urlBase` es el origen público del sitio (va en el QR). */
export async function generarPdfCertificado(
  cert: CertificadoDesdeBd,
  tipo: TipoPlantilla,
  urlBase: string
): Promise<PdfGenerado> {
  const buffer = await generarCertificadoBuffer(cert.data, tipo, urlBase);
  const nombreLimpio = (cert.data.alumnoNombre || 'certificado').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return { buffer, nombreArchivo: `certificado-${tipo}-${nombreLimpio || 'alumno'}.pdf` };
}
