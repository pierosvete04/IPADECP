-- =============================================================================
-- Emisión de certificados directos en una sola transacción.
--
-- ESTADO: APLICADA el 2026-08-04 (migración `emision_certificado_directo_transaccional`).
-- La función existe en la base de datos, pero el código de la app TODAVÍA NO la
-- usa: sigue con el camino actual (emitir → crear pedido → insertar ventas desde
-- el navegador). Crearla no cambia el comportamiento de nada; el cambio ocurre
-- cuando el cliente empiece a llamarla. Ver "Cómo adoptarla" al final.
--
-- PROBLEMA QUE RESUELVE
-- Hoy la emisión son tres pasos independientes disparados desde el navegador:
--   1. N × RPC admin_emitir_certificado_directo
--   2. INSERT en pedidos
--   3. INSERT en ventas
-- No hay transacción que los abarque. Si el paso 3 falla, queda un pedido con
-- total y sin ítems (el propio código lo reporta: "el pedido #N se creó pero sin
-- sus ítems"). Si el navegador se cierra entre el 1 y el 2, quedan certificados
-- emitidos que no pertenecen a ningún pedido y no aparecen en la contabilidad.
--
-- Esta función hace los tres pasos dentro de la misma transacción: o queda todo,
-- o no queda nada.
-- =============================================================================

create or replace function public.admin_emitir_certificados_con_pedido(
  p_alumno_uid    uuid,
  p_dni           text,
  p_nombre_completo text,
  p_cargo         text,
  p_cliente_email text default null,
  p_cliente_telefono text default null,
  p_metodo        text default 'pendiente',
  p_estado_pago   text default 'pagado',
  -- [{ "curso_id": 1, "periodo_id": 2, "fecha": "2026-04-30", "precio": 150, "promocion_id": null }, ...]
  p_items         jsonb default '[]'::jsonb
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

  -- Se valida TODO antes de escribir nada: si el tercer curso trae una fecha
  -- inválida, no queremos que los dos primeros ya estén emitidos.
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

    -- El UNIQUE (curso_id, alumno_uid) lo impediría igual, pero con un mensaje
    -- de Postgres. Acá se explica en el idioma del negocio.
    if p_alumno_uid is not null and exists (
      select 1 from certificados
       where alumno_uid = p_alumno_uid and curso_id = (v_item->>'curso_id')::int
    ) then
      select nombre into v_curso_nombre from cursos where id = (v_item->>'curso_id')::int;
      raise exception 'Este cliente ya tiene un certificado de "%". No se emite dos veces el mismo.', coalesce(v_curso_nombre, v_item->>'curso_id');
    end if;

    v_total := v_total + coalesce((v_item->>'precio')::numeric, 0);
  end loop;

  -- El pedido nace primero para poder sellar `certificados.pedido_id` en el
  -- mismo INSERT, en vez de emitir y volver a pasar con un UPDATE.
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
      (v_item->>'curso_id')::int, p_alumno_uid, (v_item->>'fecha')::date::timestamptz, 'emitido',
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

revoke all on function public.admin_emitir_certificados_con_pedido from public, anon;
grant execute on function public.admin_emitir_certificados_con_pedido to authenticated;


-- =============================================================================
-- CÓMO ADOPTARLA (paso siguiente, no incluido en este archivo)
--
-- 1. Aplicar esta migración en un branch de Supabase y probarla ahí.
-- 2. En src/lib/certificadosDirectos.ts, añadir una función que la invoque.
-- 3. Cambiar CertificadosDirectosSection.emitir() y CargaMasivaCertificados
--    para llamarla una vez por cliente, en vez de orquestar los tres pasos.
-- 4. Recién entonces se puede borrar registrarPedidosPorLote() y
--    vincularCertificadosAPedido().
--
-- Ojo con el progreso en pantalla: hoy se actualiza curso a curso porque cada
-- uno es una llamada. Con esta función la unidad pasa a ser el cliente, así que
-- el indicador debe contar clientes ("Emitiendo 3 de 12 clientes"), no cursos.
-- =============================================================================
