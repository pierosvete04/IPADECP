'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { mensajeError } from '@/lib/copy';
import DataTable from '@/Componentes/ui/DataTable';
import ConfirmDialog from '@/Componentes/ui/ConfirmDialog';
import Aviso from '@/Componentes/ui/Aviso';
import EstadoCarga from './EstadoCarga';
import { useCargaDatos, datosDe } from './useCargaDatos';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/Componentes/ui/card';
import { Button } from '@/Componentes/ui/button';
import { Input } from '@/Componentes/ui/input';
import { Label } from '@/Componentes/ui/label';
import CursoMultiSelector, { type CursoSeleccionable } from './CursoMultiSelector';

interface CodigoRow {
  id: number;
  codigo: string;
  descripcion: string | null;
  estado: string;
  creado_en: string | null;
  codigo_cursos: { cursos: { nombre: string } | null }[];
}

const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I, para evitar confusiones al transcribir

function generarCodigo(): string {
  const grupo = () => Array.from({ length: 4 }, () => ALFABETO_CODIGO[Math.floor(Math.random() * ALFABETO_CODIGO.length)]).join('');
  return `SB-${grupo()}-${grupo()}`;
}

export default function CodigosSection() {
  const {
    datos: filas,
    error,
    cargando,
    recargar: cargarTabla,
  } = useCargaDatos(() =>
    datosDe<CodigoRow>(
      supabase
        .from('codigos_acceso')
        .select('id,codigo,descripcion,estado,creado_en,codigo_cursos(cursos(nombre))')
        .order('creado_en', { ascending: false })
    )
  );
  const [aAnular, setAAnular] = useState<CodigoRow | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [avisoCopia, setAvisoCopia] = useState<string | null>(null);
  const [buscar, setBuscar] = useState('');

  async function copiar(codigo: string) {
    // La API de portapapeles falla sin HTTPS y si el usuario deniega el
    // permiso. Antes se pintaba "Copiado" igual, así que el admin pegaba en
    // WhatsApp lo que tuviera antes en el portapapeles.
    try {
      await navigator.clipboard.writeText(codigo);
      setAvisoCopia(null);
      setCopiado(codigo);
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      setAvisoCopia(`No se pudo copiar automáticamente. El código es ${codigo} — selecciónalo y cópialo a mano.`);
    }
  }

  async function confirmarAnular(): Promise<string | void> {
    if (!aAnular) return;
    // Se leía `error` en ningún sitio: si RLS rechazaba el update, el diálogo
    // se cerraba, la tabla recargaba igual y el código seguía activo sin que
    // nadie se enterara.
    const { error: eAnular } = await supabase.from('codigos_acceso').update({ estado: 'anulado' }).eq('id', aAnular.id);
    if (eAnular) return mensajeError(eAnular);
    setAAnular(null);
    await cargarTabla();
  }

  const q = buscar.toLowerCase().trim();
  const filtradas = (filas || []).filter(
    (f) => !q || [f.codigo, f.descripcion].some((v) => (v || '').toLowerCase().includes(q))
  );

  return (
    <>
      <h1 className="titulo">Códigos de acceso</h1>
      <p className="sub">
        Genera un código para uno o varios cursos y entrégaselo al cliente (WhatsApp, correo, etc.). Desde su cuenta, en
        «Añadir curso», el cliente lo canjea y queda matriculado al instante — sin que tengas que crearle la cuenta tú
        mismo. Para ventas donde registras todo tú por el cliente, usa <strong>Pedidos → Crear pedido</strong>.
      </p>
      <GenerarCodigo onGenerado={cargarTabla} />

      <h2 className="titulo-seccion">Códigos generados</h2>
      <Aviso mensaje={avisoCopia} />
      <EstadoCarga cargando={cargando} error={error} onReintentar={cargarTabla} cols={6}>
        <DataTable
          entidad={['código', 'códigos']}
          encabezadoExtra={
            <div className="filtros">
              <div>
                <label className="campo-label" htmlFor="buscar-codigo">
                  Buscar
                </label>
                {/* Sin buscador, encontrar un "SB-XK4P-9RT2" concreto era
                    pasar páginas de 15 en 15 a mano. */}
                <input
                  id="buscar-codigo"
                  className="campo-ancho"
                  placeholder="Código o descripción…"
                  value={buscar}
                  onChange={(e) => setBuscar(e.target.value)}
                />
              </div>
            </div>
          }
          columns={[
            { key: 'codigo', header: 'Código', sortable: true, render: (f) => <span className="codigo-fila">{f.codigo}</span> },
            { key: 'descripcion', header: 'Descripción', render: (f) => f.descripcion || '—' },
            {
              key: 'cursos',
              header: 'Cursos',
              render: (f) => {
                const nombres = (f.codigo_cursos || []).map((x) => x.cursos?.nombre || '—').join(', ');
                return (
                  <span className="celda-corta" title={nombres}>
                    {nombres || '—'}
                  </span>
                );
              },
            },
            {
              key: 'estado',
              header: 'Estado',
              render: (f) => <span className={`tag ${f.estado}`}>{f.estado.charAt(0).toUpperCase() + f.estado.slice(1)}</span>,
            },
            { key: 'fecha', header: 'Creado', sortable: true, render: (f) => (f.creado_en ? new Date(f.creado_en).toLocaleDateString('es-PE') : '') },
          ]}
          rows={filtradas}
          filtrosActivos={!!q}
          onLimpiarFiltros={() => setBuscar('')}
          vacio="Genera un código arriba y entrégaselo al cliente para que se matricule solo desde su cuenta."
          actions={(f) => (
            <div className="fila">
              <button
                className="btn sec btn-sm"
                type="button"
                onClick={() => copiar(f.codigo)}
                aria-label={`Copiar el código ${f.codigo}`}
              >
                {copiado === f.codigo ? 'Copiado' : 'Copiar'}
              </button>
              {f.estado === 'activo' && (
                <button
                  className="btn peligro btn-sm"
                  type="button"
                  onClick={() => setAAnular(f)}
                  aria-label={`Anular el código ${f.codigo}`}
                >
                  Anular
                </button>
              )}
            </div>
          )}
        />
      </EstadoCarga>

      <ConfirmDialog
        open={!!aAnular}
        title="¿Anular este código?"
        body={aAnular ? `El código ${aAnular.codigo} ya no podrá canjearse. Esta acción no se puede deshacer.` : undefined}
        confirmLabel="Anular código"
        onConfirm={confirmarAnular}
        onCancel={() => setAAnular(null)}
      />
    </>
  );
}

