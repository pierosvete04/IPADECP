'use client';

import { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { supabase } from '@/lib/supabase/client';
import { asegurarCertificadoEnDrive, generarCertificadoBlob, obtenerAsignaturasParaCertificado, type CertificadoRenderData } from '@/lib/certificado';
import { enviarCorreoConCertificado, correoCertificadoHtml } from '@/lib/email';
import { descargarBlobComoArchivo } from '@/lib/importarCertificados';
import { useCursosAdmin } from './useCursosAdmin';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';
import EditarDatosLibroModal from './EditarDatosLibroModal';

// Certificados que salen SOLOS cuando un cliente que compró un curso online
// termina todas sus tareas/exámenes (modalidad 'evaluado', ver
// intentar_emitir_certificado()) — a propósito en una lista separada de
// "Certificados emitidos" (que solo muestra modalidad 'directo'): son dos
// operaciones distintas y mezclarlas hace más difícil ubicar cualquiera de
// las dos. Reutiliza los mismos principios que esa pantalla: ver
// digital/imprimir, enviar por correo, seleccionar varios y descargar/enviar
// en lote.
interface CertificadoClienteRow {
  id: number;
  curso_id: number;
  alumno_uid: string;
  nota: number | null;
  fecha: string;
  creado_en: string;
  codigo_verificacion: string;
  registro: string | null;
  libro: string | null;
  creditos: string | null;
  meses: string | null;
  horas_lectivas: string | null;
  drive_digital_url: string | null;
  drive_imprimir_url: string | null;
}

interface PerfilCliente {
  nombre: string | null;
  documento: string | null;
  email: string | null;
  correo_contacto: string | null;
}

function saneaNombreArchivo(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '').trim() || 'sin-nombre';
}

function esCorreoInstitucional(email: string | null): boolean {
  return !!email && email.toLowerCase().endsWith('@ipadecp.com.pe');
}

