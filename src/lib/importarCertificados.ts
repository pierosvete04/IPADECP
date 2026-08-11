/**
 * Carga masiva de certificados directos: parseo de un archivo .csv/.xlsx
 * (una fila = un certificado a emitir), matching de curso/cargo/período por
 * nombre de texto contra los catálogos reales, y generación de la plantilla
 * de ejemplo y del reporte final para descargar.
 */
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase/client';
import { BADGE_ESTADO_PAGO, codigoPedido, ESTADO_PAGO_A_VENTA_ESTADO, METODO_LABEL, type EstadoPago, type MetodoPago } from '@/lib/pedidos';
import type { CertificadoDirectoRow } from '@/lib/certificadosDirectos';
import { fechaLegible, type CalendarioHabil } from '@/lib/diasHabiles';

export interface CursoParaImportar {
  id: number;
  nombre: string;
}
export interface CargoParaImportar {
  id: number;
  nombre: string;
}
export interface PeriodoParaImportar {
  id: number;
  nombre: string;
  fecha_inicio: string;
  fecha_entrega: string;
  fecha_cierre: string;
}

export interface FilaCruda {
  numero: number;
  dni: string;
  nombre_completo: string;
  curso: string;
  cargo: string;
  periodo: string;
  fecha: string;
  telefono: string;
  correo: string;
  precio: string;
}

export interface FilaValidada extends FilaCruda {
  cursoId: number | null;
  periodoId: number | null;
  cargoFinal: string;
  fechaFinal: string;
  errores: string[];
}

const ENCABEZADOS: Record<string, Exclude<keyof FilaCruda, 'numero'>> = {
  dni: 'dni',
  documento: 'dni',
  nombre_completo: 'nombre_completo',
  nombrecompleto: 'nombre_completo',
  nombre: 'nombre_completo',
  cliente: 'nombre_completo',
  curso: 'curso',
  cargo: 'cargo',
  cargo_profesional: 'cargo',
  periodo: 'periodo',
  período: 'periodo',
  periodo_certificacion: 'periodo',
  fecha: 'fecha',
  telefono: 'telefono',
  teléfono: 'telefono',
  correo: 'correo',
  email: 'correo',
  correo_contacto: 'correo',
  precio: 'precio',
  monto: 'precio',
  monto_pagado: 'precio',
};

