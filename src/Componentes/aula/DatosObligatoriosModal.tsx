'use client';

import { useState } from 'react';
import { UserRound, Calendar, Phone, IdCard, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { verificarDni } from '@/lib/dni';
import Modal from '@/Componentes/ui/Modal';

type TipoDocumento = 'DNI' | 'CE';

interface PerfilBase {
  nombre?: string | null;
  nombres?: string | null;
  apellidos?: string | null;
  fecha_nacimiento?: string | null;
  telefono?: string | null;
  documento?: string | null;
  tipo_documento?: string | null;
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
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>((perfil?.tipo_documento as TipoDocumento) || 'DNI');
  const [documento, setDocumento] = useState(perfil?.documento || '');
  const [verificacionFallo, setVerificacionFallo] = useState(false);
  const [aceptaResponsabilidad, setAceptaResponsabilidad] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  function cambiarTipoDocumento(t: TipoDocumento) {
    setTipoDocumento(t);
    setDocumento('');
    setVerificacionFallo(false);
    setAceptaResponsabilidad(false);
  }

  function cambiarDocumento(v: string) {
    setDocumento(v);
    setVerificacionFallo(false);
    setAceptaResponsabilidad(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    const nombresV = nombres.trim();
    const apellidosV = apellidos.trim();
    const doc = documento.trim();
    const nombreCompleto = `${nombresV} ${apellidosV}`.trim();

    if (tipoDocumento === 'DNI' && !/^\d{8}$/.test(doc)) {
      setAviso('Ingresa un DNI válido de 8 dígitos.');
      return;
    }
    if (tipoDocumento === 'CE' && doc.length < 6) {
      setAviso('Ingresa un número de Carnet de Extranjería válido.');
      return;
    }

    let documentoVerificado = false;
    if (tipoDocumento === 'CE') {
      if (!aceptaResponsabilidad) {
        setAviso('El Carnet de Extranjería no se puede verificar automáticamente. Marca la casilla para confirmar que tu nombre es correcto.');
        return;
      }
    } else if (!aceptaResponsabilidad) {
      setCargando(true);
      const verificacion = await verificarDni(doc, nombreCompleto);
      setCargando(false);
      if (verificacion.ok && verificacion.coincide === true) {
        documentoVerificado = true;
      } else {
        setVerificacionFallo(true);
        setAviso(
          !verificacion.ok
            ? verificacion.motivo || 'No se pudo verificar tu DNI. Intenta nuevamente.'
            : `El nombre ingresado no coincide con el registrado en RENIEC para ese DNI (${verificacion.nombreCompleto}). Corrígelo o marca la casilla de abajo para continuar bajo tu responsabilidad.`
        );
        return;
      }
    }

    setCargando(true);
    const { error } = await supabase
      .from('perfiles')
      .update({
        nombres: nombresV,
        apellidos: apellidosV,
        nombre: nombreCompleto,
        fecha_nacimiento: fechaNac,
        telefono: telefono.trim(),
        documento: doc,
        tipo_documento: tipoDocumento,
        documento_verificado: documentoVerificado,
      })
      .eq('id', userId);
    setCargando(false);
    if (error) {
      setAviso(error.message);
      return;
    }
    onGuardado(nombreCompleto);
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
            <label htmlFor="do-tipo-doc">Tipo de documento</label>
            <div className="fila">
              <label className="chk">
                <input id="do-tipo-doc" type="radio" name="do-tipo-doc" checked={tipoDocumento === 'DNI'} onChange={() => cambiarTipoDocumento('DNI')} /> DNI
              </label>
              <label className="chk">
                <input type="radio" name="do-tipo-doc" checked={tipoDocumento === 'CE'} onChange={() => cambiarTipoDocumento('CE')} /> Carnet de Extranjería
              </label>
            </div>
          </div>
          <div className="campo-icono">
            <label htmlFor="do-documento">{tipoDocumento === 'DNI' ? 'DNI' : 'Carnet de Extranjería'}</label>
            <div className="input-icono">
              <IdCard size={17} strokeWidth={2} aria-hidden="true" />
              <input
                id="do-documento"
                inputMode={tipoDocumento === 'DNI' ? 'numeric' : 'text'}
                maxLength={tipoDocumento === 'DNI' ? 8 : 15}
                placeholder={tipoDocumento === 'DNI' ? '8 dígitos' : 'Número de tu carnet'}
                value={documento}
                onChange={(e) => cambiarDocumento(tipoDocumento === 'DNI' ? e.target.value.replace(/\D/g, '').slice(0, 8) : e.target.value.slice(0, 15))}
                required
              />
            </div>
          </div>
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
        {(tipoDocumento === 'CE' || verificacionFallo) && (
          <label className="chk" style={{ marginTop: '.4rem', alignItems: 'flex-start' }}>
            <input type="checkbox" checked={aceptaResponsabilidad} onChange={(e) => setAceptaResponsabilidad(e.target.checked)} style={{ marginTop: '.2rem' }} />
            <span>
              Confirmo que mis nombres y apellidos están escritos correctamente. Entiendo que este mismo nombre aparecerá en mi certificado y que soy responsable de su
              exactitud.
            </span>
          </label>
        )}
        <button className="btn bloque modal-datos-btn" type="submit" disabled={cargando}>
          {cargando ? <Loader2 size={17} className="girando" aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
          {cargando ? 'Guardando…' : 'Guardar y continuar'}
        </button>
      </form>
    </Modal>
  );
}
