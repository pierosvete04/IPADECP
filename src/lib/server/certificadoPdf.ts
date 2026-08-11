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
  obtenerAsignaturasParaCertificado,
  obtenerModulosDelCurso,
  type CertificadoRenderData,
  type ClienteSupabase,
  type ModalidadCertificado,
  type TipoPlantilla,
} from '@/lib/certificado';
import { generarCertificadoBuffer } from '@/lib/certificadoRender';
// El formato vive en `lib/fechas.ts` porque la página pública de verificación tiene que usar
// exactamente el mismo: si el PDF y la web no coinciden en el día, la verificación no sirve.
import { fechaPeru, fechaSoloDia } from '@/lib/fechas';

function clienteAdmin(): ClienteSupabase {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el servidor.');
  return createClient(url, serviceKey);
}

/** `fechaSoloDia` devuelve '' cuando no hay valor; acá conviene `undefined` para no dibujar el campo. */
const soloDiaOpcional = (valor: string | null | undefined) => fechaSoloDia(valor) || undefined;

export interface CertificadoDesdeBd {
  id: number;
  alumnoUid: string | null;
  driveDigitalUrl: string | null;
  driveImprimirUrl: string | null;
  /** 'emitido' | 'anulado'. Un certificado anulado no se sirve como PDF. */
  estado: string;
  anuladoEn: string | null;
  motivoAnulacion: string | null;
  data: CertificadoRenderData;
}

/** Arma los datos de render de un certificado leyéndolos de la BD con la service role.
 * Devuelve null si el código no corresponde a ningún certificado emitido. */
export async function obtenerDatosCertificado(codigo: string): Promise<CertificadoDesdeBd | null> {
  const admin = clienteAdmin();

  const { data: cert } = await admin
    .from('certificados')
    .select('id,curso_id,alumno_uid,fecha,codigo_verificacion,dni,nombre_completo,cargo,periodo_id,modalidad,registro,libro,creditos,meses,horas_lectivas,drive_digital_url,drive_imprimir_url,estado,anulado_en,motivo_anulacion')
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

  // MANDA EL NOMBRE SELLADO AL EMITIR, no el del perfil.
  //
  // Antes era al revés y el efecto era grave: el perfil pisaba al certificado, y como el alumno
  // edita su propio perfil desde el aula, podía reescribir el nombre de un diploma ya emitido.
  // Pasó de verdad — el certificado 8 se emitió a "SVETE ANCHANTE PIERO PAOLO" (nombre traído de
  // RENIEC y confirmado por el admin) y la web y el PDF mostraban "Piero Svete".
  //
  // El perfil queda solo de respaldo para certificados antiguos que se guardaron sin nombre.
  // Si alguien cambia de nombre legalmente, se corrige el certificado desde el panel.
  const nombrePerfil = perfil?.nombres && perfil?.apellidos ? `${perfil.nombres} ${perfil.apellidos}` : perfil?.nombre;
  const alumnoNombre = cert.nombre_completo?.trim() || nombrePerfil || '';

  const modalidad = (cert.modalidad === 'evaluado' || cert.modalidad === 'directo' ? cert.modalidad : undefined) as
    | ModalidadCertificado
    | undefined;

  // Con el cliente admin y no con el singleton del navegador: acá no hay sesión que
  // satisfaga las RLS de `resultados_examen`, así que leído anónimamente devolvía
  // una tabla de notas vacía sin dar error.
  //
  // Las notas solo existen para 'evaluado' (en certificación directa el alumno no rinde nada),
  // pero el TEMARIO del curso se imprime igual en los dos casos — por eso los módulos se piden
  // siempre. Sin esto, el campo "Módulos" del diseño salía en blanco en todo certificado directo.
  const [asignaturas, modulos] = await Promise.all([
    modalidad === 'evaluado' && cert.alumno_uid && cert.curso_id
      ? obtenerAsignaturasParaCertificado(cert.curso_id, cert.alumno_uid, admin)
      : Promise.resolve([]),
    cert.curso_id ? obtenerModulosDelCurso(cert.curso_id, admin) : Promise.resolve([]),
  ]);

  return {
    id: cert.id,
    alumnoUid: cert.alumno_uid,
    driveDigitalUrl: cert.drive_digital_url,
    driveImprimirUrl: cert.drive_imprimir_url,
    estado: cert.estado || 'emitido',
    anuladoEn: cert.anulado_en,
    motivoAnulacion: cert.motivo_anulacion,
    data: {
      codigo: cert.codigo_verificacion,
      alumnoNombre,
      cursoNombre: curso?.nombre || '',
      fecha: fechaPeru(cert.fecha),
      cargo: cert.cargo || undefined,
      dni: cert.dni || undefined,
      cursoId: cert.curso_id ?? undefined,
      modalidad,
      periodoInicio: soloDiaOpcional(periodo?.fecha_inicio),
      periodoEntrega: soloDiaOpcional(periodo?.fecha_entrega),
      periodoCierre: soloDiaOpcional(periodo?.fecha_cierre),
      registro: cert.registro || undefined,
      libro: cert.libro || undefined,
      creditos: cert.creditos || undefined,
      meses: cert.meses || undefined,
      horasLectivas: cert.horas_lectivas || undefined,
      asignaturas: asignaturas.length ? asignaturas : undefined,
      modulos: modulos.length ? modulos : undefined,
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
  // El cliente admin también va al render: resolver la plantilla del curso y bajar la
  // imagen de fondo del bucket privado `certificados` son lecturas con RLS, y sin él
  // el PDF oficial salía sin el diseño asignado.
  const buffer = await generarCertificadoBuffer(cert.data, tipo, urlBase, clienteAdmin());
  const nombreLimpio = (cert.data.alumnoNombre || 'certificado').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return { buffer, nombreArchivo: `certificado-${tipo}-${nombreLimpio || 'alumno'}.pdf` };
}