function normalizarEncabezado(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function normalizarTexto(s: string): string {
  return s.trim().toLowerCase();
}

/** Excel a veces guarda fechas como número serial; xlsx ya las puede convertir con cellDates. */
function celdaAString(valor: unknown): string {
  if (valor instanceof Date) {
    const y = valor.getFullYear();
    const m = String(valor.getMonth() + 1).padStart(2, '0');
    const d = String(valor.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(valor ?? '').trim();
}

/**
 * Columnas sin las cuales no se puede emitir nada. `fecha` y `correo` sí son opcionales.
 *
 * El teléfono es obligatorio desde que el correo dejó de pedirse: el cliente de
 * certificación directa pone su correo él mismo al activar su cuenta, así que
 * hasta ese momento el ÚNICO canal para alcanzarlo es su celular — y hay que
 * alcanzarlo si perdió el volante con su código, si agotó los intentos o si el
 * envío se traspapeló. Un cliente sin teléfono y sin cuenta activada es un
 * cliente incontactable.
 */
const COLUMNAS_REQUERIDAS: Exclude<keyof FilaCruda, 'numero'>[] = ['dni', 'nombre_completo', 'curso', 'cargo', 'periodo', 'telefono', 'precio'];

export interface ArchivoCertificados {
  filas: FilaCruda[];
  /** Encabezados que el archivo traía y se reconocieron. */
  columnas: Set<Exclude<keyof FilaCruda, 'numero'>>;
  /** Requeridas que no aparecen. Si hay alguna, no vale la pena validar fila por fila. */
  faltantes: Exclude<keyof FilaCruda, 'numero'>[];
}

export async function parsearArchivoCertificados(file: File): Promise<ArchivoCertificados> {
  const buffer = await file.arrayBuffer();
  const libro = XLSX.read(buffer, { type: 'array', cellDates: true });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filasCrudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: '', raw: false });

  // Qué columnas trae el archivo, no qué columnas tienen dato. Sin esto, un
  // encabezado mal escrito ("cursos" en vez de "curso") producía N errores
  // idénticos de 'No se encontró el curso ""' — 500 filas rojas para un solo
  // problema, que además estaba en la primera línea del archivo.
  const columnas = new Set<Exclude<keyof FilaCruda, 'numero'>>();
  for (const clave of Object.keys(filasCrudas[0] || {})) {
    const campo = ENCABEZADOS[normalizarEncabezado(clave)];
    if (campo) columnas.add(campo);
  }

  const filas = filasCrudas.map((fila, i) => {
    const mapeada: FilaCruda = {
      numero: i + 2,
      dni: '',
      nombre_completo: '',
      curso: '',
      cargo: '',
      periodo: '',
      fecha: '',
      telefono: '',
      correo: '',
      precio: '',
    };
    for (const [clave, valor] of Object.entries(fila)) {
      const campo = ENCABEZADOS[normalizarEncabezado(clave)];
      if (campo) mapeada[campo] = celdaAString(valor);
    }
    mapeada.dni = mapeada.dni.replace(/\D/g, '').slice(0, 8);
    return mapeada;
  });

  return { filas, columnas, faltantes: COLUMNAS_REQUERIDAS.filter((c) => !columnas.has(c)) };
}

/**
 * Interpreta un monto tal como sale de un Excel peruano: "S/ 150", "150,00",
 * "1.500", "1,500.50".
 *
 * Antes era un `Number(valor)` pelado, así que cualquiera de esos formatos daba
 * NaN y la fila se rechazaba con "Falta el monto" aunque el monto estuviera ahí.
 * La regla del separador: si deja exactamente tres dígitos detrás y hay dígitos
 * delante, es separador de miles; si no, es decimal.
 */
export function montoDesdeTexto(valor: string): number {
  const limpio = (valor || '').replace(/[^\d,.-]/g, '').trim();
  if (!limpio) return NaN;

  const ultimaComa = limpio.lastIndexOf(',');
  const ultimoPunto = limpio.lastIndexOf('.');

  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    // Con ambos, el que va último es el decimal.
    return Number(
      ultimaComa > ultimoPunto ? limpio.replace(/\./g, '').replace(',', '.') : limpio.replace(/,/g, '')
    );
  }

  const separador = ultimaComa >= 0 ? ',' : ultimoPunto >= 0 ? '.' : null;
  if (!separador) return Number(limpio);

  const pos = limpio.lastIndexOf(separador);
  const decimales = limpio.length - pos - 1;
  const esMiles = decimales === 3 && pos > 0 && limpio.slice(0, pos).replace(/[^\d]/g, '').length > 0;
  return Number(esMiles ? limpio.split(separador).join('') : limpio.replace(separador, '.'));
}

/** Distancia de edición, para sugerir "¿quisiste decir…?" cuando un nombre no calza por poco. */
function distancia(a: string, b: string): number {
  const previa = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let esquina = previa[0];
    previa[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const anterior = previa[j];
      previa[j] = Math.min(previa[j] + 1, previa[j - 1] + 1, esquina + (a[i - 1] === b[j - 1] ? 0 : 1));
      esquina = anterior;
    }
  }
  return previa[b.length];
}

/** El nombre del catálogo más parecido, si está lo bastante cerca como para ser un typo y no otra cosa. */
function sugerencia(texto: string, candidatos: { nombre: string }[]): string | null {
  const buscado = normalizarTexto(texto);
  if (!buscado) return null;
  let mejor: { nombre: string; d: number } | null = null;
  for (const c of candidatos) {
    const d = distancia(buscado, normalizarTexto(c.nombre));
    if (!mejor || d < mejor.d) mejor = { nombre: c.nombre, d };
  }
  // Hasta un tercio de la longitud: tolera tildes, plurales y dedazos, pero no
  // propone un curso al azar cuando el texto no se parece a nada.
  return mejor && mejor.d <= Math.max(2, Math.floor(buscado.length / 3)) ? mejor.nombre : null;
}

