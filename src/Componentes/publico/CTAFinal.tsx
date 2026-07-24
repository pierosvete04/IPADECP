import { WHATSAPP_PEDIDOS, whatsappLink } from '@/lib/site-config';

export default function CTAFinal() {
  return (
    <section className="ipd-seccion ipd-seccion-navy text-center">
      <div className="ipd-blobs">
        <div className="ipd-blob ipd-blob--celeste" style={{ width: 380, height: 380, top: -100, left: '30%' }} />
      </div>
      <div className="ipd-contenedor">
        <div className="max-w-2xl mx-auto">
          <h2 className="ipd-titulo-seccion claro">¿Listo para dar el siguiente paso?</h2>
          <p className="ipd-subtitulo-seccion claro mx-auto">
            Crea tu cuenta gratis y explora el catálogo completo de cursos, o conversa primero con
            un asesor si tienes dudas.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a href="/registro" className="ipd-btn ipd-btn-claro">
              Crear cuenta gratis
            </a>
            <a
              href={whatsappLink(WHATSAPP_PEDIDOS, 'Hola, quisiera más información sobre los cursos de IPADECP.')}
              target="_blank"
              rel="noopener noreferrer"
              className="ipd-btn ipd-btn-fantasma"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                chat
              </span>
              Hablar con un asesor
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
