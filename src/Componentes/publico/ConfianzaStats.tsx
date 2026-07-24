const ITEMS = [
  { icon: 'devices', label: '100% virtual, a tu ritmo' },
  { icon: 'workspace_premium', label: 'Certificación oficial IPADECP' },
  { icon: 'qr_code_2', label: 'Certificado verificable por QR' },
  { icon: 'support_agent', label: 'Soporte directo por WhatsApp' },
];

export default function ConfianzaStats() {
  return (
    <section className="px-6 pb-14">
      <div className="ipd-contenedor">
        <div className="ipd-card [display:grid] grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[var(--st-superficie-borde)]">
          {ITEMS.map((item) => (
            <div key={item.icon} className="flex flex-col items-center text-center gap-2 px-4 py-6">
              <span
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: 'var(--st-secundario-cont)', color: 'var(--st-on-secundario-cont)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                  {item.icon}
                </span>
              </span>
              <span className="text-[.85rem] font-semibold" style={{ color: 'var(--st-texto-navy)' }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
