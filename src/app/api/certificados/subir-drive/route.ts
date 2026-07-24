import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { subirCertificadoADrive, type TipoCertificadoDrive } from '@/lib/server/googleDrive';

export const runtime = 'nodejs';

/**
 * Sube un certificado (PDF) ya generado en el cliente a Google Drive y guarda el link
 * en certificados.drive_digital_url / drive_imprimir_url. Requiere sesión de Supabase
 * (admin, o el propio alumno dueño del certificado) — no se llama desde la página pública
 * de verificación, que es anónima. Idempotente: si el certificado ya tiene un link para
 * ese tipo, lo devuelve sin volver a subir nada.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const archivo = form.get('archivo');
  const tipo = form.get('tipo');
  const certificadoIdRaw = form.get('certificadoId');
  const fechaRaw = form.get('fecha');

  if (!(archivo instanceof File) || (tipo !== 'digital' && tipo !== 'imprimir') || !certificadoIdRaw) {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }
  const certificadoId = Number(certificadoIdRaw);
  if (!Number.isFinite(certificadoId)) {
    return NextResponse.json({ error: 'certificadoId inválido.' }, { status: 400 });
  }

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.' }, { status: 500 });
  }

  const supabaseUsuario = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await supabaseUsuario.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const { data: fila, error: filaError } = await supabaseAdmin
    .from('certificados')
    .select('id, alumno_uid, drive_digital_url, drive_imprimir_url')
    .eq('id', certificadoId)
    .maybeSingle();
  if (filaError || !fila) {
    return NextResponse.json({ error: 'Certificado no encontrado.' }, { status: 404 });
  }

  const { data: esAdmin } = await supabaseUsuario.rpc('es_admin');
  const esDueno = fila.alumno_uid === userData.user.id;
  if (!esAdmin && !esDueno) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  const columna = tipo === 'digital' ? 'drive_digital_url' : 'drive_imprimir_url';
  const urlExistente = tipo === 'digital' ? fila.drive_digital_url : fila.drive_imprimir_url;
  if (urlExistente) return NextResponse.json({ url: urlExistente });

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const fecha = fechaRaw ? new Date(String(fechaRaw)) : new Date();

  let url: string;
  try {
    url = await subirCertificadoADrive({
      buffer,
      nombreArchivo: archivo.name || `certificado-${certificadoId}.pdf`,
      tipo: tipo as TipoCertificadoDrive,
      fecha,
    });
  } catch (e) {
    console.error('Error al subir certificado a Drive:', e);
    return NextResponse.json({ error: 'No se pudo subir el certificado a Drive.' }, { status: 502 });
  }

  const { error: updateError } = await supabaseAdmin.from('certificados').update({ [columna]: url }).eq('id', certificadoId);
  if (updateError) console.error('Error al guardar el link de Drive en el certificado:', updateError);

  return NextResponse.json({ url });
}
