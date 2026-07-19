'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import DataTable from '@/Componentes/ui/DataTable';
import { useCursosAdmin } from './useCursosAdmin';

interface CodigoRow {
  codigo: string;
  comprador: string | null;
  estado: string;
  creado_en: string | null;
  codigo_cursos: { cursos: { nombre: string } | null }[];
}

function generarCodigo() {
  const cs = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = () => Array.from({ length: 4 }, () => cs[Math.floor(Math.random() * cs.length)]).join('');
  return 'SB-' + b() + '-' + b();
}

export default function CodigosSection() {
  const { cursos } = useCursosAdmin();
  const activos = cursos.filter((c) => c.estado === '1');
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [comprador, setComprador] = useState('');
  const [aviso, setAviso] = useState<{ texto: string; tipo: string } | null>(null);
  const [codigoGenerado, setCodigoGenerado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [filas, setFilas] = useState<CodigoRow[] | null>(null);

  async function cargarTabla() {
    const { data } = await supabase
      .from('codigos_acceso')
      .select('codigo,comprador,estado,creado_en,codigo_cursos(cursos(nombre))')
      .order('creado_en', { ascending: false });
    setFilas((data as unknown as CodigoRow[]) || []);
  }
  useEffect(() => {
    cargarTabla();
  }, []);

  function toggleCurso(id: number) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function generar() {
    if (!seleccion.size) {
      setAviso({ texto: 'Selecciona al menos un curso.', tipo: 'err' });
      return;
    }
    const codigo = generarCodigo();
    const { data: cod, error } = await supabase.from('codigos_acceso').insert({ codigo, comprador: comprador.trim() || null }).select('id').single();
    if (error) {
      setAviso({ texto: error.message, tipo: 'err' });
      return;
    }
    const { error: e2 } = await supabase.from('codigo_cursos').insert([...seleccion].map((curso_id) => ({ codigo_id: cod.id, curso_id })));
    if (e2) {
      setAviso({ texto: e2.message, tipo: 'err' });
      return;
    }
    setCodigoGenerado(codigo);
    setAviso({ texto: 'Código generado.', tipo: 'ok' });
    setSeleccion(new Set());
    setComprador('');
    cargarTabla();
  }

  return (
    <>
      <h1 className="titulo">Códigos de acceso</h1>
      <div className="card card-pad" style={{ marginBottom: '1.5rem' }}>
        {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}
        <label>Nombre del comprador (opcional)</label>
        <input value={comprador} onChange={(e) => setComprador(e.target.value)} />
        <label style={{ marginTop: '.6rem' }}>Cursos a desbloquear</label>
        <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid var(--borde)', borderRadius: 8, padding: '.5rem 1rem' }}>
          {activos.map((c) => (
            <label className="chk" key={c.id}>
              <input type="checkbox" checked={seleccion.has(c.id)} onChange={() => toggleCurso(c.id)} /> {c.nombre}
            </label>
          ))}
        </div>
        <button className="btn" style={{ marginTop: '1rem' }} onClick={generar}>
          Generar código
        </button>
        {codigoGenerado && (
          <div style={{ marginTop: '1rem' }}>
            <span className="codigo-box">{codigoGenerado}</span>{' '}
            <button
              className="btn sec"
              onClick={() => {
                navigator.clipboard.writeText(codigoGenerado);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 1500);
              }}
            >
              {copiado ? '¡Copiado!' : 'Copiar'}
            </button>
          </div>
        )}
      </div>
      <h2 className="titulo" style={{ fontSize: '1.2rem' }}>
        Códigos generados
      </h2>
      {filas === null ? (
        <p>Cargando…</p>
      ) : (
        <DataTable
          columns={[
            { key: 'codigo', header: 'Código', render: (f) => <strong style={{ fontFamily: 'monospace' }}>{f.codigo}</strong> },
            { key: 'comprador', header: 'Comprador' },
            { key: 'cursos', header: 'Cursos', render: (f) => (f.codigo_cursos || []).map((x) => x.cursos?.nombre || '—').join(', ') },
            { key: 'estado', header: 'Estado', render: (f) => <span className={`tag ${f.estado}`}>{f.estado}</span> },
            { key: 'fecha', header: 'Fecha', render: (f) => (f.creado_en ? new Date(f.creado_en).toLocaleDateString('es-PE') : '') },
          ]}
          rows={filas.map((f, i) => ({ ...f, id: i }))}
        />
      )}
    </>
  );
}
