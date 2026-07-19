'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Modal from '@/Componentes/ui/Modal';

export default function CodigoModal({
  open,
  onClose,
  onCanjeado,
}: {
  open: boolean;
  onClose: () => void;
  onCanjeado: () => void;
}) {
  const [codigo, setCodigo] = useState('');
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!codigo.trim()) return;
    setCargando(true);
    const { data, error } = await supabase.rpc('canjear_codigo', { p_codigo: codigo.trim() });
    setCargando(false);
    if (error) {
      setAviso({ texto: error.message.replace(/^.*?:\s*/, ''), tipo: 'err' });
      return;
    }
    const n = (data || []).length;
    setAviso({ texto: `¡Listo! Se desbloquearon ${n} curso(s).`, tipo: 'ok' });
    setTimeout(() => {
      setCodigo('');
      setAviso(null);
      onCanjeado();
    }, 1200);
  }

  return (
    <Modal open={open} title="Añadir curso" onClose={onClose}>
      <p className="sub" style={{ marginTop: 0 }}>
        Ingresa el código que te enviamos para desbloquear tus cursos.
      </p>
      {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}
      <form className="fila" onSubmit={handleSubmit}>
        <input
          placeholder="Ej. SB-XXXX-XXXX"
          style={{ flex: 1, minWidth: 200, textTransform: 'uppercase' }}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
        />
        <button className="btn" type="submit" disabled={cargando}>
          Canjear
        </button>
      </form>
    </Modal>
  );
}
