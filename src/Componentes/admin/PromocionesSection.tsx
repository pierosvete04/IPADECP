'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatSoles, mensajeError } from '@/lib/copy';
import DataTable from '@/Componentes/ui/DataTable';
import Aviso from '@/Componentes/ui/Aviso';
import { useCursosAdmin } from './useCursosAdmin';
import EstadoCarga from './EstadoCarga';
import { useCargaDatos, datosDe } from './useCargaDatos';
import { METODOS_PAGO } from '@/lib/metodos-pago';

const TIPO_PROMO_LABEL: Record<string, string> = {
  precio_fijo: 'Precio fijo (1 curso)',
  precio_fijo_bundle: 'Combo: N cursos por un precio fijo',
  descuento_pct: 'Descuento por porcentaje',
  descuento_monto: 'Descuento por monto fijo',
  compra_n_lleva_m: 'Compra N y llévate M gratis',
};

function labelValorPromo(tipo: string) {
  if (tipo === 'precio_fijo_bundle') return 'Precio total del combo (S/)';
  if (tipo === 'descuento_pct') return 'Porcentaje de descuento (%)';
  if (tipo === 'descuento_monto') return 'Monto de descuento (S/)';
  if (tipo === 'precio_fijo') return 'Precio fijo del curso (S/)';
  return 'Valor';
}

interface Promocion {
  id: number;
  titulo: string | null;
  descripcion: string | null;
  tipo: string;
  cantidad_minima: number | null;
  cantidad_gratis: number | null;
  precio_promo: number | null;
  categoria_id: number | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: string | null;
  cursos?: { nombre: string } | null;
  categorias?: { cat_descripcion: string } | null;
  promocion_cursos?: { curso_id: number }[];
}

function alcancePromo(f: Promocion): string {
  const n = f.promocion_cursos?.length || 0;
  if (n) return n === 1 ? '1 curso específico' : `${n} cursos específicos`;
  if (f.categorias) return f.categorias.cat_descripcion || 'Categoría';
  if (f.cursos) return f.cursos.nombre;
  return 'Todos los cursos';
}

export default function PromocionesSection() {
  const { cursos } = useCursosAdmin();
  const [editar, setEditar] = useState<Promocion | null | undefined>(undefined);

  const {
    datos: filas,
    error,
    cargando,
    recargar,
  } = useCargaDatos(() =>
    datosDe<Promocion>(
      supabase
        .from('promociones')
        .select('*, cursos!promociones_curso_id_fkey(nombre), categorias(cat_descripcion), promocion_cursos(curso_id)')
        .order('fecha_fin', { ascending: false })
    )
  );

  if (editar !== undefined) {
    return (
      <FormPromocion
        promocion={editar}
        cursos={cursos}
        onVolver={() => setEditar(undefined)}
        onGuardado={() => {
          setEditar(undefined);
          recargar();
        }}
      />
    );
  }

  return (
    <>
      <div className="cabecera-seccion">
        <h1 className="titulo">Promociones</h1>
        <button className="btn" onClick={() => setEditar(null)}>
          + Nueva promoción
        </button>
      </div>
      <p className="sub">
        Descuentos y combos que se aplican solos en el checkout del aula y de la web. Solo cuentan las activas y dentro
        de fecha.
      </p>
      <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} cols={8}>
        <DataTable
          entidad={['promoción', 'promociones']}
          columns={[
            { key: 'titulo', header: 'Título', sortable: true },
            { key: 'tipo', header: 'Tipo', render: (f) => TIPO_PROMO_LABEL[f.tipo] || f.tipo },
            { key: 'alcance', header: 'Aplica a', render: alcancePromo },
            { key: 'cantidad_minima', header: 'Cantidad mínima', align: 'right', render: (f) => f.cantidad_minima ?? '—' },
            {
              key: 'valor',
              header: 'Valor',
              align: 'right',
              render: (f) => (f.tipo === 'descuento_pct' ? `${f.precio_promo}%` : f.tipo === 'compra_n_lleva_m' ? `${f.cantidad_gratis} gratis` : formatSoles(f.precio_promo)),
            },
            { key: 'fecha_fin', header: 'Hasta', sortable: true, render: (f) => (f.fecha_fin ? new Date(f.fecha_fin).toLocaleDateString('es-PE') : '—') },
            {
              key: 'estado',
              header: 'Estado',
              sortable: true,
              render: (f) => (f.estado === '1' ? <span className="tag activo">Activa</span> : <span className="tag anulado">Inactiva</span>),
            },
          ]}
          rows={filas || []}
          vacio="Las promociones aplican descuentos y combos automáticamente al pagar. Crea la primera para empezar a usarlas."
          vacioAccion={
            <button className="btn btn-sm" onClick={() => setEditar(null)}>
              Crear la primera promoción
            </button>
          }
          actions={(f) => (
            <button className="btn sec btn-sm" onClick={() => setEditar(f)}>
              Editar
            </button>
          )}
        />
      </EstadoCarga>
    </>
  );
}

