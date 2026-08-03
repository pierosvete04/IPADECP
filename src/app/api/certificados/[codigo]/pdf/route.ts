import { NextRequest, NextResponse } from 'next/server';
import { obtenerDatosCertificado, generarPdfCertificado } from '@/lib/server/certificadoPdf';

export const runtime = 'nodejs';

/**
 * Sirve el PDF de un certificado a partir de su código de verificación.
 *
 * Es la URL que se le entrega al alumno: el PDF se arma aquí con los datos de la base de datos,
 * así que no depende de ningún archivo subido y no se puede falsificar desde el cliente.
 * Google Drive queda solo como respaldo.
 *
 * Pública a propósito: la página de verificación /certificado/[codigo] es anónima y cualquiera
 * con el código puede comprobar el certificado — el mismo criterio que ya regía antes. El código
 * es un UUID, así que no es adivinable.
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

  try {
    const { buffer, nombreArchivo } = await generarPdfCertificado(cert, tipo, req.nextUrl.origin);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nombreArchivo}"`,
        // El certificado no cambia una vez emitido, pero se deja revalidable por si se
        // reasigna el diseño del curso desde el panel de Diseño.
        'Cache-Control': 'public, max-age=300, must-revalidate',
      },
    });
  } catch (e) {
    console.error('Error al generar el PDF del certificado:', e);
    return NextResponse.json({ error: 'No se pudo generar el certificado.' }, { status: 500 });
  }
}
