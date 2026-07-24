/**
 * Carga masiva de certificados directos: parseo de un archivo .csv/.xlsx
 * (una fila = un certificado a emitir), matching de curso/cargo/período por
 * nombre de texto contra los catálogos reales, y generación de la plantilla
 * de ejemplo y del reporte final para descargar.
 */
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase/client';
import { ESTADO_PAGO_A_VENTA_ESTADO, type EstadoPago, type MetodoPago } from '@/lib/pedidos';
import type { CertificadoDirectoRow } from '@/lib/certificadosDirectos';

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

export async function parsearArchivoCertificados(file: File): Promise<FilaCruda[]> {
  const buffer = await file.arrayBuffer();
  const libro = XLSX.read(buffer, { type: 'array', cellDates: true });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filasCrudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: '', raw: false });

  return filasCrudas.map((fila, i) => {
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
}

export function validarFilas(
  filas: FilaCruda[],
  cursos: CursoParaImportar[],
  cargos: CargoParaImportar[],
  periodos: PeriodoParaImportar[]
): FilaValidada[] {
  return filas.map((fila) => {
    const errores: string[] = [];

    if (!/^\d{8}$/.test(fila.dni)) errores.push('DNI inválido (deben ser 8 dígitos).');
    if (!fila.nombre_completo.trim()) errores.push('Falta el nombre completo.');
    if (!(Number(fila.precio) > 0)) errores.push('Falta el monto (precio) que paga por este curso.');

    const curso = cursos.find((c) => normalizarTexto(c.nombre) === normalizarTexto(fila.curso));
    if (!curso) errores.push(`No se encontró el curso "${fila.curso}".`);

    const periodo = periodos.find((p) => normalizarTexto(p.nombre) === normalizarTexto(fila.periodo));
    if (!periodo) errores.push(`No se encontró el período "${fila.periodo}".`);

    let cargoFinal = fila.cargo.trim();
    if (!cargoFinal) errores.push('Falta el cargo profesional.');
    else if (!cargos.some((c) => normalizarTexto(c.nombre) === normalizarTexto(cargoFinal))) {
      // No es un error bloqueante: el formulario individual también acepta cargo libre ("Otro").
      cargoFinal = fila.cargo.trim();
    }

    let fechaFinal = fila.fecha.trim();
    if (!fechaFinal && periodo) fechaFinal = periodo.fecha_entrega;
    if (periodo && fechaFinal && (fechaFinal < periodo.fecha_inicio || fechaFinal > periodo.fecha_cierre)) {
      errores.push(`La fecha ${fechaFinal} está fuera del rango del período (${periodo.fecha_inicio} a ${periodo.fecha_cierre}).`);
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
  const ejemplos = [
    '12345678,Juan Pérez García,Nombre exacto del curso 1,Nombre exacto del cargo,Nombre exacto del período,,,juan.perez@ejemplo.com,150',
    '12345678,Juan Pérez García,Nombre exacto del curso 2,Nombre exacto del cargo,Nombre exacto del período,,,juan.perez@ejemplo.com,150',
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

export function generarReporteCSV(resultados: ResultadoFilaImportada[]): string {
  const encabezado = 'dni,nombre_completo,curso,precio,estado,motivo,email,password_temporal';
  const filas = resultados.map((r) => {
    const cols = [
      r.fila.dni,
      r.fila.nombre_completo,
      r.fila.curso,
      r.fila.precio,
      r.estado,
      r.motivo || '',
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
 */
export async function registrarPedidosPorLote(
  resultados: ResultadoFilaImportada[],
  cursos: CursoParaImportar[],
  metodo: MetodoPago,
  estadoPago: EstadoPago
): Promise<{ pedidosCreados: number; errores: string[] }> {
  const emitidos = resultados.filter((r) => r.estado === 'emitido' && r.row);
  if (!emitidos.length) return { pedidosCreados: 0, errores: [] };

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
    const total = grupo.reduce((acc, r) => acc + (Number(r.fila.precio) || 0), 0);

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
      monto: Number(r.fila.precio) || 0,
      precio_lista: Number(r.fila.precio) || 0,
      metodo,
      estado: estadoVenta,
      pedido_id: pedido.id,
    }));
    const { error: eVentas } = await supabase.from('ventas').insert(filasVentas);
    if (eVentas) {
      errores.push(`${dni} (${primero.fila.nombre_completo}): el pedido #${pedido.id} se creó pero sin sus ítems.`);
      continue;
    }

    pedidosCreados += 1;
  }

  return { pedidosCreados, errores };
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
