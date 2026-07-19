'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useRequireSession } from '@/lib/supabase/auth';
import Topbar from '@/Componentes/layout/Topbar';
import Footer from '@/Componentes/layout/Footer';

interface Alternativa {
  designo: string;
  titulo: string;
}
interface Pregunta {
  id: number;
  titulo: string;
  alternativas: Alternativa[];
}
interface Resultado {
  nota: number;
  situacion: string;
  correctas: number;
  total: number;
  mejor_nota: number;
  intentos_restantes: number;
}

function EvaluacionContenido() {
  const { user, loading } = useRequireSession();
  const params = useParams<{ tareaId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tareaId = parseInt(params.tareaId, 10);
  const cursoId = parseInt(searchParams.get('curso') || '', 10);
  const tituloParam = searchParams.get('titulo') || '';

  const [nombreCurso, setNombreCurso] = useState('');
  const [preguntas, setPreguntas] = useState<Pregunta[] | null>(null);
  const [respuestas, setRespuestas] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!cursoId || !tareaId) {
      router.replace('/aula');
      return;
    }
    let activo = true;
    supabase
      .from('cursos')
      .select('nombre')
      .eq('id', cursoId)
      .maybeSingle()
      .then(({ data }) => {
        if (activo) setNombreCurso(data?.nombre || '');
      });
    supabase
      .rpc('obtener_evaluacion', { p_tarea_id: tareaId })
      .then(({ data, error }) => {
        if (!activo) return;
        if (error) {
          setError(error.message);
          return;
        }
        setPreguntas(data.preguntas || []);
      });
    return () => {
      activo = false;
    };
  }, [user, cursoId, tareaId, router]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const { data, error } = await supabase.rpc('rendir_evaluacion', { p_tarea_id: tareaId, p_respuestas: respuestas });
    setEnviando(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.situacion === 'aprobado') {
      supabase.rpc('sumar_puntos', { p_tipo: 'evaluacion', p_ref_id: String(tareaId), p_puntos: 50 });
    }
    setResultado(data);
  }

  if (loading || !user) return null;

  return (
    <>
      <Topbar variant="simple" onSimpleClick={() => router.push(`/aula/curso/${cursoId}`)} />
      <main className="aula-main" style={{ maxWidth: 760, margin: '0 auto' }}>
        <div className="examen-header">
          <div className="examen-curso">{nombreCurso || 'Cargando…'}</div>
          <h1 className="examen-titulo">{tituloParam}</h1>
        </div>
        {error && <div className="aviso err">{error}</div>}

        {!resultado ? (
          preguntas === null ? (
            <p className="vacio">Cargando preguntas…</p>
          ) : !preguntas.length ? (
            <div className="aviso info">Esta evaluación aún no tiene preguntas.</div>
          ) : (
            <form onSubmit={enviar}>
              {preguntas.map((p, i) => (
                <div className="preg" key={p.id}>
                  <h4>
                    {i + 1}. {p.titulo}
                  </h4>
                  {(p.alternativas || []).map((a) => (
                    <label className="alt" key={a.designo}>
                      <input
                        type="radio"
                        name={`p${p.id}`}
                        value={a.designo}
                        checked={respuestas[p.id] === a.designo}
                        onChange={() => setRespuestas((prev) => ({ ...prev, [p.id]: a.designo }))}
                      />
                      <span className="letra">{a.designo}</span>
                      <span>{a.titulo}</span>
                    </label>
                  ))}
                </div>
              ))}
              <button className="btn bloque" type="submit" disabled={enviando}>
                Enviar respuestas
              </button>
            </form>
          )
        ) : (
          <>
            <div className={`aviso ${resultado.situacion === 'aprobado' ? 'ok' : 'err'}`}>
              <h3 style={{ margin: '.2rem 0' }}>
                Nota: {resultado.nota}/20 — {resultado.situacion === 'aprobado' ? 'Aprobado ✅' : 'Desaprobado'}
              </h3>
              Respondiste {resultado.correctas} de {resultado.total} correctas.
              <br />
              Mejor nota registrada: <strong>{resultado.mejor_nota}</strong>. Intentos restantes: {resultado.intentos_restantes}.
            </div>
            <a className="btn bloque" href={`/aula/curso/${cursoId}`}>
              Volver al curso
            </a>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}

export default function EvaluacionPage() {
  return (
    <Suspense fallback={null}>
      <EvaluacionContenido />
    </Suspense>
  );
}
