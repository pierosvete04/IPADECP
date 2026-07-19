import { avatarPorKey } from '@/lib/avatars';

export default function Avatar({
  avatarKey,
  nombreRef,
  size = 38,
}: {
  avatarKey?: string | null;
  nombreRef?: string | null;
  size?: number;
}) {
  const a = avatarPorKey(avatarKey);
  if (a) {
    return (
      <span className="avatar-circulo" style={{ width: size, height: size, overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </span>
    );
  }
  const letra = (nombreRef || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      className="avatar-circulo"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.45),
        background: 'linear-gradient(135deg,var(--st-secundario),var(--st-fondo-navy))',
        color: '#fff',
        fontWeight: 700,
        fontFamily: 'var(--st-font-titulo)',
      }}
    >
      {letra}
    </span>
  );
}
