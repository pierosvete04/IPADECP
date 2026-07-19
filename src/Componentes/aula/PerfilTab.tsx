'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { cerrarSesion } from '@/lib/supabase/auth';
import { obtenerCargosProfesionales, type CargoProfesional } from '@/lib/cargos';
import { revealStagger } from '@/lib/motion';
import Avatar from '@/Componentes/ui/Avatar';
import PasswordField from '@/Componentes/ui/PasswordField';
import AvatarPickerModal from './AvatarPickerModal';
import HistorialList from './HistorialList';

const DEPARTAMENTOS_PERU = [
  'Amazonas', 'Áncash', 'Apurímac', 'Arequipa', 'Ayacucho', 'Cajamarca', 'Callao', 'Cusco',
  'Huancavelica', 'Huánuco', 'Ica', 'Junín', 'La Libertad', 'Lambayeque', 'Lima', 'Loreto', 'Madre de Dios', 'Moquegua',
  'Pasco', 'Piura', 'Puno', 'San Martín', 'Tacna', 'Tumbes', 'Ucayali',
];

interface Perfil {
  nombre?: string | null;
  nombres?: string | null;
  apellidos?: string | null;
  fecha_nacimiento?: string | null;
  email?: string | null;
  telefono?: string | null;
  documento?: string | null;
  departamento?: string | null;
  distrito?: string | null;
  genero?: string | null;
  avatar_key?: string | null;
  cargo?: string | null;
}

interface Logro {
  icono: string;
  nombre: string;
  descripcion?: string;
  desbloqueado: boolean;
}

type Vista = 'datos' | 'seguridad' | 'historial';

