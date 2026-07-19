// Número de WhatsApp al que los alumnos envían su comprobante de pago
// (checkout y pantalla de post-venta). Cambiar aquí si el instituto cambia
// de número — no hay que tocar los componentes que lo usan.
export const WHATSAPP_PEDIDOS = '51992951855';

export function whatsappLink(numero: string, mensaje?: string) {
  const base = `https://wa.me/${numero}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}
