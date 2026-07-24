export default function SeccionCertificacion() {
  return (
    <section className="ipd-seccion ipd-seccion-navy">
      <div className="ipd-blobs">
        <div className="ipd-blob ipd-blob--celeste" style={{ width: 420, height: 420, top: -120, left: -140 }} />
        <div className="ipd-blob ipd-blob--oro" style={{ width: 300, height: 300, bottom: -140, right: -80, opacity: 0.28 }} />
      </div>

      <div className="ipd-contenedor [display:grid] lg:grid-cols-2 gap-14 items-center">
        <div>
          <span className="ipd-pill-glass ipd-pill-glass--oscuro">
            <span className="material-symbols-outlined">verified</span>
            Respaldo académico
          </span>
          <h2 className="ipd-titulo-seccion claro">Certificación oficial, verificable al instante</h2>
          <p className="ipd-subtitulo-seccion claro">
            Cada certificado de IPADECP incluye un código QR único: cualquier persona puede
            validar su autenticidad desde nuestra página pública de verificación, sin necesidad
            de iniciar sesión.
          </p>

          <ul className="mt-6 flex flex-col gap-3">
            {[
              'Código de verificación único por certificado',
              'Consulta pública, sin registro ni contraseña',
              'Disponible para descarga en PDF desde tu aula',
            ].map((texto) => (
              <li key={texto} className="flex items-start gap-3 text-sm" style={{ color: 'rgba(255,255,255,.85)' }}>
                <span className="material-symbols-outlined shrink-0" style={{ color: 'var(--st-celeste)', fontSize: 20 }}>
                  check_circle
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <div
          className="ipd-card-glass mx-auto w-full"
          style={{ maxWidth: 400, padding: '2rem' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[.7rem] font-bold tracking-[.08em] uppercase" style={{ color: 'var(--st-celeste)' }}>
              IPADECP · Certificado
            </span>
            <span className="material-symbols-outlined" style={{ color: 'var(--st-premium-gold)' }}>
              workspace_premium
            </span>
          </div>
          <div className="mt-6 h-3 rounded-full w-4/5" style={{ background: 'rgba(255,255,255,.18)' }} />
          <div className="mt-2.5 h-3 rounded-full w-3/5" style={{ background: 'rgba(255,255,255,.18)' }} />
          <div className="mt-8 flex items-center justify-center py-6 rounded-2xl" style={{ background: 'rgba(255,255,255,.08)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 88, color: '#fff' }}>
              qr_code_2
            </span>
          </div>
          <p className="text-center text-[.72rem] mt-3" style={{ color: 'rgba(255,255,255,.6)' }}>
            Escanea el código o verifica en línea con tu código de certificado
          </p>
        </div>
      </div>
    </section>
  );
}
