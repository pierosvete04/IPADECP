-- =============================================================================
-- Activación de cuenta con código de 6 dígitos.
--
-- ESTADO: APLICADA el 2026-08-06 (migración `activacion_cuenta_codigo_seis_digitos`).
-- Ver también la 006, que cierra el caso de los registros nuevos.
--
-- El problema que resuelve: el cliente de certificación directa no crea su
-- cuenta, se la crea el equipo al emitirle el certificado (ver
-- `admin-crear-usuario` y lib/certificadosDirectos.ts). Esa cuenta nace con un
-- correo interno @ipadecp.com.pe que el cliente NO puede leer, así que:
--
--   - no puede recuperar su contraseña solo (el correo no le llega),
--   - no puede registrarse de nuevo (`perfiles_documento_unique` lo impide, y
--     el trigger `crear_perfil_nuevo_usuario` solo resuelve el choque por `id`,
--     así que el alta revienta con un error de base de datos ilegible),
--   - depende de que alguien del equipo le pase sus credenciales por WhatsApp.
--
-- La solución es que RECLAME la cuenta que ya existe con su DNI y le ponga su
-- propio correo y contraseña. Como el DNI en Perú no es un dato secreto, hace
-- falta un segundo factor: un código de 6 dígitos que se imprime y viaja DENTRO
-- del sobre, junto al certificado.
--
-- Por qué no se reutiliza el `codigo_verificacion` del certificado: ese código
-- es público por diseño — es el del QR, existe para que cualquiera valide el
-- certificado sin iniciar sesión. Si además abriera la cuenta, bastaría con ver
-- una foto del certificado para apoderarse de ella.
--
-- Lo que de verdad protege la cuenta no es el hash (6 dígitos son 10^6
-- combinaciones: se rompen a fuerza bruta en segundos si se deja intentar sin
-- límite) sino `intentos_activacion`. El hash solo evita que el código quede
-- legible para quien lea la tabla.
-- =============================================================================

alter table public.perfiles
  add column if not exists codigo_activacion_hash        text,
  add column if not exists codigo_activacion_creado_en   timestamptz,
  add column if not exists cuenta_activada_en            timestamptz,
  add column if not exists intentos_activacion           smallint not null default 0;

comment on column public.perfiles.codigo_activacion_hash is
  'sha256 de "documento:codigo". Null = no hay código vigente (nunca se generó, o ya se consumió al activar).';
comment on column public.perfiles.cuenta_activada_en is
  'Cuándo el cliente reclamó la cuenta y puso su propio correo/contraseña. Null = cuenta creada por el equipo y todavía sin estrenar.';

-- Máximo de intentos fallidos antes de bloquear la activación. Al llegar acá el
-- cliente tiene que escribir al instituto y un admin le regenera el código.
create or replace function public.max_intentos_activacion()
returns smallint language sql immutable as $function$ select 5::smallint $function$;

-- ---------------------------------------------------------------------------
-- 1. Generación del código (admin).
-- ---------------------------------------------------------------------------

-- Devuelve el código EN CLARO una sola vez; después solo queda el hash. Si el
-- admin no lo copia/imprime en ese momento, hay que generar otro — igual que la
-- contraseña temporal de `admin-crear-usuario`.
--
-- Generar de nuevo invalida el código anterior y reinicia los intentos: es
-- también la salida para el cliente que se quedó bloqueado o que perdió el
-- volante.
create or replace function public.admin_generar_codigo_activacion(p_alumno_uid uuid)
returns text language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_codigo text;
  v_documento text;
