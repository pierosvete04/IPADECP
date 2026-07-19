'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useRequireSession } from '@/lib/supabase/auth';
import AulaShell from '@/Componentes/layout/AulaShell';
import InformacionTab, { CursoDetalle } from '@/Componentes/curso/InformacionTab';
import ModulosTab, { Material, Modulo } from '@/Componentes/curso/ModulosTab';
import TareasTab from '@/Componentes/curso/TareasTab';
import ExamenesTab from '@/Componentes/curso/ExamenesTab';
import CertificadoBanner from '@/Componentes/curso/CertificadoBanner';
import type { Tarea } from '@/Componentes/curso/EvalRow';

type TabKey = 'general' | 'modulos' | 'tareas' | 'examenes';
const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'general', label: 'Información general', icon: 'info' },
  { key: 'modulos', label: 'Módulos', icon: 'menu_book' },
  { key: 'tareas', label: 'Tareas', icon: 'edit_note' },
  { key: 'examenes', label: 'Exámenes', icon: 'assignment' },
];

function CursoContenido() {
  const { user, loading } = useRequireSession();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cursoId = parseInt(params.id, 10);
  const tab = (searchParams.get('tab') as TabKey) || 'general';

  const [inscrito, setInscrito] = useState<boolean | null>(null);
  const [curso, setCurso] = useState<CursoDetalle | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [mejorPorTarea, setMejorPorTarea] = useState<Record<number, { nota: number; intentos: number }>>({});
  const [misEntregas, setMisEntregas] = useState<Record<number, { nota: number | null; situacion: string | null }>>({});
  const [alumnoNombre, setAlumnoNombre] = useState('');
  const [avisoEntrega, setAvisoEntrega] = useState<{ texto: string; tipo: 'ok' | 'err' } | null>(null);

  useEffect(() => {
    if (!user || !cursoId) return;
    let activo = true;
    (async () => {
      const { data: insc } = await supabase.from('inscripciones').select('curso_id').eq('curso_id', cursoId).maybeSingle();
      if (!activo) return;
      if (!insc) {
        setInscrito(false);
        return;
      }
      setInscrito(true);

      const { data: c } = await supabase.from('cursos').select('*').eq('id', cursoId).maybeSingle();
      if (activo) setCurso(c);

      const { data: perfil } = await supabase.from('perfiles').select('nombres,apellidos,nombre').eq('id', user.id).maybeSingle();
      if (activo) {
        const nombreCompuesto = perfil?.nombres && perfil?.apellidos ? `${perfil.nombres} ${perfil.apellidos}` : perfil?.nombre;
        setAlumnoNombre(nombreCompuesto || user.email || 'Alumno');
      }

      const { data: mods } = await supabase.from('modulos').select('*').eq('curso_id', cursoId).eq('estado', '1').order('id');
      if (activo) setModulos(mods || []);

      const { data: mats } = await supabase.from('materiales').select('*').eq('curso_id', cursoId).eq('estado', '1').order('id');
      if (activo) setMateriales(mats || []);

      const { data: tareasData } = await supabase
        .from('tareas')
        .select('*')
        .eq('curso_id', String(cursoId))
        .eq('estado', '1')
        .order('titulo');
      const listaTareas = tareasData || [];
      if (activo) setTareas(listaTareas);

      const ids = listaTareas.map((t) => t.id);
      if (ids.length) {
        const { data: rs } = await supabase.from('resultados_examen').select('tarea_id,nota,intento').in('tarea_id', ids);
        if (activo) {
          const mapa: Record<number, { nota: number; intentos: number }> = {};
          (rs || []).forEach((r) => {
            const actual = mapa[r.tarea_id] || { nota: 0, intentos: 0 };
            mapa[r.tarea_id] = { nota: Math.max(actual.nota, r.nota || 0), intentos: Math.max(actual.intentos, r.intento || 0) };
          });
          setMejorPorTarea(mapa);
        }
      }

      const entregables = listaTareas.filter((t) => t.categoria === 'tarea' && t.cantpreg === 'sin');
      if (entregables.length && user) {
        const { data: es } = await supabase.from('entregas').select('tarea_id,nota,situacion').eq('alumno_uid', user.id);
        if (activo) {
          const mapa: Record<number, { nota: number | null; situacion: string | null }> = {};
          (es || []).forEach((e) => (mapa[e.tarea_id] = { nota: e.nota, situacion: e.situacion }));
          setMisEntregas(mapa);
        }
      }
    })();
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, cursoId]);

  async function sumarPuntos(tipo: string, refId: string | number, puntos: number) {
    await supabase.rpc('sumar_puntos', { p_tipo: tipo, p_ref_id: String(refId), p_puntos: puntos });
  }

  async function subirEntrega(tareaId: number, file: File) {
    if (!user) return;
    setAvisoEntrega(null);
    const ruta = `${user.id}/${tareaId}_${Date.now()}_${file.name}`;
    const { error: e1 } = await supabase.storage.from('entregas').upload(ruta, file);
    if (e1) {
      setAvisoEntrega({ texto: 'No se pudo subir tu entrega. Verifica el archivo e intenta de nuevo.', tipo: 'err' });
      return;
    }
    const { error: e2 } = await supabase.from('entregas').insert({ tarea_id: tareaId, alumno_uid: user.id, archivo_url: ruta, situacion: 'entregado' });
    if (e2) {
      setAvisoEntrega({ texto: 'Se subió tu archivo, pero no se pudo registrar la entrega. Intenta de nuevo.', tipo: 'err' });
      return;
    }
    setAvisoEntrega({ texto: 'Entrega registrada.', tipo: 'ok' });
    setMisEntregas((prev) => ({ ...prev, [tareaId]: { nota: null, situacion: 'entregado' } }));
  }

  const autoeval = useMemo(() => tareas.filter((t) => t.categoria === 'tarea' && t.cantpreg !== 'sin'), [tareas]);
  const examenes = useMemo(() => tareas.filter((t) => t.categoria === 'examen'), [tareas]);
  const entregables = useMemo(() => tareas.filter((t) => t.categoria === 'tarea' && t.cantpreg === 'sin'), [tareas]);

  const completadas = useMemo(
    () =>
      tareas.filter((t) =>
        t.categoria === 'tarea' && t.cantpreg === 'sin' ? !!misEntregas[t.id] : !!mejorPorTarea[t.id]
      ).length,
    [tareas, mejorPorTarea, misEntregas]
  );

  function setTab(t: TabKey) {
    router.push(`/aula/curso/${cursoId}?tab=${t}`);
  }

  if (loading || !user) return null;

  return (
    <AulaShell user={user} activeSec="cursos" extraBodyClass="curso-shell">
      <Link href="/aula?sec=cursos" className="migas">
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          arrow_back
        </span>{' '}
        Volver a Mis cursos
      </Link>
      <h1 className="titulo">{inscrito === false ? 'Acceso no disponible' : curso?.nombre || 'Cargando…'}</h1>

      {inscrito === false && (
        <div className="aviso err">
          No tienes acceso a este curso. Ingresa tu código en <Link href="/aula?sec=cursos">Mis cursos</Link>.
        </div>
      )}

      {inscrito && (
        <>
          {user && curso && (
            <div style={{ marginBottom: '1rem' }}>
              <CertificadoBanner
                cursoId={cursoId}
                cursoNombre={curso.nombre || ''}
                userId={user.id}
                alumnoNombre={alumnoNombre}
                completadas={completadas}
                total={tareas.length}
              />
            </div>
          )}

          <nav className="tabs aula-tabs">
            {TABS.map((t) => (
              <a
                key={t.key}
                href="#"
                className={`tab-btn${tab === t.key ? ' activo' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  setTab(t.key);
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {t.icon}
                </span>{' '}
                {t.label}
              </a>
            ))}
          </nav>

          {curso && (
            <div>
              <div className={`tab-pane${tab === 'general' ? ' activo' : ''}`}>
                <InformacionTab curso={curso} />
              </div>
              <div className={`tab-pane${tab === 'modulos' ? ' activo' : ''}`}>
                <ModulosTab modulos={modulos} materiales={materiales} onVerModulo={(id) => sumarPuntos('leccion', 'mod-' + id, 10)} />
              </div>
              <div className={`tab-pane${tab === 'tareas' ? ' activo' : ''}`}>
                {avisoEntrega && <div className={`aviso ${avisoEntrega.tipo}`}>{avisoEntrega.texto}</div>}
                <TareasTab cursoId={cursoId} autoeval={autoeval} entregables={entregables} mejorPorTarea={mejorPorTarea} misEntregas={misEntregas} onSubir={subirEntrega} />
              </div>
              <div className={`tab-pane${tab === 'examenes' ? ' activo' : ''}`}>
                <ExamenesTab cursoId={cursoId} examenes={examenes} mejorPorTarea={mejorPorTarea} />
              </div>
            </div>
          )}
        </>
      )}
    </AulaShell>
  );
}

export default function CursoPage() {
  return (
    <Suspense fallback={null}>
      <CursoContenido />
    </Suspense>
  );
}
