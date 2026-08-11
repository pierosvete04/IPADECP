-- =============================================================================
-- La fecha del certificado se guardaba un día antes de la elegida.
--
-- EL PROBLEMA
-- `certificados.fecha` es `timestamptz`, pero lo que representa es un DÍA DE
-- CALENDARIO elegido por una persona en un <input type="date">. Las funciones de
-- emisión lo guardaban con `p_fecha::timestamptz`, y como la sesión de Postgres
-- corre en UTC, eso da la medianoche UTC de ese día:
--
--     '2026-12-23'::timestamptz  →  2026-12-23 00:00:00+00
--
-- El PDF y la página pública formatean SIEMPRE en hora de Perú (ver lib/fechas.ts,
-- que fija America/Lima a propósito para que el certificado no cambie de día según
-- desde dónde se mire). Lima va 5 horas atrás, así que esa medianoche UTC cae a
-- las 19:00 del día ANTERIOR:
--
--     2026-12-23 00:00:00+00  →  se imprime "22/12/2026"
--
-- Resultado: todo certificado de certificación directa salía con un día menos del
-- que el admin eligió. Los cuatro emitidos hasta hoy lo tenían:
--
--     elegido 23/12/2026 → imprimía 22/12/2026   (certificados 8 y 10)
--     elegido 24/12/2025 → imprimía 23/12/2025   (certificado 11)
--     elegido 24/04/2026 → imprimía 23/04/2026   (certificado 12)
--
-- QUÉ NO ESTABA AFECTADO
--  - Los certificados 'evaluado' (certificación web): su fecha es `now()`, un
--    instante real, y convertirlo a hora de Perú es lo correcto.
--  - Las tres fechas del período (inicio, entrega, cierre): son columnas `date`
--    y `fechaSoloDia` las formatea partiendo el texto, justamente para no caer
--    en este mismo problema.
--
-- LA CORRECCIÓN
-- Guardar la medianoche de LIMA, no la de UTC:
--
--     '2026-12-23'::timestamp at time zone 'America/Lima'  →  2026-12-23 05:00:00+00
--     ... que en Lima se lee 23/12/2026. El día elegido y el impreso coinciden.
--
-- Se encapsula en `dia_peru(date)` para que las tres funciones de escritura usen
-- la misma conversión y no vuelva a divergir.
-- =============================================================================

create or replace function public.dia_peru(d date)
returns timestamptz
language sql
immutable
set search_path to 'public'
as $function$
  -- Medianoche en Lima del día indicado. Para columnas timestamptz que en
  -- realidad representan un día de calendario elegido por una persona.
  select d::timestamp at time zone 'America/Lima';
$function$;

comment on function public.dia_peru(date) is
  'Medianoche de Lima del día dado. Usar al guardar en certificados.fecha: un cast directo a timestamptz da medianoche UTC, que en Perú se lee como el día anterior.';

-- --- 1. Emisión individual ---------------------------------------------------

create or replace function public.admin_emitir_certificado_directo(
  p_curso_id integer, p_periodo_id bigint, p_fecha date, p_dni text,
  p_nombre_completo text, p_cargo text, p_alumno_uid uuid default null::uuid
)
returns certificados
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_periodo periodos_certificacion%rowtype;
  v_row certificados%rowtype;
begin
  if not es_admin() then
    raise exception 'No autorizado.';
  end if;

  select * into v_periodo from periodos_certificacion where id = p_periodo_id;
  if not found then
    raise exception 'El período no existe.';
  end if;
  if p_fecha < v_periodo.fecha_inicio or p_fecha > v_periodo.fecha_cierre then
    raise exception 'La fecha debe estar dentro del rango del período (% a %).', v_periodo.fecha_inicio, v_periodo.fecha_cierre;
  end if;
  if not es_dia_habil(p_fecha) then
    raise exception 'La fecha elegida no es un día hábil (fin de semana o feriado).';
  end if;
  if p_dni is null or length(trim(p_dni)) = 0 then
    raise exception 'El DNI es obligatorio.';
  end if;

  insert into certificados (curso_id, alumno_uid, fecha, estado, dni, nombre_completo, cargo, periodo_id, modalidad, emitido_por)
  values (p_curso_id, p_alumno_uid, dia_peru(p_fecha), 'emitido', trim(p_dni), p_nombre_completo, p_cargo, p_periodo_id, 'directo', auth.uid())
  returning * into v_row;

  return v_row;
end;
$function$;

-- --- 2. Emisión transaccional con pedido -------------------------------------
-- Igual que la versión anterior salvo el `dia_peru(...)` del insert.

