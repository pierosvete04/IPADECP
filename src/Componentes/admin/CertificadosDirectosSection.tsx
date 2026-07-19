'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { verificarDni } from '@/lib/dni';
import { obtenerCargosProfesionales, type CargoProfesional } from '@/lib/cargos';
import { generarCertificadoPDF, generarCertificadoImprimirPDF } from '@/lib/certificado';
import DataTable from '@/Componentes/ui/DataTable';
import CursoSelector from './CursoSelector';
import { useCursosAdmin } from './useCursosAdmin';

interface Periodo {
  id: number;
  nombre: string;
  fecha_inicio: string;
  fecha_entrega: string;
  fecha_cierre: string;
}

interface CertificadoDirectoRow {
  id: number;
  curso_id: number;
  dni: string | null;
  nombre_completo: string | null;
  cargo: string | null;
  fecha: string;
  alumno_uid: string | null;
  codigo_verificacion: string;
  periodo_id: number | null;
}

export default function CertificadosDirectosSection() {
  const { cursos } = useCursosAdmin();
  const activos = cursos.filter((c) => c.estado === '1');

  const [periodos, setPeriodos] = useState<Periodo[] | null>(null);
  const [certificados, setCertificados] = useState<CertificadoDirectoRow[] | null>(null);
  const [cargos, setCargos] = useState<CargoProfesional[]>([]);

  async function cargarPeriodos() {
    const { data } = await supabase.from('periodos_certificacion').select('*').order('fecha_inicio', { ascending: false });
    setPeriodos((data as Periodo[]) || []);
  }
  async function cargarCertificados() {
    const { data } = await supabase
      .from('certificados')
      .select('id,curso_id,dni,nombre_completo,cargo,fecha,alumno_uid,codigo_verificacion,periodo_id')
      .eq('modalidad', 'directo')
      .order('fecha', { ascending: false });
    setCertificados((data as CertificadoDirectoRow[]) || []);
  }
  useEffect(() => {
    cargarPeriodos();
    cargarCertificados();
    obtenerCargosProfesionales().then(setCargos);
  }, []);

  const cursoNombre = (id: number) => cursos.find((c) => c.id === id)?.nombre || `Curso #${id}`;

  function fechasPeriodo(periodoId: number | null) {
    const p = (periodos || []).find((x) => x.id === periodoId);
    if (!p) return {};
    return {
      periodoInicio: new Date(p.fecha_inicio + 'T00:00:00').toLocaleDateString('es-PE'),
      periodoEntrega: new Date(p.fecha_entrega + 'T00:00:00').toLocaleDateString('es-PE'),
      periodoCierre: new Date(p.fecha_cierre + 'T00:00:00').toLocaleDateString('es-PE'),
    };
  }

  async function descargarDigital(row: CertificadoDirectoRow) {
    await generarCertificadoPDF({
      codigo: row.codigo_verificacion,
      alumnoNombre: row.nombre_completo || '—',
      cursoNombre: cursoNombre(row.curso_id),
      fecha: new Date(row.fecha).toLocaleDateString('es-PE'),
      cargo: row.cargo || undefined,
      ...fechasPeriodo(row.periodo_id),
    });
  }
  async function descargarImprimir(row: CertificadoDirectoRow) {
    await generarCertificadoImprimirPDF({
      codigo: row.codigo_verificacion,
      alumnoNombre: row.nombre_completo || '—',
      cursoNombre: cursoNombre(row.curso_id),
      fecha: new Date(row.fecha).toLocaleDateString('es-PE'),
      cargo: row.cargo || undefined,
      dni: row.dni || undefined,
      ...fechasPeriodo(row.periodo_id),
    });
  }

  return (
    <>
      <h1 className="titulo">Certificados directos</h1>
      <p className="sub" style={{ marginTop: 0 }}>
        Para clientes que compran un curso solo por el certificado (sin rendir tareas/exámenes): ingresa su DNI, cargo y la
        fecha que corresponda dentro del período de 6 meses, y se emite su certificado con QR de verificación.
      </p>

      <h2 className="titulo" style={{ fontSize: '1.1rem', marginTop: '1.6rem' }}>
        Emitir certificado directo
      </h2>
      <FormEmision
        cursos={activos}
        periodos={periodos || []}
        cargos={cargos}
        onEmitido={() => {
          cargarCertificados();
        }}
      />

      <h2 className="titulo" style={{ fontSize: '1.1rem', marginTop: '1.8rem' }}>
        Certificados directos emitidos
      </h2>
      {certificados === null ? (
        <p>Cargando…</p>
      ) : (
        <DataTable
          columns={[
            { key: 'nombre_completo', header: 'Cliente' },
            { key: 'dni', header: 'DNI' },
            { key: 'cargo', header: 'Cargo', render: (f) => f.cargo || '—' },
            { key: 'curso', header: 'Curso', render: (f) => cursoNombre(f.curso_id) },
            { key: 'fecha', header: 'Fecha', render: (f) => new Date(f.fecha).toLocaleDateString('es-PE') },
            {
              key: 'cuenta',
              header: 'Cuenta',
              render: (f) => (f.alumno_uid ? <span className="tag activo">con acceso</span> : <span className="tag canjeado">sin cuenta</span>),
            },
          ]}
          rows={certificados}
          vacio="Aún no se ha emitido ningún certificado directo."
          actions={(f) => (
            <>
              <button className="btn sec btn-sm" onClick={() => descargarDigital(f)}>
                Digital
              </button>
              <button className="btn sec btn-sm" onClick={() => descargarImprimir(f)}>
                Para imprimir
              </button>
            </>
          )}
        />
      )}
    </>
  );
}

