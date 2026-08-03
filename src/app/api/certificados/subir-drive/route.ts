import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { subirCertificadoADrive, type TipoCertificadoDrive } from '@/lib/server/googleDrive';
import { obtenerDatosCertificado, generarPdfCertificado } from '@/lib/server/certificadoPdf';

export const runtime = 'nodejs';

/**
 * Respalda un certificado en Google Drive y guarda el link en
 * certificados.drive_digital_url / drive_imprimir_url.
 *
 * El PDF se genera aquí, en el servidor, a partir de la base de datos. Antes se recibía el
 * archivo ya armado desde el navegador, lo que permitía que un alumno subiera un PDF adulterado
 * y quedara publicado como su certificado oficial: la ruta acepta al dueño del certificado, no
 * solo al admin, y no había forma de comprobar que el archivo correspondiera al registro.
 *
 * Requiere sesión de Supabase (admin, o el propio alumno dueño del certificado). Idempotente: si
 * el certificado ya tiene un link para ese tipo, lo devuelve sin volver a subir nada.
 */
export async function POST(req: NextRequest) {
  let cuerpo: { tipo?: unknown; certificadoId?: unknown };
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de solicitud inválido.' }, { status: 400 });
  }

  const tipo = cuerpo.tipo;
  if (tipo !== 'digital' && tipo !== 'imprimir') {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }
  const certificadoId = Number(cuerpo.certificadoId);
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
    .select('id, alumno_uid, codigo_verificacion, drive_digital_url, drive_imprimir_url')
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

  let url: string;
  try {
    const cert = await obtenerDatosCertificado(fila.codigo_verificacion);
    if (!cert) return NextResponse.json({ error: 'Certificado no encontrado.' }, { status: 404 });

    const { buffer, nombreArchivo } = await generarPdfCertificado(cert, tipo as TipoCertificadoDrive, req.nextUrl.origin);
    url = await subirCertificadoADrive({
      buffer,
      nombreArchivo,
      tipo: tipo as TipoCertificadoDrive,
      fecha: new Date(),
    });
  } catch (e) {
    console.error('Error al subir certificado a Drive:', e);
    return NextResponse.json({ error: 'No se pudo subir el certificado a Drive.' }, { status: 502 });
  }

  const { error: updateError } = await supabaseAdmin.from('certificados').update({ [columna]: url }).eq('id', certificadoId);
  if (updateError) console.error('Error al guardar el link de Drive en el certificado:', updateError);

  return NextResponse.json({ url });
}
