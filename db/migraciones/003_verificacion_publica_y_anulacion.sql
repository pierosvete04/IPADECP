-- =============================================================================
-- Verificación pública: nombre sellado, anulación y código corto.
--
-- ESTADO: APLICADA el 2026-08-04, en cuatro migraciones de Supabase:
--   certificado_publico_nombre_sellado
--   anulacion_de_certificados
--   verificacion_publica_codigo_corto_y_anulacion
--   buscar_certificado_publico_arreglo_solo_digitos
--
-- Este archivo es el estado final consolidado, para que el esquema quede en el
-- repo y no solo en el panel de Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. El nombre del certificado se congela al emitir.
--
-- Antes se resolvía como coalesce(perfil…, cert.nombre_completo): el PERFIL pisaba
-- lo sellado. Como el alumno edita su propio perfil desde el aula, podía reescribir
-- el nombre de un diploma ya emitido. Ocurrió de verdad: el certificado 8 se emitió
-- a "SVETE ANCHANTE PIERO PAOLO" (verificado contra RENIEC) y se verificaba como
-- "Piero Svete".
--
-- 2. Anulación: `estado` pasa a leerse de verdad, con fecha y motivo públicos.
-- 3. Código corto legible derivado del Registro N° (IPD-2026-000123).
-- -----------------------------------------------------------------------------

alter table public.certificados
  add column if not exists anulado_en timestamptz,
  add column if not exists anulado_por uuid references auth.users(id),
  add column if not exists motivo_anulacion text;

alter table public.certificados drop constraint if exists certificados_estado_check;
alter table public.certificados
  add constraint certificados_estado_check check (estado in ('emitido', 'anulado'));

-- Si está anulado tiene fecha de anulación, y si no lo está no la tiene.
alter table public.certificados drop constraint if exists certificados_anulacion_coherente;
alter table public.certificados
  add constraint certificados_anulacion_coherente check (
    (estado = 'anulado' and anulado_en is not null) or
    (estado <> 'anulado' and anulado_en is null)
  );

create index if not exists certificados_estado_idx on public.certificados (estado);

-- El Registro N° es lo que da el código corto, así que tiene que resolver a un único
-- certificado. El trigger lo asigna secuencialmente, pero el admin puede corregirlo a
-- mano desde "Corregir N°" y nada impedía repetirlo.
create unique index if not exists certificados_registro_key
  on public.certificados (registro) where registro is not null and btrim(registro) <> '';


create or replace function public.obtener_certificado_publico(p_codigo uuid)
 returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select jsonb_build_object(
    'alumno_nombre', coalesce(nullif(btrim(cert.nombre_completo), ''), p.nombres || ' ' || p.apellidos, p.nombre),
    'curso_nombre', c.nombre,
    'fecha', cert.fecha,
    'nota', cert.nota,
    'estado', cert.estado,
    'codigo', cert.codigo_verificacion,
    'codigo_corto', case
      when nullif(btrim(cert.registro), '') is null then null
      else 'IPD-' || to_char(cert.fecha at time zone 'America/Lima', 'YYYY') || '-' || btrim(cert.registro)
    end,
    'cargo', cert.cargo,
    'modalidad', cert.modalidad,
    'periodo_inicio', per.fecha_inicio,
    'periodo_entrega', per.fecha_entrega,
    'periodo_cierre', per.fecha_cierre,
    'anulado_en', cert.anulado_en,
    'motivo_anulacion', cert.motivo_anulacion,
    'drive_digital_url', cert.drive_digital_url
  )
  from certificados cert
  join cursos c on c.id = cert.curso_id
  left join perfiles p on p.id = cert.alumno_uid
  left join periodos_certificacion per on per.id = cert.periodo_id
  where cert.codigo_verificacion = p_codigo;
$function$;


-- Busca por lo que la persona tenga a mano: el UUID del QR, el código corto impreso
-- ("IPD-2026-000123") o solo el número de registro ("123"). El número se compara como
-- entero para que den igual los ceros a la izquierda.
create or replace function public.buscar_certificado_publico(p_busqueda text)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_texto   text := btrim(coalesce(p_busqueda, ''));
  v_digitos text;
  v_codigo  uuid;
begin
  if v_texto = '' then return null; end if;

  if v_texto ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return obtener_certificado_publico(v_texto::uuid);
  end if;

  -- `substring` y no regexp_replace+nullif: con una entrada de solo dígitos ("000001")
  -- el reemplazo devolvía el mismo texto y el nullif lo anulaba, así que buscar por el
  -- número pelado —lo más natural— no encontraba nada.
  v_digitos := substring(v_texto from '(\d+)\s*$');
  if v_digitos is null then return null; end if;

  select cert.codigo_verificacion into v_codigo
    from certificados cert
   where cert.registro ~ '^\d+$' and cert.registro::bigint = v_digitos::bigint
   limit 1;

  if v_codigo is null then return null; end if;
  return obtener_certificado_publico(v_codigo);
end;
$function$;

grant execute on function public.buscar_certificado_publico(text) to anon, authenticated;


-- Anula un certificado. Solo admin. Idempotente: reanular no pisa la fecha original.
create or replace function public.admin_anular_certificado(p_certificado_id bigint, p_motivo text default null)
returns certificados language plpgsql security definer set search_path to 'public'
as $function$
declare v_row certificados%rowtype;
begin
  if not es_admin() then raise exception 'No autorizado.'; end if;

  select * into v_row from certificados where id = p_certificado_id;
  if not found then raise exception 'El certificado no existe.'; end if;
  if v_row.estado = 'anulado' then return v_row; end if;

  update certificados
     set estado = 'anulado', anulado_en = now(), anulado_por = auth.uid(),
         motivo_anulacion = nullif(btrim(coalesce(p_motivo, '')), '')
   where id = p_certificado_id
  returning * into v_row;
  return v_row;
end;
$function$;

-- Revierte una anulación hecha por error.
create or replace function public.admin_restaurar_certificado(p_certificado_id bigint)
returns certificados language plpgsql security definer set search_path to 'public'
as $function$
declare v_row certificados%rowtype;
begin
  if not es_admin() then raise exception 'No autorizado.'; end if;
  update certificados
     set estado = 'emitido', anulado_en = null, anulado_por = null, motivo_anulacion = null
   where id = p_certificado_id
  returning * into v_row;
  if not found then raise exception 'El certificado no existe.'; end if;
  return v_row;
end;
$function$;

revoke all on function public.admin_anular_certificado(bigint, text) from public, anon;
revoke all on function public.admin_restaurar_certificado(bigint) from public, anon;
grant execute on function public.admin_anular_certificado(bigint, text) to authenticated;
grant execute on function public.admin_restaurar_certificado(bigint) to authenticated;
