import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Nosotros — IPADECP',
  description: 'Conoce IPADECP, instituto de capacitación virtual para el personal de salud del Perú, con certificación oficial verificable.',
};

const MISION_VISION = [
  {
    icon: 'flag',
    titulo: 'Misión',
    texto: 'Capacitar al personal de salud del Perú con programas virtuales de calidad, accesibles desde cualquier parte del país, que fortalezcan su desempeño profesional y la atención que brindan a sus pacientes.',
  },
  {
    icon: 'visibility',
    titulo: 'Visión',
    texto: 'Ser el instituto de referencia en capacitación virtual para el personal de salud del Perú, reconocido por la calidad de sus programas y la confiabilidad de sus certificaciones.',
  },
];

const DIFERENCIALES = [
  { icon: 'devices', titulo: 'Modalidad 100% virtual', texto: 'Estudia desde cualquier dispositivo, sin depender de un horario fijo.' },
  { icon: 'insights', titulo: 'Seguimiento de tu avance', texto: 'Progreso, puntos y racha para que veas tu propio crecimiento en el camino.' },
  { icon: 'qr_code_2', titulo: 'Certificado verificable', texto: 'Cada certificado tiene un código QR único, consultable públicamente.' },
  { icon: 'support_agent', titulo: 'Soporte directo', texto: 'Resolvemos tus dudas por WhatsApp, sin pasar por sistemas de tickets.' },
];

export default function NosotrosPage() {
  return (
    <>
      <section className="px-6 pt-14 pb-10 text-center">
        <div className="max-w-2xl mx-auto">
          <span className="ipd-eyebrow" style={{ justifyContent: 'center' }}>
            <span className="material-symbols-outlined">school</span>
            Nosotros
          </span>
          <h1 className="ipd-titulo-seccion">Quiénes somos</h1>
          <p className="ipd-subtitulo-seccion mx-auto">
            Instituto de capacitación virtual para el personal de salud del Perú, con certificación
            oficial verificable.
          </p>
        </div>
      </section>

      <section className="px-6 pb-14">
        <div className="max-w-3xl mx-auto">
          <div className="ipd-card p-8">
            <h2 className="font-bold text-[1.15rem] mb-3" style={{ color: 'var(--st-texto-navy)', fontFamily: 'var(--st-font-titulo)' }}>
              Nuestra historia
            </h2>
            <p className="leading-relaxed" style={{ color: 'var(--st-texto-tenue)' }}>
              Desde el año 2015, el <strong>Instituto Peruano Americano de Desarrollo y Capacitación
              Profesional (IPADECP)</strong> capacita al personal de salud del Perú con programas de
              especialización 100&nbsp;% virtuales. Nacimos para acercar formación de calidad a
              profesionales de la salud en todo el país, sin que la distancia o los horarios de
              trabajo sean un obstáculo para seguir creciendo.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 pb-16">
        <div className="ipd-contenedor">
          <div className="[display:grid] md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {MISION_VISION.map((v) => (
              <div key={v.titulo} className="ipd-card p-6">
                <span
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'var(--st-secundario-cont)', color: 'var(--st-on-secundario-cont)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                    {v.icon}
                  </span>
                </span>
                <h3 className="font-bold text-[1.02rem] mb-1.5" style={{ color: 'var(--st-texto-navy)', fontFamily: 'var(--st-font-titulo)' }}>
                  {v.titulo}
                </h3>
                <p className="text-[.88rem] leading-relaxed" style={{ color: 'var(--gris)' }}>
                  {v.texto}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ipd-seccion">
        <div className="ipd-contenedor">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="ipd-eyebrow" style={{ justifyContent: 'center' }}>
              <span className="material-symbols-outlined">verified</span>
              Por qué IPADECP
            </span>
            <h2 className="ipd-titulo-seccion">Diferenciales reales, no promesas vacías</h2>
          </div>
          <div className="[display:grid] sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {DIFERENCIALES.map((d) => (
              <div key={d.titulo} className="text-center">
                <span
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'var(--st-secundario-cont)', color: 'var(--st-on-secundario-cont)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 26 }}>
                    {d.icon}
                  </span>
                </span>
                <h3 className="font-bold text-[.95rem] mb-1.5" style={{ color: 'var(--st-texto-navy)', fontFamily: 'var(--st-font-titulo)' }}>
                  {d.titulo}
                </h3>
                <p className="text-[.82rem] leading-relaxed" style={{ color: 'var(--gris)' }}>
                  {d.texto}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ipd-seccion ipd-seccion-navy text-center">
        <div className="ipd-blobs">
          <div className="ipd-blob ipd-blob--celeste" style={{ width: 360, height: 360, top: -100, left: '30%' }} />
        </div>
        <div className="ipd-contenedor">
          <div className="max-w-xl mx-auto">
            <h2 className="ipd-titulo-seccion claro">Empieza tu certificación hoy</h2>
            <Link href="/cursos" className="ipd-btn ipd-btn-claro mt-4">
              Ver cursos
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