begin
  if not es_admin() then raise exception 'No autorizado.'; end if;

  select nullif(btrim(coalesce(documento, '')), '') into v_documento
    from perfiles where id = p_alumno_uid;
  if v_documento is null then
    raise exception 'Ese cliente no tiene documento registrado: sin DNI no hay con qué activar la cuenta.';
  end if;

  if exists (select 1 from perfiles where id = p_alumno_uid and cuenta_activada_en is not null) then
    raise exception 'Esa cuenta ya fue activada por el cliente. Si perdió el acceso, debe recuperar su contraseña desde su propio correo.';
  end if;

  -- `gen_random_bytes` y no `random()`: `random()` es predecible a partir de la
  -- semilla y acá el número ES la credencial.
  v_codigo := lpad((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0');

  update perfiles
     set codigo_activacion_hash      = encode(extensions.digest(v_documento || ':' || v_codigo, 'sha256'), 'hex'),
         codigo_activacion_creado_en = now(),
         intentos_activacion         = 0
   where id = p_alumno_uid;

  return v_codigo;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Estado de un documento (público).
-- ---------------------------------------------------------------------------

-- Con esto el formulario de registro sabe a dónde mandar a la persona en vez de
-- reventar contra el índice único con un error de Postgres.
--
-- Sí, revela si un DNI tiene cuenta en IPADECP. Es el mismo dato que filtra
-- cualquier "ese correo ya está registrado" y no se puede evitar sin arruinar
-- el flujo: quien escribe su propio DNI necesita que le digamos qué hacer.
-- Devuelve solo el estado — ni nombre, ni correo, ni nada del perfil.
create or replace function public.estado_cuenta_por_documento(p_documento text)
returns text language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_doc text; v_fila record;
begin
  v_doc := nullif(btrim(coalesce(p_documento, '')), '');
  if v_doc is null then return 'sin_cuenta'; end if;

  select cuenta_activada_en, codigo_activacion_hash, intentos_activacion
    into v_fila
    from perfiles
   where btrim(coalesce(documento, '')) = v_doc
     and coalesce(rol, '') <> 'admin'
   limit 1;

  if not found then return 'sin_cuenta'; end if;
  if v_fila.cuenta_activada_en is not null then return 'activa'; end if;
  if v_fila.intentos_activacion >= max_intentos_activacion() then return 'bloqueada'; end if;
  -- Cuenta del equipo a la que todavía nadie le generó un código: el cliente no
  -- puede hacer nada solo, tiene que escribirnos.
  if v_fila.codigo_activacion_hash is null then return 'sin_codigo'; end if;
  return 'pendiente';
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Validación del código (la usa la Edge Function `activar-cuenta`).
-- ---------------------------------------------------------------------------

-- Devuelve el uid si el código es correcto, y en el camino cuenta el intento.
-- El cambio de correo y contraseña NO se hace acá: eso vive en `auth.users` y
-- solo se toca con service role desde la Edge Function.
--
-- Deliberadamente no dice si falló por código incorrecto o por cuenta
-- inexistente — quien prueba códigos no debe poder ir descartando DNIs.
create or replace function public.validar_codigo_activacion(p_documento text, p_codigo text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_doc text;
  v_codigo text;
  v_fila record;
  v_dias_vigencia constant int := 180;
begin
  v_doc    := nullif(btrim(coalesce(p_documento, '')), '');
  v_codigo := nullif(btrim(coalesce(p_codigo, '')), '');
  if v_doc is null or v_codigo is null then
    return jsonb_build_object('ok', false, 'motivo', 'Ingresa tu documento y el código de activación.');
  end if;

  select id, cuenta_activada_en, codigo_activacion_hash, codigo_activacion_creado_en, intentos_activacion
    into v_fila
    from perfiles
   where btrim(coalesce(documento, '')) = v_doc
     and coalesce(rol, '') <> 'admin'
   limit 1;

  if not found or v_fila.codigo_activacion_hash is null then
    return jsonb_build_object('ok', false, 'motivo', 'El documento o el código no son correctos.');
  end if;

  if v_fila.cuenta_activada_en is not null then
    return jsonb_build_object('ok', false, 'motivo', 'Esa cuenta ya está activada. Inicia sesión con tu correo y contraseña.');
  end if;

  if v_fila.intentos_activacion >= max_intentos_activacion() then
    return jsonb_build_object('ok', false, 'bloqueada', true,
      'motivo', 'Por seguridad bloqueamos la activación tras varios intentos fallidos. Escríbenos por WhatsApp y te damos un código nuevo.');
  end if;

  if v_fila.codigo_activacion_creado_en < now() - make_interval(days => v_dias_vigencia) then
    return jsonb_build_object('ok', false,
      'motivo', 'Ese código ya venció. Escríbenos por WhatsApp y te generamos uno nuevo.');
  end if;

  if encode(extensions.digest(v_doc || ':' || v_codigo, 'sha256'), 'hex') <> v_fila.codigo_activacion_hash then
    -- El intento se cuenta ANTES de devolver: si se contara después de un
    -- return, un error en el llamador dejaría el contador sin avanzar y el
    -- límite no serviría de nada.
    update perfiles set intentos_activacion = intentos_activacion + 1 where id = v_fila.id;
    return jsonb_build_object('ok', false, 'motivo', 'El documento o el código no son correctos.');
  end if;

  return jsonb_build_object('ok', true, 'alumno_uid', v_fila.id);
end;
$function$;

-- Marca la cuenta como reclamada y quema el código. Se llama desde la Edge
-- Function DESPUÉS de haber cambiado correo y contraseña en `auth.users`: si se
-- marcara antes y el cambio fallara, la cuenta quedaría sin código y sin dueño.
create or replace function public.consumir_codigo_activacion(p_alumno_uid uuid)
returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  update perfiles
     set cuenta_activada_en          = now(),
         codigo_activacion_hash      = null,
         codigo_activacion_creado_en = null,
         intentos_activacion         = 0
   where id = p_alumno_uid;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Permisos.
-- ---------------------------------------------------------------------------

-- `estado_cuenta_por_documento` sí la llama gente sin sesión: es lo primero que
-- pasa en el formulario de registro.
revoke all on function public.admin_generar_codigo_activacion(uuid) from public, anon;
revoke all on function public.validar_codigo_activacion(text, text)  from public, anon;
revoke all on function public.consumir_codigo_activacion(uuid)       from public, anon;
revoke all on function public.estado_cuenta_por_documento(text)      from public;

grant execute on function public.admin_generar_codigo_activacion(uuid) to authenticated;
grant execute on function public.estado_cuenta_por_documento(text)     to anon, authenticated;

-- Las otras dos las invoca la Edge Function con service role, que se salta los
-- grants. No se le dan a `authenticated` para que nadie pueda probar códigos
-- desde el navegador saltándose la función.

-- Las cuentas que ya existían y que el cliente sí usa (se registró él en la web)
-- no son "pendientes de activación": se marcan como activadas para que el
-- formulario de registro las mande a iniciar sesión y no a pedir un código que
-- nunca les dimos. El criterio es haber iniciado sesión alguna vez.
update public.perfiles p
   set cuenta_activada_en = coalesce(u.last_sign_in_at, u.created_at)
  from auth.users u
 where u.id = p.id
   and p.cuenta_activada_en is null
   and u.last_sign_in_at is not null;
