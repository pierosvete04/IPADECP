'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface LinkQrCodeProps {
  link: string;
  size?: number;
  className?: string;
}

// QR genérico para cualquier link (WhatsApp, etc.) — se regenera si `link`
// cambia (el mensaje predeterminado incluye datos del pedido). errorCorrectionLevel
// "H" (máximo) + margen amplio para que se pueda escanear de forma confiable
// con la cámara del celular.
export function LinkQrCode({ link, size = 150, className = '' }: LinkQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    QRCode.toDataURL(link, { width: size * 3, margin: 4, errorCorrectionLevel: 'H' })
      .then((url) => !cancelado && setDataUrl(url))
      .catch(() => !cancelado && setDataUrl(null));
    return () => {
      cancelado = true;
    };
  }, [link, size]);

  if (!dataUrl) {
    return <div className={className} style={{ width: size, height: size, borderRadius: 10, background: 'var(--primario-claro)' }} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt="Código QR para abrir WhatsApp"
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: 10, border: '1px solid var(--borde)' }}
    />
  );
}
