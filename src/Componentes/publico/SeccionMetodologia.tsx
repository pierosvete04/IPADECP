function MockModulos() {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ background: 'var(--st-fondo-suave)' }}>
          <span
            className="material-symbols-outlined shrink-0"
            style={{ fontSize: 18, color: n === 1 ? '#fff' : 'var(--st-secundario)', background: n === 1 ? 'var(--st-secundario)' : 'var(--st-secundario-cont)', borderRadius: 999, padding: 4 }}
          >
            {n === 1 ? 'play_arrow' : 'lock'}
          </span>
          <div className="h-2 rounded-full flex-1" style={{ background: 'var(--st-superficie-borde)', maxWidth: `${70 - n * 8}%` }} />
        </div>
      ))}
    </div>
  );
}

function MockEvaluacion() {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--st-fondo-suave)' }}>
      <div className="h-2 rounded-full w-4/5 mb-3" style={{ background: 'var(--st-superficie-borde)' }} />
      <div className="flex flex-col gap-2">
        {['a', 'b', 'c'].map((k, i) => (
          <div key={k} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: i === 1 ? 'var(--st-secundario-cont)' : '#fff', border: '1px solid var(--st-superficie-borde)' }}>
            <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ border: `2px solid ${i === 1 ? 'var(--st-secundario)' : 'var(--st-superficie-borde)'}`, background: i === 1 ? 'var(--st-secundario)' : 'transparent' }} />
            <div className="h-1.5 rounded-full flex-1" style={{ background: 'var(--st-superficie-borde)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MockGamificacion() {
  return (
    <div className="flex gap-2">
      <div className="flex-1 rounded-xl p-3 text-center" style={{ background: '#fff1e0' }}>
        <p className="text-lg font-extrabold" style={{ color: '#b8590b', fontFamily: 'var(--st-font-titulo)' }}>7</p>
        <p className="text-[.65rem] font-semibold" style={{ color: '#b8590b' }}>días de racha</p>
      </div>
      <div className="flex-1 rounded-xl p-3 text-center" style={{ background: '#eaf6e9' }}>
        <p className="text-lg font-extrabold" style={{ color: '#1f7a3d', fontFamily: 'var(--st-font-titulo)' }}>320</p>
        <p className="text-[.65rem] font-semibold" style={{ color: '#1f7a3d' }}>puntos</p>
      </div>
      <div className="flex-1 rounded-xl p-3 text-center" style={{ background: 'var(--st-secundario-cont)' }}>
        <p className="text-lg font-extrabold" style={{ color: 'var(--st-on-secundario-cont)', fontFamily: 'var(--st-font-titulo)' }}>#4</p>
        <p className="text-[.65rem] font-semibold" style={{ color: 'var(--st-on-secundario-cont)' }}>en el ranking</p>
      </div>
    </div>
  );
}

const TARJETAS = [
  {
    icon: 'smart_display',
    titulo: 'Clases virtuales a tu ritmo',
    texto: 'Videos grabados y material descargable disponibles en todo momento, desde cualquier dispositivo.',
    mock: <MockModulos />,
  },
  {
    icon: 'fact_check',
    titulo: 'Evaluaciones con retroalimentación',
    texto: 'Tareas y exámenes que miden tu avance real, con resultados y comentarios inmediatos.',
    mock: <MockEvaluacion />,
  },
  {
    icon: 'military_tech',
    titulo: 'Gamificación y progreso',
    texto: 'Puntos, rachas y ranking para que veas tu propio avance y te mantengas motivado.',
    mock: <MockGamificacion />,
  },
];

export default function SeccionMetodologia() {
  return (
    <section className="ipd-seccion">
      <div className="ipd-contenedor">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="ipd-eyebrow justify-center">
            <span className="material-symbols-outlined">route</span>
            Metodología
          </span>
          <h2 className="ipd-titulo-seccion">Alcanza tus metas con un método claro</h2>
          <p className="ipd-subtitulo-seccion mx-auto">
            Todo lo que necesitas para avanzar y demostrar lo aprendido, en un solo lugar.
          </p>
        </div>

        <div className="[display:grid] md:grid-cols-3 gap-6">
          {TARJETAS.map((t) => (
            <div key={t.titulo} className="ipd-card p-6 flex flex-col gap-4">
              <span
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--st-secundario-cont)', color: 'var(--st-on-secundario-cont)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                  {t.icon}
                </span>
              </span>
              <div>
                <h3 className="font-bold text-[1.02rem] mb-1.5" style={{ color: 'var(--st-texto-navy)', fontFamily: 'var(--st-font-titulo)' }}>
                  {t.titulo}
                </h3>
                <p className="text-[.88rem] leading-relaxed" style={{ color: 'var(--gris)' }}>
                  {t.texto}
                </p>
              </div>
              {t.mock}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
