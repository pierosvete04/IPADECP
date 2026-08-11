'use client';

import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatSoles } from '@/lib/copy';
import { obtenerPedidos, type PedidoRow } from '@/lib/pedidos';
import DataTable from '@/Componentes/ui/DataTable';
import EstadoCarga from './EstadoCarga';
import { useCargaDatos, datosDe } from './useCargaDatos';
import ClienteDetalle from './cliente/ClienteDetalle';

interface Perfil {
  id: string;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  documento: string | null;
  tipo_documento: string | null;
  documento_verificado: boolean | null;
  creado_en: string | null;
  /** Null = el cliente todavía no reclamó su cuenta (típico de certificación directa). */
  cuenta_activada_en: string | null;
}

interface InscripcionBruta {
  alumno_id: string | null;
  curso_id: number;
}

interface CertificadoBruto {
  alumno_uid: string | null;
  curso_id: number;
  modalidad: string | null;
}

/** Cómo se certifica esta persona. 'hibrido' = las dos cosas a la vez. */
type Flujo = 'web' | 'directa' | 'hibrido' | 'ninguno';

interface Cliente extends Perfil {
  flujo: Flujo;
  pedidos: number;
  totalPagado: number;
  ultima: string | null;
  datosCompletos: boolean;
}

const FILTROS: { valor: string; etiqueta: string; incluye: (f: Flujo) => boolean }[] = [
  { valor: '', etiqueta: 'Todas', incluye: () => true },
  { valor: 'web', etiqueta: 'Certificación web', incluye: (f) => f === 'web' || f === 'hibrido' },
  { valor: 'directa', etiqueta: 'Certificación directa', incluye: (f) => f === 'directa' || f === 'hibrido' },
  { valor: 'hibrido', etiqueta: 'Solo híbridos', incluye: (f) => f === 'hibrido' },
  { valor: 'ninguno', etiqueta: 'Sin cursos', incluye: (f) => f === 'ninguno' },
];

function agruparCursos<T>(filas: T[], alumnoDe: (f: T) => string | null, cursoDe: (f: T) => number): Map<string, Set<number>> {
  const mapa = new Map<string, Set<number>>();
  for (const fila of filas) {
    const uid = alumnoDe(fila);
    if (!uid) continue;
    const cursos = mapa.get(uid) ?? new Set<number>();
    cursos.add(cursoDe(fila));
    mapa.set(uid, cursos);
  }
  return mapa;
}

/**
 * "Web" y "directa" no son atributos de la persona sino de cada curso suyo: el
 * mismo cliente puede llevar un curso en el aula y pedir el certificado de otro
 * sin rendir nada. Por eso se clasifica curso por curso y la persona termina con
 * la unión — el híbrido no es un tercer estado, son las dos etiquetas a la vez.
 *
 * Cuidado con las inscripciones: emitir un certificado directo crea una con
 * origen 'admin' (ver certificadosDirectos.ts), y ese mismo origen lo usa el
 * botón de "Asignar curso manualmente". O sea que ni "tiene inscripción" ni el
 * origen sirven para separar los flujos. Lo que decide es si ese curso suyo
 * terminó en un certificado 'directo'.
 */
function flujoDe(uid: string, directos: Map<string, Set<number>>, evaluados: Map<string, Set<number>>, inscritos: Map<string, Set<number>>): Flujo {
  const cursosDirectos = directos.get(uid) ?? new Set<number>();
  const cursosEvaluados = evaluados.get(uid) ?? new Set<number>();
  // Un curso cuenta como del aula si está inscrito y no se resolvió con un
  // certificado directo: esa inscripción la creó la emisión, no el alumno.
  const cursosAula = [...(inscritos.get(uid) ?? [])].filter((id) => !cursosDirectos.has(id));

  const web = cursosEvaluados.size > 0 || cursosAula.length > 0;
  const directa = cursosDirectos.size > 0;
  return web && directa ? 'hibrido' : web ? 'web' : directa ? 'directa' : 'ninguno';
}

