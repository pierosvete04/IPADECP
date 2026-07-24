'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { WHATSAPP_PEDIDOS, whatsappLink } from '@/lib/site-config';

interface CursoOpcion {
  id: number;
  nombre: string;
}

const FAQ = [
  {
    p: '¿Qué métodos de pago aceptan?',
    r: 'Tarjeta de crédito/débito, transferencia bancaria y Yape, según lo que tenga habilitado cada curso.',
  },
  {
    p: '¿Cómo recibo mi certificado?',
    r: 'Se descarga en PDF desde tu aula virtual apenas completas el curso, con un código QR de verificación.',
  },
  {
    p: '¿Las clases son en vivo o grabadas?',
    r: 'Depende del curso: los cursos estándar son 100% grabados y a tu ritmo; los cursos Premium incluyen además clases en vivo.',
  },
  {
    p: '¿El certificado es verificable?',
    r: 'Sí. Cada certificado tiene un código único que cualquier persona puede consultar públicamente, sin necesidad de crear una cuenta.',
  },
  {
    p: '¿Puedo pagar con Yape?',
    r: 'Sí, junto con transferencia bancaria y tarjeta, según el método que tenga habilitado el curso que te interesa.',
  },
];

export default function ContactoClient() {
  const [cursos, setCursos] = useState<CursoOpcion[]>([]);
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cursoInteres, setCursoInteres] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    supabase
      .from('cursos')
      .select('id,nombre')
      .eq('estado', '1')
      .eq('mostrar_en_catalogo', true)
      .order('nombre')
      .then(({ data }) => setCursos((data as CursoOpcion[]) || []));
  }, []);

  const formularioValido = nombre.trim().length > 0 && mensaje.trim().length > 0 && (correo.trim() || telefono.trim());

  function enviarPorWhatsApp(e: React.FormEvent) {
    e.preventDefault();
    if (!formularioValido) return;
    const partes = [
      `Hola, soy ${nombre.trim()}.`,
      correo.trim() ? `Correo: ${correo.trim()}` : null,
      telefono.trim() ? `Teléfono: ${telefono.trim()}` : null,
      cursoInteres ? `Curso de interés: ${cursoInteres}` : null,
      `Mensaje: ${mensaje.trim()}`,
    ].filter(Boolean);
    window.open(whatsappLink(WHATSAPP_PEDIDOS, partes.join('\n')), '_blank', 'noopener,noreferrer');
  }

  return (
    <>
      <section className="px-6 pt-14 pb-10 text-center">
        <div className="max-w-2xl mx-auto">
          <span className="ipd-eyebrow" style={{ justifyContent: 'center' }}>
            <span className="material-symbols-outlined">forum</span>
            Contáctanos
          </span>
          <h1 className="ipd-titulo-seccion">Escríbenos y te respondemos a la brevedad</h1>
        </div>
      </section>

      <section className="px-6 pb-16">
        <div className="ipd-contenedor [display:grid] lg:grid-cols-[1fr_380px] gap-8 items-start">
          <form onSubmit={enviarPorWhatsApp} className="ipd-card p-6 md:p-8 flex flex-col gap-4">
            <div>
              <label className="text-sm font-semibold block mb-1.5" style={{ color: 'var(--st-texto-navy)' }}>
                Nombre completo
              </label>
              <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required placeholder="Tu nombre" />
            </div>

            <div className="[display:grid] sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold block mb-1.5" style={{ color: 'var(--st-texto-navy)' }}>
                  Correo electrónico
                </label>
                <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="tucorreo@ejemplo.com" />
              </div>
              <div>
                <label className="text-sm font-semibold block mb-1.5" style={{ color: 'var(--st-texto-navy)' }}>
                  Teléfono
                </label>
                <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+51 9XX XXX XXX" />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold block mb-1.5" style={{ color: 'var(--st-texto-navy)' }}>
                Curso de interés (opcional)
              </label>
              <select value={cursoInteres} onChange={(e) => setCursoInteres(e.target.value)}>
                <option value="">Selecciona un curso</option>
                {cursos.map((c) => (
                  <option key={c.id} value={c.nombre}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold block mb-1.5" style={{ color: 'var(--st-texto-navy)' }}>
                Mensaje
              </label>
              <textarea
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                required
                rows={4}
                placeholder="Cuéntanos en qué te podemos ayudar"
              />
            </div>

            <button type="submit" disabled={!formularioValido} className="ipd-btn ipd-btn-primario mt-2">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                chat
              </span>
              Enviar por WhatsApp
            </button>
            <p className="text-xs" style={{ color: 'var(--gris)' }}>
              Al enviar, se abre WhatsApp con tu mensaje ya redactado — solo debes confirmarlo.
            </p>
          </form>

          <div
            className="ipd-card p-6 md:p-8"
            style={{ background: 'linear-gradient(160deg, var(--st-fondo-navy), var(--st-navy-osc))', color: '#fff', border: 'none' }}
          >
            <h2 className="font-bold text-[1.05rem] mb-5" style={{ fontFamily: 'var(--st-font-titulo)' }}>
              Contacto directo
            </h2>
            <div className="flex flex-col gap-4">
              <a
                href={whatsappLink(WHATSAPP_PEDIDOS, 'Hola, quisiera más información sobre los cursos de IPADECP.')}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3"
              >
                <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,.14)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    chat
                  </span>
                </span>
                <span className="text-sm font-semibold">+51 992 951 855</span>
              </a>
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,.14)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    mail
                  </span>
                </span>
                <span className="text-sm" style={{ color: 'rgba(255,255,255,.85)' }}>
                  contacto@ipadecp.com <em style={{ color: 'rgba(255,255,255,.55)' }}>(dato de ejemplo)</em>
                </span>
              </div>
              <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,.6)' }}>
                Te respondemos apenas veamos tu mensaje — la vía más rápida es WhatsApp.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-16">
        <div className="ipd-contenedor">
          <div className="max-w-2xl mx-auto">
            <h2
              className="font-extrabold mb-1"
              style={{ fontFamily: 'var(--st-font-titulo)', fontSize: '1.5rem', color: 'var(--st-texto-navy)', letterSpacing: '-.01em' }}
            >
              Preguntas frecuentes
            </h2>
            <div className="flex flex-col gap-3 mt-4">
              {FAQ.map((item) => (
                <details key={item.p} className="ipd-card px-5 py-4 group">
                  <summary className="font-semibold cursor-pointer flex items-center justify-between gap-3" style={{ color: 'var(--st-texto-navy)' }}>
                    {item.p}
                    <span className="material-symbols-outlined shrink-0 transition-transform group-open:rotate-180" style={{ color: 'var(--gris)' }}>
                      expand_more
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--gris)' }}>
                    {item.r}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
