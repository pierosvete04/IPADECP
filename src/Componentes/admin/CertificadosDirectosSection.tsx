'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { verificarDni } from '@/lib/dni';
import { obtenerCargosProfesionales, type CargoProfesional } from '@/lib/cargos';
import { previaCertificadoServidor, respaldarCertificadoEnDrive } from '@/lib/certificado';
import { resolverCuentaCliente, emitirCertificadoParaCurso, vincularCertificadosAPedido, type CertificadoDirectoRow } from '@/lib/certificadosDirectos';
import { ESTADO_PAGO_A_VENTA_ESTADO, type MetodoPago, type EstadoPago } from '@/lib/pedidos';
import { mensajeError, repartirEntre } from '@/lib/copy';
import { cargarCalendarioHabil, type CalendarioHabil } from '@/lib/diasHabiles';
import { obtenerPeriodosCertificacion, periodoPorId, type Periodo } from '@/lib/periodos';
import CursoSelector from './CursoSelector';
import { useCursosAdmin, type CursoAdmin } from './useCursosAdmin';
import CargaMasivaCertificados from './CargaMasivaCertificados';
import PendientesEmisionSection from './PendientesEmisionSection';
import VistaPreviaCertificadoModal, { type VistaPreviaCertificado } from './VistaPreviaCertificadoModal';
import Aviso from '@/Componentes/ui/Aviso';
import ConfirmDialog from '@/Componentes/ui/ConfirmDialog';
import EstadoCarga from './EstadoCarga';
import ProgresoEmision from './ProgresoEmision';
import SelectorCargo from './SelectorCargo';
import SelectorPeriodoFecha, { fechaSugerida } from './SelectorPeriodoFecha';
import { useCargaDatos, datosDe } from './useCargaDatos';
import Tabs from './Tabs';

interface PromocionSimple {
  id: number;
  titulo: string;
  tipo: string;
  cantidad_minima: number | null;
  precio_promo: number | null;
  categoria_id: number | null;
  cursoIds: number[];
}

const TABS_EMISION = [
  { valor: 'individual' as const, etiqueta: 'Emitir a un cliente' },
  { valor: 'lote' as const, etiqueta: 'Emitir en lote (Excel/CSV)' },
  // Flujo inverso: el pedido ya existe y solo falta ponerle las fechas.
  // Ver PendientesEmisionSection.
  { valor: 'pendientes' as const, etiqueta: 'Pendientes de emitir' },
];

export default function CertificadosDirectosSection() {
  const { cursos, error: errorCursos } = useCursosAdmin();
  const activos = cursos.filter((c) => c.estado === '1');

  const [modo, setModo] = useState<'individual' | 'lote' | 'pendientes'>('individual');

  // Las tres consultas van juntas porque el formulario no sirve de nada sin
  // las tres: si falla cualquiera, la pantalla lo dice y ofrece reintentar en
  // vez de pintar un <select> de períodos vacío que parece "no hay períodos
  // configurados".
  const { datos, error, cargando, recargar } = useCargaDatos(async () => {
    const [periodos, cargos, promosCrudas] = await Promise.all([
      obtenerPeriodosCertificacion(),
      obtenerCargosProfesionales(),
      datosDe<PromocionSimple & { promocion_cursos?: { curso_id: number }[] }>(
        supabase
          .from('promociones')
          .select('id,titulo,tipo,cantidad_minima,precio_promo,categoria_id,promocion_cursos(curso_id)')
          .eq('estado', '1')
          .order('titulo')
      ),
    ]);
    return {
      periodos,
      cargos: cargos as CargoProfesional[],
      promociones: promosCrudas.map((p) => ({
        id: p.id,
        titulo: p.titulo,
        tipo: p.tipo,
        cantidad_minima: p.cantidad_minima,
        precio_promo: p.precio_promo,
        categoria_id: p.categoria_id,
        cursoIds: (p.promocion_cursos || []).map((x) => x.curso_id),
      })),
    };
  });

  return (
    <>
      <h1 className="titulo">Certificados directos</h1>
      <p className="sub">
        Para clientes que compran un curso solo por el certificado (sin rendir tareas/exámenes): ingresa su DNI, cargo y la
        fecha que corresponda dentro del período de 6 meses, y se emite su certificado con QR de verificación. Los
        certificados ya emitidos están en la pestaña <strong>Certificados emitidos</strong>.
      </p>

      <Tabs tabs={TABS_EMISION} valor={modo} onChange={setModo} etiqueta="Forma de emisión">
        {/* Sin la lista de cursos el formulario no sirve: el selector saldría
            vacío y parecería que no hay cursos publicados. */}
        <Aviso mensaje={errorCursos} />
        <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} variante="bloque">
          {datos &&
            (modo === 'individual' ? (
              <FormEmision cursos={activos} periodos={datos.periodos} cargos={datos.cargos} promociones={datos.promociones} />
            ) : modo === 'lote' ? (
              <CargaMasivaCertificados cursos={activos} periodos={datos.periodos} cargos={datos.cargos} />
            ) : (
              <PendientesEmisionSection periodos={datos.periodos} cargos={datos.cargos} />
            ))}
        </EstadoCarga>
      </Tabs>
    </>
  );
}

