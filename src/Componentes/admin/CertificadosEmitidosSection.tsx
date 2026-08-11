'use client';

import { useMemo, useState } from 'react';
import JSZip from 'jszip';
import { Download, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { abrirPdfCertificado, descargarPdfCertificado, esBlobUrl, nombreArchivoCertificado, respaldarCertificadoEnDrive } from '@/lib/certificado';
import { obtenerCargosProfesionales, type CargoProfesional } from '@/lib/cargos';
import { enviarCorreoConCertificado, correoCertificadoHtml } from '@/lib/email';
import { descargarBlobComoArchivo } from '@/lib/importarCertificados';
import { obtenerPeriodosCertificacion, type Periodo } from '@/lib/periodos';
import { enLotes, traerTodo } from '@/lib/supabase/consultas';
import { useCursosAdmin } from './useCursosAdmin';
import DataTable from '@/Componentes/ui/DataTable';
import Modal from '@/Componentes/ui/Modal';
import EditarCertificadoModal, { type EdicionCertificado } from './EditarCertificadoModal';
import AnularCertificadoModal from './AnularCertificadoModal';
import { restaurarCertificado } from '@/lib/certificadosDirectos';
import Aviso from '@/Componentes/ui/Aviso';
import ProgresoEmision from './ProgresoEmision';
import EstadoCarga from './EstadoCarga';
import { useCargaDatos, datosDe } from './useCargaDatos';

interface CertificadoDirectoRow {
  id: number;
  estado: string;
  anulado_en: string | null;
  motivo_anulacion: string | null;
  curso_id: number;
  dni: string | null;
  nombre_completo: string | null;
  cargo: string | null;
  fecha: string;
  creado_en: string;
  alumno_uid: string | null;
  codigo_verificacion: string;
  periodo_id: number | null;
  registro: string | null;
  libro: string | null;
  creditos: string | null;
  meses: string | null;
  horas_lectivas: string | null;
  drive_digital_url: string | null;
  drive_imprimir_url: string | null;
  historial_ediciones: EdicionCertificado[] | null;
}

interface PerfilContacto {
  email: string | null;
  correo_contacto: string | null;
}

function saneaNombreArchivo(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '').trim() || 'sin-nombre';
}

function esCorreoInstitucional(email: string | null): boolean {
  return !!email && email.toLowerCase().endsWith('@ipadecp.com.pe');
}

