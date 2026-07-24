/**
 * Envío del certificado por correo al cliente, vía la Edge Function
 * enviar-certificado-correo (que llama a Resend server-side, donde vive el
 * secret RESEND_API_KEY — nunca debe tocar el cliente).
 */
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';

async function blobABase64(blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result as string);
    lector.onerror = () => reject(new Error('No se pudo leer el archivo adjunto.'));
    lector.readAsDataURL(blob);
  });
  // dataUrl viene como "data:application/pdf;base64,XXXX" — Resend solo quiere la parte base64.
  return dataUrl.split(',')[1] || '';
}

export interface EnvioCorreoInput {
  destinatario: string;
  asunto: string;
  cuerpoHtml: string;
  archivoBlob: Blob;
  nombreArchivo: string;
}

export interface EnvioCorreoResultado {
  ok: boolean;
  motivo?: string;
}

export async function enviarCorreoConCertificado(input: EnvioCorreoInput): Promise<EnvioCorreoResultado> {
  const archivoBase64 = await blobABase64(input.archivoBlob);
  const { data, error } = await supabase.functions.invoke('enviar-certificado-correo', {
    body: {
      destinatario: input.destinatario,
      asunto: input.asunto,
      cuerpoHtml: input.cuerpoHtml,
      archivoBase64,
      nombreArchivo: input.nombreArchivo,
    },
  });
  if (error || !data?.ok) {
    return { ok: false, motivo: data?.motivo || mensajeError(error, 'No se pudo enviar el correo.') };
  }
  return { ok: true };
}

export function correoCertificadoHtml(clienteNombre: string, cursoNombre: string, codigo: string): string {
  const url = `${window.location.origin}/certificado/${codigo}`;
  return `
    <p>Hola ${clienteNombre},</p>
    <p>Adjunto encontrarás tu certificado del curso <strong>${cursoNombre}</strong>.</p>
    <p>Puedes verificarlo en cualquier momento en: <a href="${url}">${url}</a></p>
    <p>Saludos,<br>IPADECP</p>
  `.trim();
}
