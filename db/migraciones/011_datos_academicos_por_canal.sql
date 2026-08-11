-- =============================================================================
-- Los datos académicos del certificado dependen del CANAL, no solo del curso.
--
-- EL PROBLEMA
-- La migración 010 puso créditos/meses/horas lectivas en el curso y los copia al
-- certificado al emitirlo. Pero el mismo curso se certifica por dos canales muy
-- distintos, y no llevan los mismos números:
--
--   · Certificación directa ('directo'): 480 horas lectivas, 30 créditos, 6 meses.
--   · Certificación web ('evaluado'):    4 horas lectivas, sin créditos ni meses.
--
-- Con un solo juego de valores por curso, cualquiera de los dos canales sale mal.
--
-- POR QUÉ NO SE DUPLICAN LOS CURSOS
-- La alternativa era crear un curso "espejo" por canal (14 → 28). Se descartó:
-- duplicaría el catálogo público con dos entradas del mismo nombre, obligaría a
-- mantener dos veces el temario, las tareas y los materiales de cada curso, y
-- rompería la regla "un certificado por curso y alumno" (UNIQUE curso_id,
-- alumno_uid), porque una misma persona podría sacar los dos certificados del
-- mismo tema. El canal ya se distingue a nivel de CERTIFICADO (`modalidad`) y de
-- asignación de diseño (`plantillas_certificado_cursos.modalidad`); los datos
-- académicos siguen ese mismo criterio.
--
-- LA CORRECCIÓN
-- Un segundo juego de columnas para el canal web. Las columnas SIN sufijo siguen
-- siendo las de certificación directa (y el valor por defecto de cualquier otra
-- modalidad), y las `_evaluado` son las del canal web.
--
-- El canal web NO cae de vuelta a los valores de directa cuando sus columnas
-- están vacías, a propósito: "sin créditos ni meses" es justamente la
-- configuración pedida, y con un coalesce entre canales sería imposible
-- expresar "este canal no imprime este dato" — siempre heredaría los 30/06.
-- =============================================================================

alter table public.cursos
  add column if not exists creditos_evaluado       text,
  add column if not exists meses_evaluado          text,
  add column if not exists horas_lectivas_evaluado text;

comment on column public.cursos.creditos is
  'Créditos académicos para CERTIFICACIÓN DIRECTA (y para cualquier modalidad que no sea la web). Se copia al certificado al emitirlo.';
comment on column public.cursos.meses is
  'Meses de estudio para CERTIFICACIÓN DIRECTA. Se copia al certificado al emitirlo.';
comment on column public.cursos.horas_lectivas is
  'Horas lectivas para CERTIFICACIÓN DIRECTA. Se copia al certificado al emitirlo.';
comment on column public.cursos.creditos_evaluado is
  'Créditos académicos para CERTIFICACIÓN WEB (modalidad evaluado). Vacío = no se imprime; no hereda el valor de certificación directa.';
comment on column public.cursos.meses_evaluado is
  'Meses de estudio para CERTIFICACIÓN WEB (modalidad evaluado). Vacío = no se imprime.';
comment on column public.cursos.horas_lectivas_evaluado is
  'Horas lectivas para CERTIFICACIÓN WEB (modalidad evaluado). Vacío = no se imprime.';

create or replace function public.certificados_datos_academicos_del_curso()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_curso cursos%rowtype;
  v_creditos text;
  v_meses    text;
  v_horas    text;
begin
  -- Nada que completar: evita el SELECT en el caso más común de la carga masiva,
  -- donde las tres columnas ya vienen con la numeración histórica.
  if new.creditos is not null and new.meses is not null and new.horas_lectivas is not null then
    return new;
  end if;

  select * into v_curso from cursos where id = new.curso_id;
  if not found then
    return new;
  end if;

  -- El canal web usa su propio juego y NO hereda el de directa: dejar una de sus
  -- columnas vacía es la forma de decir "este dato no va en el certificado web".
  if new.modalidad = 'evaluado' then
    v_creditos := v_curso.creditos_evaluado;
    v_meses    := v_curso.meses_evaluado;
    v_horas    := v_curso.horas_lectivas_evaluado;
  else
    v_creditos := v_curso.creditos;
    v_meses    := v_curso.meses;
    v_horas    := v_curso.horas_lectivas;
  end if;

  -- coalesce contra lo que traiga la fila: un valor explícito manda siempre
  -- (la carga de certificados históricos trae su propia numeración).
  new.creditos       := coalesce(new.creditos,       nullif(btrim(coalesce(v_creditos, '')), ''));
  new.meses          := coalesce(new.meses,          nullif(btrim(coalesce(v_meses, '')),    ''));
  new.horas_lectivas := coalesce(new.horas_lectivas, nullif(btrim(coalesce(v_horas, '')),    ''));

  return new;
end;
$function$;

comment on function public.certificados_datos_academicos_del_curso() is
  'Copia créditos/meses/horas lectivas del curso al certificado al emitirlo, eligiendo el juego según la modalidad (web usa las columnas _evaluado). No pisa los valores que la fila ya traiga.';

-- --- Configuración pedida por el instituto -----------------------------------
-- Directa: 480 horas, 30 créditos, 6 meses. Web: solo 4 horas lectivas.

update public.cursos
   set creditos       = coalesce(nullif(btrim(coalesce(creditos, '')), ''),       '30'),
       meses          = coalesce(nullif(btrim(coalesce(meses, '')), ''),          '06'),
       horas_lectivas = coalesce(nullif(btrim(coalesce(horas_lectivas, '')), ''), '480'),
       horas_lectivas_evaluado = coalesce(nullif(btrim(coalesce(horas_lectivas_evaluado, '')), ''), '4');
