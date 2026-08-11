-- =============================================================================
-- Tres cambios sobre el certificado emitido, decididos con el instituto:
--
--   1. El Libro N° pasa a ser un TOMO real: 100 registros por tomo.
--   2. Registro y Libro los llevan SOLO los certificados de certificación
--      directa. Los de certificación web se identifican por su código de
--      verificación y su QR.
--   3. Los datos del certificado (fecha, nombre, DNI, cargo, período) se pueden
--      corregir después de emitir, con validación y dejando rastro.
--
-- -----------------------------------------------------------------------------
-- 1. EL LIBRO COMO TOMO
--
-- Hasta ahora `libro` salía de su propio contador y avanzaba de uno en uno, así
-- que cada certificado caía en un "libro" distinto: registro 000005 → libro
-- 00005. Eso no es un libro, es un segundo correlativo con otro nombre.
--
-- Un tomo agrupa 100 asientos: registros 1-100 → Libro 1, 101-200 → Libro 2.
-- Ahora se DERIVA del registro en vez de tener contador propio, así que las dos
-- numeraciones no pueden desincronizarse: el tomo es siempre el que le toca al
-- registro que lleva impreso.
--
-- La fila 'libro' de `contadores_libro` queda sin uso. No se borra a propósito:
-- `siguiente_codigo_libro` sigue existiendo y otras cargas podrían llamarla.
--
-- -----------------------------------------------------------------------------
-- 2. REGISTRO SOLO PARA CERTIFICACIÓN DIRECTA
--
-- El Registro N° existe para cuadrar con el libro físico del instituto, y en ese
-- libro solo se asientan las certificaciones directas. Mientras ambos canales
-- compartieron el contador, cada certificado web consumía un número y abría un
-- hueco en la serie del libro. Con 200-300 emisiones mensuales ese desfase
-- convierte el campo en inservible para lo único que sirve.
--
-- Los certificados 'evaluado' quedan sin registro ni libro. Consecuencias
-- buscadas: no tienen código corto IPD-AAAA-NNNNNN (obtener_certificado_publico
-- ya devuelve null cuando el registro está vacío) y no se encuentran por número
-- en la búsqueda pública — se verifican por QR o por código de verificación.
--
-- -----------------------------------------------------------------------------
-- 3. CORREGIR UN CERTIFICADO EMITIDO
--
-- Hoy no existe forma de arreglar un dato mal puesto. La fecha, el nombre, el
-- DNI y el cargo se sellan al emitir y ninguna pantalla los toca. Y anular no
-- libera nada: marca la fila como 'anulado' pero la deja, así que el
-- UNIQUE (curso_id, alumno_uid) impide reemitir ese curso a esa persona. Un
-- simple error de tipeo en la fecha dejaba el certificado inservible y sin salida.
--
-- `admin_editar_certificado` corrige en el sitio, con las MISMAS validaciones de
-- la emisión (período válido, fecha dentro del período, día hábil) y guardando
-- quién cambió qué y cuándo en `historial_ediciones`. No hace falta regenerar
-- nada: el PDF se arma en cada descarga, así que el QR y la página pública
-- reflejan la corrección al instante.
--
-- Registro y Libro NO se pueden editar: los pone el contador y son la columna
-- vertebral de la correspondencia con el libro físico.
-- =============================================================================

-- --- 1 y 2: asignación de registro y tomo -----------------------------------

create or replace function public.certificados_asignar_libro_registro()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_por_tomo constant int := 100;
begin
  -- Solo certificación directa lleva registro y libro. La web se identifica por
  -- su codigo_verificacion (UUID) y su QR.
  if new.modalidad is distinct from 'directo' then
    return new;
  end if;

  -- Si vienen con valor no se pisan: la carga de certificados históricos trae
  -- su propia numeración y debe conservarla.
  if new.registro is null or btrim(new.registro) = '' then
    new.registro := siguiente_codigo_libro('registro');
  end if;

  -- El tomo se deriva del registro, no de un contador aparte.
  if (new.libro is null or btrim(new.libro) = '') and new.registro ~ '^\d+$' then
    new.libro := lpad((((new.registro::bigint - 1) / v_por_tomo) + 1)::text, 5, '0');
  end if;

  return new;
end;
$function$;

-- --- Backfill de lo ya emitido ----------------------------------------------

-- Los certificados web pierden registro y libro, y devuelven sus números a la serie.
update public.certificados set registro = null, libro = null
 where modalidad = 'evaluado' and (registro is not null or libro is not null);

-- Los directos existentes (registros 1 a 4) caen todos en el tomo 1.
update public.certificados
   set libro = lpad(((((registro::bigint - 1) / 100) + 1))::text, 5, '0')
 where modalidad = 'directo' and registro ~ '^\d+$';

-- El contador vuelve al mayor registro realmente en uso, para que la serie de
-- certificación directa siga sin huecos.
update public.contadores_libro
   set valor = coalesce((select max(registro::bigint) from public.certificados where registro ~ '^\d+$'), 0),
       actualizado_en = now()
 where nombre = 'registro';

