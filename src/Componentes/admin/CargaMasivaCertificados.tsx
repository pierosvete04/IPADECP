'use client';

import { useState } from 'react';
import type { CargoProfesional } from '@/lib/cargos';
import { emitirCertificadoDirecto } from '@/lib/certificadosDirectos';
import { asegurarCertificadoEnDrive, type CertificadoRenderData } from '@/lib/certificado';
import { formatSoles } from '@/lib/copy';
import type { EstadoPago, MetodoPago } from '@/lib/pedidos';
import {
  descargarTextoComoArchivo,
  generarPlantillaCSV,
  generarReporteCSV,
  parsearArchivoCertificados,
  registrarPedidosPorLote,
  validarFilas,
  type FilaValidada,
  type ResultadoFilaImportada,
} from '@/lib/importarCertificados';
import DataTable from '@/Componentes/ui/DataTable';
import FileDropzone from '@/Componentes/ui/FileDropzone';

interface Periodo {
  id: number;
  nombre: string;
  fecha_inicio: string;
  fecha_entrega: string;
  fecha_cierre: string;
}

export default function CargaMasivaCertificados({
  cursos,
  periodos,
  cargos,
}: {
  cursos: { id: number; nombre: string }[];
  periodos: Periodo[];
  cargos: CargoProfesional[];
}) {
  const [filas, setFilas] = useState<FilaValidada[] | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  const [progreso, setProgreso] = useState<{ actual: number; total: number } | null>(null);
  const [resultados, setResultados] = useState<ResultadoFilaImportada[] | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);
  const [metodo, setMetodo] = useState<MetodoPago>('pendiente');
  const [estadoPago, setEstadoPago] = useState<EstadoPago>('pagado');
  const [pedidosCreados, setPedidosCreados] = useState(0);
  // Certificados que se emitieron bien pero no llegaron a Drive. Se listan aparte porque el
  // certificado SÍ existe y es válido: lo único que falta es la copia en Drive, que se puede
  // reintentar después desde "Certificados emitidos" sin volver a emitir nada.
  const [driveFallidos, setDriveFallidos] = useState<{ dni: string; nombre: string; curso: string; motivo: string }[]>([]);

  const validas = (filas || []).filter((f) => f.errores.length === 0);
  const conError = (filas || []).filter((f) => f.errores.length > 0);

  async function manejarArchivo(file: File) {
    setAviso(null);
    setResultados(null);
    setFilas(null);
    setNombreArchivo(file.name);
    setProcesando(true);
    try {
      const crudas = await parsearArchivoCertificados(file);
      if (!crudas.length) {
        setAviso({ texto: 'El archivo no tiene filas de datos.', tipo: 'err' });
        return;
      }
      setFilas(validarFilas(crudas, cursos, cargos, periodos));
    } catch {
      setAviso({ texto: 'No se pudo leer el archivo. Verifica que sea un .csv o .xlsx válido.', tipo: 'err' });
    } finally {
      setProcesando(false);
    }
  }

  async function confirmarEmision() {
    if (!validas.length) return;
    setEmitiendo(true);
    setResultados(null);
    setPedidosCreados(0);
    setDriveFallidos([]);
    setProgreso({ actual: 0, total: validas.length });

    const salida: ResultadoFilaImportada[] = [];
    const fallosDrive: { dni: string; nombre: string; curso: string; motivo: string }[] = [];
    for (let i = 0; i < validas.length; i++) {
      const fila = validas[i];
      setProgreso({ actual: i + 1, total: validas.length });
      const res = await emitirCertificadoDirecto({
        cursoId: fila.cursoId!,
        periodoId: fila.periodoId!,
        fecha: fila.fechaFinal,
        dni: fila.dni,
        nombreCompleto: fila.nombre_completo.trim(),
        cargo: fila.cargoFinal,
        telefono: fila.telefono.trim() || undefined,
        correoContacto: fila.correo.trim() || undefined,
      });
      salida.push(
        res.ok
          ? { fila, estado: 'emitido', email: res.email, passwordTemporal: res.passwordTemporal, yaExistia: res.yaExistia, row: res.row }
          : { fila, estado: 'error', motivo: res.motivo }
      );

      if (res.ok && res.row) {
        const cursoNombre = cursos.find((c) => c.id === fila.cursoId)?.nombre || fila.curso;
        const periodo = periodos.find((p) => p.id === fila.periodoId);
        const dataPdf: CertificadoRenderData = {
          codigo: res.row.codigo_verificacion,
          alumnoNombre: res.row.nombre_completo || fila.nombre_completo.trim(),
          cursoNombre,
          fecha: new Date(res.row.fecha).toLocaleDateString('es-PE'),
          cargo: res.row.cargo || undefined,
          dni: res.row.dni || undefined,
          cursoId: res.row.curso_id,
          modalidad: 'directo',
          periodoInicio: periodo ? new Date(periodo.fecha_inicio + 'T00:00:00').toLocaleDateString('es-PE') : undefined,
          periodoEntrega: periodo ? new Date(periodo.fecha_entrega + 'T00:00:00').toLocaleDateString('es-PE') : undefined,
          periodoCierre: periodo ? new Date(periodo.fecha_cierre + 'T00:00:00').toLocaleDateString('es-PE') : undefined,
        };
        try {
          await Promise.all([
            asegurarCertificadoEnDrive(dataPdf, 'digital', res.row.id, res.row.drive_digital_url),
            asegurarCertificadoEnDrive(dataPdf, 'imprimir', res.row.id, res.row.drive_imprimir_url),
          ]);
        } catch (e) {
          console.error('No se pudo subir el certificado a Drive:', e);
          fallosDrive.push({
            dni: fila.dni,
            nombre: fila.nombre_completo.trim(),
            curso: cursoNombre,
            motivo: e instanceof Error ? e.message : 'Error desconocido al subir a Drive.',
          });
        }
      }
    }

    const { pedidosCreados: creados, errores: erroresPedidos } = await registrarPedidosPorLote(salida, cursos, metodo, estadoPago);
    setPedidosCreados(creados);
    if (erroresPedidos.length) {
      setAviso({ texto: `Certificados emitidos, pero algunos pedidos no se registraron: ${erroresPedidos.join(' ')}`, tipo: 'err' });
    }

    setDriveFallidos(fallosDrive);
    setResultados(salida);
    setEmitiendo(false);
    setProgreso(null);
    setFilas(null);
  }

  const emitidosOk = (resultados || []).filter((r) => r.estado === 'emitido').length;

  return (
    <div className="card card-pad">
      <p className="sub" style={{ marginTop: 0 }}>
        Sube un archivo .csv o .xlsx con <strong>una fila por certificado</strong> (si un cliente compró varios cursos,
        repite sus datos en una fila por curso). Las columnas <code>curso</code>, <code>cargo</code> y{' '}
        <code>periodo</code> deben coincidir exactamente con los nombres ya registrados en el sistema.
      </p>
      <button
        type="button"
        className="btn sec"
        onClick={() => descargarTextoComoArchivo(generarPlantillaCSV(), 'plantilla-certificados-directos.csv')}
      >
        Descargar plantilla de ejemplo (.csv)
      </button>

      {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}

      <label style={{ marginTop: '1rem' }}>Archivo de clientes</label>
      <FileDropzone
        accept=".csv,.xlsx,.xls"
        cargando={procesando}
        textoCargando={`Leyendo ${nombreArchivo}…`}
        onFile={manejarArchivo}
        icon={<span className="material-symbols-outlined">table_chart</span>}
        label="Subir archivo (.csv o .xlsx)"
        nombreArchivo={!procesando ? nombreArchivo : null}
      />

      {filas && !emitiendo && (
        <>
          <div className="fila" style={{ marginTop: '1rem' }}>
            <span className="tag activo">{validas.length} listas para emitir</span>
            {conError.length > 0 && <span className="tag anulado">{conError.length} con error</span>}
          </div>
          <div style={{ marginTop: '.8rem' }}>
            <DataTable
              columns={[
                { key: 'numero', header: 'Fila' },
                { key: 'dni', header: 'DNI' },
                { key: 'nombre_completo', header: 'Cliente' },
                { key: 'curso', header: 'Curso' },
                { key: 'periodo', header: 'Período' },
                { key: 'precio', header: 'Precio', render: (f) => (f.precio ? formatSoles(f.precio) : '—') },
                {
                  key: 'estado',
                  header: 'Estado',
                  render: (f) =>
                    f.errores.length === 0 ? (
                      <span className="tag activo">OK</span>
                    ) : (
                      <span className="tag anulado" title={f.errores.join(' ')}>
                        {f.errores.join(' ')}
                      </span>
                    ),
                },
              ]}
              rows={filas.map((f) => ({ ...f, id: f.numero }))}
              vacio="El archivo no tiene filas."
            />
          </div>

          <div className="perfil-grid" style={{ marginTop: '1rem' }}>
            <div>
              <label>Método de pago (aplica a todo el lote)</label>
              <select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
                <option value="pendiente">Pendiente</option>
                <option value="transferencia">Transferencia</option>
                <option value="yape_plin">Yape</option>
                <option value="mercadopago">Tarjeta (Mercado Pago)</option>
              </select>
            </div>
            <div>
              <label>Estado del pago (aplica a todo el lote)</label>
              <select value={estadoPago} onChange={(e) => setEstadoPago(e.target.value as EstadoPago)}>
                <option value="pagado">Pagado</option>
                <option value="pendiente">Pendiente</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>
          <p className="sub" style={{ margin: '.3rem 0 0', fontSize: '.78rem' }}>
            Se crea un pedido por cada DNI del archivo (agrupando sus cursos y sumando sus precios), igual que en
            &quot;Emitir a un cliente&quot;.
          </p>

          <button className="btn bloque" onClick={confirmarEmision} disabled={!validas.length}>
            Emitir {validas.length} certificado{validas.length === 1 ? '' : 's'}
          </button>
        </>
      )}

      {emitiendo && progreso && (
        <p className="aviso info" style={{ marginTop: '1rem' }}>
          Emitiendo {progreso.actual} de {progreso.total}…
        </p>
      )}

      {resultados && (
        <div style={{ marginTop: '1.2rem' }}>
          <div className={`aviso ${emitidosOk === resultados.length ? 'ok' : 'err'}`}>
            {emitidosOk} de {resultados.length} certificados emitidos correctamente · {pedidosCreados} pedido{pedidosCreados === 1 ? '' : 's'} registrado{pedidosCreados === 1 ? '' : 's'}.
          </div>
          {driveFallidos.length > 0 && (
            <div className="aviso err" style={{ marginTop: '.6rem' }}>
              <strong>
                {driveFallidos.length} certificado{driveFallidos.length === 1 ? '' : 's'} no se{' '}
                {driveFallidos.length === 1 ? 'subió' : 'subieron'} a Google Drive.
              </strong>{' '}
              El certificado se emitió y es válido — solo falta la copia en Drive. Puedes reintentarlo desde
              &quot;Certificados emitidos&quot; sin volver a emitirlo.
              <ul style={{ margin: '.5rem 0 0', paddingLeft: '1.2rem' }}>
                {driveFallidos.map((f, i) => (
                  <li key={`${f.dni}-${i}`} style={{ fontSize: '.85rem' }}>
                    {f.nombre} ({f.dni}) — {f.curso}: {f.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {resultados.some((r) => r.passwordTemporal) && (
            <p className="sub">
              Se crearon cuentas nuevas para algunos clientes. Descarga el reporte para obtener sus correos y
              contraseñas temporales — no se volverán a mostrar.
            </p>
          )}
          <button
            type="button"
            className="btn sec"
            onClick={() => descargarTextoComoArchivo(generarReporteCSV(resultados), 'reporte-carga-masiva-certificados.csv')}
          >
            Descargar reporte (.csv)
          </button>
          <div style={{ marginTop: '.8rem' }}>
            <DataTable
              columns={[
                { key: 'dni', header: 'DNI', render: (r) => r.fila.dni },
                { key: 'nombre', header: 'Cliente', render: (r) => r.fila.nombre_completo },
                { key: 'curso', header: 'Curso', render: (r) => r.fila.curso },
                { key: 'precio', header: 'Precio', render: (r) => formatSoles(r.fila.precio) },
                {
                  key: 'estado',
                  header: 'Resultado',
                  render: (r) =>
                    r.estado === 'emitido' ? (
                      <span className="tag activo">Emitido</span>
                    ) : (
                      <span className="tag anulado" title={r.motivo}>
                        Error: {r.motivo}
                      </span>
                    ),
                },
              ]}
              rows={resultados.map((r, i) => ({ ...r, id: i }))}
              vacio="Sin resultados."
            />
          </div>
        </div>
      )}
    </div>
  );
}