export function validarFilas(
  filas: FilaCruda[],
  cursos: CursoParaImportar[],
  cargos: CargoParaImportar[],
  periodos: PeriodoParaImportar[],
  /** Para rechazar fechas que el RPC va a rechazar igual. Si es null solo se valida el rango. */
  calendario: CalendarioHabil | null = null
): FilaValidada[] {
  // Un mismo DNI puede repetirse (una fila por curso), pero el mismo DNI con el
  // mismo curso dos veces no: `certificados` tiene UNIQUE (curso_id, alumno_uid),
  // así que la segunda fila fallaría al emitir. Mejor decirlo antes de empezar.
  const vistos = new Map<string, number>();

  return filas.map((fila) => {
    const errores: string[] = [];

    if (!/^\d{8}$/.test(fila.dni)) errores.push('DNI inválido (deben ser 8 dígitos).');
    if (!fila.nombre_completo.trim()) errores.push('Falta el nombre completo.');
    // Se cuentan dígitos y no caracteres: "999 888 777" y "+51 999888777" son
    // válidos, y así un guion de más no rechaza una fila buena.
    if (fila.telefono.replace(/\D/g, '').length < 6) errores.push('Falta el teléfono del cliente (o tiene muy pocos dígitos).');

    const monto = montoDesdeTexto(fila.precio);
    if (!(monto > 0)) errores.push('Falta el monto (precio) que paga por este curso.');

    const curso = cursos.find((c) => normalizarTexto(c.nombre) === normalizarTexto(fila.curso));
    if (!curso) {
      const cerca = sugerencia(fila.curso, cursos);
      errores.push(`No se encontró el curso "${fila.curso}".${cerca ? ` ¿Quisiste decir "${cerca}"?` : ''}`);
    }

    const periodo = periodos.find((p) => normalizarTexto(p.nombre) === normalizarTexto(fila.periodo));
    if (!periodo) {
      const cerca = sugerencia(fila.periodo, periodos);
      errores.push(`No se encontró el período "${fila.periodo}".${cerca ? ` ¿Quisiste decir "${cerca}"?` : ''}`);
    }

    // El cargo se acepta aunque no esté en el catálogo: el formulario individual
    // también admite cargo libre vía "Otro".
    const cargoFinal = fila.cargo.trim();
    if (!cargoFinal) errores.push('Falta el cargo profesional.');

    let fechaFinal = fila.fecha.trim();
    if (!fechaFinal && periodo) fechaFinal = periodo.fecha_entrega;
    if (periodo && fechaFinal && (fechaFinal < periodo.fecha_inicio || fechaFinal > periodo.fecha_cierre)) {
      errores.push(
        `La fecha ${fechaLegible(fechaFinal)} está fuera del período (${fechaLegible(periodo.fecha_inicio)} a ${fechaLegible(periodo.fecha_cierre)}).`
      );
    } else if (calendario && fechaFinal) {
      // La base de datos exige día hábil. Sin comprobarlo acá, el archivo pasaba
      // entero como "listo para emitir" y reventaba fila por fila al emitir.
      const motivo = calendario.motivoNoHabil(fechaFinal);
      if (motivo) {
        const alternativa = periodo ? calendario.masCercano(fechaFinal, periodo.fecha_inicio, periodo.fecha_cierre) : null;
        errores.push(
          `La fecha ${fechaLegible(fechaFinal)} no es un día hábil. ${motivo}${alternativa ? ` El día hábil más cercano es ${fechaLegible(alternativa)}.` : ''}`
        );
      }
    }

    if (curso && /^\d{8}$/.test(fila.dni)) {
      const clave = `${fila.dni}:${curso.id}`;
      const anterior = vistos.get(clave);
      if (anterior) errores.push(`Este DNI ya lleva este mismo curso en la fila ${anterior}. Un cliente no se certifica dos veces en el mismo curso.`);
      else vistos.set(clave, fila.numero);
    }

    return {
      ...fila,
      cursoId: curso?.id ?? null,
      periodoId: periodo?.id ?? null,
      cargoFinal,
      fechaFinal,
      errores,
    };
  });
}

