export default function HeroInicio() {
  return (
    <section className="ipd-seccion pt-14 pb-16 md:pt-20 md:pb-24 overflow-hidden">
      <div className="ipd-dots" />
      <div className="ipd-blobs">
        <div className="ipd-blob ipd-blob--celeste" style={{ width: 460, height: 460, top: -160, right: -120 }} />
        <div className="ipd-blob ipd-blob--navy" style={{ width: 360, height: 360, bottom: -140, left: -100 }} />
      </div>

      <div className="ipd-contenedor [display:grid] lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
        <div>
          <span className="ipd-pill-glass">
            <span className="material-symbols-outlined">workspace_premium</span>
            Certificación oficial verificable
          </span>

          <h1 className="ipd-hero-titulo mt-5">
            Capacítate con programas que certifican tu{' '}
            <span className="ipd-texto-degradado">experiencia profesional</span>.
          </h1>

          <p className="mt-5 text-[1.05rem] leading-relaxed" style={{ color: 'var(--gris)', maxWidth: '34rem' }}>
            Diplomados y cursos especializados 100&nbsp;% virtuales, pensados para profesionales
            que buscan resultados aplicables desde la primera semana.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a href="/cursos" className="ipd-btn ipd-btn-primario">
              Ver cursos
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                arrow_forward
              </span>
            </a>
            <a href="/nosotros" className="ipd-btn ipd-btn-claro">
              Conócenos
            </a>
          </div>

          <div className="mt-6 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--st-secundario)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              check_circle
            </span>
            Acceso inmediato después de matricularte
          </div>
        </div>

        <div className="relative hidden lg:block">
          <div
            className="ipd-card-glass relative mx-auto"
            style={{
              maxWidth: 380,
              padding: '1.8rem',
              background: 'linear-gradient(160deg, rgba(255,255,255,.9), rgba(255,255,255,.72))',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 30px 60px -20px rgba(10,28,56,.35)',
              border: '1px solid rgba(255,255,255,.9)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[.72rem] font-bold tracking-[.08em] uppercase" style={{ color: 'var(--st-secundario)' }}>
                Certificado oficial
              </span>
              <span className="material-symbols-outlined" style={{ color: 'var(--st-premium-gold)', fontSize: 22 }}>
                verified
              </span>
            </div>

            <div className="mt-5 h-2.5 rounded-full w-4/5" style={{ background: 'var(--st-superficie-borde)' }} />
            <div className="mt-2.5 h-2.5 rounded-full w-3/5" style={{ background: 'var(--st-superficie-borde)' }} />

            <div className="mt-6 flex items-end justify-between">
              <div>
                <p className="text-[.7rem] font-semibold" style={{ color: 'var(--gris)' }}>
                  Código de verificación
                </p>
                <p className="text-[.92rem] font-bold" style={{ color: 'var(--st-texto-navy)', fontFamily: 'var(--st-font-titulo)' }}>
                  IPADECP-2026-XXXXX
                </p>
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: 54, color: 'var(--st-texto-navy)' }}>
                qr_code_2
              </span>
            </div>
          </div>

          <div
            className="ipd-pill-glass absolute -left-6 bottom-8"
            style={{ background: '#fff' }}
          >
            <span className="material-symbols-outlined" style={{ color: 'var(--st-ok)' }}>
              task_alt
            </span>
            Verificable en segundos
          </div>
        </div>
      </div>
    </section>
  );
}
