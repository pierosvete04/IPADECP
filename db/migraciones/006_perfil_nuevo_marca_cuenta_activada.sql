-- =============================================================================
-- Un perfil que nace de un auto-registro nace ya activado.
--
-- ESTADO: APLICADA el 2026-08-06 (migración `perfil_nuevo_marca_cuenta_activada`).
--
-- Sin esto, la 005 dejaba un hueco: el backfill marcó como activadas las
-- cuentas que YA existían y habían iniciado sesión, pero nada marcaba las que
-- se crearan de ahí en adelante. Un alumno que se registrara solo en la web
-- quedaba con `cuenta_activada_en` en null — o sea, "sin estrenar" —, y el
-- formulario de registro le habría ofrecido activar con un código una cuenta
-- que él mismo acababa de crear.
--
-- La marca la manda el formulario público (`auto_registro: true` en los
-- metadatos del signUp) y no la deduce el trigger, porque este mismo trigger
-- corre también cuando `admin-crear-usuario` da de alta a un cliente de
-- certificación directa. Esa otra cuenta SÍ debe quedar sin estrenar: es
-- exactamente la que el cliente va a reclamar después con su código.
-- =============================================================================

create or replace function public.crear_perfil_nuevo_usuario()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
BEGIN
  INSERT INTO perfiles (id, nombre, email, documento, nombres, apellidos, tipo_documento, documento_verificado, cuenta_activada_en)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'nombre',
    NEW.email,
    NEW.raw_user_meta_data->>'documento',
    NEW.raw_user_meta_data->>'nombres',
    NEW.raw_user_meta_data->>'apellidos',
    COALESCE(NEW.raw_user_meta_data->>'tipo_documento', 'DNI'),
    COALESCE((NEW.raw_user_meta_data->>'documento_verificado')::boolean, false),
    CASE WHEN COALESCE((NEW.raw_user_meta_data->>'auto_registro')::boolean, false) THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;
