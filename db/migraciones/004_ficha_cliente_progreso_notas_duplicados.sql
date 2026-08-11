-- =============================================================================
-- Datos que la ficha de cliente necesitaba y no tenía.
--
-- ESTADO: APLICADA el 2026-08-04 (migración `ficha_alumno_progreso_notas_y_duplicados`).
--
-- Tres cosas:
--   1. `perfiles.notas_internas` — contexto del equipo sobre un cliente.
--   2. `admin_resumen_alumno`    — último acceso real + avance curso por curso.
--   3. `admin_posibles_duplicados` — avisa de cuentas con el mismo documento.
--
-- Sobre el último acceso: NO se usa `perfiles.ultima_actividad`. Esa columna la
-- escribe `sumar_puntos`, así que significa "última vez que ganó puntos" y hoy
-- la tiene 1 de 33 perfiles. El dato correcto es `auth.users.last_sign_in_at`,
-- que Supabase mantiene solo en cada inicio de sesión. Con él se distingue a
-- quien compró y nunca entró de quien entra a diario.
-- =============================================================================

alter table public.perfiles add column if not exists notas_internas text;

-- El criterio de "tarea completada" es EL MISMO que usa `intentar_emitir_certificado`
-- para decidir si emite. Si acá dijera otra cosa, la ficha mostraría 12 de 12 y el
-- botón de emitir seguiría negándose, sin forma de entender por qué.
create or replace function public.admin_resumen_alumno(p_alumno_uid uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_resultado jsonb;
begin
  if p_alumno_uid <> auth.uid() and not es_admin() then
    raise exception 'No autorizado.';
  end if;

  select jsonb_build_object(
    'ultimo_acceso', (select u.last_sign_in_at from auth.users u where u.id = p_alumno_uid),
    'cuenta_creada', (select u.created_at from auth.users u where u.id = p_alumno_uid),
    'ultima_actividad', (select pf.ultima_actividad from perfiles pf where pf.id = p_alumno_uid),
    'progreso', coalesce((
      select jsonb_agg(jsonb_build_object(
               'curso_id', x.curso_id, 'total', x.total,
               'completadas', x.completadas, 'promedio', x.promedio
             ) order by x.curso_id)
      from (
        select i.curso_id,
               (select count(*) from tareas t where t.curso_id = i.curso_id and t.estado = '1') as total,
               (select count(*) from tareas t
                 where t.curso_id = i.curso_id and t.estado = '1'
                   and (((t.categoria = 'examen' or (t.categoria = 'tarea' and t.cantpreg is distinct from 'sin'))
                          and exists (select 1 from resultados_examen re
                                       where re.tarea_id = t.id and re.alumno_uid = p_alumno_uid))
                        or (t.categoria = 'tarea' and t.cantpreg = 'sin'
                          and exists (select 1 from entregas e
                                       where e.tarea_id = t.id and e.alumno_uid = p_alumno_uid)))) as completadas,
               (select round(avg(mejor), 1) from (
                  select max(re.nota) as mejor from tareas t join resultados_examen re on re.tarea_id = t.id
                   where t.curso_id = i.curso_id and re.alumno_uid = p_alumno_uid group by t.id) s) as promedio
          from inscripciones i where i.alumno_id = p_alumno_uid
      ) x
    ), '[]'::jsonb)
  ) into v_resultado;
  return v_resultado;
end;
$function$;

-- Solo avisa; no fusiona. Fusionar mueve certificados, ventas e inscripciones entre
-- personas y puede chocar con el UNIQUE (curso_id, alumno_uid) de certificados: se
-- decide caso por caso, no automáticamente.
create or replace function public.admin_posibles_duplicados(p_alumno_uid uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_doc text;
begin
  if not es_admin() then raise exception 'No autorizado.'; end if;

  select nullif(btrim(coalesce(documento, '')), '') into v_doc from perfiles where id = p_alumno_uid;
  if v_doc is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object('id', pf.id, 'nombre', pf.nombre,
                                        'email', pf.email, 'creado_en', pf.creado_en)
                     order by pf.creado_en)
      from perfiles pf
     where btrim(coalesce(pf.documento, '')) = v_doc
       and pf.id <> p_alumno_uid and coalesce(pf.rol, '') <> 'admin'
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.admin_resumen_alumno(uuid) from public, anon;
revoke all on function public.admin_posibles_duplicados(uuid) from public, anon;
grant execute on function public.admin_resumen_alumno(uuid) to authenticated;
grant execute on function public.admin_posibles_duplicados(uuid) to authenticated;