export function generarPlantillaCSV(): string {
  const encabezado = 'dni,nombre_completo,curso,cargo,periodo,fecha,telefono,correo,precio';
  // Ejemplo con la misma persona en dos filas (dos cursos): cada fila lleva
  // su propio precio — si repite el mismo curso a varios clientes, simplemente
  // repite el mismo monto en cada fila, el sistema arma un solo pedido por DNI
  // sumando esas filas, no hace falta pre-sumar nada a mano.
  // El correo va vacío a propósito: no hace falta pedírselo al cliente. Lo pone
  // él mismo al activar su cuenta, y así llega sin errores de transcripción.
  // El teléfono, en cambio, es obligatorio — ver COLUMNAS_REQUERIDAS.
  const ejemplos = [
    '12345678,Juan Pérez García,Nombre exacto del curso 1,Nombre exacto del cargo,Nombre exacto del período,,999888777,,150',
    '12345678,Juan Pérez García,Nombre exacto del curso 2,Nombre exacto del cargo,Nombre exacto del período,,999888777,,150',
  ];
  return `${encabezado}\n${ejemplos.join('\n')}\n`;
}

export interface ResultadoFilaImportada {
  fila: FilaValidada;
  estado: 'emitido' | 'error';
  motivo?: string;
  email?: string;
  passwordTemporal?: string;
  yaExistia?: boolean;
  /** Presente solo si estado === 'emitido' — se usa después para agrupar por DNI y armar el pedido. */
  row?: CertificadoDirectoRow;
}

/** Pedido que quedó registrado para un DNI del lote. */
export interface PedidoDelLote {
  pedidoId: number;
  total: number;
}

export interface ContextoReporte {
  /** Catálogos reales, para escribir el nombre exacto del curso/período y no lo que vino tipeado en el archivo. */
  cursos: CursoParaImportar[];
  periodos: PeriodoParaImportar[];
  /** Método y estado de pago elegidos para todo el lote. */
  metodo: MetodoPago;
  estadoPago: EstadoPago;
  /** Pedido creado por cada DNI (ver registrarPedidosPorLote). */
  pedidosPorDni: Map<string, PedidoDelLote>;
}

/**
 * Reporte de lo que quedó emitido: una fila por certificado, con los datos del
 * cliente, del certificado y del pedido que lo respalda.
 *
 * Es el comprobante de la carga masiva — con esto se puede conciliar contra
 * Pedidos sin abrir el panel, así que lleva todo lo que define al pedido
 * (código, total, estado y método de pago) además de los datos del certificado.
 * Las columnas del pedido se repiten en cada fila del mismo DNI: el pedido es
 * uno solo por persona, pero el archivo se lee/filtra fila por fila.
 */
export function generarReporteCSV(resultados: ResultadoFilaImportada[], ctx: ContextoReporte): string {
  const encabezado = [
    'dni',
    'nombre_completo',
    'cargo',
    'correo',
    'telefono',
    'curso',
    'periodo',
    'fecha_certificado',
    'precio',
    'estado',
    'motivo',
    'codigo_verificacion',
    'pedido',
    'total_pedido',
    'estado_pago',
    'metodo_pago',
    'email_aula',
    'password_temporal',
  ].join(',');

  const filas = resultados.map((r) => {
    // Solo tiene sentido hablar de pedido en las filas que sí se emitieron: si
    // el certificado falló, esa fila no entró en ningún pedido.
    const pedido = r.estado === 'emitido' ? ctx.pedidosPorDni.get(r.fila.dni) : undefined;
    const cols = [
      r.fila.dni,
      r.fila.nombre_completo,
      r.fila.cargoFinal || r.fila.cargo,
      r.fila.correo,
      r.fila.telefono,
      ctx.cursos.find((c) => c.id === r.fila.cursoId)?.nombre || r.fila.curso,
      ctx.periodos.find((p) => p.id === r.fila.periodoId)?.nombre || r.fila.periodo,
      r.fila.fechaFinal,
      (montoDesdeTexto(r.fila.precio) || 0).toFixed(2),
      r.estado,
      r.motivo || '',
      r.row?.codigo_verificacion || '',
      pedido ? codigoPedido({ id: pedido.pedidoId, esOrfano: false }) : '',
      pedido ? pedido.total.toFixed(2) : '',
      pedido ? BADGE_ESTADO_PAGO[ctx.estadoPago].label : '',
      pedido ? METODO_LABEL[ctx.metodo] || ctx.metodo : '',
      r.email || '',
      r.passwordTemporal || '',
    ];
    return cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
  });
  return `${encabezado}\n${filas.join('\n')}\n`;
}

