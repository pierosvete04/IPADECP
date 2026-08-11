import type { MetadataRoute } from 'next';
import { SITIO_PUBLICO } from '@/lib/site-config';

// Genera /robots.txt en build/deploy. Deja indexable todo lo que es
// contenido público de marketing (inicio, catálogo, fichas de curso,
// nosotros, contacto, legales) y bloquea todo lo que es panel privado,
// flujo transaccional o rutas técnicas — nada de eso aporta a SEO y
// exponerlo en resultados de búsqueda solo confunde al usuario.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/admin/',
        '/aula',
        '/aula/',
        '/api/',
        '/login',
        '/registro',
        '/recuperar',
        '/activar',
        '/carrito',
        '/checkout',
        '/checkout/',
      ],
    },
    sitemap: `https://${SITIO_PUBLICO}/sitemap.xml`,
    host: `https://${SITIO_PUBLICO}`,
  };
}