-- --- 3: corrección de datos con auditoría -----------------------------------

alter table public.certificados
  add column if not exists editado_en timestamptz,
  add column if not exists editado_por uuid,
  add column if not exists historial_ediciones jsonb not null default '[]'::jsonb;

comment on column public.certificados.historial_ediciones is
  'Correcciones posteriores a la emisión: [{cuando, quien, motivo, cambios:{campo:{antes,despues}}}]. Solo crece.';

create or replace function public.admin_editar_certificado(
  p_certificado_id  bigint,
  p_fecha           date    default null,
  p_nombre_completo text    default null,
  p_dni             text    default null,
  p_cargo           text    default null,
  p_periodo_id      bigint  default null,
  p_motivo          text    default null
)
returns certificados
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row      certificados%rowtype;
  v_periodo  periodos_certificacion%rowtype;
  v_fecha    date;
  v_periodo_id bigint;
  v_cambios  jsonb := '{}'::jsonb;
begin
  if not es_admin() then
    raise exception 'No autorizado.';
  end if;

  select * into v_row from certificados where id = p_certificado_id;
  if not found then
    raise exception 'El certificado no existe.';
  end if;
  -- Un certificado anulado ya no se corrige: se emite otro. Editarlo daría un
  -- documento anulado con datos nuevos, que no representa nada.
  if v_row.estado = 'anulado' then
    raise exception 'Este certificado está anulado. No se puede corregir.';
  end if;

  -- null = "no cambiar este campo". Estos datos no se vacían, se corrigen.
  v_fecha      := coalesce(p_fecha, (v_row.fecha at time zone 'America/Lima')::date);
  v_periodo_id := coalesce(p_periodo_id, v_row.periodo_id);

  -- Mismas reglas que la emisión, y solo donde aplican: un certificado
  -- 'evaluado' lleva la fecha real en que el alumno terminó el curso, que puede
  -- caer en sábado y no pertenece a ningún período de certificación.
  if v_row.modalidad = 'directo' then
    if v_periodo_id is null then
      raise exception 'Un certificado de certificación directa necesita un período.';
    end if;
    select * into v_periodo from periodos_certificacion where id = v_periodo_id;
    if not found then
      raise exception 'El período no existe.';
    end if;
    if v_fecha < v_periodo.fecha_inicio or v_fecha > v_periodo.fecha_cierre then
      raise exception 'La fecha debe estar dentro del rango del período (% a %).', v_periodo.fecha_inicio, v_periodo.fecha_cierre;
    end if;
    if not es_dia_habil(v_fecha) then
      raise exception 'La fecha elegida no es un día hábil (fin de semana o feriado).';
    end if;
    if p_dni is not null and length(btrim(p_dni)) = 0 then
      raise exception 'El DNI no puede quedar vacío.';
    end if;
  end if;

  -- Solo se registra lo que de verdad cambió, para que el historial se lea.
  if p_fecha is not null and v_fecha is distinct from (v_row.fecha at time zone 'America/Lima')::date then
    v_cambios := v_cambios || jsonb_build_object('fecha', jsonb_build_object(
      'antes', (v_row.fecha at time zone 'America/Lima')::date, 'despues', v_fecha));
  end if;
  if p_nombre_completo is not null and btrim(p_nombre_completo) is distinct from v_row.nombre_completo then
    v_cambios := v_cambios || jsonb_build_object('nombre_completo', jsonb_build_object(
      'antes', v_row.nombre_completo, 'despues', btrim(p_nombre_completo)));
  end if;
  if p_dni is not null and btrim(p_dni) is distinct from v_row.dni then
    v_cambios := v_cambios || jsonb_build_object('dni', jsonb_build_object('antes', v_row.dni, 'despues', btrim(p_dni)));
  end if;
  if p_cargo is not null and btrim(p_cargo) is distinct from v_row.cargo then
    v_cambios := v_cambios || jsonb_build_object('cargo', jsonb_build_object('antes', v_row.cargo, 'despues', btrim(p_cargo)));
  end if;
  if p_periodo_id is not null and v_periodo_id is distinct from v_row.periodo_id then
    v_cambios := v_cambios || jsonb_build_object('periodo_id', jsonb_build_object('antes', v_row.periodo_id, 'despues', v_periodo_id));
  end if;

  if v_cambios = '{}'::jsonb then
    return v_row;
  end if;

  update certificados
     set fecha           = case when p_fecha is not null then v_fecha::timestamptz else fecha end,
         nombre_completo = coalesce(btrim(p_nombre_completo), nombre_completo),
         dni             = coalesce(btrim(p_dni), dni),
         cargo           = coalesce(btrim(p_cargo), cargo),
         periodo_id      = v_periodo_id,
         editado_en      = now(),
         editado_por     = auth.uid(),
         historial_ediciones = historial_ediciones || jsonb_build_array(jsonb_build_object(
           'cuando', now(),
           'quien', auth.uid(),
           'motivo', nullif(btrim(coalesce(p_motivo, '')), ''),
           'cambios', v_cambios))
   where id = p_certificado_id
  returning * into v_row;

  return v_row;
end;
$function$;
