import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { obtenerDatosCertificado, generarPdfCertificado } from '@/lib/server/certificadoPdf';

export const runtime = 'nodejs';

/**
 * Sirve el PDF de un certificado a partir de su código de verificación.
 *
 * Dos variantes con dos públicos distintos:
 *
 *  - `digital` — PÚBLICA. Es la que enlaza el botón "Descargar certificado (PDF)" de la página
 *    de verificación, y la que abre quien escanea el QR. No lleva DNI impreso. Anónima a
 *    propósito: verificar un certificado no puede exigir tener cuenta.
 *
 *  - `imprimir` — REQUIERE SESIÓN (admin o el dueño del certificado). Es el PDF pensado para
 *    imprimirse sobre el papel membretado del instituto y SÍ lleva el DNI impreso. Antes se
 *    servía por la misma URL pública con solo añadir `?tipo=imprimir`: cualquiera con el código
 *    podía sacar el DNI del titular, justo el dato que la página de verificación oculta a
 *    propósito. El DNI es dato personal (Ley 29733) y el UUID no adivinable no es una base legal.
 *
 * El PDF se arma acá con los datos de la base, así que no depende de ningún archivo subido y no
 * se puede falsificar desde el cliente. Google Drive queda solo como respaldo.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(codigo)) {
    return NextResponse.json({ error: 'Código de verificación inválido.' }, { status: 400 });
  }

  const tipoParam = req.nextUrl.searchParams.get('tipo');
  const tipo = tipoParam === 'imprimir' ? 'imprimir' : 'digital';

  let cert;
  try {
    cert = await obtenerDatosCertificado(codigo);
  } catch (e) {
    console.error('Error al leer el certificado para el PDF:', e);
    return NextResponse.json({ error: 'No se pudo generar el certificado.' }, { status: 500 });
  }
  if (!cert) {
    return NextResponse.json({ error: 'Este código no corresponde a ningún certificado emitido.' }, { status: 404 });
  }

  // Un certificado anulado no produce PDF. Servirlo sería entregar un documento con toda la
  // pinta de válido de algo que ya no lo es; la página de verificación sí lo muestra, pero
  // diciendo explícitamente que está anulado.
  if (cert.estado === 'anulado') {
    return NextResponse.json(
      {
        error: 'Este certificado fue anulado y ya no se puede descargar.',
        anulado_en: cert.anuladoEn,
        motivo: cert.motivoAnulacion,
      },
      { status: 410 }
    );
  }

  if (tipo === 'imprimir') {
    const permitido = await puedeVerVersionImprimir(req, cert.alumnoUid);
    if (!permitido) {
      return NextResponse.json(
        { error: 'La versión para imprimir solo está disponible para el titular del certificado o para un administrador.' },
        { status: 401 }
      );
    }
  }

  try {
    const { buffer, nombreArchivo } = await generarPdfCertificado(cert, tipo, req.nextUrl.origin);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nombreArchivo}"`,
        // La versión con sesión no se cachea en proxies compartidos: lleva el DNI y depende
        // de quién la pide. La pública sí, revalidable por si se reasigna el diseño del curso.
        'Cache-Control': tipo === 'imprimir' ? 'private, no-store' : 'public, max-age=300, must-revalidate',
      },
    });
  } catch (e) {
    console.error('Error al generar el PDF del certificado:', e);
    return NextResponse.json({ error: 'No se pudo generar el certificado.' }, { status: 500 });
  }
}

/**
 * ¿Quien pide puede ver la versión con DNI? Solo el admin o el propio titular.
 *
 * El token va en la cabecera `Authorization` porque la sesión de Supabase vive en
 * localStorage, no en cookies: el servidor no puede deducirla del request por su cuenta.
 * Por eso las pantallas del panel piden este PDF con `fetch` y no con `window.open`
 * (ver `abrirPdfCertificado` en lib/certificado.ts).
 */
async function puedeVerVersionImprimir(req: NextRequest, alumnoUid: string | null): Promise<boolean> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return false;

  const cliente = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await cliente.auth.getUser(token);
  if (error || !data?.user) return false;
  if (alumnoUid && data.user.id === alumnoUid) return true;

  const { data: esAdmin } = await cliente.rpc('es_admin');
  return esAdmin === true;
}
