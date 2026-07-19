'use client';

import { useEffect } from 'react';

// Varias reglas de estilos.css/tema-stitch.css están ancladas a clases del
// <body> (body.aula-shell, body.admin-shell, body.auth-card...). Como el
// <body> vive en el layout raíz, cada página aplica la suya en montaje.
export default function BodyClass({ className }: { className: string }) {
  useEffect(() => {
    const clases = className.split(' ').filter(Boolean);
    document.body.classList.add(...clases);
    return () => {
      document.body.classList.remove(...clases);
    };
  }, [className]);
  return null;
}