export default function CertificadosClientesSection() {
  const { cursos } = useCursosAdmin();
  const [certificados, setCertificados] = useState<CertificadoClienteRow[] | null>(null);
  const [perfiles, setPerfiles] = useState<Map<string, PerfilCliente>>(new Map());

  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [cursoFiltro, setCursoFiltro] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [abriendo, setAbriendo] = useState<string | null>(null);

  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [generandoZip, setGenerandoZip] = useState(false);

  const [editarLibroPara, setEditarLibroPara] = useState<CertificadoClienteRow | null>(null);
  const [pedirCorreoPara, setPedirCorreoPara] = useState<CertificadoClienteRow | null>(null);
  const [correoManual, setCorreoManual] = useState('');
  const [enviando, setEnviando] = useState<number | null>(null);
  const [envioLote, setEnvioLote] = useState<{ actual: number; total: number } | null>(null);
  const [reporteEnvio, setReporteEnvio] = useState<{ nombre: string; ok: boolean; motivo?: string }[] | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);

  async function cargarCertificados() {
    const { data } = await supabase
      .from('certificados')
      .select('id,curso_id,alumno_uid,nota,fecha,creado_en,codigo_verificacion,registro,libro,creditos,meses,horas_lectivas,drive_digital_url,drive_imprimir_url')
      .eq('modalidad', 'evaluado')
      .order('fecha', { ascending: false });
    const filas = (data as CertificadoClienteRow[]) || [];
    setCertificados(filas);

    const uids = Array.from(new Set(filas.map((f) => f.alumno_uid).filter(Boolean)));
    if (uids.length) {
      const { data: perfilesData } = await supabase.from('perfiles').select('id,nombre,documento,email,correo_contacto').in('id', uids);
      setPerfiles(new Map((perfilesData || []).map((p) => [p.id as string, p as PerfilCliente])));
    } else {
      setPerfiles(new Map());
    }
  }
  useEffect(() => {
    cargarCertificados();
  }, []);

  const cursoNombre = (id: number) => cursos.find((c) => c.id === id)?.nombre || `Curso #${id}`;
  const perfilDe = (uid: string) => perfiles.get(uid);

  function correoDe(row: CertificadoClienteRow): string | null {
    const perfil = perfilDe(row.alumno_uid);
    if (!perfil) return null;
    if (perfil.correo_contacto?.trim()) return perfil.correo_contacto.trim();
    if (perfil.email && !esCorreoInstitucional(perfil.email)) return perfil.email;
    return null;
  }

  const filtrados = useMemo(() => {
    if (!certificados) return [];
    const texto = busqueda.trim().toLowerCase();
    return certificados.filter((c) => {
      const fecha = c.fecha.slice(0, 10);
      const perfil = perfilDe(c.alumno_uid);
      if (desde && fecha < desde) return false;
      if (hasta && fecha > hasta) return false;
      if (cursoFiltro && String(c.curso_id) !== cursoFiltro) return false;
      if (texto && !`${perfil?.nombre || ''} ${perfil?.documento || ''}`.toLowerCase().includes(texto)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certificados, perfiles, desde, hasta, cursoFiltro, busqueda]);

  function alternarSeleccion(id: number) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const todosFiltradosSeleccionados = filtrados.length > 0 && filtrados.every((f) => seleccionados.has(f.id));

  function alternarSeleccionTodos() {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (todosFiltradosSeleccionados) filtrados.forEach((f) => next.delete(f.id));
      else filtrados.forEach((f) => next.add(f.id));
      return next;
    });
  }

  async function datosParaPdf(row: CertificadoClienteRow): Promise<CertificadoRenderData> {
    const perfil = perfilDe(row.alumno_uid);
    const asignaturas = await obtenerAsignaturasParaCertificado(row.curso_id, row.alumno_uid);
    return {
      codigo: row.codigo_verificacion,
      alumnoNombre: perfil?.nombre || '—',
      cursoNombre: cursoNombre(row.curso_id),
      fecha: new Date(row.fecha).toLocaleDateString('es-PE'),
      dni: perfil?.documento || undefined,
      cursoId: row.curso_id,
      modalidad: 'evaluado',
      registro: row.registro || undefined,
      libro: row.libro || undefined,
      creditos: row.creditos || undefined,
      meses: row.meses || undefined,
      horasLectivas: row.horas_lectivas || undefined,
      asignaturas: asignaturas.length ? asignaturas : undefined,
    };
  }

  /** Sube el certificado a Drive si aún no lo estaba (primera vez que se pide) y abre el link. */
  async function verEnDrive(row: CertificadoClienteRow, tipo: 'digital' | 'imprimir') {
    const clave = `${row.id}-${tipo}`;
    const urlExistente = tipo === 'digital' ? row.drive_digital_url : row.drive_imprimir_url;
    setAbriendo(clave);
    try {
      const url = await asegurarCertificadoEnDrive(await datosParaPdf(row), tipo, row.id, urlExistente);
      setCertificados((prev) =>
        (prev || []).map((c) => (c.id === row.id ? { ...c, [tipo === 'digital' ? 'drive_digital_url' : 'drive_imprimir_url']: url } : c))
      );
      window.open(url, '_blank');
    } catch (e) {
      setAviso({ texto: e instanceof Error ? e.message : 'No se pudo abrir el certificado.', tipo: 'err' });
    } finally {
      setAbriendo(null);
    }
  }

  async function descargarSeleccionadosZip() {
    const filas = (certificados || []).filter((c) => seleccionados.has(c.id));
    if (!filas.length) return;
    setGenerandoZip(true);
    try {
      const zip = new JSZip();
      for (const fila of filas) {
        const blob = await generarCertificadoBlob(await datosParaPdf(fila), 'imprimir');
        const cliente = saneaNombreArchivo(perfilDe(fila.alumno_uid)?.nombre || 'Cliente');
        const fechaTermino = new Date(fila.fecha).toLocaleDateString('es-PE').replace(/\//g, '-');
        const nombreArchivo = `${saneaNombreArchivo(cursoNombre(fila.curso_id))}_${cliente}_${fechaTermino}.pdf`;
        zip.folder(cliente)!.file(nombreArchivo, blob);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      descargarBlobComoArchivo(zipBlob, `certificados-clientes-${new Date().toISOString().slice(0, 10)}.zip`);
    } finally {
      setGenerandoZip(false);
    }
  }

  async function enviarPorCorreo(row: CertificadoClienteRow, destinatario: string) {
    setEnviando(row.id);
    setAviso(null);
    try {
      const nombre = perfilDe(row.alumno_uid)?.nombre || 'cliente';
      const blob = await generarCertificadoBlob(await datosParaPdf(row), 'digital');
      const res = await enviarCorreoConCertificado({
        destinatario,
        asunto: `Tu certificado de ${cursoNombre(row.curso_id)} — IPADECP`,
        cuerpoHtml: correoCertificadoHtml(nombre, cursoNombre(row.curso_id), row.codigo_verificacion),
        archivoBlob: blob,
        nombreArchivo: `certificado-${row.codigo_verificacion.slice(0, 8)}.pdf`,
      });
      setAviso(
        res.ok
          ? { texto: `Correo enviado a ${destinatario}.`, tipo: 'ok' }
          : { texto: res.motivo || 'No se pudo enviar el correo.', tipo: 'err' }
      );
    } finally {
      setEnviando(null);
    }
  }

  async function alHacerClicEnviar(row: CertificadoClienteRow) {
    const correo = correoDe(row);
    if (!correo) {
      setCorreoManual('');
      setPedirCorreoPara(row);
      return;
    }
    await enviarPorCorreo(row, correo);
  }

  async function confirmarCorreoManual() {
    if (!pedirCorreoPara) return;
    const correo = correoManual.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      setAviso({ texto: 'Ingresa un correo válido.', tipo: 'err' });
      return;
    }
    await supabase.from('perfiles').update({ correo_contacto: correo }).eq('id', pedirCorreoPara.alumno_uid);
    setPerfiles((prev) => {
      const next = new Map(prev);
      const actual = next.get(pedirCorreoPara.alumno_uid);
      next.set(pedirCorreoPara.alumno_uid, { nombre: actual?.nombre ?? null, documento: actual?.documento ?? null, email: actual?.email ?? null, correo_contacto: correo });
      return next;
    });
    const fila = pedirCorreoPara;
    setPedirCorreoPara(null);
    await enviarPorCorreo(fila, correo);
  }

  async function enviarCorreoSeleccionados() {
    const filas = (certificados || []).filter((c) => seleccionados.has(c.id));
    if (!filas.length) return;
    setReporteEnvio(null);
    setEnvioLote({ actual: 0, total: filas.length });
    const reporte: { nombre: string; ok: boolean; motivo?: string }[] = [];
    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];
      setEnvioLote({ actual: i + 1, total: filas.length });
      const nombre = perfilDe(fila.alumno_uid)?.nombre || '—';
      const correo = correoDe(fila);
      if (!correo) {
        reporte.push({ nombre, ok: false, motivo: 'Sin correo de contacto registrado.' });
        continue;
      }
      const blob = await generarCertificadoBlob(await datosParaPdf(fila), 'digital');
      const res = await enviarCorreoConCertificado({
        destinatario: correo,
        asunto: `Tu certificado de ${cursoNombre(fila.curso_id)} — IPADECP`,
        cuerpoHtml: correoCertificadoHtml(nombre, cursoNombre(fila.curso_id), fila.codigo_verificacion),
        archivoBlob: blob,
        nombreArchivo: `certificado-${fila.codigo_verificacion.slice(0, 8)}.pdf`,
      });
      reporte.push({ nombre, ok: res.ok, motivo: res.motivo });
    }
    setEnvioLote(null);
    setReporteEnvio(reporte);
  }

  return (
    <>
      <h1 className="titulo">Certificados de clientes</h1>
      <p className="sub">
        Certificados que se emiten solos cuando un cliente que compró un curso online termina todas sus tareas y
        exámenes. Van separados de <strong>Certificados emitidos</strong> (los que el equipo emite a mano) porque son
        dos operaciones distintas.
      </p>

      <div className="card card-pad" style={{ marginBottom: '1rem' }}>
        <div className="fila">
          <div>
            <label style={{ fontSize: '.8rem' }}>Fecha del certificado — desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={{ minWidth: 150 }} />
          </div>
          <div>
            <label style={{ fontSize: '.8rem' }}>Fecha del certificado — hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={{ minWidth: 150 }} />
          </div>
          <div>
            <label style={{ fontSize: '.8rem' }}>Curso</label>
            <select value={cursoFiltro} onChange={(e) => setCursoFiltro(e.target.value)} style={{ minWidth: 200 }}>
              <option value="">Todos</option>
              {cursos.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={{ fontSize: '.8rem' }}>Buscar por nombre o DNI</label>
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Ej. Juan Pérez o 12345678" />
          </div>
        </div>
      </div>

      {seleccionados.size > 0 && (
        <div className="card card-pad fila" style={{ marginBottom: '1rem', alignItems: 'center' }}>
          <span className="tag activo">{seleccionados.size} seleccionados</span>
          <button className="btn sec" type="button" onClick={descargarSeleccionadosZip} disabled={generandoZip}>
            {generandoZip ? 'Generando .zip…' : 'Descargar seleccionados para imprimir (.zip)'}
          </button>
          <button className="btn sec" type="button" onClick={enviarCorreoSeleccionados} disabled={!!envioLote}>
            {envioLote ? `Enviando ${envioLote.actual} de ${envioLote.total}…` : 'Enviar por correo a los seleccionados'}
          </button>
          <button className="btn sec" type="button" onClick={() => setSeleccionados(new Set())}>
            Quitar selección
          </button>
        </div>
      )}

      {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}

      {reporteEnvio && (
        <div className="card card-pad" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Resultado del envío</h3>
          <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
            {reporteEnvio.map((r, i) => (
              <li key={i}>
                {r.nombre}: {r.ok ? <span className="tag activo">Enviado</span> : <span className="tag anulado">{r.motivo}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {certificados === null ? (
        <p>Cargando…</p>
      ) : (
        <DataTable
          columns={[
            {
              key: 'sel',
              header: '',
              render: (f) => <input type="checkbox" checked={seleccionados.has(f.id)} onChange={() => alternarSeleccion(f.id)} />,
            },
            { key: 'cliente', header: 'Cliente', render: (f) => perfilDe(f.alumno_uid)?.nombre || '—' },
            { key: 'dni', header: 'DNI', render: (f) => perfilDe(f.alumno_uid)?.documento || '—' },
            { key: 'curso', header: 'Curso', render: (f) => cursoNombre(f.curso_id) },
            { key: 'nota', header: 'Nota', align: 'right', render: (f) => (f.nota != null ? f.nota : '—') },
            { key: 'fecha', header: 'Fecha del certificado', sortable: true, render: (f) => new Date(f.fecha).toLocaleDateString('es-PE') },
            { key: 'creado_en', header: 'Creado', sortable: true, render: (f) => new Date(f.creado_en).toLocaleString('es-PE') },
          ]}
          rows={filtrados}
          contador={`${filtrados.length} de ${certificados.length}`}
          vacio="Todavía no hay certificados emitidos por cursos online."
          encabezadoExtra={
            <label className="chk" style={{ margin: 0 }}>
              <input type="checkbox" checked={todosFiltradosSeleccionados} onChange={alternarSeleccionTodos} />
              Seleccionar todos los filtrados
            </label>
          }
          actions={(f) => (
            <>
              <button className="btn sec btn-sm" onClick={() => verEnDrive(f, 'digital')} disabled={abriendo === `${f.id}-digital`}>
                {abriendo === `${f.id}-digital` ? 'Abriendo…' : 'Digital'}
              </button>
              <button className="btn sec btn-sm" onClick={() => verEnDrive(f, 'imprimir')} disabled={abriendo === `${f.id}-imprimir`}>
                {abriendo === `${f.id}-imprimir` ? 'Abriendo…' : 'Para imprimir'}
              </button>
              <button className="btn sec btn-sm" onClick={() => alHacerClicEnviar(f)} disabled={enviando === f.id}>
                {enviando === f.id ? 'Enviando…' : 'Enviar por correo'}
              </button>
              <button className="btn sec btn-sm" onClick={() => setEditarLibroPara(f)}>
                Libro/registro
              </button>
            </>
          )}
        />
      )}

      <EditarDatosLibroModal
        fila={editarLibroPara}
        existentes={certificados || []}
        onClose={() => setEditarLibroPara(null)}
        onGuardado={(actualizada) => setCertificados((prev) => (prev || []).map((c) => (c.id === actualizada.id ? { ...c, ...actualizada } : c)))}
      />

      <Modal open={!!pedirCorreoPara} title="Correo del cliente" onClose={() => setPedirCorreoPara(null)}>
        <p className="sub" style={{ marginTop: 0 }}>
          {(pedirCorreoPara && perfilDe(pedirCorreoPara.alumno_uid)?.nombre) || 'Este cliente'} no tiene un correo de
          contacto registrado. Ingrésalo para poder enviarle el certificado (se guardará para la próxima vez).
        </p>
        <input
          type="email"
          value={correoManual}
          onChange={(e) => setCorreoManual(e.target.value)}
          placeholder="correo@ejemplo.com"
          autoFocus
        />
        <button className="btn bloque" onClick={confirmarCorreoManual}>
          Guardar y enviar
        </button>
      </Modal>
    </>
  );
}
