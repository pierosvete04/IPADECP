'use client';

import { useState } from 'react';
import { UserRound, Calendar, Phone, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
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
    <Modal open={open} title="Completa tus datos" onClose={() => {}} hideClose className="modal-datos">
      <div className="modal-datos-intro">
        <span className="modal-datos-icono" aria-hidden="true">
          <ShieldCheck size={20} strokeWidth={2} />
        </span>
        <p>Antes de continuar, necesitamos algunos datos para tu perfil y certificados.</p>
      </div>
      {aviso && <div className="aviso err">{aviso}</div>}
      <form onSubmit={handleSubmit} className="modal-datos-form">
        <div className="modal-datos-grid">
          <div className="campo-icono">
            <label htmlFor="do-nombres">Nombres</label>
            <div className="input-icono">
              <UserRound size={17} strokeWidth={2} aria-hidden="true" />
              <input id="do-nombres" value={nombres} onChange={(e) => setNombres(e.target.value)} required autoComplete="given-name" />
            </div>
          </div>
          <div className="campo-icono">
            <label htmlFor="do-apellidos">Apellidos</label>
            <div className="input-icono">
              <UserRound size={17} strokeWidth={2} aria-hidden="true" />
              <input id="do-apellidos" value={apellidos} onChange={(e) => setApellidos(e.target.value)} required autoComplete="family-name" />
            </div>
          </div>
          <div className="campo-icono">
            <label htmlFor="do-fecha">Fecha de nacimiento</label>
            <div className="input-icono">
              <Calendar size={17} strokeWidth={2} aria-hidden="true" />
              <input id="do-fecha" type="date" value={fechaNac} onChange={(e) => setFechaNac(e.target.value)} required />
            </div>
          </div>
          <div className="campo-icono">
            <label htmlFor="do-telefono">Teléfono</label>
            <div className="input-icono">
              <Phone size={17} strokeWidth={2} aria-hidden="true" />
              <input id="do-telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} autoComplete="tel" />
            </div>
          </div>
        </div>
        <button className="btn bloque modal-datos-btn" type="submit" disabled={cargando}>
          {cargando ? <Loader2 size={17} className="girando" aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
          {cargando ? 'Guardando…' : 'Guardar y continuar'}
        </button>
      </form>
    </Modal>
  );
}
