'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CargoProfesional } from '@/lib/cargos';
import { emitirCertificadoParaCurso, resolverCuentasPorDni } from '@/lib/certificadosDirectos';
import { asegurarCertificadoEnDrive } from '@/lib/certificado';
import { formatSoles } from '@/lib/copy';
import { cargarCalendarioHabil, type CalendarioHabil } from '@/lib/diasHabiles';
import type { Periodo } from '@/lib/periodos';
import { codigoPedido, type EstadoPago, type MetodoPago } from '@/lib/pedidos';
import {
  descargarTextoComoArchivo,
  generarPlantillaCSV,
  generarReporteCSV,
  montoDesdeTexto,
  parsearArchivoCertificados,
  registrarPedidosPorLote,
  validarFilas,
  type FilaValidada,
  type PedidoDelLote,
  type ResultadoFilaImportada,
} from '@/lib/importarCertificados';
import DataTable from '@/Componentes/ui/DataTable';
import FileDropzone from '@/Componentes/ui/FileDropzone';
import Aviso from '@/Componentes/ui/Aviso';
import ConfirmDialog from '@/Componentes/ui/ConfirmDialog';
import ProgresoEmision from './ProgresoEmision';

/** Nombre legible de cada columna requerida, para el mensaje de encabezados faltantes. */
const NOMBRE_COLUMNA: Record<string, string> = {
  dni: 'dni',
  nombre_completo: 'nombre_completo',
  curso: 'curso',
  cargo: 'cargo',
  periodo: 'periodo',
  precio: 'precio',
};

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
  const [confirmando, setConfirmando] = useState(false);
  const [progreso, setProgreso] = useState<{ actual: number; total: number; cliente: string } | null>(null);
  const [respaldando, setRespaldando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoFilaImportada[] | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);
  const [metodo, setMetodo] = useState<MetodoPago>('pendiente');
  const [estadoPago, setEstadoPago] = useState<EstadoPago>('pagado');
  const [pedidosCreados, setPedidosCreados] = useState(0);
  // Qué pedido le quedó a cada DNI del lote: lo usan la tabla de resultados y
  // el reporte para mostrar el código y el total del pedido en cada fila.
  const [pedidosPorDni, setPedidosPorDni] = useState<Map<string, PedidoDelLote>>(new Map());
  // Certificados que se emitieron bien pero no llegaron a Drive. Se listan aparte porque el
  // certificado SÍ existe y es válido: lo único que falta es la copia en Drive, que se puede
  // reintentar después desde "Certificados emitidos" sin volver a emitir nada.
  const [driveFallidos, setDriveFallidos] = useState<{ dni: string; nombre: string; curso: string; motivo: string }[]>([]);

  // El calendario de días hábiles se necesita para validar el archivo: la base de
  // datos rechaza fines de semana y feriados, y sin comprobarlo acá el lote entero
  // pasaba como "listo para emitir" y fallaba fila por fila.
  const [calendario, setCalendario] = useState<CalendarioHabil | null>(null);
  useEffect(() => {
    let vivo = true;
    cargarCalendarioHabil().then((c) => vivo && setCalendario(c));
    return () => {
      vivo = false;
    };
  }, []);

  const validas = useMemo(() => (filas || []).filter((f) => f.errores.length === 0), [filas]);
  const conError = (filas || []).filter((f) => f.errores.length > 0);

  /** Un pedido por DNI, igual que al emitir de a uno. */
  const resumen = useMemo(() => {
    const dnis = new Set(validas.map((f) => f.dni));
    return { certificados: validas.length, pedidos: dnis.size, total: validas.reduce((acc, f) => acc + (montoDesdeTexto(f.precio) || 0), 0) };
  }, [validas]);

  async function manejarArchivo(file: File) {
    setAviso(null);
    setResultados(null);
    setFilas(null);
    setNombreArchivo(file.name);
    setProcesando(true);
    try {
      const { filas: crudas, faltantes } = await parsearArchivoCertificados(file);
      if (!crudas.length) {
        setAviso({ texto: 'El archivo no tiene filas de datos.', tipo: 'err' });
        return;
      }
      // Un encabezado mal escrito es un problema del archivo, no de sus filas.
      // Antes se traducía en un error idéntico repetido en cada una de las filas.
      if (faltantes.length) {
        const lista = faltantes.map((c) => `"${NOMBRE_COLUMNA[c] || c}"`).join(', ');
        setAviso({
          texto: `Al archivo le ${faltantes.length === 1 ? 'falta la columna' : 'faltan las columnas'} ${lista}. Descarga la plantilla de ejemplo y usa esos mismos encabezados en la primera fila.`,
          tipo: 'err',
        });
        return;
      }
      setFilas(validarFilas(crudas, cursos, cargos, periodos, calendario));
    } catch {
      setAviso({ texto: 'No se pudo leer el archivo. Verifica que sea un .csv o .xlsx válido.', tipo: 'err' });
    } finally {
      setProcesando(false);
    }
  }

  async function confirmarEmision() {
    setConfirmando(false);
    if (!validas.length) return;
    setEmitiendo(true);
    setAviso(null);
    setResultados(null);
    setPedidosCreados(0);
    setPedidosPorDni(new Map());
    setDriveFallidos([]);
    setProgreso({ actual: 0, total: validas.length, cliente: '' });

    try {
      // Las cuentas se resuelven UNA vez por DNI, no una por fila: el archivo trae
      // una fila por certificado, así que un cliente con cuatro cursos disparaba
      // cuatro búsquedas/creaciones de perfil seguidas.
      const cuentas = await resolverCuentasPorDni(
        validas.map((f) => ({
          dni: f.dni,
          nombreCompleto: f.nombre_completo.trim(),
          cargo: f.cargoFinal,
          telefono: f.telefono.trim() || undefined,
          correoContacto: f.correo.trim() || undefined,
        }))
      );

      const salida: ResultadoFilaImportada[] = [];
      // El respaldo en Drive se dispara y se recoge al final: son dos subidas por
      // certificado y esperarlas dentro del bucle multiplicaba por tres la duración
      // del lote. El certificado ya es válido y verificable sin Drive — el PDF lo
      // sirve la propia app. Se siguen reportando los fallos, solo que después.
      const respaldos: Promise<{ fila: FilaValidada; curso: string; motivo?: string }>[] = [];

      for (const [i, fila] of validas.entries()) {
        setProgreso({ actual: i + 1, total: validas.length, cliente: fila.nombre_completo.trim() });
        const cuenta = cuentas.get(fila.dni);
        if (!cuenta?.ok) {
          salida.push({ fila, estado: 'error', motivo: cuenta?.motivo || 'No se pudo resolver la cuenta del cliente.' });
          continue;
        }

        const res = await emitirCertificadoParaCurso({
          alumnoUid: cuenta.alumnoUid ?? null,
          cursoId: fila.cursoId!,
          periodoId: fila.periodoId!,
          fecha: fila.fechaFinal,
          dni: fila.dni,
          nombreCompleto: fila.nombre_completo.trim(),
          cargo: fila.cargoFinal,
        });

        if (!res.ok || !res.row) {
          salida.push({ fila, estado: 'error', motivo: res.motivo });
          continue;
        }

        salida.push({
          fila,
          estado: 'emitido',
          email: cuenta.email,
          passwordTemporal: cuenta.passwordTemporal,
          yaExistia: cuenta.yaExistia,
          row: res.row,
        });

        const cursoNombre = cursos.find((c) => c.id === fila.cursoId)?.nombre || fila.curso;
        const row = res.row;
        respaldos.push(
          Promise.all([
            asegurarCertificadoEnDrive(null, 'digital', row.id, row.drive_digital_url),
            asegurarCertificadoEnDrive(null, 'imprimir', row.id, row.drive_imprimir_url),
          ])
            .then(() => ({ fila, curso: cursoNombre }))
            .catch((e) => ({ fila, curso: cursoNombre, motivo: e instanceof Error ? e.message : 'Error desconocido al subir a Drive.' }))
        );
      }

      const {
        pedidosCreados: creados,
        errores: erroresPedidos,
        pedidosPorDni: pedidos,
      } = await registrarPedidosPorLote(salida, cursos, metodo, estadoPago);
      setPedidosCreados(creados);
      setPedidosPorDni(pedidos);
      if (erroresPedidos.length) {
        setAviso({ texto: `Certificados emitidos, pero algunos pedidos no se registraron: ${erroresPedidos.join(' ')}`, tipo: 'err' });
      }

      setResultados(salida);
      setFilas(null);
      setEmitiendo(false);
      setProgreso(null);

      // Los certificados ya están listos en pantalla; esto solo completa el respaldo.
      if (respaldos.length) {
        setRespaldando(true);
        const hechos = await Promise.all(respaldos);
        setDriveFallidos(
          hechos
            .filter((r) => r.motivo)
            .map((r) => ({ dni: r.fila.dni, nombre: r.fila.nombre_completo.trim(), curso: r.curso, motivo: r.motivo! }))
        );
        setRespaldando(false);
      }
    } catch (e) {
      setAviso({ texto: e instanceof Error ? e.message : 'No se pudo completar la carga.', tipo: 'err' });
    } finally {
      setEmitiendo(false);
      setProgreso(null);
    }
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

      <Aviso tipo={aviso?.tipo ?? 'err'} mensaje={aviso?.texto} />

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
          {conError.length > 0 && (
            <p className="campo-ayuda">
              Las filas con error se saltan: se emiten solo las {validas.length} correctas. Corrige el archivo y vuelve a
              subirlo para emitir el resto.
            </p>
          )}
          <div style={{ marginTop: '.8rem' }}>
            <DataTable
              columns={[
                { key: 'numero', header: 'Fila' },
                { key: 'dni', header: 'DNI' },
                { key: 'nombre_completo', header: 'Cliente' },
                { key: 'curso', header: 'Curso' },
                { key: 'periodo', header: 'Período' },
                { key: 'precio', header: 'Precio', render: (f) => (montoDesdeTexto(f.precio) > 0 ? formatSoles(montoDesdeTexto(f.precio)) : '—') },
                {
                  key: 'estado',
                  header: 'Estado',
                  render: (f) =>
                    f.errores.length === 0 ? (
                      <span className="tag activo">OK</span>
                    ) : (
                      // El detalle va fuera de la etiqueta: metido dentro, un error
                      // largo ensanchaba la columna hasta descuadrar la tabla.
                      <span className="celda-errores">
                        <span className="tag anulado">Error</span>
                        <span>{f.errores.join(' ')}</span>
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
              <label htmlFor="lote-metodo">Método de pago (aplica a todo el lote)</label>
              <select id="lote-metodo" value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
                <option value="pendiente">Pendiente</option>
                <option value="transferencia">Transferencia</option>
                <option value="yape_plin">Yape</option>
                <option value="mercadopago">Tarjeta (Mercado Pago)</option>
              </select>
            </div>
            <div>
              <label htmlFor="lote-estado-pago">Estado del pago (aplica a todo el lote)</label>
              <select id="lote-estado-pago" value={estadoPago} onChange={(e) => setEstadoPago(e.target.value as EstadoPago)}>
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

          <button className="btn bloque" onClick={() => setConfirmando(true)} disabled={!validas.length}>
            Revisar y emitir {validas.length} certificado{validas.length === 1 ? '' : 's'}
          </button>
        </>
      )}

      {/* Emitir en lote no se deshace desde el panel: deja N certificados con
          código de verificación público, sus pedidos y sus filas de ventas. El
          formulario individual ya preguntaba antes de hacer esto mismo con UN
          certificado; hacerlo con doscientos de un clic no tenía defensa. */}
      <ConfirmDialog
        open={confirmando}
        peligro={false}
        title={resumen.certificados === 1 ? 'Emitir 1 certificado' : `Emitir ${resumen.certificados} certificados`}
        body={
          `${resumen.certificados === 1 ? '1 certificado' : `${resumen.certificados} certificados`} para ` +
          `${resumen.pedidos === 1 ? '1 cliente' : `${resumen.pedidos} clientes`}.\n` +
          `Se registrarán ${resumen.pedidos === 1 ? '1 pedido' : `${resumen.pedidos} pedidos`} por S/ ${resumen.total.toFixed(2)} en total (${estadoPago}).\n` +
          (conError.length ? `Se saltan ${conError.length} fila${conError.length === 1 ? '' : 's'} con error.\n` : '') +
          'El nombre y el DNI se imprimen tal cual en cada certificado y no se pueden cambiar después de emitir.'
        }
        confirmLabel={resumen.certificados === 1 ? 'Emitir certificado' : `Emitir ${resumen.certificados} certificados`}
        cancelLabel="Revisar de nuevo"
        onConfirm={confirmarEmision}
        onCancel={() => setConfirmando(false)}
      />

      {emitiendo && progreso && (
        <ProgresoEmision actual={progreso.actual} total={progreso.total} detalle={progreso.cliente || undefined} />
      )}

      {resultados && (
        <div style={{ marginTop: '1.2rem' }}>
          <div className={`aviso ${emitidosOk === resultados.length ? 'ok' : 'err'}`} role="status">
            {emitidosOk} de {resultados.length} certificados emitidos correctamente · {pedidosCreados} pedido{pedidosCreados === 1 ? '' : 's'} registrado{pedidosCreados === 1 ? '' : 's'}.
          </div>
          {respaldando && (
            <p className="campo-ayuda" role="status">
              Copiando los certificados a Google Drive… Puedes seguir trabajando: ya están emitidos y disponibles.
            </p>
          )}
          {driveFallidos.length > 0 && (
            <div className="aviso err" role="alert" style={{ marginTop: '.6rem' }}>
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
          <p className="sub" style={{ margin: '.6rem 0 .4rem', fontSize: '.78rem' }}>
            El reporte lleva, por cada certificado, los datos del cliente (DNI, nombre, cargo, correo), el nombre exacto
            del curso y del período, y el pedido que se registró: código, total, estado y método de pago.
          </p>
          <button
            type="button"
            className="btn sec"
            onClick={() =>
              descargarTextoComoArchivo(
                generarReporteCSV(resultados, { cursos, periodos, metodo, estadoPago, pedidosPorDni }),
                'reporte-carga-masiva-certificados.csv'
              )
            }
          >
            Descargar reporte (.csv)
          </button>
          <div style={{ marginTop: '.8rem' }}>
            <DataTable
              columns={[
                { key: 'dni', header: 'DNI', render: (r) => r.fila.dni },
                { key: 'nombre', header: 'Cliente', render: (r) => r.fila.nombre_completo },
                { key: 'curso', header: 'Curso', render: (r) => cursos.find((c) => c.id === r.fila.cursoId)?.nombre || r.fila.curso },
                { key: 'periodo', header: 'Período', render: (r) => periodos.find((p) => p.id === r.fila.periodoId)?.nombre || r.fila.periodo },
                { key: 'precio', header: 'Precio', render: (r) => formatSoles(montoDesdeTexto(r.fila.precio) || 0) },
                {
                  key: 'pedido',
                  header: 'Pedido',
                  render: (r) => {
                    const pedido = r.estado === 'emitido' ? pedidosPorDni.get(r.fila.dni) : undefined;
                    if (!pedido) return '—';
                    return (
                      <span title={`Total del pedido: ${formatSoles(pedido.total)}`}>
                        {codigoPedido({ id: pedido.pedidoId, esOrfano: false })} · {formatSoles(pedido.total)}
                      </span>
                    );
                  },
                },
                {
                  key: 'estado',
                  header: 'Resultado',
                  render: (r) =>
                    r.estado === 'emitido' ? (
                      <span className="tag activo">Emitido</span>
                    ) : (
                      <span className="celda-errores">
                        <span className="tag anulado">Error</span>
                        <span>{r.motivo}</span>
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
