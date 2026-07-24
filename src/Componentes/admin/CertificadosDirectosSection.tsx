'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { verificarDni } from '@/lib/dni';
import { obtenerCargosProfesionales, type CargoProfesional } from '@/lib/cargos';
import { abrirVistaPreviaCertificado, asegurarCertificadoEnDrive, type CertificadoRenderData } from '@/lib/certificado';
import { resolverCuentaCliente, emitirCertificadoParaCurso, type CertificadoDirectoRow } from '@/lib/certificadosDirectos';
import { ESTADO_PAGO_A_VENTA_ESTADO, type MetodoPago, type EstadoPago } from '@/lib/pedidos';
import { mensajeError, repartirEntre } from '@/lib/copy';
import CursoSelector from './CursoSelector';
import { useCursosAdmin, type CursoAdmin } from './useCursosAdmin';
import CargaMasivaCertificados from './CargaMasivaCertificados';
import VistaPreviaCertificadoModal, { type VistaPreviaCertificado } from './VistaPreviaCertificadoModal';

interface Periodo {
  id: number;
  nombre: string;
  fecha_inicio: string;
  fecha_entrega: string;
  fecha_cierre: string;
}

interface PromocionSimple {
  id: number;
  titulo: string;
  tipo: string;
  cantidad_minima: number | null;
  precio_promo: number | null;
  categoria_id: number | null;
  cursoIds: number[];
}

