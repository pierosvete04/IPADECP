-- =============================================================================
-- Créditos, meses y horas lectivas: que salgan solos, tomados del curso.
--
-- EL PROBLEMA
-- `certificados.creditos`, `.meses` y `.horas_lectivas` son columnas por
-- certificado, y ninguna pantalla de emisión las llena: quedan en NULL salvo
-- que alguien entre después a "Certificados emitidos → Editar" y las tipee a
-- mano, certificado por certificado. Con 200-300 emisiones mensuales eso no
-- pasa nunca, así que los diseños que colocan esos tres campos los imprimen en
-- blanco — que es exactamente lo que se vio en el certificado 28 (Centro
-- quirúrgico): el diseño tenía los campos, la fila no tenía los datos.
--
-- Y los tres son, en realidad, propiedades DEL CURSO, no de cada emisión: todos
-- los alumnos de "Centro quirúrgico" llevan los mismos créditos, los mismos
-- meses y las mismas horas lectivas. Tipearlos por certificado es repetir el
-- mismo dato una vez por alumno, con el riesgo de que se contradigan entre sí.
--
-- LA CORRECCIÓN
-- Los tres pasan a vivir en `cursos` como valor por defecto, y un trigger los
-- copia al certificado al emitirlo cuando la fila no trae valor propio.
--
-- Se copian AL EMITIR y no se leen en vivo desde el curso a propósito: el
-- certificado es un documento sellado. Si mañana el curso cambia de 30 a 40
-- créditos, los diplomas ya entregados tienen que seguir diciendo 30 — igual
-- que `nombre_completo`, que también se congela en la fila (ver la nota en
-- lib/server/certificadoPdf.ts sobre por qué el perfil no pisa al certificado).
--
-- Si la fila YA trae valor no se pisa: la carga masiva de certificados
-- históricos trae sus propios números y debe conservarlos, igual que ya pasa
-- con registro/libro en `certificados_asignar_libro_registro`.
--
-- Aplica a las dos modalidades. La regla "solo certificación directa" existe
-- para registro/libro porque responden al libro físico del instituto; estos
-- tres son datos académicos del curso y no tienen esa restricción. Un diseño
-- que no los coloque simplemente no los imprime.
-- =============================================================================

alter table public.cursos
  add column if not exists creditos       text,
  add column if not exists meses          text,
  add column if not exists horas_lectivas text;

comment on column public.cursos.creditos is
  'Créditos académicos del curso. Valor por defecto que se copia al certificado al emitirlo (ver certificados_datos_academicos_del_curso).';
comment on column public.cursos.meses is
  'Meses de estudio del curso. Valor por defecto que se copia al certificado al emitirlo.';
comment on column public.cursos.horas_lectivas is
  'Horas lectivas del curso. Valor por defecto que se copia al certificado al emitirlo.';

create or replace function public.certificados_datos_academicos_del_curso()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_curso cursos%rowtype;
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

  -- coalesce y no asignación directa: lo que ya trae la fila manda siempre.
  new.creditos       := coalesce(new.creditos,       nullif(btrim(coalesce(v_curso.creditos, '')),       ''));
  new.meses          := coalesce(new.meses,          nullif(btrim(coalesce(v_curso.meses, '')),          ''));
  new.horas_lectivas := coalesce(new.horas_lectivas, nullif(btrim(coalesce(v_curso.horas_lectivas, '')), ''));

  return new;
end;
$function$;

comment on function public.certificados_datos_academicos_del_curso() is
  'Copia créditos/meses/horas lectivas del curso al certificado al emitirlo, sin pisar los valores que la fila ya traiga.';

drop trigger if exists trg_certificados_datos_academicos on public.certificados;

create trigger trg_certificados_datos_academicos
  before insert on public.certificados
  for each row
  execute function public.certificados_datos_academicos_del_curso();