export default function CertificadosEmitidosSection() {
  const { cursos } = useCursosAdmin();
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [cargos, setCargos] = useState<CargoProfesional[]>([]);
  const [certificados, setCertificados] = useState<CertificadoDirectoRow[] | null>(null);
  const [perfiles, setPerfiles] = useState<Map<string, PerfilContacto>>(new Map());

  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [creadoDesde, setCreadoDesde] = useState('');
  const [creadoHasta, setCreadoHasta] = useState('');
  const [cursoFiltro, setCursoFiltro] = useState('');
  const [cargoFiltro, setCargoFiltro] = useState('');
  const [periodoFiltro, setPeriodoFiltro] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [generandoZip, setGenerandoZip] = useState(false);
  const [progresoZip, setProgresoZip] = useState<{ actual: number; total: number } | null>(null);

  const [editarLibroPara, setEditarLibroPara] = useState<CertificadoDirectoRow | null>(null);
  const [anularPara, setAnularPara] = useState<CertificadoDirectoRow | null>(null);
  const [restaurando, setRestaurando] = useState<number | null>(null);
  const [pedirCorreoPara, setPedirCorreoPara] = useState<CertificadoDirectoRow | null>(null);
  const [correoManual, setCorreoManual] = useState('');
  const [enviando, setEnviando] = useState<number | null>(null);
  const [envioLote, setEnvioLote] = useState<{ actual: number; total: number } | null>(null);
  const [reporteEnvio, setReporteEnvio] = useState<{ nombre: string; ok: boolean; motivo?: string }[] | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);

  const {
    error: errorCarga,
    cargando,
    recargar: cargarCertificados,
  } = useCargaDatos(async () => {
    const [filas, periodosData, cargosData] = await Promise.all([
      // Paginado, no un `select` suelto: PostgREST corta en 1000 filas sin avisar,
      // así que a partir del certificado 1001 los más antiguos desaparecían de la
      // lista, de los filtros y de "seleccionar todos los filtrados" — en silencio.
      traerTodo<CertificadoDirectoRow>(() =>
        supabase
          .from('certificados')
          .select(
            'id,estado,anulado_en,motivo_anulacion,curso_id,dni,nombre_completo,cargo,fecha,creado_en,alumno_uid,codigo_verificacion,periodo_id,registro,libro,creditos,meses,horas_lectivas,drive_digital_url,drive_imprimir_url,historial_ediciones'
          )
          .eq('modalidad', 'directo')
          .order('fecha', { ascending: false })
          .order('id', { ascending: false })
      ),
      obtenerPeriodosCertificacion(),
      obtenerCargosProfesionales(),
    ]);
    setCertificados(filas);
    setPeriodos(periodosData);
    setCargos(cargosData);

    const uids = Array.from(new Set(filas.map((f) => f.alumno_uid).filter((x): x is string => !!x)));
    if (uids.length) {
      // Por lotes: un `.in()` con cientos de uids viaja en la query string y a
      // partir de cierto tamaño el servidor responde 414, que acá se veía como
      // "ningún cliente tiene correo" en vez de como un error.
      const perfilesData = await enLotes(uids, 200, (lote) =>
        datosDe<{ id: string; email: string | null; correo_contacto: string | null }>(
          supabase.from('perfiles').select('id,email,correo_contacto').in('id', lote)
        )
      );
      setPerfiles(new Map(perfilesData.map((p) => [p.id, { email: p.email, correo_contacto: p.correo_contacto }])));
    } else {
      setPerfiles(new Map());
    }
    return filas;
  });

  const cursoNombre = (id: number) => cursos.find((c) => c.id === id)?.nombre || `Curso #${id}`;

  function correoDe(row: CertificadoDirectoRow): string | null {
    const perfil = row.alumno_uid ? perfiles.get(row.alumno_uid) : undefined;
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
      const creado = c.creado_en.slice(0, 10);
      if (desde && fecha < desde) return false;
      if (hasta && fecha > hasta) return false;
      if (creadoDesde && creado < creadoDesde) return false;
      if (creadoHasta && creado > creadoHasta) return false;
      if (cursoFiltro && String(c.curso_id) !== cursoFiltro) return false;
      if (cargoFiltro && c.cargo !== cargoFiltro) return false;
      if (periodoFiltro && String(c.periodo_id) !== periodoFiltro) return false;
      if (texto && !`${c.nombre_completo || ''} ${c.dni || ''}`.toLowerCase().includes(texto)) return false;
      return true;
    });
  }, [certificados, desde, hasta, creadoDesde, creadoHasta, cursoFiltro, cargoFiltro, periodoFiltro, busqueda]);

  const hayFiltros = !!desde || !!hasta || !!creadoDesde || !!creadoHasta || !!cursoFiltro || !!cargoFiltro || !!periodoFiltro || !!busqueda.trim();

  function limpiarFiltros() {
    setDesde('');
    setHasta('');
    setCreadoDesde('');
    setCreadoHasta('');
    setCursoFiltro('');
    setCargoFiltro('');
    setPeriodoFiltro('');
    setBusqueda('');
  }

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

  /**
   * Abre el certificado desde la propia app: el PDF lo arma el servidor con los datos
   * de la base, así que siempre refleja el estado actual (si corriges el registro o
   * cambias el diseño, el link ya muestra la versión buena). El respaldo en Drive se
   * dispara en paralelo y no se espera — si falla, el certificado igual se abre.
   */
  async function abrirCertificado(row: CertificadoDirectoRow, tipo: 'digital' | 'imprimir') {
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

  async function restaurar(row: CertificadoDirectoRow) {
    setRestaurando(row.id);
    setAviso(null);
    const res = await restaurarCertificado(row.id);
    setRestaurando(null);
    if (!res.ok) {
      setAviso({ texto: res.motivo || 'No se pudo restaurar el certificado.', tipo: 'err' });
      return;
    }
    setCertificados((prev) =>
      (prev || []).map((c) => (c.id === row.id ? { ...c, estado: 'emitido', anulado_en: null, motivo_anulacion: null } : c))
    );
    setAviso({ texto: `El certificado de ${row.nombre_completo || 'este cliente'} vuelve a estar vigente.`, tipo: 'ok' });
  }

  async function descargarSeleccionadosZip() {
    const filas = (certificados || []).filter((c) => seleccionados.has(c.id));
    if (!filas.length) return;
    setGenerandoZip(true);
    setAviso(null);
    setProgresoZip({ actual: 0, total: filas.length });
    // Un fallo suelto no puede tumbar el lote entero: se anota y el .zip sale con
    // el resto. Antes la excepción se propagaba y el admin solo veía el botón
    // volver a su estado normal, sin archivo y sin explicación.
    const fallidos: string[] = [];
    try {
      const zip = new JSZip();
      for (const [i, fila] of filas.entries()) {
        setProgresoZip({ actual: i + 1, total: filas.length });
        const cliente = saneaNombreArchivo(fila.nombre_completo || 'Cliente');
        try {
          // El PDF oficial lo arma el servidor: es el mismo archivo que abre el QR.
          // Renderizarlo de nuevo acá daba un PDF distinto — el servidor prefiere el
          // nombre del perfil sobre el tecleado al emitir y fija la fecha a hora de Lima.
          const blob = await descargarPdfCertificado(fila.codigo_verificacion, 'imprimir');
          const fechaTermino = new Date(fila.fecha).toLocaleDateString('es-PE').replace(/\//g, '-');
          const nombreArchivo = `${saneaNombreArchivo(cursoNombre(fila.curso_id))}_${cliente}_${fechaTermino}.pdf`;
          zip.folder(cliente)!.file(nombreArchivo, blob);
        } catch {
          fallidos.push(`${fila.nombre_completo || cliente} — ${cursoNombre(fila.curso_id)}`);
        }
      }
      if (fallidos.length === filas.length) {
        setAviso({ texto: 'No se pudo obtener ninguno de los certificados seleccionados. Inténtalo de nuevo.', tipo: 'err' });
        return;
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      descargarBlobComoArchivo(zipBlob, `certificados-para-imprimir-${new Date().toISOString().slice(0, 10)}.zip`);
      if (fallidos.length) {
        setAviso({
          texto: `El .zip salió con ${filas.length - fallidos.length} de ${filas.length} certificados. No se pudieron obtener: ${fallidos.join(' · ')}.`,
          tipo: 'err',
        });
      }
    } finally {
      setGenerandoZip(false);
      setProgresoZip(null);
    }
  }

  async function enviarPorCorreo(row: CertificadoDirectoRow, destinatario: string) {
    setEnviando(row.id);
    setAviso(null);
    try {
      const blob = await descargarPdfCertificado(row.codigo_verificacion, 'digital');
      const res = await enviarCorreoConCertificado({
        destinatario,
        asunto: `Tu certificado de ${cursoNombre(row.curso_id)} — IPADECP`,
        cuerpoHtml: correoCertificadoHtml(row.nombre_completo || 'cliente', cursoNombre(row.curso_id), row.codigo_verificacion),
        archivoBlob: blob,
        nombreArchivo: nombreArchivoCertificado(row.codigo_verificacion),
      });
      setAviso(
        res.ok
          ? { texto: `Correo enviado a ${destinatario}.`, tipo: 'ok' }
          : { texto: res.motivo || 'No se pudo enviar el correo.', tipo: 'err' }
      );
    } catch (e) {
      setAviso({ texto: e instanceof Error ? e.message : 'No se pudo enviar el correo.', tipo: 'err' });
    } finally {
      setEnviando(null);
    }
  }

  async function alHacerClicEnviar(row: CertificadoDirectoRow) {
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
    if (pedirCorreoPara.alumno_uid) {
      await supabase.from('perfiles').update({ correo_contacto: correo }).eq('id', pedirCorreoPara.alumno_uid);
      setPerfiles((prev) => new Map(prev).set(pedirCorreoPara.alumno_uid!, { email: prev.get(pedirCorreoPara.alumno_uid!)?.email || null, correo_contacto: correo }));
    }
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
      const correo = correoDe(fila);
      if (!correo) {
        reporte.push({ nombre: fila.nombre_completo || '—', ok: false, motivo: 'Sin correo de contacto registrado.' });
        continue;
      }
      try {
        const blob = await descargarPdfCertificado(fila.codigo_verificacion, 'digital');
        const res = await enviarCorreoConCertificado({
          destinatario: correo,
          asunto: `Tu certificado de ${cursoNombre(fila.curso_id)} — IPADECP`,
          cuerpoHtml: correoCertificadoHtml(fila.nombre_completo || 'cliente', cursoNombre(fila.curso_id), fila.codigo_verificacion),
          archivoBlob: blob,
          nombreArchivo: nombreArchivoCertificado(fila.codigo_verificacion),
        });
        reporte.push({ nombre: fila.nombre_completo || '—', ok: res.ok, motivo: res.motivo });
      } catch (e) {
        // Un certificado que no se pudo obtener no corta el lote: se anota y sigue.
        reporte.push({ nombre: fila.nombre_completo || '—', ok: false, motivo: e instanceof Error ? e.message : 'No se pudo obtener el certificado.' });
      }
    }
    setEnvioLote(null);
    setReporteEnvio(reporte);
  }

  return (
    <>
      <h1 className="titulo">Certificados emitidos</h1>
      <p className="sub">
        Todos los certificados directos ya emitidos (individual o en lote). Cada fila muestra el cliente, el curso y la
        fecha con la que terminó.
      </p>

      {/* Todos los filtros en una sola fila que envuelve sola si no entran.
          Antes eran dos bloques separados por un borde más un párrafo de
          ayuda, y el contenedor se comía tres franjas de alto antes de que
          empezara la tabla. Los rangos de fecha van pegados en pares para que
          se lean como un rango y no como cuatro campos sueltos; la
          explicación de "creación" pasó a `title`. */}
      <div className="card card-pad filtros" style={{ marginBottom: '1rem' }}>
        <div>
          <label className="campo-label">Certificado — desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={{ width: 140 }} />
        </div>
        <div>
          <label className="campo-label">hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={{ width: 140 }} />
        </div>
        <div>
          <label className="campo-label">Curso</label>
          <select value={cursoFiltro} onChange={(e) => setCursoFiltro(e.target.value)} style={{ width: 180 }}>
            <option value="">Todos</option>
            {cursos.map((c) => (
              <option value={c.id} key={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="campo-label">Cargo</label>
          <select value={cargoFiltro} onChange={(e) => setCargoFiltro(e.target.value)} style={{ width: 150 }}>
            <option value="">Todos</option>
            {cargos.map((c) => (
              <option value={c.nombre} key={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="campo-label">Período</label>
          <select value={periodoFiltro} onChange={(e) => setPeriodoFiltro(e.target.value)} style={{ width: 150 }}>
            <option value="">Todos</option>
            {periodos.map((p) => (
              <option value={p.id} key={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div title="Fecha interna: cuándo se generó el certificado en el sistema. Úsala para encontrar todo lo que subiste en un mismo lote, sin importar la fecha del certificado.">
          <label className="campo-label">Creación — desde</label>
          <input type="date" value={creadoDesde} onChange={(e) => setCreadoDesde(e.target.value)} style={{ width: 140 }} />
        </div>
        <div title="Fecha interna: cuándo se generó el certificado en el sistema.">
          <label className="campo-label">hasta</label>
          <input type="date" value={creadoHasta} onChange={(e) => setCreadoHasta(e.target.value)} style={{ width: 140 }} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label className="campo-label">Buscar por nombre o DNI</label>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Ej. Juan Pérez o 12345678" />
        </div>
      </div>

      {seleccionados.size > 0 && (
        <div className="barra-seleccion">
          <span className="barra-seleccion-info">
            <span>
              <b>{seleccionados.size}</b> {seleccionados.size === 1 ? 'certificado seleccionado' : 'certificados seleccionados'}
            </span>
            <button type="button" className="barra-seleccion-limpiar" onClick={() => setSeleccionados(new Set())}>
              Quitar selección
            </button>
          </span>
          <span className="barra-seleccion-acciones">
            {/* Una sola acción primaria: descargar el .zip es lo que se hace
                en el 90% de los casos. Enviar por correo queda en secundario
                — antes los tres botones pesaban igual y no guiaban a nada. */}
            <button className="btn btn-sm" type="button" onClick={descargarSeleccionadosZip} disabled={generandoZip}>
              <Download size={14} /> {generandoZip ? 'Generando .zip…' : 'Descargar .zip'}
            </button>
            <button className="btn sec btn-sm" type="button" onClick={enviarCorreoSeleccionados} disabled={!!envioLote}>
              <Mail size={14} /> {envioLote ? `Enviando ${envioLote.actual}/${envioLote.total}…` : 'Enviar por correo'}
            </button>
          </span>
        </div>
      )}

      {/* Con decenas de certificados el .zip y el envío tardan bastante y el
          único indicio era el texto del botón, que no anuncia nada a un lector
          de pantalla ni dice cuánto falta. */}
      {progresoZip && <ProgresoEmision actual={progresoZip.actual} total={progresoZip.total} accion="Preparando" />}
      {envioLote && <ProgresoEmision actual={envioLote.actual} total={envioLote.total} accion="Enviando" />}

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

      <EstadoCarga cargando={cargando} error={errorCarga} onReintentar={cargarCertificados} cols={10}>
        <DataTable
          columns={[
            {
              key: 'sel',
              header: '',
              render: (f) => (
                <span className="chk-fila">
                  {/* Un anulado no se descarga ni se envía: seleccionarlo solo produciría
                      un fallo dentro del lote. */}
                  <input
                    type="checkbox"
                    checked={seleccionados.has(f.id)}
                    disabled={f.estado === 'anulado'}
                    onChange={() => alternarSeleccion(f.id)}
                    aria-label={`Seleccionar el certificado de ${f.nombre_completo || 'este cliente'}`}
                  />
                </span>
              ),
            },
            { key: 'nombre_completo', header: 'Cliente', sortable: true },
            { key: 'dni', header: 'DNI' },
            { key: 'cargo', header: 'Cargo', render: (f) => f.cargo || '—' },
            { key: 'curso', header: 'Curso', render: (f) => cursoNombre(f.curso_id) },
            { key: 'fecha', header: 'Fecha del certificado', sortable: true, render: (f) => new Date(f.fecha).toLocaleDateString('es-PE') },
            { key: 'creado_en', header: 'Creado', sortable: true, render: (f) => new Date(f.creado_en).toLocaleString('es-PE') },
            {
              key: 'cuenta',
              header: 'Cuenta',
              render: (f) => (f.alumno_uid ? <span className="tag activo">Con acceso</span> : <span className="tag canjeado">Sin cuenta</span>),
            },
            {
              key: 'estado',
              header: 'Estado',
              render: (f) =>
                f.estado === 'anulado' ? (
                  <span className="tag anulado" title={f.motivo_anulacion || 'Sin motivo registrado'}>
                    Anulado
                  </span>
                ) : (
                  <span className="tag activo">Vigente</span>
                ),
            },
          ]}
          rows={filtrados}
          entidad={['certificado', 'certificados']}
          filtrosActivos={hayFiltros}
          onLimpiarFiltros={limpiarFiltros}
          vacio="Los certificados directos que emitas aparecerán aquí, listos para descargar o enviar por correo."
          encabezadoExtra={
            <label className="chk" style={{ margin: 0 }}>
              <input type="checkbox" checked={todosFiltradosSeleccionados} onChange={alternarSeleccionTodos} />
              Seleccionar todos los filtrados
            </label>
          }
          actions={(f) =>
            // Un certificado anulado no se abre, no se envía y no se renumera: lo único que
            // tiene sentido hacerle es devolverlo a vigente si la anulación fue un error.
            f.estado === 'anulado' ? (
              <button className="btn sec btn-sm" onClick={() => restaurar(f)} disabled={restaurando === f.id}>
                {restaurando === f.id ? 'Restaurando…' : 'Restaurar'}
              </button>
            ) : (
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
                {/* Corregir un dato mal puesto al emitir (la fecha, sobre todo).
                    El Registro N° y el Libro N° no entran acá: los asigna el
                    contador y el tomo se deriva del registro. */}
                <button className="btn sec btn-sm" onClick={() => setEditarLibroPara(f)}>
                  Editar
                </button>
                <button className="btn sec btn-sm" onClick={() => setAnularPara(f)}>
                  Anular
                </button>
              </>
            )
          }
        />
      </EstadoCarga>

      <AnularCertificadoModal
        fila={anularPara ? { ...anularPara, cursoNombre: cursoNombre(anularPara.curso_id) } : null}
        onClose={() => setAnularPara(null)}
        onAnulado={(id) => {
          const fila = anularPara;
          setAnularPara(null);
          setCertificados((prev) => (prev || []).map((c) => (c.id === id ? { ...c, estado: 'anulado' } : c)));
          setAviso({
            texto: `Certificado de ${fila?.nombre_completo || 'el cliente'} anulado. Quien consulte su código verá que ya no es válido.`,
            tipo: 'ok',
          });
          // Se recarga para traer anulado_en y el motivo tal como quedaron en la BD.
          cargarCertificados();
        }}
      />

      <EditarCertificadoModal
        fila={editarLibroPara ? { ...editarLibroPara, modalidad: 'directo' } : null}
        periodos={periodos}
        cargos={cargos}
        onClose={() => setEditarLibroPara(null)}
        onGuardado={(actualizada) => setCertificados((prev) => (prev || []).map((c) => (c.id === actualizada.id ? { ...c, ...actualizada } : c)))}
      />

      <Modal open={!!pedirCorreoPara} title="Correo del cliente" onClose={() => setPedirCorreoPara(null)}>
        <p className="sub" style={{ marginTop: 0 }}>
          {pedirCorreoPara?.nombre_completo || 'Este cliente'} no tiene un correo de contacto registrado. Ingrésalo para
          poder enviarle el certificado (se guardará para la próxima vez).
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