export default function CertificadosDirectosSection() {
  const { cursos } = useCursosAdmin();
  const activos = cursos.filter((c) => c.estado === '1');

  const [periodos, setPeriodos] = useState<Periodo[] | null>(null);
  const [cargos, setCargos] = useState<CargoProfesional[]>([]);
  const [promociones, setPromociones] = useState<PromocionSimple[]>([]);
  const [modo, setModo] = useState<'individual' | 'lote'>('individual');

  useEffect(() => {
    supabase
      .from('periodos_certificacion')
      .select('*')
      .order('fecha_inicio', { ascending: false })
      .then(({ data }) => setPeriodos((data as Periodo[]) || []));
    obtenerCargosProfesionales().then(setCargos);
    supabase
      .from('promociones')
      .select('id,titulo,tipo,cantidad_minima,precio_promo,categoria_id,promocion_cursos(curso_id)')
      .eq('estado', '1')
      .order('titulo')
      .then(({ data }) =>
        setPromociones(
          ((data as unknown as (PromocionSimple & { promocion_cursos?: { curso_id: number }[] })[]) || []).map((p) => ({
            id: p.id,
            titulo: p.titulo,
            tipo: p.tipo,
            cantidad_minima: p.cantidad_minima,
            precio_promo: p.precio_promo,
            categoria_id: p.categoria_id,
            cursoIds: (p.promocion_cursos || []).map((x) => x.curso_id),
          }))
        )
      );
  }, []);

  return (
    <>
      <h1 className="titulo">Certificados directos</h1>
      <p className="sub">
        Para clientes que compran un curso solo por el certificado (sin rendir tareas/exámenes): ingresa su DNI, cargo y la
        fecha que corresponda dentro del período de 6 meses, y se emite su certificado con QR de verificación. Los
        certificados ya emitidos están en la pestaña <strong>Certificados emitidos</strong>.
      </p>

      <div className="tabs">
        <button type="button" className={`tab-btn${modo === 'individual' ? ' activo' : ''}`} onClick={() => setModo('individual')}>
          Emitir a un cliente
        </button>
        <button type="button" className={`tab-btn${modo === 'lote' ? ' activo' : ''}`} onClick={() => setModo('lote')}>
          Emitir en lote (Excel/CSV)
        </button>
      </div>

      {periodos === null ? (
        <p>Cargando…</p>
      ) : modo === 'individual' ? (
        <FormEmision cursos={activos} periodos={periodos} cargos={cargos} promociones={promociones} />
      ) : (
        <CargaMasivaCertificados cursos={activos} periodos={periodos} cargos={cargos} />
      )}
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
  const [cargoSel, setCargoSel] = useState('');
  const [cargoOtro, setCargoOtro] = useState('');
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

  const cargoFinal = cargoSel === 'Otro' ? cargoOtro.trim() : cargoSel;

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

  function fechasPeriodo(periodoIdStr: string) {
    const p = periodos.find((x) => String(x.id) === periodoIdStr);
    if (!p) return {};
    return {
      periodoInicio: new Date(p.fecha_inicio + 'T00:00:00').toLocaleDateString('es-PE'),
      periodoEntrega: new Date(p.fecha_entrega + 'T00:00:00').toLocaleDateString('es-PE'),
      periodoCierre: new Date(p.fecha_cierre + 'T00:00:00').toLocaleDateString('es-PE'),
    };
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
          const periodo = periodos.find((p) => String(p.id) === cambios.periodoId);
          if (periodo) actualizado.fecha = periodo.fecha_entrega;
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
          const periodo = periodos.find((p) => String(p.id) === cambios.periodoId);
          if (periodo) actualizado.fecha = periodo.fecha_entrega;
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

    if (!/^\d{8}$/.test(dni)) return setAviso({ texto: 'Ingresa un DNI válido de 8 dígitos.', tipo: 'err' });
    if (!nombreCompleto.trim()) return setAviso({ texto: 'Falta el nombre completo del cliente.', tipo: 'err' });
    if (!cargoFinal) return setAviso({ texto: 'Elige o escribe el cargo profesional.', tipo: 'err' });

    const itemsValidos = [...itemsPromo, ...itemsExtra].filter((it) => it.cursoId && it.periodoId && it.fecha);
    if (!itemsValidos.length) {
      return setAviso({ texto: 'Agrega al menos un curso con su período y fecha.', tipo: 'err' });
    }
    if (itemsValidos.some((it) => !(Number(it.precio) > 0))) {
      return setAviso({ texto: 'Ingresa el monto que paga por cada curso.', tipo: 'err' });
    }

    setEmitiendo(true);
    try {
      const cuenta = await resolverCuentaCliente({
        dni,
        nombreCompleto: nombreCompleto.trim(),
        cargo: cargoFinal,
        telefono: telefono.trim() || undefined,
        correoContacto: correo.trim() || undefined,
      });
      if (!cuenta.ok) {
        setAviso({ texto: cuenta.motivo || 'No se pudo resolver la cuenta del cliente.', tipo: 'err' });
        return;
      }

      const resultadosItems: ResultadoItem[] = [];
      for (const it of itemsValidos) {
        const cursoNombre = cursos.find((c) => String(c.id) === it.cursoId)?.nombre || `Curso #${it.cursoId}`;
        const res = await emitirCertificadoParaCurso({
          alumnoUid: cuenta.alumnoUid ?? null,
          cursoId: parseInt(it.cursoId, 10),
          periodoId: parseInt(it.periodoId, 10),
          fecha: it.fecha,
          dni,
          nombreCompleto: nombreCompleto.trim(),
          cargo: cargoFinal,
        });
        resultadosItems.push({ cursoNombre, ok: res.ok, motivo: res.motivo, row: res.row, periodoId: it.periodoId });

        if (res.ok && res.row) {
          const dataPdf: CertificadoRenderData = {
            codigo: res.row.codigo_verificacion,
            alumnoNombre: res.row.nombre_completo || nombreCompleto.trim(),
            cursoNombre,
            fecha: new Date(res.row.fecha).toLocaleDateString('es-PE'),
            cargo: res.row.cargo || undefined,
            dni: res.row.dni || undefined,
            cursoId: res.row.curso_id,
            modalidad: 'directo',
            ...fechasPeriodo(it.periodoId),
          };
          try {
            await Promise.all([
              asegurarCertificadoEnDrive(dataPdf, 'digital', res.row.id, res.row.drive_digital_url),
              asegurarCertificadoEnDrive(dataPdf, 'imprimir', res.row.id, res.row.drive_imprimir_url),
            ]);
          } catch (e) {
            console.error('No se pudo subir el certificado a Drive:', e);
          }
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
      setAviso({
        texto: `${okCount} de ${itemsValidos.length} certificado(s) emitido(s)${pedidoId ? ` · Pedido #${pedidoId} registrado.` : '.'}`,
        tipo: okCount === itemsValidos.length ? 'ok' : 'err',
      });
      if (okCount) {
        setDni('');
        setNombreCompleto('');
        setTelefono('');
        setCorreo('');
        setItemsExtra([itemVacio()]);
        setItemsPromo([]);
        setPromoComboId('');
      }
    } finally {
      setEmitiendo(false);
    }
  }

  return (
    <div className="card card-pad">
      {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}
      <form onSubmit={emitir}>
        <label>DNI del cliente</label>
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
          <option value="">— Elige un cargo —</option>
          {cargos.map((c) => (
            <option value={c.nombre} key={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        {cargoSel === 'Otro' && (
          <input style={{ marginTop: '.4rem' }} placeholder="Especifica el cargo" value={cargoOtro} onChange={(e) => setCargoOtro(e.target.value)} />
        )}

        <label style={{ marginTop: '.6rem' }}>Teléfono (opcional)</label>
        <input value={telefono} onChange={(e) => setTelefono(e.target.value)} />

        <label style={{ marginTop: '.6rem' }}>Correo del cliente (opcional)</label>
        <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="Para poder enviarle el certificado por correo" />
        <p className="sub" style={{ margin: '.3rem 0 0', fontSize: '.78rem' }}>
          Este cliente siempre queda con cuenta de acceso al aula. Si el DNI ya tiene una cuenta, se reutiliza
          automáticamente y no se crea una nueva. Si no existe, se genera un correo <code>@ipadecp.com.pe</code> y una
          contraseña temporal que deberás entregarle al cliente. El correo de arriba es distinto: es el correo real del
          cliente, para poder enviarle el certificado desde &quot;Certificados emitidos&quot;.
        </p>

        <hr style={{ margin: '1rem 0' }} />
        <label style={{ marginTop: 0 }}>Promoción combo (opcional)</label>
        <select value={promoComboId} onChange={(e) => seleccionarPromoCombo(e.target.value)}>
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
              const periodoItem = periodos.find((p) => String(p.id) === it.periodoId);
              const opciones = cursosElegibles(promoCombo);
              return (
                <div key={i} className="card card-pad" style={{ marginBottom: '.7rem', background: 'var(--primario-claro)' }}>
                  <strong style={{ fontSize: '.85rem' }}>
                    Curso del combo {i + 1} de {itemsPromo.length}
                  </strong>

                  <label style={{ marginTop: '.5rem' }}>Curso</label>
                  <CursoSelector cursos={opciones} value={it.cursoId} onChange={(v) => actualizarItemPromo(i, { cursoId: v })} />

                  <div className="perfil-grid">
                    <div>
                      <label>Período de certificación</label>
                      <select value={it.periodoId} onChange={(e) => actualizarItemPromo(i, { periodoId: e.target.value })}>
                        <option value="">— Elige un período —</option>
                        {periodos.map((p) => (
                          <option value={p.id} key={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>Fecha del certificado</label>
                      <input
                        type="date"
                        disabled={!periodoItem}
                        min={periodoItem?.fecha_inicio}
                        max={periodoItem?.fecha_cierre}
                        value={it.fecha}
                        onChange={(e) => actualizarItemPromo(i, { fecha: e.target.value })}
                      />
                    </div>
                  </div>
                  {periodoItem && (
                    <p className="sub" style={{ margin: '.2rem 0 0', fontSize: '.75rem' }}>
                      Debe ser un día hábil entre {new Date(periodoItem.fecha_inicio + 'T00:00:00').toLocaleDateString('es-PE')} y{' '}
                      {new Date(periodoItem.fecha_cierre + 'T00:00:00').toLocaleDateString('es-PE')}.
                    </p>
                  )}
                  <p className="sub" style={{ margin: '.4rem 0 0', fontSize: '.78rem' }}>
                    Incluido en el combo — S/ {it.precio}
                  </p>
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
          const periodoItem = periodos.find((p) => String(p.id) === it.periodoId);
          return (
            <div key={i} className="card card-pad" style={{ marginBottom: '.7rem', background: 'var(--primario-claro)' }}>
              <div className="fila" style={{ justifyContent: 'space-between' }}>
                <strong style={{ fontSize: '.85rem' }}>Curso {i + 1}</strong>
                {(itemsExtra.length > 1 || esCombo) && (
                  <button type="button" className="btn peligro btn-sm" onClick={() => quitarItemExtra(i)}>
                    Quitar
                  </button>
                )}
              </div>

              <label style={{ marginTop: '.5rem' }}>Curso</label>
              <CursoSelector cursos={cursos} value={it.cursoId} onChange={(v) => actualizarItemExtra(i, { cursoId: v })} />

              <div className="perfil-grid">
                <div>
                  <label>Período de certificación</label>
                  <select value={it.periodoId} onChange={(e) => actualizarItemExtra(i, { periodoId: e.target.value })}>
                    <option value="">— Elige un período —</option>
                    {periodos.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Fecha del certificado</label>
                  <input
                    type="date"
                    disabled={!periodoItem}
                    min={periodoItem?.fecha_inicio}
                    max={periodoItem?.fecha_cierre}
                    value={it.fecha}
                    onChange={(e) => actualizarItemExtra(i, { fecha: e.target.value })}
                  />
                </div>
              </div>
              {periodoItem && (
                <p className="sub" style={{ margin: '.2rem 0 0', fontSize: '.75rem' }}>
                  Debe ser un día hábil entre {new Date(periodoItem.fecha_inicio + 'T00:00:00').toLocaleDateString('es-PE')} y{' '}
                  {new Date(periodoItem.fecha_cierre + 'T00:00:00').toLocaleDateString('es-PE')}.
                </p>
              )}

              <div className="perfil-grid" style={{ marginTop: '.4rem' }}>
                <div>
                  <label>Precio (S/)</label>
                  <input type="number" min={0} step="0.01" value={it.precio} onChange={(e) => actualizarItemExtra(i, { precio: e.target.value })} />
                </div>
                <div>
                  <label>Promoción (opcional, solo referencia)</label>
                  <select value={it.promocionId} onChange={(e) => actualizarItemExtra(i, { promocionId: e.target.value })}>
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

        <hr style={{ margin: '1rem 0' }} />
        <div className="perfil-grid">
          <div>
            <label>Método de pago</label>
            <select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
              <option value="pendiente">Pendiente</option>
              <option value="transferencia">Transferencia</option>
              <option value="yape_plin">Yape</option>
              <option value="mercadopago">Tarjeta (Mercado Pago)</option>
            </select>
          </div>
          <div>
            <label>Estado del pago</label>
            <select value={estadoPago} onChange={(e) => setEstadoPago(e.target.value as EstadoPago)}>
              <option value="pagado">Pagado</option>
              <option value="pendiente">Pendiente</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        </div>
        <p className="sub" style={{ margin: '.3rem 0 0', fontSize: '.78rem' }}>
          Se crea un pedido con estos {[...itemsPromo, ...itemsExtra].filter((it) => it.cursoId).length || 1} curso(s)
          para que quede contabilizado en <strong>Pedidos</strong>, además del certificado.
        </p>

        <button className="btn bloque" type="submit" disabled={emitiendo}>
          {emitiendo ? 'Emitiendo…' : 'Emitir certificado(s)'}
        </button>
      </form>

      {resultado && (
        <div className={`aviso ${resultado.items.every((r) => r.ok) ? 'ok' : 'err'}`} style={{ marginTop: '1.2rem' }}>
          {resultado.pedidoId && (
            <p style={{ margin: 0 }}>
              <strong>Pedido #{resultado.pedidoId}</strong> registrado por S/ {resultado.totalPedido.toFixed(2)}.
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
                    <button
                      type="button"
                      className="btn sec btn-sm"
                      onClick={async () =>
                        setPrevia(
                          await abrirVistaPreviaCertificado(
                            {
                              codigo: r.row!.codigo_verificacion,
                              alumnoNombre: r.row!.nombre_completo || '—',
                              cursoNombre: r.cursoNombre,
                              fecha: new Date(r.row!.fecha).toLocaleDateString('es-PE'),
                              cargo: r.row!.cargo || undefined,
                              cursoId: r.row!.curso_id,
                              modalidad: 'directo',
                              ...fechasPeriodo(r.periodoId),
                            },
                            'digital'
                          )
                        )
                      }
                    >
                      Ver digital
                    </button>
                    <button
                      type="button"
                      className="btn sec btn-sm"
                      onClick={async () =>
                        setPrevia(
                          await abrirVistaPreviaCertificado(
                            {
                              codigo: r.row!.codigo_verificacion,
                              alumnoNombre: r.row!.nombre_completo || '—',
                              cursoNombre: r.cursoNombre,
                              fecha: new Date(r.row!.fecha).toLocaleDateString('es-PE'),
                              cargo: r.row!.cargo || undefined,
                              dni: r.row!.dni || undefined,
                              cursoId: r.row!.curso_id,
                              modalidad: 'directo',
                              ...fechasPeriodo(r.periodoId),
                            },
                            'imprimir'
                          )
                        )
                      }
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