function construirClientes(
  perfiles: Perfil[],
  pedidos: PedidoRow[],
  inscripciones: InscripcionBruta[],
  certificados: CertificadoBruto[]
): Cliente[] {
  const porCliente = new Map<string, { pedidos: number; totalPagado: number; ultima: string | null }>();
  for (const p of pedidos) {
    if (!p.cliente_uid) continue;
    const acc = porCliente.get(p.cliente_uid) || { pedidos: 0, totalPagado: 0, ultima: null };
    acc.pedidos += 1;
    if (p.estado_pago === 'pagado') acc.totalPagado += Number(p.total) || 0;
    if (p.fecha && (!acc.ultima || new Date(p.fecha) > new Date(acc.ultima))) acc.ultima = p.fecha;
    porCliente.set(p.cliente_uid, acc);
  }

  const directos = agruparCursos(
    certificados.filter((c) => c.modalidad === 'directo'),
    (c) => c.alumno_uid,
    (c) => c.curso_id
  );
  const evaluados = agruparCursos(
    certificados.filter((c) => c.modalidad !== 'directo'),
    (c) => c.alumno_uid,
    (c) => c.curso_id
  );
  const inscritos = agruparCursos(
    inscripciones,
    (i) => i.alumno_id,
    (i) => i.curso_id
  );

  return perfiles
    .map((perfil) => {
      const acc = porCliente.get(perfil.id) || { pedidos: 0, totalPagado: 0, ultima: null };
      return {
        ...perfil,
        flujo: flujoDe(perfil.id, directos, evaluados, inscritos),
        pedidos: acc.pedidos,
        totalPagado: acc.totalPagado,
        ultima: acc.ultima,
        datosCompletos: !!(perfil.telefono && perfil.documento),
      };
    })
    .sort((a, b) => {
      // Los que compraron primero, por compra más reciente; los que no tienen
      // ninguna compra al final, por fecha de registro.
      if (a.ultima && b.ultima) return new Date(b.ultima).getTime() - new Date(a.ultima).getTime();
      if (a.ultima) return -1;
      if (b.ultima) return 1;
      return new Date(b.creado_en || 0).getTime() - new Date(a.creado_en || 0).getTime();
    });
}

/**
 * Si el cliente ya reclamó su cuenta o todavía no.
 *
 * Sin documento no se muestra nada: la activación se hace CON el documento, así
 * que a quien no lo tiene registrado no se le puede generar un código y decir
 * "sin activar" sería señalar un pendiente que nadie puede resolver.
 */
function EstadoCuenta({ activadaEn, documento }: { activadaEn: string | null; documento: string | null }) {
  if (!documento) return <span className="campo-ayuda">—</span>;
  if (activadaEn) {
    return (
      <abbr className="tag activo" title={`Activada el ${new Date(activadaEn).toLocaleDateString('es-PE')}`} style={{ textDecoration: 'none' }}>
        Activada
      </abbr>
    );
  }
  return (
    <abbr className="tag sin-activar" title="Todavía no entró nunca. Necesita su código de activación impreso." style={{ textDecoration: 'none' }}>
      Sin activar
    </abbr>
  );
}

function TagsFlujo({ flujo }: { flujo: Flujo }) {
  if (flujo === 'ninguno') return <span className="tag canjeado">Sin cursos</span>;
  return (
    <span className="tags-flujo">
      {(flujo === 'web' || flujo === 'hibrido') && <span className="tag flujo-web">Web</span>}
      {(flujo === 'directa' || flujo === 'hibrido') && <span className="tag flujo-directa">Directa</span>}
    </span>
  );
}