/**
 * Agrupa las filas emitidas por DNI y registra un pedido por persona (con una
 * venta por curso, cada una con su propio monto) — igual que si lo hubieran
 * cargado uno por uno desde "Emitir a un cliente". El certificado directo
 * siempre implica entrega física, así que incluye_certificado_fisico va fijo
 * en true. No falla la carga si un pedido individual no se pudo registrar:
 * los certificados ya emitidos quedan igual, solo se avisa cuál pedido faltó.
 *
 * Devuelve además qué pedido le tocó a cada DNI, para que el reporte de la
 * carga pueda mostrar el código y el total del pedido junto a cada certificado.
 */
export async function registrarPedidosPorLote(
  resultados: ResultadoFilaImportada[],
  cursos: CursoParaImportar[],
  metodo: MetodoPago,
  estadoPago: EstadoPago
): Promise<{ pedidosCreados: number; errores: string[]; pedidosPorDni: Map<string, PedidoDelLote> }> {
  const pedidosPorDni = new Map<string, PedidoDelLote>();
  const emitidos = resultados.filter((r) => r.estado === 'emitido' && r.row);
  if (!emitidos.length) return { pedidosCreados: 0, errores: [], pedidosPorDni };

  const {
    data: { user: admin },
  } = await supabase.auth.getUser();

  const porDni = new Map<string, ResultadoFilaImportada[]>();
  for (const r of emitidos) {
    const grupo = porDni.get(r.fila.dni) ?? [];
    grupo.push(r);
    porDni.set(r.fila.dni, grupo);
  }

  const estadoVenta = ESTADO_PAGO_A_VENTA_ESTADO[estadoPago] || 'pendiente';
  let pedidosCreados = 0;
  const errores: string[] = [];

  for (const [dni, grupo] of porDni) {
    const primero = grupo[0];
    const alumnoUid = primero.row?.alumno_uid ?? null;
    const total = grupo.reduce((acc, r) => acc + (montoDesdeTexto(r.fila.precio) || 0), 0);

    const { data: pedido, error: ePedido } = await supabase
      .from('pedidos')
      .insert({
        cliente_uid: alumnoUid,
        cliente_nombre: primero.fila.nombre_completo.trim(),
        cliente_email: primero.fila.correo.trim() || primero.email || null,
        cliente_telefono: primero.fila.telefono.trim() || null,
        canal: 'admin',
        metodo,
        estado_pago: estadoPago,
        subtotal: total,
        descuento: 0,
        total,
        notas: 'Certificado directo (lote)',
        creado_por: admin?.id || null,
        incluye_certificado_fisico: true,
        origen: 'certificado_directo',
      })
      .select('id')
      .single();

    if (ePedido || !pedido) {
      errores.push(`${dni} (${primero.fila.nombre_completo}): no se pudo registrar el pedido.`);
      continue;
    }

    const filasVentas = grupo.map((r) => ({
      curso_id: r.fila.cursoId,
      alumno_uid: alumnoUid,
      nombre_curso: cursos.find((c) => c.id === r.fila.cursoId)?.nombre || r.fila.curso,
      monto: montoDesdeTexto(r.fila.precio) || 0,
      precio_lista: montoDesdeTexto(r.fila.precio) || 0,
      metodo,
      estado: estadoVenta,
      pedido_id: pedido.id,
    }));
    const { error: eVentas } = await supabase.from('ventas').insert(filasVentas);
    if (eVentas) {
      errores.push(`${dni} (${primero.fila.nombre_completo}): el pedido #${pedido.id} se creó pero sin sus ítems.`);
      continue;
    }

    pedidosPorDni.set(dni, { pedidoId: pedido.id, total });
    pedidosCreados += 1;
  }

  return { pedidosCreados, errores, pedidosPorDni };
}

export function descargarTextoComoArchivo(contenido: string, nombreArchivo: string, tipo = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['﻿' + contenido], { type: tipo });
  descargarBlobComoArchivo(blob, nombreArchivo);
}

export function descargarBlobComoArchivo(blob: Blob, nombreArchivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
