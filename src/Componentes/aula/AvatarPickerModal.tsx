'use client';

import Modal from '@/Componentes/ui/Modal';
import Avatar from '@/Componentes/ui/Avatar';
import { AVATARS_DISPONIBLES } from '@/lib/avatars';

export default function AvatarPickerModal({
  open,
  onClose,
  avatarKey,
  nombreRef,
  onElegir,
}: {
  open: boolean;
  onClose: () => void;
  avatarKey: string | null;
  nombreRef: string;
  onElegir: (key: string | null) => void;
}) {
  return (
    <Modal open={open} title="Elige tu foto de perfil" onClose={onClose}>
      <p className="sub" style={{ marginTop: 0 }}>
        Es opcional: si no eliges ninguna, usaremos la inicial de tu nombre.
      </p>
      <div className="avatar-picker-grid">
        <button type="button" className={`avatar-opcion${!avatarKey ? ' activo' : ''}`} onClick={() => onElegir(null)}>
          <Avatar avatarKey={null} nombreRef={nombreRef} size={56} />
          <span>Sin foto</span>
        </button>
        {AVATARS_DISPONIBLES.map((a) => (
          <button
            key={a.key}
            type="button"
            className={`avatar-opcion${avatarKey === a.key ? ' activo' : ''}`}
            onClick={() => onElegir(a.key)}
          >
            <Avatar avatarKey={a.key} nombreRef={nombreRef} size={56} />
            <span>{a.nombre}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
