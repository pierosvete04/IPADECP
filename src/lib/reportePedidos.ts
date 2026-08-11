/**
 * Listado de pedidos en PDF, para imprimir o mandar al courier.
 *
 * Se dibuja a mano con jsPDF en vez de traer una librería de tablas
 * (jspdf-autotable): la tabla tiene cinco columnas fijas y una sola forma, y
 * no compensa sumar otra dependencia al bundle del panel por eso.
 */
import { jsPDF } from 'jspdf';
import { codigoPedido, type PedidoRow } from '@/lib/pedidos';

/** Ancho útil de una A4 vertical con márgenes de 12mm. */
const MARGEN = 12;
const ANCHO_PAGINA = 210;
const ALTO_PAGINA = 297;
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN * 2;

// Las columnas suman ANCHO_UTIL (186mm). La dirección se lleva la mayor parte
// porque es el único campo que de verdad varía de largo — el resto son datos
// cortos y de ancho previsible.
const COLUMNAS: { clave: 'codigo' | 'cliente' | 'telefono' | 'direccion' | 'total'; titulo: string; ancho: number; derecha?: boolean }[] = [
  { clave: 'codigo', titulo: 'Pedido', ancho: 20 },
  { clave: 'cliente', titulo: 'Cliente', ancho: 46 },
  { clave: 'telefono', titulo: 'Teléfono', ancho: 24 },
  { clave: 'direccion', titulo: 'Dirección', ancho: 74 },
  { clave: 'total', titulo: 'Total', ancho: 22, derecha: true },
];

/** Arma la dirección de envío en una sola línea legible, saltando lo vacío. */
export function direccionDePedido(pedido: PedidoRow): string {
  const d = pedido.direccion_envio;
  if (!d) return '—';
  const partes = [d.direccion, d.direccionSecundaria, d.distrito, d.provincia, d.departamento].map((p) => (p || '').trim()).filter(Boolean);
  return partes.length ? partes.join(', ') : '—';
}

function soles(n: number | null): string {
  return `S/ ${(Number(n) || 0).toFixed(2)}`;
}

/**
 * Genera el PDF y dispara la descarga. `fechaGeneracion` se pasa desde el
 * componente en vez de calcularse acá para que la función sea determinista y
 * se pueda probar sin depender del reloj.
 */
export function descargarListadoPedidosPdf(pedidos: PedidoRow[], fechaGeneracion: Date): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let y = MARGEN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Listado de pedidos', MARGEN, y + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    `${pedidos.length} pedido(s) · generado el ${fechaGeneracion.toLocaleString('es-PE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`,
    MARGEN,
    y + 10
  );
  doc.setTextColor(0);
  y += 18;

  function dibujarCabecera() {
    doc.setFillColor(238, 241, 244);
    doc.rect(MARGEN, y, ANCHO_UTIL, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    let x = MARGEN;
    for (const col of COLUMNAS) {
      // El +1.5 evita que el texto quede pegado al filo de la celda.
      doc.text(col.titulo, col.derecha ? x + col.ancho - 1.5 : x + 1.5, y + 4.8, { align: col.derecha ? 'right' : 'left' });
      x += col.ancho;
    }
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
  }

  dibujarCabecera();

  let total = 0;

  for (const pedido of pedidos) {
    const celdas: Record<string, string> = {
      codigo: codigoPedido(pedido),
      cliente: pedido.cliente_nombre || pedido.cliente_email || 'Sin nombre',
      telefono: pedido.cliente_telefono || '—',
      direccion: direccionDePedido(pedido),
      total: soles(pedido.total),
    };
    total += Number(pedido.total) || 0;

    // La altura de la fila la manda la celda que más líneas necesite: si la
    // dirección ocupa tres renglones, la fila entera mide tres renglones. Sin
    // esto el texto de una celda larga se montaría sobre la fila siguiente.
    const lineasPorColumna = COLUMNAS.map((col) => doc.splitTextToSize(celdas[col.clave], col.ancho - 3) as string[]);
    const lineas = Math.max(...lineasPorColumna.map((l) => l.length));
    const alto = lineas * 4 + 3;

    // Salto de página antes de dibujar, nunca a mitad de una fila.
    if (y + alto > ALTO_PAGINA - MARGEN - 12) {
      doc.addPage();
      y = MARGEN;
      dibujarCabecera();
    }

    let x = MARGEN;
    COLUMNAS.forEach((col, i) => {
      doc.text(lineasPorColumna[i], col.derecha ? x + col.ancho - 1.5 : x + 1.5, y + 4, { align: col.derecha ? 'right' : 'left' });
      x += col.ancho;
    });

    y += alto;
    doc.setDrawColor(225);
    doc.line(MARGEN, y, MARGEN + ANCHO_UTIL, y);
  }

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Total', MARGEN + ANCHO_UTIL - 40, y, { align: 'right' });
  doc.text(soles(total), MARGEN + ANCHO_UTIL, y, { align: 'right' });

  const marca = fechaGeneracion.toISOString().slice(0, 10);
  doc.save(`pedidos-${marca}.pdf`);
}