create or replace function public.admin_emitir_certificados_con_pedido(
  p_alumno_uid uuid, p_dni text, p_nombre_completo text, p_cargo text,
  p_cliente_email text default null::text, p_cliente_telefono text default null::text,
  p_metodo text default 'pendiente'::text, p_estado_pago text default 'pagado'::text,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_item          jsonb;
  v_periodo       periodos_certificacion%rowtype;
  v_cert          certificados%rowtype;
  v_pedido_id     bigint;
  v_total         numeric := 0;
  v_estado_venta  text;
  v_certificados  jsonb := '[]'::jsonb;
  v_curso_nombre  text;
  v_fecha         date;
begin
  if not es_admin() then
    raise exception 'No autorizado.';
  end if;

  if p_dni is null or length(trim(p_dni)) = 0 then
    raise exception 'El DNI es obligatorio.';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'No hay cursos que certificar.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_fecha := (v_item->>'fecha')::date;

    select * into v_periodo from periodos_certificacion where id = (v_item->>'periodo_id')::bigint;
    if not found then
      raise exception 'El período % no existe.', v_item->>'periodo_id';
    end if;

    if v_fecha < v_periodo.fecha_inicio or v_fecha > v_periodo.fecha_cierre then
      raise exception 'La fecha % debe estar dentro del período (% a %).', v_fecha, v_periodo.fecha_inicio, v_periodo.fecha_cierre;
    end if;

    if not es_dia_habil(v_fecha) then
      raise exception 'La fecha % no es un día hábil (fin de semana o feriado).', v_fecha;
    end if;

    if p_alumno_uid is not null and exists (
      select 1 from certificados
       where alumno_uid = p_alumno_uid and curso_id = (v_item->>'curso_id')::int
    ) then
      select nombre into v_curso_nombre from cursos where id = (v_item->>'curso_id')::int;
      raise exception 'Este cliente ya tiene un certificado de "%". No se emite dos veces el mismo.', coalesce(v_curso_nombre, v_item->>'curso_id');
    end if;

    v_total := v_total + coalesce((v_item->>'precio')::numeric, 0);
  end loop;

  insert into pedidos (
    cliente_uid, cliente_nombre, cliente_email, cliente_telefono,
    canal, metodo, estado_pago, subtotal, descuento, total, notas,
    creado_por, incluye_certificado_fisico, origen
  ) values (
    p_alumno_uid, p_nombre_completo, nullif(trim(coalesce(p_cliente_email, '')), ''), nullif(trim(coalesce(p_cliente_telefono, '')), ''),
    'admin', p_metodo, p_estado_pago, v_total, 0, v_total, 'Certificado directo',
    auth.uid(), true, 'certificado_directo'
  )
  returning id into v_pedido_id;

  v_estado_venta := case p_estado_pago when 'pagado' then 'pagado' when 'cancelado' then 'cancelado' else 'pendiente' end;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select nombre into v_curso_nombre from cursos where id = (v_item->>'curso_id')::int;

    insert into certificados (
      curso_id, alumno_uid, fecha, estado, dni, nombre_completo, cargo,
      periodo_id, modalidad, emitido_por, pedido_id
    ) values (
      (v_item->>'curso_id')::int, p_alumno_uid, dia_peru((v_item->>'fecha')::date), 'emitido',
      trim(p_dni), p_nombre_completo, p_cargo,
      (v_item->>'periodo_id')::bigint, 'directo', auth.uid(), v_pedido_id
    )
    returning * into v_cert;

    insert into ventas (curso_id, alumno_uid, nombre_curso, monto, precio_lista, promocion_id, metodo, estado, pedido_id)
    values (
      (v_item->>'curso_id')::int, p_alumno_uid, coalesce(v_curso_nombre, ''),
      coalesce((v_item->>'precio')::numeric, 0), coalesce((v_item->>'precio')::numeric, 0),
      nullif(v_item->>'promocion_id', '')::bigint,
      p_metodo, v_estado_venta, v_pedido_id
    );

    if p_alumno_uid is not null then
      insert into inscripciones (alumno_id, curso_id, origen)
      values (p_alumno_uid, (v_item->>'curso_id')::int, 'admin')
      on conflict (alumno_id, curso_id) do nothing;
    end if;

    v_certificados := v_certificados || jsonb_build_object(
      'id', v_cert.id,
      'curso_id', v_cert.curso_id,
      'codigo_verificacion', v_cert.codigo_verificacion,
      'registro', v_cert.registro,
      'libro', v_cert.libro,
      'drive_digital_url', v_cert.drive_digital_url,
      'drive_imprimir_url', v_cert.drive_imprimir_url
    );
  end loop;

  return jsonb_build_object('pedido_id', v_pedido_id, 'total', v_total, 'certificados', v_certificados);
end;
$function$;

-- --- 3. Corrección posterior (migración 007) ---------------------------------
-- Heredaba el mismo cast; se corrige el guardado y la lectura del "antes" del
-- historial, que ahora coinciden con lo que se imprime.

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
  v_fecha_actual date;
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
  if v_row.estado = 'anulado' then
    raise exception 'Este certificado está anulado. No se puede corregir.';
  end if;

  -- El día tal y como se imprime, que es contra el que hay que comparar.
  v_fecha_actual := (v_row.fecha at time zone 'America/Lima')::date;
  v_fecha        := coalesce(p_fecha, v_fecha_actual);
  v_periodo_id   := coalesce(p_periodo_id, v_row.periodo_id);

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

  if p_fecha is not null and v_fecha is distinct from v_fecha_actual then
    v_cambios := v_cambios || jsonb_build_object('fecha', jsonb_build_object('antes', v_fecha_actual, 'despues', v_fecha));
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
     set fecha           = case when p_fecha is not null then dia_peru(v_fecha) else fecha end,
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

-- --- Corrección de los ya emitidos ------------------------------------------
--
-- Se recupera el día que el admin eligió —que es el día de calendario en UTC que
-- quedó guardado— y se reescribe como medianoche de Lima. El filtro por hora
-- 00:00 UTC acota el arreglo a las filas escritas con el cast viejo, así que
-- volver a ejecutarlo no vuelve a correr nada.

update public.certificados
   set fecha = dia_peru((fecha at time zone 'UTC')::date)
 where modalidad = 'directo'
   and (fecha at time zone 'UTC')::time = '00:00:00';
