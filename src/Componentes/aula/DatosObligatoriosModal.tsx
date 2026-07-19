'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Modal from '@/Componentes/ui/Modal';

interface PerfilBase {
  nombre?: string | null;
  nombres?: string | null;
  apellidos?: string | null;
  fecha_nacimiento?: string | null;
  telefono?: string | null;
}

function nombreApellidoPrevios(p: PerfilBase | null): [string, string] {
  if (p?.nombres) return [p.nombres, p.apellidos || ''];
  const partes = (p?.nombre || '').split(' ');
  if (partes.length > 1) return [partes.slice(0, -1).join(' '), partes.slice(-1).join(' ')];
  return [p?.nombre || '', ''];
}

export default function DatosObligatoriosModal({
  open,
  perfil,
  userId,
  onGuardado,
}: {
  open: boolean;
  perfil: PerfilBase | null;
  userId: string;
  onGuardado: (nombre: string) => void;
}) {
  const [nomPrevio, apePrevio] = nombreApellidoPrevios(perfil);
  const [nombres, setNombres] = useState(nomPrevio);
  const [apellidos, setApellidos] = useState(apePrevio);
  const [fechaNac, setFechaNac] = useState(perfil?.fecha_nacimiento || '');
  const [telefono, setTelefono] = useState(perfil?.telefono || '');
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setAviso(null);
    const nombresV = nombres.trim();
    const apellidosV = apellidos.trim();
    const { error } = await supabase
      .from('perfiles')
      .update({ nombres: nombresV, apellidos: apellidosV, nombre: `${nombresV} ${apellidosV}`.trim(), fecha_nacimiento: fechaNac, telefono: telefono.trim() })
      .eq('id', userId);
    setCargando(false);
    if (error) {
      setAviso(error.message);
      return;
    }
    onGuardado(`${nombresV} ${apellidosV}`.trim());
  }

  return (
    <Modal open={open} title="Completa tus datos" onClose={() => {}} hideClose>
      <p className="sub" style={{ marginTop: 0 }}>
        Antes de continuar, necesitamos algunos datos para tu perfil y certificados.
      </p>
      {aviso && <div className="aviso err">{aviso}</div>}
      <form onSubmit={handleSubmit}>
        <div className="perfil-grid">
          <div>
            <label>Nombres</label>
            <input value={nombres} onChange={(e) => setNombres(e.target.value)} required />
          </div>
          <div>
            <label>Apellidos</label>
            <input value={apellidos} onChange={(e) => setApellidos(e.target.value)} required />
          </div>
          <div>
            <label>Fecha de nacimiento</label>
            <input type="date" value={fechaNac} onChange={(e) => setFechaNac(e.target.value)} required />
          </div>
          <div>
            <label>Teléfono</label>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
        </div>
        <button className="btn bloque" type="submit" disabled={cargando} style={{ marginTop: '1.2rem' }}>
          Guardar y continuar
        </button>
      </form>
    </Modal>
  );
}
