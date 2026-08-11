/**
 * Activación de cuenta: el cliente reclama la cuenta que ya existe con su DNI.
 *
 * Va en una Edge Function y no en un RPC porque el correo y la contraseña viven
 * en `auth.users`, y eso solo se toca con service role. Todo lo demás (validar
 * el código, contar los intentos, quemarlo) sí está en la base — ver
 * db/migraciones/005_activacion_cuenta.sql.
 *
 * Orden de las operaciones, que importa:
 *   1. validar_codigo_activacion  → ¿el código es correcto? (cuenta el intento)
 *   2. updateUserById             → correo + contraseña nuevos
 *   3. consumir_codigo_activacion → recién ahora se quema el código
 *
 * Si se quemara antes del paso 2 y el cambio fallara (correo ya usado, por
 * ejemplo), la cuenta quedaría sin código y sin dueño: nadie podría entrar y
 * nadie podría volver a activarla.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function responder(cuerpo: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { documento, codigo, email, password } = await req.json();

    const correo = String(email ?? '').trim().toLowerCase();
    const clave = String(password ?? '');
    if (!correo || !correo.includes('@')) {
      return responder({ ok: false, motivo: 'Ingresa un correo electrónico válido.' }, 400);
    }
    if (clave.length < 6) {
      return responder({ ok: false, motivo: 'La contraseña debe tener al menos 6 caracteres.' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } }
    );

    const { data: validacion, error: errValidar } = await admin.rpc('validar_codigo_activacion', {
      p_documento: String(documento ?? ''),
      p_codigo: String(codigo ?? ''),
    });
    if (errValidar) {
      console.error('validar_codigo_activacion falló:', errValidar);
      return responder({ ok: false, motivo: 'No se pudo validar el código. Intenta nuevamente.' }, 500);
    }
    if (!validacion?.ok) {
      // 400 y no 401: para el navegador es un dato mal escrito, no una sesión
      // caducada. `bloqueada` viaja para que la pantalla ofrezca el WhatsApp.
      return responder({ ok: false, motivo: validacion?.motivo, bloqueada: !!validacion?.bloqueada }, 400);
    }

    const alumnoUid = validacion.alumno_uid as string;

    // `email_confirm: true` porque el correo ya quedó probado por el código que
    // el cliente tenía en la mano: mandarle un correo de confirmación solo
    // agregaría un paso más para alguien que ya demostró quién es.
    const { error: errUpdate } = await admin.auth.admin.updateUserById(alumnoUid, {
      email: correo,
      password: clave,
      email_confirm: true,
    });
    if (errUpdate) {
      const yaUsado = /already|registered|exists/i.test(errUpdate.message || '');
      return responder(
        {
          ok: false,
          motivo: yaUsado
            ? 'Ese correo ya está en uso por otra cuenta. Usa otro correo.'
            : 'No se pudo actualizar tu cuenta. Intenta nuevamente.',
        },
        400
      );
    }

    // El perfil guarda su propia copia del correo (la leen la ficha del cliente,
    // el checkout y los pedidos); si no se actualiza, el panel sigue mostrando
    // el @ipadecp.com.pe interno que el cliente ya no usa.
    await admin.from('perfiles').update({ email: correo }).eq('id', alumnoUid);

    const { error: errConsumir } = await admin.rpc('consumir_codigo_activacion', { p_alumno_uid: alumnoUid });
    if (errConsumir) {
      // La cuenta YA es del cliente y puede entrar: no es un fallo que deba ver.
      // Queda en el log para limpiar el código a mano si hiciera falta.
      console.error('No se pudo consumir el código de activación de', alumnoUid, errConsumir);
    }

    return responder({ ok: true, email: correo });
  } catch (e) {
    console.error('activar-cuenta:', e);
    return responder({ ok: false, motivo: 'No se pudo completar la activación. Intenta nuevamente.' }, 500);
  }
});