/**
 * Pantalla única de personas. Antes esto vivía partido en dos —"Clientes"
 * (quien tenía al menos un pedido) y "Alumnos" (toda cuenta del aula)— pero es
 * la misma gente vista por dos criterios: el que compra es el que cursa. Tener
 * dos listas obligaba a adivinar en cuál buscar y ambas terminaban abriendo el
 * mismo detalle. Acá está todo el mundo, y la columna "Certificación" más su
 * filtro cubren lo que antes daba la lista de Alumnos.
 */
export default function ClientesSection() {
  const [buscar, setBuscar] = useState('');
  const [filtroFlujo, setFiltroFlujo] = useState('');
  const [filtroCuenta, setFiltroCuenta] = useState('');
  const [soloConPedidos, setSoloConPedidos] = useState(false);
  const [vista, setVista] = useState<{ tipo: 'lista' } | { tipo: 'detalle'; id: string }>({ tipo: 'lista' });

  const {
    datos: clientes,
    error,
    cargando,
    recargar: cargar,
  } = useCargaDatos(async () => {
    // Las cuatro consultas se cruzan para clasificar a cada persona: si
    // cualquiera falla en silencio, la columna "Certificación" miente (alguien
    // con certificado directo aparecería como "Sin cursos"). Por eso se lanza
    // en vez de rellenar con [].
    const [perfiles, pedidos, inscripciones, certificados] = await Promise.all([
      datosDe<Perfil>(
        supabase
          .from('perfiles')
          .select('id,nombre,email,telefono,documento,tipo_documento,documento_verificado,creado_en,cuenta_activada_en')
          .neq('rol', 'admin')
      ),
      obtenerPedidos(supabase),
      datosDe<InscripcionBruta>(supabase.from('inscripciones').select('alumno_id,curso_id')),
      datosDe<CertificadoBruto>(supabase.from('certificados').select('alumno_uid,curso_id,modalidad')),
    ]);
    return construirClientes(perfiles, pedidos, inscripciones, certificados);
  });

  const filtrado = useMemo(() => {
    const q = buscar.toLowerCase().trim();
    const incluye = FILTROS.find((f) => f.valor === filtroFlujo)?.incluye ?? (() => true);
    return (clientes || []).filter((c) => {
      if (!incluye(c.flujo)) return false;
      // Sin documento no se puede activar nada, así que esas filas no son ni
      // "activadas" ni "sin activar": quedan fuera de los dos filtros.
      if (filtroCuenta === 'sin_activar' && (!c.documento || c.cuenta_activada_en)) return false;
      if (filtroCuenta === 'activada' && !c.cuenta_activada_en) return false;
      if (soloConPedidos && !c.pedidos) return false;
      if (q && ![c.nombre, c.email, c.documento].some((v) => (v || '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [clientes, buscar, filtroFlujo, filtroCuenta, soloConPedidos]);

  if (vista.tipo === 'detalle') {
    return (
      <ClienteDetalle
        clienteId={vista.id}
        onVolver={() => {
          setVista({ tipo: 'lista' });
          cargar();
        }}
      />
    );
  }

  return (
    <>
      <h1 className="titulo">Clientes</h1>
      <p className="sub">
        Todas las personas con cuenta (no incluye administradores). Toca cualquier fila para abrir su detalle: datos,
        cursos, certificados, gamificación y pedidos.
      </p>

      <EstadoCarga cargando={cargando} error={error} onReintentar={cargar} cols={7}>
        <DataTable
          entidad={['cliente', 'clientes']}
          encabezadoExtra={
            <div className="filtros">
              <div>
                <label className="campo-label" htmlFor="buscar-cliente">
                  Buscar
                </label>
                <input
                  id="buscar-cliente"
                  placeholder="Nombre, correo o documento…"
                  style={{ minWidth: 240 }}
                  value={buscar}
                  onChange={(e) => setBuscar(e.target.value)}
                />
              </div>
              <div>
                <label className="campo-label" htmlFor="filtro-flujo">
                  Certificación
                </label>
                <select id="filtro-flujo" value={filtroFlujo} onChange={(e) => setFiltroFlujo(e.target.value)}>
                  {FILTROS.map((f) => (
                    <option value={f.valor} key={f.valor || 'todos'}>
                      {f.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                {/* Cruzado con "Certificación directa" da la lista de trabajo:
                    a quiénes hay que imprimirles su código de acceso. */}
                <label className="campo-label" htmlFor="filtro-cuenta">
                  Cuenta
                </label>
                <select id="filtro-cuenta" value={filtroCuenta} onChange={(e) => setFiltroCuenta(e.target.value)}>
                  <option value="">Todas</option>
                  <option value="sin_activar">Sin activar</option>
                  <option value="activada">Activadas</option>
                </select>
              </div>
              <div>
                <label className="chk" style={{ marginBottom: 0 }}>
                  <input type="checkbox" checked={soloConPedidos} onChange={(e) => setSoloConPedidos(e.target.checked)} /> Solo con pedidos
                </label>
              </div>
            </div>
          }
          columns={[
            {
              // Nombre y correo van juntos en una celda de dos líneas, no en
              // dos columnas: identifican a la misma persona, y separarlos
              // gastaba el doble de ancho y dejaba la tabla sin espacio para
              // el resto. Las dos líneas son SIEMPRE dos, así que todas las
              // filas miden igual.
              key: 'nombre',
              header: 'Cliente',
              sortable: true,
              render: (f) => (
                <span className="celda-principal">
                  <b>
                    {f.nombre || 'Sin nombre'}
                    {!f.datosCompletos && <i className="punto-alerta" title="Datos incompletos: falta teléfono y/o documento" />}
                  </b>
                  <small>{f.email || '—'}</small>
                </span>
              ),
            },
            {
              key: 'documento',
              header: 'Documento',
              render: (f) =>
                f.documento ? (
                  <span style={{ whiteSpace: 'nowrap' }}>
                    <span className="campo-ayuda">{f.tipo_documento || 'DNI'}</span> {f.documento}
                    {f.documento_verificado && (
                      <abbr className="verificado-ok" title="Verificado con RENIEC" style={{ textDecoration: 'none' }}>
                        ✓
                      </abbr>
                    )}
                  </span>
                ) : (
                  <span className="campo-ayuda">—</span>
                ),
            },
            { key: 'flujo', header: 'Certificación', sortable: true, render: (f) => <TagsFlujo flujo={f.flujo} /> },
            {
              key: 'cuenta_activada_en',
              header: 'Cuenta',
              sortable: true,
              render: (f) => <EstadoCuenta activadaEn={f.cuenta_activada_en} documento={f.documento} />,
            },
            {
              key: 'pedidos',
              header: 'Pedidos',
              sortable: true,
              align: 'right',
              render: (f) => (f.pedidos ? f.pedidos : <span className="campo-ayuda">—</span>),
            },
            {
              key: 'totalPagado',
              header: 'Total pagado',
              sortable: true,
              align: 'right',
              render: (f) => (f.totalPagado ? formatSoles(f.totalPagado) : <span className="campo-ayuda">—</span>),
            },
            {
              key: 'ultima',
              header: 'Último pedido',
              sortable: true,
              align: 'right',
              render: (f) =>
                f.ultima ? (
                  new Date(f.ultima).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
                ) : (
                  <span className="campo-ayuda">—</span>
                ),
            },
          ]}
          rows={filtrado}
          filtrosActivos={!!buscar.trim() || !!filtroFlujo || soloConPedidos}
          onLimpiarFiltros={() => {
            setBuscar('');
            setFiltroFlujo('');
            setSoloConPedidos(false);
          }}
          vacio="Los clientes aparecen aquí en cuanto crean su cuenta o registras su primer pedido."
          onRowClick={(f) => setVista({ tipo: 'detalle', id: f.id })}
          rowClickLabel={(f) => `Ver ${f.nombre || f.email || 'cliente'}`}
        />
      </EstadoCarga>
    </>
  );
}