export default function PerfilTab({
  user,
  vistaInicial,
  onPerfilActualizado,
}: {
  user: User;
  vistaInicial?: Vista;
  onPerfilActualizado: (nombre: string) => void;
}) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [vista, setVista] = useState<Vista>(vistaInicial || 'datos');
  const [logros, setLogros] = useState<Logro[] | null>(null);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const logrosRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logros && logros.some((l) => l.desbloqueado)) {
      revealStagger(logrosRef.current, '.logro-item.desbloqueado', { y: 8, stagger: 0.05 });
    }
  }, [logros]);

  useEffect(() => {
    let activo = true;
    supabase
      .from('perfiles')
      .select('nombre,nombres,apellidos,fecha_nacimiento,email,telefono,documento,departamento,distrito,genero,avatar_key,cargo')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (activo) setPerfil(data);
      });
    supabase.rpc('mis_logros').then(({ data }) => {
      if (activo) setLogros(data || []);
    });
    return () => {
      activo = false;
    };
  }, [user]);

  if (!perfil) return <p>Cargando…</p>;

  const nombreCompleto = perfil.nombres ? `${perfil.nombres} ${perfil.apellidos || ''}`.trim() : perfil.nombre || user.email || '';
  const camposPerfil = [perfil.nombres, perfil.apellidos, perfil.telefono, perfil.fecha_nacimiento, perfil.documento, perfil.departamento, perfil.distrito, perfil.genero];
  const progresoPerfil = Math.round((camposPerfil.filter(Boolean).length / camposPerfil.length) * 100);

  async function elegirAvatar(key: string | null) {
    const { error } = await supabase.from('perfiles').update({ avatar_key: key }).eq('id', user.id);
    if (error) return;
    setPerfil((p) => (p ? { ...p, avatar_key: key } : p));
    setAvatarModalOpen(false);
  }

  return (
    <>
      <div className="barra" style={{ marginBottom: '.6rem' }}>
        <h2 className="titulo" style={{ margin: 0 }}>
          Mi perfil
        </h2>
      </div>
      <div className="perfil-layout">
        <div className="perfil-col-lateral">
          <div className="card perfil-section">
            <div className="perfil-section-body" style={{ textAlign: 'center' }}>
              <div className="perfil-avatar" style={{ margin: '0 auto .5rem' }}>
                <Avatar avatarKey={perfil.avatar_key} nombreRef={nombreCompleto} size={84} />
              </div>
              <button className="btn sec btn-sm" type="button" style={{ marginBottom: '.7rem' }} onClick={() => setAvatarModalOpen(true)}>
                Cambiar foto
              </button>
              <strong style={{ fontSize: '1rem', display: 'block' }}>{nombreCompleto}</strong>
              <p className="sub" style={{ margin: '.15rem 0 .8rem', fontSize: '.82rem' }}>
                {perfil.email || user.email}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', color: 'var(--gris)', marginBottom: '.3rem' }}>
                <span>Progreso de perfil</span>
                <strong style={{ color: 'var(--st-secundario)' }}>{progresoPerfil}%</strong>
              </div>
              <div className="barra-progreso">
                <div className="relleno" style={{ width: `${progresoPerfil}%` }} />
              </div>
            </div>
          </div>
          <div className="card perfil-section" style={{ marginTop: '.8rem' }}>
            <nav className="perfil-quicknav">
              <a href="#" className={vista === 'datos' ? 'activo' : ''} onClick={(e) => { e.preventDefault(); setVista('datos'); }}>
                <span className="material-symbols-outlined">person</span> Datos personales
              </a>
              <a href="#" className={vista === 'seguridad' ? 'activo' : ''} onClick={(e) => { e.preventDefault(); setVista('seguridad'); }}>
                <span className="material-symbols-outlined">lock</span> Seguridad y contraseña
              </a>
              <a href="#" className={vista === 'historial' ? 'activo' : ''} onClick={(e) => { e.preventDefault(); setVista('historial'); }}>
                <span className="material-symbols-outlined">receipt_long</span> Historial de compras
              </a>
              <Link href="/reclamos">
                <span className="material-symbols-outlined">mail</span> Libro de Reclamaciones
              </Link>
              <a href="#" className="peligro" onClick={(e) => { e.preventDefault(); cerrarSesion('/login'); }}>
                <span className="material-symbols-outlined">logout</span> Cerrar sesión
              </a>
            </nav>
          </div>
          <div className="card perfil-section" style={{ marginTop: '.8rem' }}>
            <div className="perfil-section-head">
              <span className="material-symbols-outlined">military_tech</span> Tus logros
            </div>
            <div className="perfil-section-body">
              {logros === null ? (
                'Cargando…'
              ) : logros.length ? (
                <div className="logros-grid" ref={logrosRef}>
                  {logros.map((lg, i) => (
                    <div className={`logro-item${lg.desbloqueado ? ' desbloqueado' : ''}`} title={lg.descripcion || ''} key={i}>
                      <span className="logro-ico">{lg.icono}</span>
                      <span className="logro-nombre">{lg.nombre}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="vacio">Aún no hay logros disponibles.</p>
              )}
            </div>
          </div>
        </div>
        <div className="perfil-col-principal">
          {vista === 'datos' && (
            <VistaDatos
              perfil={perfil}
              user={user}
              onGuardado={(p, nombre) => {
                setPerfil(p);
                onPerfilActualizado(nombre);
              }}
            />
          )}
          {vista === 'seguridad' && <VistaSeguridad />}
          {vista === 'historial' && (
            <div className="card perfil-section">
              <div className="perfil-section-head">
                <span className="material-symbols-outlined">receipt_long</span> Historial de compras
              </div>
              <div className="perfil-section-body">
                <HistorialList userId={user.id} />
              </div>
            </div>
          )}
        </div>
      </div>
      <AvatarPickerModal
        open={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        avatarKey={perfil.avatar_key || null}
        nombreRef={nombreCompleto}
        onElegir={elegirAvatar}
      />
    </>
  );
}

function VistaDatos({
  perfil,
  user,
  onGuardado,
}: {
  perfil: Perfil;
  user: User;
  onGuardado: (p: Perfil, nombre: string) => void;
}) {
  const [nombres, setNombres] = useState(perfil.nombres || perfil.nombre || '');
  const [apellidos, setApellidos] = useState(perfil.apellidos || '');
  const [email, setEmail] = useState(perfil.email || user.email || '');
  const [telefono, setTelefono] = useState(perfil.telefono || '');
  const [fechaNac, setFechaNac] = useState(perfil.fecha_nacimiento || '');
  const [documento, setDocumento] = useState(perfil.documento || '');
  const [depto, setDepto] = useState(perfil.departamento || '');
  const [distrito, setDistrito] = useState(perfil.distrito || '');
  const [genero, setGenero] = useState(perfil.genero || '');
  const [cargos, setCargos] = useState<CargoProfesional[]>([]);
  const [cargoSel, setCargoSel] = useState('');
  const [cargoOtro, setCargoOtro] = useState('');
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);

  useEffect(() => {
    obtenerCargosProfesionales().then((lista) => {
      setCargos(lista);
      const coincide = lista.some((c) => c.nombre === perfil.cargo);
      if (perfil.cargo && coincide) {
        setCargoSel(perfil.cargo);
      } else if (perfil.cargo) {
        setCargoSel('Otro');
        setCargoOtro(perfil.cargo);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargoFinal = cargoSel === 'Otro' ? cargoOtro.trim() : cargoSel;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    const nuevoEmail = email.trim();
    const emailPrevio = perfil.email || user.email || '';
    if (nuevoEmail && nuevoEmail !== emailPrevio) {
      const { error: eMail } = await supabase.auth.updateUser({ email: nuevoEmail });
      if (eMail) {
        setAviso({ texto: eMail.message, tipo: 'err' });
        return;
      }
    }
    const nombresV = nombres.trim();
    const apellidosV = apellidos.trim();
    const actualizado = {
      nombres: nombresV,
      apellidos: apellidosV,
      nombre: `${nombresV} ${apellidosV}`.trim(),
      email: nuevoEmail,
      telefono: telefono.trim(),
      fecha_nacimiento: fechaNac || null,
      documento: documento.trim(),
      departamento: depto,
      distrito: distrito.trim(),
      genero,
      cargo: cargoFinal || null,
    };
    const { error } = await supabase.from('perfiles').update(actualizado).eq('id', user.id);
    if (error) {
      setAviso({ texto: error.message, tipo: 'err' });
      return;
    }
    setAviso({
      texto: nuevoEmail !== emailPrevio ? 'Datos actualizados. Revisa tu nuevo correo para confirmar el cambio.' : 'Datos actualizados.',
      tipo: 'ok',
    });
    onGuardado({ ...perfil, ...actualizado }, actualizado.nombre || perfil.nombre || '');
  }

  return (
    <div className="card perfil-section">
      <div className="perfil-section-head">
        <span className="material-symbols-outlined">person</span> Datos personales
      </div>
      <div className="perfil-section-body">
        {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}
        <form onSubmit={guardar}>
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
              <label>Correo electrónico</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label>Teléfono</label>
              <input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
            <div>
              <label>Fecha de nacimiento</label>
              <input type="date" value={fechaNac} onChange={(e) => setFechaNac(e.target.value)} />
            </div>
            <div>
              <label>Documento de identidad</label>
              <input value={documento} onChange={(e) => setDocumento(e.target.value)} />
            </div>
            <div>
              <label>Departamento / Región</label>
              <select value={depto} onChange={(e) => setDepto(e.target.value)}>
                <option value="">— Selecciona —</option>
                {DEPARTAMENTOS_PERU.map((d) => (
                  <option value={d} key={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Distrito</label>
              <input value={distrito} onChange={(e) => setDistrito(e.target.value)} />
            </div>
            <div>
              <label>Género</label>
              <select value={genero} onChange={(e) => setGenero(e.target.value)}>
                <option value="">— Selecciona —</option>
                <option value="Femenino">Femenino</option>
                <option value="Masculino">Masculino</option>
                <option value="Otro">Otro</option>
                <option value="Prefiero no decir">Prefiero no decir</option>
              </select>
            </div>
            <div>
              <label>Cargo profesional</label>
              <select value={cargoSel} onChange={(e) => setCargoSel(e.target.value)}>
                <option value="">— Selecciona —</option>
                {cargos.map((c) => (
                  <option value={c.nombre} key={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              {cargoSel === 'Otro' && (
                <input
                  style={{ marginTop: '.4rem' }}
                  placeholder="Especifica tu cargo"
                  value={cargoOtro}
                  onChange={(e) => setCargoOtro(e.target.value)}
                />
              )}
              <p className="sub" style={{ margin: '.3rem 0 0', fontSize: '.78rem' }}>
                Este dato se usa para tus certificados.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button className="btn" type="submit">
              Guardar cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VistaSeguridad() {
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (pass1 !== pass2) {
      setAviso({ texto: 'Las contraseñas no coinciden.', tipo: 'err' });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pass1 });
    if (error) {
      setAviso({ texto: error.message, tipo: 'err' });
      return;
    }
    setAviso({ texto: 'Contraseña actualizada.', tipo: 'ok' });
    setPass1('');
    setPass2('');
  }

  return (
    <div className="card perfil-section">
      <div className="perfil-section-head">
        <span className="material-symbols-outlined">lock</span> Seguridad y contraseña
      </div>
      <div className="perfil-section-body">
        {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}
        <form onSubmit={guardar}>
          <div className="perfil-grid">
            <PasswordField label="Nueva contraseña" value={pass1} onChange={setPass1} placeholder="Mínimo 6 caracteres" minLength={6} />
            <PasswordField label="Confirmar nueva contraseña" value={pass2} onChange={setPass2} minLength={6} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button className="btn sec" type="submit">
              Actualizar contraseña
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
