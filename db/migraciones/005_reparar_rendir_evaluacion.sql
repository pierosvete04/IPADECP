-- =============================================================================
-- Repara `rendir_evaluacion`: apuntaba a columnas que ya no existen.
--
-- PROBLEMA QUE RESUELVE
-- Esta es LA función que califica en el aula: recibe las respuestas del alumno,
-- las compara con las correctas, calcula la nota e inserta en
-- `resultados_examen`. Ese INSERT es el que dispara `trigger_verificar_certificado`
-- y por lo tanto el que emite el certificado de certificación web.
--
-- En algún momento las tablas del aula pasaron al esquema nuevo de nombres.
-- `obtener_evaluacion` y `mi_promedio_curso` se migraron; esta se quedó atrás y
-- seguía leyendo:
--
--     tareas.idtarea        → hoy es  tareas.id
--     tareas.id_curso       → hoy es  tareas.curso_id   (además ahora es integer, no text)
--     preguntas.id_tarea    → hoy es  preguntas.tarea_id
--     preguntas.idpreg      → hoy es  preguntas.id
--     respuestas.idpreg     → hoy es  respuestas.pregunta_id
--
-- Postgres no valida los nombres de columna dentro del cuerpo de una función
-- plpgsql al crearla — solo cuando la línea se ejecuta. Por eso la función se
-- guardó sin protestar y fallaba con 42703 recién cuando un alumno enviaba sus
-- respuestas. Efecto en cadena: nunca se escribía en `resultados_examen`, el
-- trigger nunca corría, y ningún alumno podía obtener su certificado. A la
-- fecha de esta migración había 0 certificados de modalidad 'evaluado' en la
-- base, con 14 cursos publicados y alumnos inscritos.
--
-- QUÉ NO CAMBIA
-- La lógica de calificación estaba bien y se conserva intacta:
--   - Límite de intentos: 1 para 'examen', 2 para el resto.
--   - Nota = round(correctas / total * 20). Aprueba con 13.
--   - La alternativa correcta se lee de `respuestas.respuesta`, que guarda la
--     letra correcta REPETIDA en cada fila de opción de la pregunta (por eso el
--     max() es válido: todas las filas de una pregunta traen el mismo valor).
--     `respuestas.designo` es la letra de esa opción concreta.
--   - El contrato con el front no se toca: `p_respuestas` sigue siendo
--     { "<preguntas.id>": "<letra designo>" }, que es exactamente lo que arma
--     src/app/aula/evaluacion/[tareaId]/page.tsx a partir de `obtener_evaluacion`.
--
-- ÚNICO AÑADIDO DE COMPORTAMIENTO
-- Si el id de tarea no existe, ahora responde 'Evaluación no encontrada.' en vez
-- de caer en el chequeo de inscripción y decir 'No tienes acceso a esta
-- evaluación.', que mandaba a buscar un problema de permisos donde no lo había.
-- Es el mismo mensaje que ya usa `obtener_evaluacion` para ese caso.
-- =============================================================================

create or replace function public.rendir_evaluacion(p_tarea_id integer, p_respuestas jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_uid uuid := auth.uid();
  v_curso_id integer;
  v_categoria text;
  v_max integer;
  v_total integer := 0;
  v_correctas integer := 0;
  v_nota numeric;
  v_situ text;
  v_intentos integer;
  v_best numeric;
  r RECORD;
  v_elegida text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión.'; END IF;

  SELECT curso_id, categoria INTO v_curso_id, v_categoria FROM tareas WHERE id = p_tarea_id;
  IF v_curso_id IS NULL THEN RAISE EXCEPTION 'Evaluación no encontrada.'; END IF;

  IF NOT EXISTS (SELECT 1 FROM inscripciones i WHERE i.alumno_id = v_uid AND i.curso_id = v_curso_id) THEN
    RAISE EXCEPTION 'No tienes acceso a esta evaluación.';
  END IF;

  v_max := CASE WHEN v_categoria = 'examen' THEN 1 ELSE 2 END;

  SELECT COALESCE(MAX(intento),0), COALESCE(MAX(nota),0) INTO v_intentos, v_best
    FROM resultados_examen WHERE tarea_id = p_tarea_id AND alumno_uid = v_uid;
  IF v_intentos >= v_max THEN
    RAISE EXCEPTION 'Alcanzaste el límite de % intento%.', v_max, (CASE WHEN v_max > 1 THEN 's' ELSE '' END);
  END IF;

  SELECT count(*) INTO v_total FROM preguntas WHERE tarea_id = p_tarea_id AND estado = '1';

  FOR r IN
    SELECT p.id,
           (SELECT max(rr.respuesta) FROM respuestas rr WHERE rr.pregunta_id = p.id) AS correcta
      FROM preguntas p WHERE p.tarea_id = p_tarea_id AND p.estado = '1'
  LOOP
    v_elegida := p_respuestas ->> r.id::text;
    IF v_elegida IS NOT NULL AND r.correcta IS NOT NULL
       AND lower(trim(v_elegida)) = lower(trim(r.correcta)) THEN
      v_correctas := v_correctas + 1;
    END IF;
  END LOOP;

  IF v_total = 0 THEN v_nota := 0; ELSE v_nota := round(v_correctas::numeric / v_total * 20); END IF;
  v_situ := CASE WHEN v_nota >= 13 THEN 'aprobado' ELSE 'desaprobado' END;

  INSERT INTO resultados_examen(tarea_id, alumno_uid, nota, intento, total_preg, correctas, fecha)
    VALUES (p_tarea_id, v_uid, v_nota, v_intentos + 1, v_total, v_correctas, now());

  RETURN jsonb_build_object(
    'nota', v_nota, 'mejor_nota', GREATEST(v_nota, v_best),
    'correctas', v_correctas, 'total', v_total,
    'situacion', v_situ, 'intento', v_intentos + 1, 'intentos_restantes', v_max - (v_intentos + 1)
  );
END;
$function$;