interface ItemCurso {
  cursoId: string;
  periodoId: string;
  fecha: string;
  precio: string;
  promocionId: string;
}

function itemVacio(): ItemCurso {
  return { cursoId: '', periodoId: '', fecha: '', precio: '', promocionId: '' };
}

interface ResultadoItem {
  cursoNombre: string;
  ok: boolean;
  motivo?: string;
  row?: CertificadoDirectoRow;
  periodoId: string;
}

function FormEmision({
  cursos,
  periodos,
  cargos,
  promociones,
}: {
  cursos: CursoAdmin[];
  periodos: Periodo[];
  cargos: CargoProfesional[];
  promociones: PromocionSimple[];
}) {
  const [dni, setDni] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [cargoFinal, setCargoFinal] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [promoComboId, setPromoComboId] = useState('');
  const [itemsPromo, setItemsPromo] = useState<ItemCurso[]>([]);
  const [itemsExtra, setItemsExtra] = useState<ItemCurso[]>([itemVacio()]);
  const [metodo, setMetodo] = useState<MetodoPago>('pendiente');
  const [estadoPago, setEstadoPago] = useState<EstadoPago>('pagado');
  const [emitiendo, setEmitiendo] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);
  const [resultado, setResultado] = useState<{ items: ResultadoItem[]; pedidoId?: number; totalPedido: number } | null>(null);
  const [previa, setPrevia] = useState<VistaPreviaCertificado | null>(null);
  // Emitir un certificado es irreversible desde el panel (queda con su código
  // de verificación y su QR públicos), y además crea un pedido y sus filas de
  // ventas. Un solo clic no debería poder hacer todo eso sin un resumen de lo
  // que va a pasar.
  const [confirmando, setConfirmando] = useState(false);
  // Progreso real, como en la carga masiva. Antes el botón decía "Emitiendo…"
  // y nada más: con 4 cursos son 4 emisiones + 8 subidas a Drive, medio
  // minuto largo en el que la pantalla parecía colgada.
  const [progreso, setProgreso] = useState<{ actual: number; total: number; curso: string } | null>(null);
  // Verificación de RENIEC: vive junto al campo del nombre, no en el banner
  // de errores del formulario. El resultado de UN campo no pertenece al canal
  // que reporta el fallo de TODO el formulario.
  const [reniec, setReniec] = useState<{ texto: string; ok: boolean } | null>(null);
  // La BD exige día hábil (ver es_dia_habil). Sin comprobarlo acá, elegir un
  // sábado pasaba la validación y el diálogo de confirmación, y reventaba a
  // mitad del bucle de emisión — con los certificados anteriores ya creados.
  const [calendario, setCalendario] = useState<CalendarioHabil | null>(null);

  useEffect(() => {
    let vivo = true;
    cargarCalendarioHabil().then((c) => vivo && setCalendario(c));
    return () => {
      vivo = false;
    };
  }, []);

  const promoCombo = promociones.find((p) => String(p.id) === promoComboId);
  const esCombo = promoCombo?.tipo === 'precio_fijo_bundle';

  function cursosElegibles(promo?: PromocionSimple) {
    if (!promo) return cursos;
    if (promo.cursoIds.length) return cursos.filter((c) => promo.cursoIds.includes(c.id));
    if (promo.categoria_id) return cursos.filter((c) => c.categoria_id === promo.categoria_id);
    return cursos;
  }

  function seleccionarPromoCombo(id: string) {
    setPromoComboId(id);
    const promo = promociones.find((p) => String(p.id) === id);
    if (!promo || promo.tipo !== 'precio_fijo_bundle') {
      setItemsPromo([]);
      return;
    }
    const cantidad = promo.cantidad_minima || 1;
    const precios = repartirEntre(promo.precio_promo || 0, cantidad);
    setItemsPromo((prev) =>
      Array.from({ length: cantidad }, (_, i) => ({
        ...(prev[i] || itemVacio()),
        precio: precios[i],
        promocionId: id,
      }))
    );
  }

  function actualizarItemExtra(i: number, cambios: Partial<ItemCurso>) {
    setItemsExtra((prev) =>
      prev.map((it, idx) => {
        if (idx !== i) return it;
        const actualizado = { ...it, ...cambios };
        if (cambios.cursoId !== undefined) {
          const curso = cursos.find((c) => String(c.id) === cambios.cursoId);
          if (curso?.precio_ahora) actualizado.precio = curso.precio_ahora;
        }
        if (cambios.periodoId !== undefined) {
          actualizado.fecha = fechaSugerida(periodoPorId(periodos, cambios.periodoId), calendario);
        }
        return actualizado;
      })
    );
  }

  function actualizarItemPromo(i: number, cambios: Partial<ItemCurso>) {
    setItemsPromo((prev) =>
      prev.map((it, idx) => {
        if (idx !== i) return it;
        const actualizado = { ...it, ...cambios };
        if (cambios.periodoId !== undefined) {
          actualizado.fecha = fechaSugerida(periodoPorId(periodos, cambios.periodoId), calendario);
        }
        return actualizado;
      })
    );
  }

  function agregarItemExtra() {
    setItemsExtra((prev) => [...prev, itemVacio()]);
  }

  function quitarItemExtra(i: number) {
    setItemsExtra((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function verificarConReniec() {
    if (!/^\d{8}$/.test(dni)) {
      setReniec({ texto: 'El DNI debe tener 8 dígitos.', ok: false });
      return;
    }
    setVerificando(true);
    setReniec(null);
    const res = await verificarDni(dni, '');
    setVerificando(false);
    if (res.ok && res.nombreCompleto) {
      setNombreCompleto(res.nombreCompleto);
      setReniec({ texto: 'Nombre traído de RENIEC. Revísalo antes de emitir.', ok: true });
    } else {
      setReniec({ texto: res.motivo || 'No se pudo verificar el DNI en RENIEC. Escribe el nombre manualmente.', ok: false });
    }
  }

  /**
   * Los cursos completos (curso + período + fecha). Se calcula en render y no
   * dentro de `emitir` porque el botón y el diálogo de confirmación necesitan
   * el recuento real para poder decir "Emitir 3 certificados" en vez de la
   * plantilla "certificado(s)".
   */
  const itemsCompletos = [...itemsPromo, ...itemsExtra].filter((it) => it.cursoId && it.periodoId && it.fecha);
  // Una fecha no hábil la rechaza la BD, así que un ítem con esa fecha no cuenta
  // como "listo para emitir": si contara, el botón prometería N certificados y
  // saldrían menos.
  const itemsValidos = itemsCompletos.filter((it) => !calendario || calendario.esHabil(it.fecha));
  const totalAEmitir = itemsValidos.reduce((acc, it) => acc + (Number(it.precio) || 0), 0);

  const nombreCurso = (cursoId: string) => cursos.find((c) => String(c.id) === cursoId)?.nombre || `Curso #${cursoId}`;

  /** Devuelve el primer problema del formulario, o null si está listo. */
  function primerProblema(): string | null {
    if (!/^\d{8}$/.test(dni)) return 'Ingresa un DNI válido de 8 dígitos.';
    if (!nombreCompleto.trim()) return 'Falta el nombre completo del cliente.';
    if (!cargoFinal.trim()) return 'Elige o escribe el cargo profesional.';
    // Obligatorio desde que el correo dejó de pedirse: hasta que el cliente
    // active su cuenta, su celular es el único modo de alcanzarlo — y hay que
    // alcanzarlo si perdió el volante con su código de acceso.
    if (telefono.replace(/\D/g, '').length < 6) return 'Falta el teléfono del cliente. Es el único modo de contactarlo hasta que active su cuenta.';
    const noHabil = itemsCompletos.find((it) => calendario && !calendario.esHabil(it.fecha));
    if (noHabil) return `Corrige la fecha de "${nombreCurso(noHabil.cursoId)}": no es un día hábil y el certificado no se puede emitir así.`;
    if (!itemsValidos.length) return 'Agrega al menos un curso con su período y su fecha.';
    if (itemsValidos.some((it) => !(Number(it.precio) > 0))) return 'Ingresa el monto que paga el cliente por cada curso.';
    return null;
  }

  /**
   * Valida y, si todo está bien, abre la confirmación. Emitir crea
   * certificados con código de verificación público, un pedido y sus filas de
   * ventas — nada de eso se deshace desde el panel, así que el submit ya no
   * ejecuta: pregunta.
   */
  /** La previa de la versión "imprimir" exige sesión, así que se resuelve antes de abrir el modal. */
  async function abrirPrevia(codigo: string, tipo: 'digital' | 'imprimir') {
    try {
      setPrevia(await previaCertificadoServidor(codigo, tipo));
    } catch (e) {
      setAviso({ texto: e instanceof Error ? e.message : 'No se pudo abrir la vista previa.', tipo: 'err' });
    }
  }

  function revisarAntesDeEmitir(e: React.FormEvent) {
    e.preventDefault();
    setResultado(null);
    const problema = primerProblema();
    if (problema) {
      // El <Aviso> se encarga de anunciarlo y de traerlo a la vista: el banner
      // vive arriba del formulario y el botón abajo, así que antes el mensaje
      // aparecía fuera de pantalla y parecía que el botón no hacía nada.
      setAviso({ texto: problema, tipo: 'err' });
      return;
    }
    setAviso(null);
    setConfirmando(true);
  }

  async function emitir() {
    setConfirmando(false);
    setAviso(null);
    setEmitiendo(true);
    try {
      const cuenta = await resolverCuentaCliente({
        dni,
        nombreCompleto: nombreCompleto.trim(),
        cargo: cargoFinal.trim(),
        telefono: telefono.trim() || undefined,
        correoContacto: correo.trim() || undefined,
      });
      if (!cuenta.ok) {
        setAviso({ texto: cuenta.motivo || 'No se pudo resolver la cuenta del cliente.', tipo: 'err' });
        return;
      }

      const resultadosItems: ResultadoItem[] = [];
      for (const [i, it] of itemsValidos.entries()) {
        const cursoNombre = cursos.find((c) => String(c.id) === it.cursoId)?.nombre || `Curso #${it.cursoId}`;
        // Progreso curso a curso: con 4 cursos esto es medio minuto largo en
        // el que antes la pantalla solo decía "Emitiendo…" y parecía colgada.
        setProgreso({ actual: i + 1, total: itemsValidos.length, curso: cursoNombre });
        const res = await emitirCertificadoParaCurso({
          alumnoUid: cuenta.alumnoUid ?? null,
          cursoId: parseInt(it.cursoId, 10),
          periodoId: parseInt(it.periodoId, 10),
          fecha: it.fecha,
          dni,
          nombreCompleto: nombreCompleto.trim(),
          cargo: cargoFinal.trim(),
        });
        resultadosItems.push({ cursoNombre, ok: res.ok, motivo: res.motivo, row: res.row, periodoId: it.periodoId });

        if (res.ok && res.row) {
          // Respaldo en Drive: se dispara y no se espera. El certificado ya es verificable
          // por QR y el PDF lo sirve la app, así que Drive no puede demorar la emisión.
          respaldarCertificadoEnDrive('digital', res.row.id, res.row.drive_digital_url);
          respaldarCertificadoEnDrive('imprimir', res.row.id, res.row.drive_imprimir_url);
        }
      }

      const emitidosConItem = resultadosItems
        .map((r, i) => ({ r, it: itemsValidos[i] }))
        .filter((x) => x.r.ok && x.r.row);

      let pedidoId: number | undefined;
      const totalPedido = emitidosConItem.reduce((acc, x) => acc + (Number(x.it.precio) || 0), 0);

      if (emitidosConItem.length && cuenta.alumnoUid) {
        const {
          data: { user: admin },
        } = await supabase.auth.getUser();

        const { data: pedido, error: ePedido } = await supabase
          .from('pedidos')
          .insert({
            cliente_uid: cuenta.alumnoUid,
            cliente_nombre: nombreCompleto.trim(),
            cliente_email: correo.trim() || cuenta.email || null,
            cliente_telefono: telefono.trim() || null,
            canal: 'admin',
            metodo,
            estado_pago: estadoPago,
            subtotal: totalPedido,
            descuento: 0,
            total: totalPedido,
            notas: 'Certificado directo',
            creado_por: admin?.id || null,
            // Un certificado directo siempre implica entregarle al cliente el
            // certificado físico — no es opcional como en un pedido de curso online.
            incluye_certificado_fisico: true,
            origen: 'certificado_directo',
          })
          .select('id')
          .single();

        if (ePedido || !pedido) {
          setAviso({ texto: mensajeError(ePedido, 'Los certificados se emitieron, pero no se pudo registrar el pedido.'), tipo: 'err' });
        } else {
          pedidoId = pedido.id;
          // Se sella acá y no antes porque en este camino el pedido nace
          // DESPUÉS de emitir. Sin esto, el pedido recién creado caería en la
          // bandeja de "Pendientes de emitir" pidiendo un certificado que ya
          // existe (ver obtenerPedidosPendientesEmision).
          await vincularCertificadosAPedido(
            emitidosConItem.map(({ r }) => r.row!.id),
            pedido.id
          );
          const estadoVenta = ESTADO_PAGO_A_VENTA_ESTADO[estadoPago] || 'pendiente';
          const filasVentas = emitidosConItem.map(({ r, it }) => ({
            curso_id: parseInt(it.cursoId, 10),
            alumno_uid: cuenta.alumnoUid,
            nombre_curso: r.cursoNombre,
            monto: Number(it.precio) || 0,
            precio_lista: Number(it.precio) || 0,
            promocion_id: it.promocionId ? parseInt(it.promocionId, 10) : null,
            metodo,
            estado: estadoVenta,
            pedido_id: pedido.id,
          }));
          await supabase.from('ventas').insert(filasVentas);
        }
      }

      setResultado({ items: resultadosItems, pedidoId, totalPedido });
      const okCount = emitidosConItem.length;
      const todoBien = okCount === itemsValidos.length;
      const pedidoTexto = pedidoId ? ` Se registró el pedido P-${String(pedidoId).padStart(4, '0')}.` : '';

      setAviso(
        todoBien
          ? {
              texto: `${okCount === 1 ? 'Certificado emitido' : `${okCount} certificados emitidos`}.${pedidoTexto}`,
              tipo: 'ok',
            }
          : {
              texto: `Se emitieron ${okCount} de ${itemsValidos.length} certificados.${pedidoTexto} Abajo está el detalle de cada uno: corrige los que fallaron y vuelve a emitir solo esos.`,
              tipo: 'err',
            }
      );

      // Solo se limpia el formulario si TODO salió bien. Antes bastaba con
      // que uno saliera para borrar DNI, nombre, teléfono, correo y los
      // cursos — y el que había fallado ya no se podía reintentar sin
      // volver a teclear los datos del cliente desde cero.
      if (todoBien) {
        setDni('');
        setNombreCompleto('');
        setTelefono('');
        setCorreo('');
        setReniec(null);
        setItemsExtra([itemVacio()]);
        setItemsPromo([]);
        setPromoComboId('');
      } else {
        // Se quitan los que SÍ salieron: lo que queda en pantalla es
        // exactamente lo que falta por emitir, sin riesgo de duplicar.
        const fallidos = new Set(resultadosItems.map((r, i) => (r.ok ? -1 : i)).filter((i) => i >= 0));
        const sigueFallando = (it: ItemCurso) => {
          const idx = itemsValidos.indexOf(it);
          return idx < 0 || fallidos.has(idx);
        };
        setItemsPromo((prev) => prev.filter(sigueFallando));
        setItemsExtra((prev) => {
          const restantes = prev.filter(sigueFallando);
          return restantes.length ? restantes : [itemVacio()];
        });
      }
    } catch (e) {
      setAviso({ texto: mensajeError(e as { message?: string | null }, 'No se pudo completar la emisión.'), tipo: 'err' });
    } finally {
      setEmitiendo(false);
      setProgreso(null);
    }
  }

  return (
    <div className="card card-pad">
      <Aviso tipo={aviso?.tipo ?? 'err'} mensaje={aviso?.texto} />
      <form onSubmit={revisarAntesDeEmitir}>
        {/* <fieldset> y no un <hr> suelto: agrupa de verdad los campos que van
            juntos, y el <legend> le da a cada bloque un nombre que los
            lectores de pantalla anuncian al entrar en él. */}
        <fieldset className="campos-grupo">
          <legend>Datos del cliente</legend>

          <label htmlFor="cd-dni">DNI del cliente</label>
          <div className="fila">
            <input
              id="cd-dni"
              inputMode="numeric"
              autoComplete="off"
              value={dni}
              onChange={(e) => {
                setDni(e.target.value.replace(/\D/g, '').slice(0, 8));
                setReniec(null);
              }}
              placeholder="8 dígitos"
              style={{ maxWidth: 160 }}
            />
            <button type="button" className="btn sec" onClick={verificarConReniec} disabled={verificando || dni.length !== 8}>
              {verificando ? 'Verificando…' : 'Verificar con RENIEC'}
            </button>
          </div>
          {/* El resultado de RENIEC va PEGADO al campo que afecta, no en el
              banner de arriba: ahí competía con los errores de todo el
              formulario y el "ok" verde de un campo se leía como si el
              formulario entero estuviera listo. */}
          {reniec && (
            <p className={`campo-ayuda${reniec.ok ? ' ok' : ' err'}`} role="status">
              {reniec.texto}
            </p>
          )}

          <label htmlFor="cd-nombre" style={{ marginTop: '.6rem' }}>
            Nombre completo
          </label>
          <input
            id="cd-nombre"
            value={nombreCompleto}
            onChange={(e) => setNombreCompleto(e.target.value)}
            placeholder="Se completa al verificar el DNI, o escríbelo aquí"
          />
          <span className="campo-ayuda">Este nombre se imprime tal cual en el certificado.</span>

          <div style={{ marginTop: '.6rem' }}>
            <SelectorCargo cargos={cargos} onChange={setCargoFinal} />
          </div>

          <label htmlFor="cd-telefono" style={{ marginTop: '.6rem' }}>
            Teléfono
          </label>
          <input id="cd-telefono" inputMode="tel" required value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          <span className="campo-ayuda">Hasta que active su cuenta, es el único modo de contactarlo.</span>

          <label htmlFor="cd-correo" style={{ marginTop: '.6rem' }}>
            Correo del cliente (opcional)
          </label>
          <input
            id="cd-correo"
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="Solo si lo tienes a mano; lo pone él al activar su cuenta"
          />
          <p className="sub" style={{ margin: '.3rem 0 0', fontSize: '.78rem' }}>
            Este cliente siempre queda con cuenta de acceso al aula. Si el DNI ya tiene una cuenta, se reutiliza
            automáticamente y no se crea una nueva. Si no existe, se genera un correo <code>@ipadecp.com.pe</code> y una
            contraseña temporal que deberás entregarle al cliente. El correo de arriba es distinto: es el correo real del
            cliente, para poder enviarle el certificado desde &quot;Certificados emitidos&quot;.
          </p>
        </fieldset>

        <fieldset className="campos-grupo">
          <legend>Cursos y precios</legend>
          <label htmlFor="cd-combo" style={{ marginTop: 0 }}>
            Promoción combo (opcional)
          </label>
        <select id="cd-combo" value={promoComboId} onChange={(e) => seleccionarPromoCombo(e.target.value)}>
          <option value="">— Ninguna, precio por curso —</option>
          {promociones
            .filter((p) => p.tipo === 'precio_fijo_bundle')
            .map((p) => (
              <option value={p.id} key={p.id}>
                {p.titulo} ({p.cantidad_minima} cursos × S/ {p.precio_promo})
              </option>
            ))}
        </select>
        {esCombo && (
          <p className="sub" style={{ margin: '.3rem 0 0', fontSize: '.78rem' }}>
            Se habilitaron {itemsPromo.length} cursos del combo. El precio ya está prorrateado — solo elige el curso, el
            período y la fecha de cada uno.
          </p>
        )}

        {esCombo && (
          <>
            {itemsPromo.map((it, i) => {
              const opciones = cursosElegibles(promoCombo);
              return (
                <div key={i} className="item-form">
                  <div className="item-form-cab">
                    <span className="item-form-num">
                      <i>{i + 1}</i> Curso del combo {i + 1} de {itemsPromo.length}
                    </span>
                    <span className="campo-ayuda">Incluido — S/ {it.precio}</span>
                  </div>

                  <label>Curso</label>
                  <CursoSelector cursos={opciones} value={it.cursoId} onChange={(v) => actualizarItemPromo(i, { cursoId: v })} />

                  <SelectorPeriodoFecha
                    periodos={periodos}
                    periodoId={it.periodoId}
                    fecha={it.fecha}
                    calendario={calendario}
                    onChange={(cambios) => actualizarItemPromo(i, cambios)}
                  />
                </div>
              );
            })}
          </>
        )}

        <label style={{ marginTop: '.8rem' }}>{esCombo ? 'Cursos aparte del combo (opcional)' : 'Cursos a certificar'}</label>
        <p className="sub" style={{ margin: '0 0 .6rem', fontSize: '.78rem' }}>
          {esCombo
            ? 'Si además del combo el cliente paga algún curso extra, agrégalo aquí con su propio precio.'
            : 'Si este cliente pidió el certificado de varios cursos, agrégalos todos aquí — cada uno con su propio período, fecha y precio. Se emite un certificado por cada uno y se registra un solo pedido con todos juntos.'}
        </p>
        {itemsExtra.map((it, i) => {
          return (
            <div key={i} className="item-form">
              <div className="item-form-cab">
                <span className="item-form-num">
                  <i>{i + 1}</i> Curso {i + 1}
                </span>
                {(itemsExtra.length > 1 || esCombo) && (
                  <button type="button" className="item-form-quitar" onClick={() => quitarItemExtra(i)}>
                    Quitar
                  </button>
                )}
              </div>

              <label>Curso</label>
              <CursoSelector cursos={cursos} value={it.cursoId} onChange={(v) => actualizarItemExtra(i, { cursoId: v })} />

              <SelectorPeriodoFecha
                periodos={periodos}
                periodoId={it.periodoId}
                fecha={it.fecha}
                calendario={calendario}
                onChange={(cambios) => actualizarItemExtra(i, cambios)}
              />

              <div className="perfil-grid" style={{ marginTop: '.4rem' }}>
                <div>
                  <label htmlFor={`cd-precio-${i}`}>Precio (S/)</label>
                  <input
                    id={`cd-precio-${i}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={it.precio}
                    onChange={(e) => actualizarItemExtra(i, { precio: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor={`cd-promo-${i}`}>Promoción (opcional, solo referencia)</label>
                  <select id={`cd-promo-${i}`} value={it.promocionId} onChange={(e) => actualizarItemExtra(i, { promocionId: e.target.value })}>
                    <option value="">— Ninguna —</option>
                    {promociones.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.titulo}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
        <button type="button" className="btn sec btn-sm" onClick={agregarItemExtra}>
          {esCombo ? '+ Agregar curso aparte' : '+ Agregar curso'}
        </button>
        </fieldset>

        <fieldset className="campos-grupo">
          <legend>Pago</legend>
          <div className="perfil-grid">
            <div>
              <label htmlFor="cd-metodo">Método de pago</label>
              <select id="cd-metodo" value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
                <option value="pendiente">Pendiente</option>
                <option value="transferencia">Transferencia</option>
                <option value="yape_plin">Yape</option>
                <option value="mercadopago">Tarjeta (Mercado Pago)</option>
              </select>
            </div>
            <div>
              <label htmlFor="cd-estado-pago">Estado del pago</label>
              <select id="cd-estado-pago" value={estadoPago} onChange={(e) => setEstadoPago(e.target.value as EstadoPago)}>
                <option value="pagado">Pagado</option>
                <option value="pendiente">Pendiente</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>
          {/* Recuento real en vez de "curso(s)": el número confirma lo que se
              va a crear antes de crearlo. */}
          <p className="sub" style={{ margin: '.3rem 0 0', fontSize: '.78rem' }}>
            {itemsValidos.length === 0
              ? 'Cuando completes un curso con su período y su fecha, aquí verás el pedido que se va a registrar.'
              : `Además de ${itemsValidos.length === 1 ? 'el certificado' : 'los certificados'}, se registra un pedido de ${
                  itemsValidos.length === 1 ? '1 curso' : `${itemsValidos.length} cursos`
                } por S/ ${totalAEmitir.toFixed(2)} para que quede contabilizado en Pedidos.`}
          </p>
        </fieldset>

        {/* Progreso curso a curso mientras se emite, igual que en la carga
            masiva y en pendientes: los tres usan el mismo componente. */}
        {progreso && <ProgresoEmision actual={progreso.actual} total={progreso.total} detalle={progreso.curso} />}

        <button className="btn bloque" type="submit" disabled={emitiendo}>
          {emitiendo
            ? 'Emitiendo…'
            : itemsValidos.length <= 1
              ? 'Revisar y emitir certificado'
              : `Revisar y emitir ${itemsValidos.length} certificados`}
        </button>
      </form>

      {/* Emitir no se deshace desde el panel: deja certificados con código de
          verificación público, un pedido y sus filas de ventas. El resumen
          repite los datos que más caro sale equivocar (nombre y DNI van
          impresos en el PDF) antes de confirmar. */}
      <ConfirmDialog
        open={confirmando}
        peligro={false}
        title={itemsValidos.length === 1 ? 'Emitir 1 certificado' : `Emitir ${itemsValidos.length} certificados`}
        body={
          `${nombreCompleto.trim()} · DNI ${dni} · ${cargoFinal.trim()}\n` +
          `${itemsValidos
            .map((it) => cursos.find((c) => String(c.id) === it.cursoId)?.nombre || `Curso #${it.cursoId}`)
            .join(', ')}\n` +
          `Se registrará un pedido por S/ ${totalAEmitir.toFixed(2)} (${estadoPago}). ` +
          'El nombre y el DNI se imprimen tal cual en el certificado y no se pueden cambiar después de emitir.'
        }
        confirmLabel={itemsValidos.length === 1 ? 'Emitir certificado' : `Emitir ${itemsValidos.length} certificados`}
        cancelLabel="Revisar de nuevo"
        onConfirm={emitir}
        onCancel={() => setConfirmando(false)}
      />

      {resultado && (
        <div className={`aviso ${resultado.items.every((r) => r.ok) ? 'ok' : 'err'}`} role="status" style={{ marginTop: '1.2rem' }}>
          {resultado.pedidoId && (
            <p style={{ margin: 0 }}>
              <strong>Pedido P-{String(resultado.pedidoId).padStart(4, '0')}</strong> registrado por S/ {resultado.totalPedido.toFixed(2)}.
            </p>
          )}
          <div style={{ marginTop: '.6rem', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
            {resultado.items.map((r, i) => (
              <div key={i} className="fila" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <span>
                  {r.cursoNombre} —{' '}
                  {r.ok ? <span className="tag activo">Emitido</span> : <span className="tag anulado">Error: {r.motivo}</span>}
                </span>
                {r.ok && r.row && (
                  <div className="fila">
                    {/* El certificado ya está emitido, así que la previa es el PDF real del
                        servidor y no un render del navegador: incluye el Registro N° que
                        acaba de asignar la BD. */}
                    <button
                      type="button"
                      className="btn sec btn-sm"
                      onClick={() => abrirPrevia(r.row!.codigo_verificacion, 'digital')}
                    >
                      Ver digital
                    </button>
                    <button
                      type="button"
                      className="btn sec btn-sm"
                      onClick={() => abrirPrevia(r.row!.codigo_verificacion, 'imprimir')}
                    >
                      Ver para imprimir
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <VistaPreviaCertificadoModal previa={previa} onClose={() => setPrevia(null)} />
    </div>
  );
}
