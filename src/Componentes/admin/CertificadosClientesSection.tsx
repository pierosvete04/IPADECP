'use client';

import { useMemo, useState } from 'react';
import JSZip from 'jszip';
import { supabase } from '@/lib/supabase/client';
import {
  abrirPdfCertificado,
  descargarPdfCertificado,
  esBlobUrl,
  nombreArchivoCertificado,
  regenerarCertificadoEnDrive,
  respaldarCertificadoEnDrive,
  type TipoPlantilla,
} from '@/lib/certificado';
import { enviarCorreoConCertificado, correoCertificadoHtml } from '@/lib/email';
import { descargarBlobComoArchivo } from '@/lib/importarCertificados';
import { useCursosAdmin } from './useCursosAdmin';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';
import EditarCertificadoModal, { type EdicionCertificado } from './EditarCertificadoModal';
// Los cargos alimentan el selector del modal de edición. Los períodos no hacen
// falta: un certificado 'evaluado' no pertenece a ninguno (su fecha es el día en
// que el alumno terminó el curso), así que el modal no muestra ese campo.
import { obtenerCargosProfesionales, type CargoProfesional } from '@/lib/cargos';
import Aviso from '@/Componentes/ui/Aviso';
import EstadoCarga from './EstadoCarga';
import { useCargaDatos, datosDe } from './useCargaDatos';

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
  // Se sellan al corregir el certificado a mano. Nacen nulos: un certificado web
  // toma el nombre del perfil salvo que alguien lo congele desde "Editar".
  nombre_completo: string | null;
  dni: string | null;
  cargo: string | null;
  periodo_id: number | null;
  historial_ediciones: EdicionCertificado[] | null;
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
  const [cargos, setCargos] = useState<CargoProfesional[]>([]);

  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [cursoFiltro, setCursoFiltro] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [generandoZip, setGenerandoZip] = useState(false);

  const [editarLibroPara, setEditarLibroPara] = useState<CertificadoClienteRow | null>(null);
  const [pedirCorreoPara, setPedirCorreoPara] = useState<CertificadoClienteRow | null>(null);
  const [correoManual, setCorreoManual] = useState('');
  const [enviando, setEnviando] = useState<number | null>(null);
  const [regenerando, setRegenerando] = useState<number | null>(null);
  const [regenLote, setRegenLote] = useState<{ actual: number; total: number } | null>(null);
  const [envioLote, setEnvioLote] = useState<{ actual: number; total: number } | null>(null);
  const [reporteEnvio, setReporteEnvio] = useState<{ nombre: string; ok: boolean; motivo?: string }[] | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);

  const {
    error: errorCarga,
    cargando,
    recargar: cargarCertificados,
  } = useCargaDatos(async () => {
    const filas = await datosDe<CertificadoClienteRow>(
      supabase
        .from('certificados')
        .select(
          'id,curso_id,alumno_uid,nota,fecha,creado_en,codigo_verificacion,registro,libro,creditos,meses,horas_lectivas,drive_digital_url,drive_imprimir_url,nombre_completo,dni,cargo,periodo_id,historial_ediciones'
        )
        .eq('modalidad', 'evaluado')
        .order('fecha', { ascending: false })
    );
    setCertificados(filas);
    setCargos(await obtenerCargosProfesionales());

    const uids = Array.from(new Set(filas.map((f) => f.alumno_uid).filter(Boolean)));
    if (uids.length) {
      const perfilesData = await datosDe<PerfilCliente & { id: string }>(
        supabase.from('perfiles').select('id,nombre,documento,email,correo_contacto').in('id', uids)
      );
      setPerfiles(new Map(perfilesData.map((p) => [p.id, p as PerfilCliente])));
    } else {
      setPerfiles(new Map());
    }
    return filas;
  });

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

  /** Abre el PDF que sirve la propia app (armado en el servidor desde la BD). Drive queda
   * como respaldo y se dispara en paralelo sin bloquear ni romper si falla. */
  async function abrirCertificado(row: CertificadoClienteRow, tipo: 'digital' | 'imprimir') {
    respaldarCertificadoEnDrive(tipo, row.id, tipo === 'digital' ? row.drive_digital_url : row.drive_imprimir_url);
    // La digital es pública y se abre directo. La de imprimir lleva el DNI y exige sesión, así
    // que se trae con fetch autenticado y se abre como blob — `window.open` no manda cabeceras.
    try {
      const url = await abrirPdfCertificado(row.codigo_verificacion, tipo);
      window.open(url, '_blank');
      if (esBlobUrl(url)) setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setAviso({ texto: e instanceof Error ? e.message : 'No se pudo abrir el certificado.', tipo: 'err' });
    }
  }

  /**
   * Pone al día la copia de Drive tras un cambio de diseño.
   *
   * Solo Drive: lo que la app entrega (el QR, "Digital", "Para imprimir", el .zip y el adjunto del
   * correo) se arma en cada descarga resolviendo la plantilla vigente, así que un diseño nuevo ya
   * se ve ahí sin tocar nada. La copia de Drive, en cambio, se subió una vez y se queda con el
   * diseño de ese día — este botón la regenera pisando el archivo, sin cambiar su link.
   *
   * Regenera los dos tipos: el admin cambió el diseño, no "el diseño digital".
   */
  async function regenerarCertificado(row: CertificadoClienteRow): Promise<string | null> {
    const tipos: TipoPlantilla[] = ['digital', 'imprimir'];
    const urls: Partial<Record<TipoPlantilla, string>> = {};
    for (const tipo of tipos) {
      // Un certificado que nunca llegó a Drive no tiene nada que actualizar; se sube por
      // primera vez con `respaldar...` y no se reporta como fallo.
      const existente = tipo === 'digital' ? row.drive_digital_url : row.drive_imprimir_url;
      if (!existente) {
        respaldarCertificadoEnDrive(tipo, row.id, existente);
        continue;
      }
      urls[tipo] = await regenerarCertificadoEnDrive(tipo, row.id);
    }
    setCertificados((prev) =>
      (prev || []).map((c) =>
        c.id === row.id
          ? { ...c, drive_digital_url: urls.digital ?? c.drive_digital_url, drive_imprimir_url: urls.imprimir ?? c.drive_imprimir_url }
          : c
      )
    );
    return null;
  }

  async function alHacerClicRegenerar(row: CertificadoClienteRow) {
    setRegenerando(row.id);
    setAviso(null);
    try {
      await regenerarCertificado(row);
      setAviso({ texto: 'Certificado regenerado con el diseño vigente.', tipo: 'ok' });
    } catch (e) {
      setAviso({ texto: e instanceof Error ? e.message : 'No se pudo regenerar el certificado.', tipo: 'err' });
    } finally {
      setRegenerando(null);
    }
  }

  async function regenerarSeleccionados() {
    const filas = (certificados || []).filter((c) => seleccionados.has(c.id));
    if (!filas.length) return;
    setAviso(null);
    setRegenLote({ actual: 0, total: filas.length });
    const fallidos: string[] = [];
    for (let i = 0; i < filas.length; i++) {
      setRegenLote({ actual: i + 1, total: filas.length });
      try {
        await regenerarCertificado(filas[i]);
      } catch (e) {
        fallidos.push(`${perfilDe(filas[i].alumno_uid)?.nombre || '—'}: ${e instanceof Error ? e.message : 'error'}`);
      }
    }
    setRegenLote(null);
    setAviso(
      fallidos.length
        ? { texto: `Se regeneraron ${filas.length - fallidos.length} de ${filas.length}. Fallaron: ${fallidos.join(' · ')}`, tipo: 'err' }
        : { texto: `${filas.length} certificados regenerados con el diseño vigente.`, tipo: 'ok' }
    );
  }

  async function descargarSeleccionadosZip() {
    const filas = (certificados || []).filter((c) => seleccionados.has(c.id));
    if (!filas.length) return;
    setGenerandoZip(true);
    try {
      const zip = new JSZip();
      for (const fila of filas) {
        // El PDF oficial lo arma el servidor. Volver a renderizarlo acá producía un
        // archivo distinto al que verifica el QR (otro nombre, a veces otro día).
        const blob = await descargarPdfCertificado(fila.codigo_verificacion, 'imprimir');
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
      const blob = await descargarPdfCertificado(row.codigo_verificacion, 'digital');
      const res = await enviarCorreoConCertificado({
        destinatario,
        asunto: `Tu certificado de ${cursoNombre(row.curso_id)} — IPADECP`,
        cuerpoHtml: correoCertificadoHtml(nombre, cursoNombre(row.curso_id), row.codigo_verificacion),
        archivoBlob: blob,
        nombreArchivo: nombreArchivoCertificado(row.codigo_verificacion),
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
      const blob = await descargarPdfCertificado(fila.codigo_verificacion, 'digital');
      const res = await enviarCorreoConCertificado({
        destinatario: correo,
        asunto: `Tu certificado de ${cursoNombre(fila.curso_id)} — IPADECP`,
        cuerpoHtml: correoCertificadoHtml(nombre, cursoNombre(fila.curso_id), fila.codigo_verificacion),
        archivoBlob: blob,
        nombreArchivo: nombreArchivoCertificado(fila.codigo_verificacion),
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

      <div className="card card-pad separado">
        <div className="filtros">
          <div>
            <label className="campo-label">Fecha del certificado — desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="campo-corto" />
          </div>
          <div>
            <label className="campo-label">Fecha del certificado — hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="campo-corto" />
          </div>
          <div>
            <label className="campo-label">Curso</label>
            <select value={cursoFiltro} onChange={(e) => setCursoFiltro(e.target.value)} className="campo-ancho">
              <option value="">Todos</option>
              {cursos.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="campo-fluido">
            <label className="campo-label">Buscar por nombre o DNI</label>
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
          <button className="btn sec" type="button" onClick={regenerarSeleccionados} disabled={!!regenLote}>
            {regenLote ? `Regenerando ${regenLote.actual} de ${regenLote.total}…` : 'Actualizar diseño de los seleccionados'}
          </button>
          <button className="btn sec" type="button" onClick={() => setSeleccionados(new Set())}>
            Quitar selección
          </button>
        </div>
      )}

      <Aviso tipo={aviso?.tipo ?? 'err'} mensaje={aviso?.texto} />

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

      <EstadoCarga cargando={cargando} error={errorCarga} onReintentar={cargarCertificados} cols={8}>
        <DataTable
          entidad={['certificado', 'certificados']}
          columns={[
            {
              key: 'sel',
              header: '',
              render: (f) => (
                <span className="chk-fila">
                  <input
                    type="checkbox"
                    checked={seleccionados.has(f.id)}
                    onChange={() => alternarSeleccion(f.id)}
                    aria-label={`Seleccionar el certificado de ${perfilDe(f.alumno_uid)?.nombre || 'este cliente'}`}
                  />
                </span>
              ),
            },
            { key: 'cliente', header: 'Cliente', render: (f) => perfilDe(f.alumno_uid)?.nombre || '—' },
            { key: 'dni', header: 'DNI', render: (f) => perfilDe(f.alumno_uid)?.documento || '—' },
            { key: 'curso', header: 'Curso', render: (f) => cursoNombre(f.curso_id) },
            { key: 'nota', header: 'Nota', align: 'right', render: (f) => (f.nota != null ? f.nota : '—') },
            { key: 'fecha', header: 'Fecha del certificado', sortable: true, render: (f) => new Date(f.fecha).toLocaleDateString('es-PE') },
            { key: 'creado_en', header: 'Creado', sortable: true, render: (f) => new Date(f.creado_en).toLocaleString('es-PE') },
          ]}
          rows={filtrados}
          filtrosActivos={!!busqueda.trim() || !!desde || !!hasta || !!cursoFiltro}
          onLimpiarFiltros={() => {
            setBusqueda('');
            setDesde('');
            setHasta('');
            setCursoFiltro('');
          }}
          vacio="Aquí caen solos los certificados de quienes terminan un curso online. Todavía no ha terminado nadie."
          encabezadoExtra={
            <label className="chk" style={{ margin: 0 }}>
              <input type="checkbox" checked={todosFiltradosSeleccionados} onChange={alternarSeleccionTodos} />
              Seleccionar todos los filtrados
            </label>
          }
          actions={(f) => (
            <>
              <button className="btn sec btn-sm" onClick={() => abrirCertificado(f, 'digital')}>
                Digital
              </button>
              <button className="btn sec btn-sm" onClick={() => abrirCertificado(f, 'imprimir')}>
                Para imprimir
              </button>
              <button className="btn sec btn-sm" onClick={() => alHacerClicEnviar(f)} disabled={enviando === f.id}>
                {enviando === f.id ? 'Enviando…' : 'Enviar por correo'}
              </button>
              <button className="btn sec btn-sm" onClick={() => setEditarLibroPara(f)}>
                Editar
              </button>
              <button
                className="btn sec btn-sm"
                onClick={() => alHacerClicRegenerar(f)}
                disabled={regenerando === f.id}
                title="Vuelve a generar la copia de Drive con el diseño vigente. El PDF que descarga el cliente ya se actualiza solo."
              >
                {regenerando === f.id ? 'Regenerando…' : 'Actualizar diseño'}
              </button>
            </>
          )}
        />
      </EstadoCarga>

      <EditarCertificadoModal
        fila={editarLibroPara ? { ...editarLibroPara, modalidad: 'evaluado' } : null}
        periodos={[]}
        cargos={cargos}
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