function FormEmision({
  cursos,
  periodos,
  cargos,
  onEmitido,
}: {
  cursos: { id: number; nombre: string }[];
  periodos: Periodo[];
  cargos: CargoProfesional[];
  onEmitido: () => void;
}) {
  const [cursoId, setCursoId] = useState('');
  const [dni, setDni] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [cargoSel, setCargoSel] = useState('');
  const [cargoOtro, setCargoOtro] = useState('');
  const [periodoId, setPeriodoId] = useState('');
  const [fecha, setFecha] = useState('');
  const [telefono, setTelefono] = useState('');
  const [emitiendo, setEmitiendo] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);
  const [resultado, setResultado] = useState<{
    row: CertificadoDirectoRow;
    email?: string;
    passwordTemporal?: string;
    yaExistia?: boolean;
  } | null>(null);

  const periodoElegido = periodos.find((p) => String(p.id) === periodoId);
  const cargoFinal = cargoSel === 'Otro' ? cargoOtro.trim() : cargoSel;

  useEffect(() => {
    if (periodoElegido) setFecha(periodoElegido.fecha_entrega);
  }, [periodoElegido]);

  async function verificarConReniec() {
    if (!/^\d{8}$/.test(dni)) {
      setAviso({ texto: 'Ingresa un DNI válido de 8 dígitos.', tipo: 'err' });
      return;
    }
    setVerificando(true);
    setAviso(null);
    const res = await verificarDni(dni, '');
    setVerificando(false);
    if (res.ok && res.nombreCompleto) {
      setNombreCompleto(res.nombreCompleto);
      setAviso({ texto: `Nombre encontrado en RENIEC: ${res.nombreCompleto}`, tipo: 'ok' });
    } else {
      setAviso({ texto: res.motivo || 'No se pudo verificar el DNI en RENIEC. Ingresa el nombre manualmente.', tipo: 'err' });
    }
  }

  async function emitir(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    setResultado(null);

    const cursoIdNum = parseInt(cursoId, 10);
    const periodoIdNum = parseInt(periodoId, 10);
    if (!cursoIdNum) return setAviso({ texto: 'Elige un curso.', tipo: 'err' });
    if (!/^\d{8}$/.test(dni)) return setAviso({ texto: 'Ingresa un DNI válido de 8 dígitos.', tipo: 'err' });
    if (!nombreCompleto.trim()) return setAviso({ texto: 'Falta el nombre completo del cliente.', tipo: 'err' });
    if (!cargoFinal) return setAviso({ texto: 'Elige o escribe el cargo profesional.', tipo: 'err' });
    if (!periodoIdNum) return setAviso({ texto: 'Elige un período de certificación.', tipo: 'err' });
    if (!fecha) return setAviso({ texto: 'Elige la fecha del certificado.', tipo: 'err' });

    setEmitiendo(true);
    try {
      const { data: existente } = await supabase.from('perfiles').select('id,email').eq('documento', dni).maybeSingle();

      let alumnoUid: string | null = existente?.id || null;
      let cuentaInfo: { email?: string; passwordTemporal?: string; yaExistia?: boolean } = {};

      if (existente) {
        cuentaInfo = { email: existente.email || undefined, yaExistia: true };
      } else {
        const partes = nombreCompleto.trim().split(/\s+/);
        const nombres = partes.slice(0, Math.max(1, partes.length - 2)).join(' ') || partes[0];
        const apellidos = partes.slice(-2).join(' ') || '';
        const { data: creado, error: errCrear } = await supabase.functions.invoke('admin-crear-usuario', {
          body: { nombres, apellidos, dni, cargo: cargoFinal, telefono: telefono.trim() || undefined },
        });
        if (errCrear || !creado?.ok) {
          setAviso({ texto: creado?.motivo || errCrear?.message || 'No se pudo crear la cuenta del cliente.', tipo: 'err' });
          setEmitiendo(false);
          return;
        }
        alumnoUid = creado.alumno_uid;
        cuentaInfo = { email: creado.email, passwordTemporal: creado.passwordTemporal, yaExistia: creado.yaExistia };
      }

      const { data: cert, error: errCert } = await supabase.rpc('admin_emitir_certificado_directo', {
        p_curso_id: cursoIdNum,
        p_periodo_id: periodoIdNum,
        p_fecha: fecha,
        p_dni: dni,
        p_nombre_completo: nombreCompleto.trim(),
        p_cargo: cargoFinal,
        p_alumno_uid: alumnoUid,
      });

      if (errCert || !cert) {
        setAviso({ texto: errCert?.message || 'No se pudo emitir el certificado.', tipo: 'err' });
        setEmitiendo(false);
        return;
      }

      if (alumnoUid) {
        await supabase
          .from('inscripciones')
          .upsert({ alumno_id: alumnoUid, curso_id: cursoIdNum, origen: 'admin' }, { onConflict: 'alumno_id,curso_id', ignoreDuplicates: true });
      }

      setResultado({ row: cert as CertificadoDirectoRow, ...cuentaInfo });
      setAviso({ texto: 'Certificado emitido correctamente.', tipo: 'ok' });
      setDni('');
      setNombreCompleto('');
      setTelefono('');
      onEmitido();
    } finally {
      setEmitiendo(false);
    }
  }

  const cursoNombreSel = cursos.find((c) => String(c.id) === cursoId)?.nombre || '';

  return (
    <div className="card card-pad">
      {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}
      <form onSubmit={emitir}>
        <label>Curso</label>
        <CursoSelector cursos={cursos.map((c) => ({ ...c, categoria_id: null, estado: '1' }))} value={cursoId} onChange={setCursoId} />

        <label style={{ marginTop: '.6rem' }}>DNI del cliente</label>
        <div className="fila">
          <input value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="8 dígitos" style={{ maxWidth: 160 }} />
          <button type="button" className="btn sec" onClick={verificarConReniec} disabled={verificando}>
            {verificando ? 'Verificando…' : 'Verificar con RENIEC'}
          </button>
        </div>

        <label style={{ marginTop: '.6rem' }}>Nombre completo</label>
        <input value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} placeholder="Se completa al verificar el DNI, o ingrésalo manualmente" />

        <label style={{ marginTop: '.6rem' }}>Cargo profesional</label>
        <select value={cargoSel} onChange={(e) => setCargoSel(e.target.value)}>
          <option value="">— Selecciona —</option>
          {cargos.map((c) => (
            <option value={c.nombre} key={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        {cargoSel === 'Otro' && (
          <input style={{ marginTop: '.4rem' }} placeholder="Especifica el cargo" value={cargoOtro} onChange={(e) => setCargoOtro(e.target.value)} />
        )}

        <label style={{ marginTop: '.6rem' }}>Período de certificación</label>
        <select value={periodoId} onChange={(e) => setPeriodoId(e.target.value)}>
          <option value="">— Elige un período —</option>
          {periodos.map((p) => (
            <option value={p.id} key={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>

        {periodoElegido && (
          <>
            <label style={{ marginTop: '.6rem' }}>Fecha del certificado</label>
            <input
              type="date"
              min={periodoElegido.fecha_inicio}
              max={periodoElegido.fecha_cierre}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
            <p className="sub" style={{ margin: '.3rem 0 0', fontSize: '.78rem' }}>
              Debe estar entre {new Date(periodoElegido.fecha_inicio + 'T00:00:00').toLocaleDateString('es-PE')} y{' '}
              {new Date(periodoElegido.fecha_cierre + 'T00:00:00').toLocaleDateString('es-PE')}, y ser un día hábil (sin
              fines de semana ni feriados). Se sugiere la fecha de entrega:{' '}
              {new Date(periodoElegido.fecha_entrega + 'T00:00:00').toLocaleDateString('es-PE')}.
            </p>
          </>
        )}

        <label style={{ marginTop: '.6rem' }}>Teléfono (opcional)</label>
        <input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        <p className="sub" style={{ margin: '.3rem 0 0', fontSize: '.78rem' }}>
          Este cliente siempre queda con cuenta de acceso al aula. Si el DNI ya tiene una cuenta, se reutiliza
          automáticamente y no se crea una nueva. Si no existe, se genera un correo <code>@ipadecp.com.pe</code> y una
          contraseña temporal que deberás entregarle al cliente.
        </p>

        <button className="btn bloque" style={{ marginTop: '1.2rem' }} type="submit" disabled={emitiendo}>
          {emitiendo ? 'Emitiendo…' : 'Emitir certificado'}
        </button>
      </form>

      {resultado && (
        <div className="aviso ok" style={{ marginTop: '1.2rem' }}>
          <p style={{ margin: 0 }}>
            <strong>Certificado emitido</strong> para {cursoNombreSel || 'el curso seleccionado'}.
          </p>
          {resultado.passwordTemporal && (
            <p style={{ margin: '.5rem 0' }}>
              Cuenta creada: <code>{resultado.email}</code> / contraseña temporal: <code>{resultado.passwordTemporal}</code>
              <br />
              <span className="sub" style={{ fontSize: '.78rem' }}>
                Entrégale estos datos al cliente ahora; no se volverán a mostrar.
              </span>
            </p>
          )}
          {resultado.yaExistia && resultado.email && (
            <p style={{ margin: '.5rem 0' }}>
              Se vinculó a la cuenta existente: <code>{resultado.email}</code>
            </p>
          )}
          <div className="fila" style={{ marginTop: '.6rem' }}>
            <button
              className="btn sec"
              type="button"
              onClick={() =>
                generarCertificadoPDF({
                  codigo: resultado.row.codigo_verificacion,
                  alumnoNombre: resultado.row.nombre_completo || '—',
                  cursoNombre: cursoNombreSel,
                  fecha: new Date(resultado.row.fecha).toLocaleDateString('es-PE'),
                  cargo: resultado.row.cargo || undefined,
                  periodoInicio: periodoElegido ? new Date(periodoElegido.fecha_inicio + 'T00:00:00').toLocaleDateString('es-PE') : undefined,
                  periodoEntrega: periodoElegido ? new Date(periodoElegido.fecha_entrega + 'T00:00:00').toLocaleDateString('es-PE') : undefined,
                  periodoCierre: periodoElegido ? new Date(periodoElegido.fecha_cierre + 'T00:00:00').toLocaleDateString('es-PE') : undefined,
                })
              }
            >
              Descargar certificado digital (PDF)
            </button>
            <button
              className="btn sec"
              type="button"
              onClick={() =>
                generarCertificadoImprimirPDF({
                  codigo: resultado.row.codigo_verificacion,
                  alumnoNombre: resultado.row.nombre_completo || '—',
                  cursoNombre: cursoNombreSel,
                  fecha: new Date(resultado.row.fecha).toLocaleDateString('es-PE'),
                  cargo: resultado.row.cargo || undefined,
                  dni: resultado.row.dni || undefined,
                  periodoInicio: periodoElegido ? new Date(periodoElegido.fecha_inicio + 'T00:00:00').toLocaleDateString('es-PE') : undefined,
                  periodoEntrega: periodoElegido ? new Date(periodoElegido.fecha_entrega + 'T00:00:00').toLocaleDateString('es-PE') : undefined,
                  periodoCierre: periodoElegido ? new Date(periodoElegido.fecha_cierre + 'T00:00:00').toLocaleDateString('es-PE') : undefined,
                })
              }
            >
              Descargar certificado para imprimir (PDF)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