function FormPromocion({
  promocion,
  cursos,
  onVolver,
  onGuardado,
}: {
  promocion: Promocion | null;
  cursos: { id: number; nombre: string; estado: string | null }[];
  onVolver: () => void;
  onGuardado: () => void;
}) {
  const [cats, setCats] = useState<{ id: number; cat_descripcion: string }[]>([]);
  const [cursosEspecificos, setCursosEspecificos] = useState<number[]>([]);
  const [titulo, setTitulo] = useState(promocion?.titulo || '');
  const [descripcion, setDescripcion] = useState(promocion?.descripcion || '');
  const [tipo, setTipo] = useState(promocion?.tipo || 'precio_fijo_bundle');
  const [cantMin, setCantMin] = useState(String(promocion?.cantidad_minima || (promocion?.id ? 1 : 5)));
  const [cantGratis, setCantGratis] = useState(String(promocion?.cantidad_gratis || 1));
  const [precio, setPrecio] = useState(promocion?.precio_promo != null ? String(promocion.precio_promo) : '');
  const [alcance, setAlcance] = useState<'todos' | 'categoria' | 'especificos'>('todos');
  const [categoriaId, setCategoriaId] = useState(promocion?.categoria_id ? String(promocion.categoria_id) : '');
  const [fechaInicio, setFechaInicio] = useState(promocion?.fecha_inicio || '');
  const [fechaFin, setFechaFin] = useState(promocion?.fecha_fin || '');
  const [estado, setEstado] = useState(promocion?.estado === '0' ? '0' : '1');
  const [metodosPago, setMetodosPago] = useState<string[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('categorias')
      .select('id,cat_descripcion')
      .order('cat_descripcion')
      .then(({ data }) => setCats(data || []));
    (async () => {
      let especificos: number[] = [];
      if (promocion?.id) {
        const { data: pc } = await supabase.from('promocion_cursos').select('curso_id').eq('promocion_id', promocion.id);
        especificos = (pc || []).map((x) => x.curso_id);
        const { data: pmp } = await supabase.from('promocion_metodos_pago').select('metodo').eq('promocion_id', promocion.id);
        setMetodosPago((pmp || []).map((m) => m.metodo));
      } else {
        setMetodosPago([]);
      }
      setCursosEspecificos(especificos);
      if (especificos.length) setAlcance('especificos');
      else if (promocion?.categoria_id) setAlcance('categoria');
      else setAlcance('todos');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promocion]);

  function toggleMetodo(m: string) {
    setMetodosPago((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  function toggleCurso(id: number) {
    setCursosEspecificos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function guardar() {
    const row = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      tipo,
      cantidad_minima: parseInt(cantMin, 10) || 1,
      cantidad_gratis: tipo === 'compra_n_lleva_m' ? parseInt(cantGratis, 10) || 1 : 0,
      precio_promo: tipo === 'compra_n_lleva_m' ? null : parseFloat(precio) || null,
      curso_id: null,
      categoria_id: alcance === 'categoria' ? parseInt(categoriaId, 10) : null,
      fecha_inicio: fechaInicio || new Date().toISOString().slice(0, 10),
      fecha_fin: fechaFin,
      estado,
    };
    if (!row.titulo || !row.fecha_fin) {
      setAviso('Título y fecha límite son obligatorios.');
      return;
    }
    if (tipo !== 'compra_n_lleva_m' && !row.precio_promo) {
      setAviso('Indica el valor de la promoción.');
      return;
    }
    const q = promocion?.id
      ? supabase.from('promociones').update(row).eq('id', promocion.id).select('id').single()
      : supabase.from('promociones').insert(row).select('id').single();
    const { data: guardada, error } = await q;
    if (error || !guardada) {
      setAviso(mensajeError(error, 'No se pudo guardar la promoción.'));
      return;
    }
    await supabase.from('promocion_cursos').delete().eq('promocion_id', guardada.id);
    if (alcance === 'especificos' && cursosEspecificos.length) {
      await supabase.from('promocion_cursos').insert(cursosEspecificos.map((curso_id) => ({ promocion_id: guardada.id, curso_id })));
    }
    await supabase.from('promocion_metodos_pago').delete().eq('promocion_id', guardada.id);
    if (metodosPago.length) {
      await supabase.from('promocion_metodos_pago').insert(metodosPago.map((metodo) => ({ promocion_id: guardada.id, metodo })));
    }
    onGuardado();
  }

  const activos = cursos.filter((c) => c.estado === '1');

  return (
    <>
      <div className="barra">
        <button type="button" className="btn sec btn-sm" onClick={onVolver}>
          <ArrowLeft size={16} style={{ marginRight: '.3rem' }} /> Volver a promociones
        </button>
        <h1 className="titulo">{promocion?.id ? 'Editar promoción' : 'Nueva promoción'}</h1>
      </div>
      <div className="card card-pad" style={{ maxWidth: 720 }}>
        <Aviso mensaje={aviso} />
      <label>Título</label>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      <label>Descripción</label>
      <textarea rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />

      <label>Tipo de promoción</label>
      <select
        value={tipo}
        onChange={(e) => {
          setTipo(e.target.value);
          if (e.target.value === 'precio_fijo') setCantMin('1');
        }}
      >
        {Object.entries(TIPO_PROMO_LABEL).map(([v, l]) => (
          <option value={v} key={v}>
            {l}
          </option>
        ))}
      </select>

      <div className="fila">
        <div style={{ flex: 1 }}>
          <label>Cantidad mínima de cursos</label>
          <input type="number" min={1} value={cantMin} onChange={(e) => setCantMin(e.target.value)} />
        </div>
        {tipo === 'compra_n_lleva_m' && (
          <div style={{ flex: 1 }}>
            <label>Cantidad de cursos gratis</label>
            <input type="number" min={1} value={cantGratis} onChange={(e) => setCantGratis(e.target.value)} />
          </div>
        )}
      </div>
      {tipo !== 'compra_n_lleva_m' && (
        <div>
          <label>{labelValorPromo(tipo)}</label>
          <input type="number" step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} />
        </div>
      )}

      <label>¿A qué cursos aplica?</label>
      <select value={alcance} onChange={(e) => setAlcance(e.target.value as 'todos' | 'categoria' | 'especificos')}>
        <option value="todos">Todos los cursos activos</option>
        <option value="categoria">Una categoría</option>
        <option value="especificos">Cursos específicos (elegir)</option>
      </select>
      {alcance === 'categoria' && (
        <div>
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            {cats.map((c) => (
              <option value={c.id} key={c.id}>
                {c.cat_descripcion}
              </option>
            ))}
          </select>
        </div>
      )}
      {alcance === 'especificos' && (
        <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid var(--borde)', borderRadius: 8, padding: '.5rem 1rem' }}>
          {activos.map((c) => (
            <label className="chk" key={c.id}>
              <input type="checkbox" checked={cursosEspecificos.includes(c.id)} onChange={() => toggleCurso(c.id)} /> {c.nombre}
            </label>
          ))}
        </div>
      )}

      <div className="fila" style={{ marginTop: '.6rem' }}>
        <div style={{ flex: 1 }}>
          <label>Fecha inicio</label>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label>Fecha límite</label>
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
        </div>
      </div>
      <label>Estado</label>
      <select value={estado} onChange={(e) => setEstado(e.target.value)}>
        <option value="1">Activa</option>
        <option value="0">Inactiva</option>
      </select>

      <label style={{ marginTop: '.6rem' }}>Métodos de pago aceptados con esta promoción</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
        {METODOS_PAGO.map((m) => (
          <label className="chk" key={m.value}>
            <input type="checkbox" checked={metodosPago.includes(m.value)} onChange={() => toggleMetodo(m.value)} /> {m.label}
          </label>
        ))}
      </div>
      <p className="sub" style={{ marginTop: '.2rem' }}>
        Si no marcas ninguno, se aceptan todos los métodos disponibles (combinados con lo que permita cada curso).
      </p>

      <button className="btn bloque" onClick={guardar}>
        {promocion?.id ? 'Guardar cambios' : 'Crear promoción'}
      </button>
      </div>
    </>
  );
}