function GenerarCodigo({ onGenerado }: { onGenerado: () => void }) {
  const [cursos, setCursos] = useState<CursoSeleccionable[]>([]);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [descripcion, setDescripcion] = useState('');
  const [expira, setExpira] = useState('');
  const [generando, setGenerando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);
  const [codigoGenerado, setCodigoGenerado] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('cursos')
      .select('id,nombre,precio_ahora')
      .eq('estado', '1')
      .order('nombre')
      .then(({ data }) => setCursos((data as CursoSeleccionable[]) || []));
  }, []);

  async function generar(e: React.FormEvent) {
    e.preventDefault();
    setAviso(null);
    setCodigoGenerado(null);
    if (!seleccion.size) return setAviso({ texto: 'Selecciona al menos un curso.', tipo: 'err' });

    setGenerando(true);
    try {
      let insertado: { id: number; codigo: string } | null = null;
      for (let intento = 0; intento < 5 && !insertado; intento++) {
        const codigo = generarCodigo();
        const { data, error } = await supabase
          .from('codigos_acceso')
          .insert({
            codigo,
            descripcion: descripcion.trim() || null,
            expira_en: expira ? new Date(`${expira}T23:59:59`).toISOString() : null,
          })
          .select('id,codigo')
          .single();
        if (data) insertado = data;
        else if (error && error.code !== '23505') {
          setAviso({ texto: mensajeError(error, 'No se pudo generar el código.'), tipo: 'err' });
          return;
        }
      }
      if (!insertado) {
        setAviso({ texto: 'No se pudo generar un código único, intenta de nuevo.', tipo: 'err' });
        return;
      }

      const filasCurso = Array.from(seleccion).map((curso_id) => ({ codigo_id: insertado!.id, curso_id }));
      const { error: errCursos } = await supabase.from('codigo_cursos').insert(filasCurso);
      if (errCursos) {
        setAviso({ texto: mensajeError(errCursos, 'El código se creó pero no se pudieron asignar los cursos.'), tipo: 'err' });
        return;
      }

      setCodigoGenerado(insertado.codigo);
      setAviso({ texto: 'Código generado.', tipo: 'ok' });
      setSeleccion(new Set());
      setDescripcion('');
      setExpira('');
      onGenerado();
    } finally {
      setGenerando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generar código de acceso</CardTitle>
        <CardDescription>Elige los cursos que desbloqueará y genera un código para enviarle al cliente.</CardDescription>
      </CardHeader>
      <CardContent>
        <Aviso tipo={aviso?.tipo ?? 'err'} mensaje={aviso?.texto} />
        <form onSubmit={generar} className="flex flex-col gap-3">
          <CursoMultiSelector cursos={cursos} seleccion={seleccion} onChange={setSeleccion} label="Cursos que desbloquea" />

          {/* No hay campo "comprador": un código no queda atado a una persona.
              Se genera, se entrega a quien sea y lo canjea el primero que lo
              use, así que poner un nombre acá era una promesa que el sistema
              no cumple. Para saber a quién fue, está la descripción. */}
          <div>
            <Label>Descripción (opcional)</Label>
            <Input className="mt-1" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Promo difusión julio" />
          </div>

          <div>
            <Label>Expira el (opcional)</Label>
            <Input className="mt-1" type="date" value={expira} onChange={(e) => setExpira(e.target.value)} style={{ maxWidth: 200 }} />
          </div>

          <Button type="submit" disabled={generando} className="mt-1">
            {generando ? 'Generando…' : 'Generar código'}
          </Button>
        </form>

        {codigoGenerado && (
          <div className="aviso ok" role="status" style={{ marginTop: '1.2rem' }}>
            <p style={{ margin: 0 }}>
              Código generado: <strong style={{ fontFamily: 'monospace', fontSize: '1.05rem' }}>{codigoGenerado}</strong>
            </p>
            <p className="sub" style={{ margin: '.4rem 0 0', fontSize: '.78rem' }}>
              Envíaselo al cliente. Desde su cuenta, en «Añadir curso», lo canjea y queda matriculado de inmediato.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
