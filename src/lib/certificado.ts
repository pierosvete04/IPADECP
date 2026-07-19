import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase/client';

const AZUL_IPADECP: [number, number, number] = [16, 40, 77];

export interface CertificadoData {
  codigo: string;
  alumnoNombre: string;
  cursoNombre: string;
  fecha: string;
  cargo?: string;
  periodoInicio?: string;
  periodoEntrega?: string;
  periodoCierre?: string;
}

export interface CertificadoPublico {
  alumno_nombre: string;
  curso_nombre: string;
  fecha: string;
  nota: number | null;
  estado: string;
  codigo: string;
  cargo?: string | null;
  modalidad?: string;
  periodo_inicio?: string | null;
  periodo_entrega?: string | null;
  periodo_cierre?: string | null;
}

export async function obtenerCertificadoPublico(codigo: string): Promise<CertificadoPublico | null> {
  const { data, error } = await supabase.rpc('obtener_certificado_publico', { p_codigo: codigo });
  if (error || !data) return null;
  return data as CertificadoPublico;
}

export async function generarCertificadoPDF(data: CertificadoData): Promise<void> {
  const url = `${window.location.origin}/certificado/${data.codigo}`;
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240 });

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
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

  doc.save(`certificado-${data.codigo.slice(0, 8)}.pdf`);
}

export interface CertificadoImprimirData {
  codigo: string;
  alumnoNombre: string;
  cursoNombre: string;
  fecha: string;
  cargo?: string;
  dni?: string;
  periodoInicio?: string;
  periodoEntrega?: string;
  periodoCierre?: string;
}

// Posiciones (mm) del PDF "para imprimir": sin bordes, sin fondo, solo los datos + QR,
// pensado para imprimirse sobre el papel membretado físico que ya tiene el instituto.
// Si al imprimirlo de prueba contra el membretado algo no calza, ajustar estos valores.
// (Estas posiciones fijas serán reemplazables por un editor visual admin — ver plan.)
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

export async function generarCertificadoImprimirPDF(data: CertificadoImprimirData): Promise<void> {
  const url = `${window.location.origin}/certificado/${data.codigo}`;
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240 });

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
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

  doc.save(`certificado-imprimir-${data.codigo.slice(0, 8)}.pdf`);
}
