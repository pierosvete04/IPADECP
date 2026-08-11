import type { Metadata } from 'next';
import Script from 'next/script';
import '@/styles/globals.css';
import '@/styles/estilos.css';
import '@/styles/tema-stitch.css';
import '@/styles/publico.css';
// Último: estandariza campos y contenedores del panel admin y debe poder
// pisar lo que traigan estilos.css / tema-stitch.css.
import '@/styles/admin-ui.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { SITIO_PUBLICO } from '@/lib/site-config';

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

// Únicos lugares del sitio donde viven estos IDs: si el instituto cambia de
// propiedad de GA4 o de contenedor de GTM, esto es lo único que hay que
// tocar — todas las páginas los heredan del layout raíz.
const GA4_MEASUREMENT_ID = 'G-GRZR25462E';
const GTM_CONTAINER_ID = 'GTM-KJ3BBTTQ';

export const metadata: Metadata = {
  metadataBase: new URL(`https://${SITIO_PUBLICO}`),
  title: 'IPADECP | Cursos para tu desarrollo personal en salud',
  description: 'Aula virtual IPADECP',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={cn("font-sans", geist.variable)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600;700;800&family=Inter:wght@400;500;600&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />

        {/* Google Tag Manager — Google pide este script "lo más arriba posible
            en <head>". `beforeInteractive` es la única estrategia de
            next/script que Next.js garantiza que inyecta dentro de <head> del
            HTML servido, antes de que corra cualquier otro código de la
            página (ver node_modules/next/dist/docs/.../script.md). */}
        <Script id="gtm-init" strategy="beforeInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_CONTAINER_ID}');`}
        </Script>

        {/* Google Analytics (GA4). Next.js recomienda `afterInteractive` para
            analítica y gestores de tags: carga apenas después de la
            hidratación, sin bloquearla. */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA4_MEASUREMENT_ID}');`}
        </Script>
      </head>
      <body>
        {/* Google Tag Manager (noscript) — tiene que ser lo primero dentro de
            <body>, tal cual lo pide Google, para que quede rastro incluso con
            JavaScript deshabilitado. */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_CONTAINER_ID}`}
            height={0}
            width={0}
            style={{ display: 'none', visibility: 'hidden' }}
            title="Google Tag Manager"
          />
        </noscript>
        {children}
      </body>
    </html>
  );
}
