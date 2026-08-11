-- =============================================================================
-- Registro N° único, y contador que no se queda atrás.
--
-- PROBLEMA QUE RESUELVE
-- El Registro N° se asigna solo al emitir (trigger certificados_asignar_libro_registro
-- → siguiente_codigo_libro, que incrementa contadores_libro). Pero el modal
-- "Corregir N°" (EditarDatosLibroModal) escribe el valor DIRECTO en la fila del
-- certificado, sin tocar el contador. Dos consecuencias, ambas silenciosas:
--
--   1. Si corriges un certificado al registro 000020, el contador sigue donde
--      estaba (p. ej. 8). Los siguientes automáticos salen 9, 10, 11… y al
--      llegar a 20 se repite el número. La columna no tenía ninguna restricción,
--      así que la base aceptaba el duplicado sin una palabra.
--   2. `buscar_certificado_publico` resuelve por número y hace `limit 1`. Con dos
--      certificados en el mismo registro, quien verifique IPD-2026-000020 recibe
--      uno cualquiera de los dos — posiblemente el certificado de otra persona.
--
-- Con 200-300 emisiones mensuales previstas, esto deja de ser hipotético.
--
-- QUÉ HACE ESTA MIGRACIÓN
--
-- 1. Índice único sobre el VALOR NUMÉRICO del registro, no sobre el texto.
--    '20' y '000020' son el mismo asiento del libro y deben chocar entre sí; un
--    único sobre texto los habría dejado pasar como distintos. Es además el mismo
--    criterio con que compara `buscar_certificado_publico` (registro::bigint), así
--    que la restricción y la búsqueda hablan el mismo idioma.
--    Parcial (`where registro ~ '^\d+$'`): los registros no numéricos de cargas
--    históricas quedan fuera y no bloquean la migración.
--
-- 2. Trigger que sube el contador cuando se guarda a mano un número mayor. Así
--    las dos vías —automática y manual— no se pueden cruzar nunca: el contador
--    siempre queda por encima del mayor número usado.
--
-- POR QUÉ NO SE PONE ÚNICO EN `libro`
-- Un libro es un tomo: por definición contiene MUCHOS asientos, así que muchos
-- certificados deben poder compartir el mismo Libro N°. Hoy el contador le da un
-- número distinto a cada certificado —lo que sugiere que se está usando como si
-- fuera un segundo correlativo—, pero eso es una decisión de negocio a revisar,
-- no algo que deba cementarse con una restricción. Si se pusiera único aquí, el
-- día que se quiera asentar dos certificados en el libro 1 la base lo impediría.
--
-- ESTADO DE LOS DATOS AL APLICAR: 7 certificados, todos con registro, sin ningún
-- duplicado (verificado por texto y por valor numérico). Se aplica sin limpieza previa.
-- =============================================================================

create unique index if not exists certificados_registro_numerico_unico
  on public.certificados ((registro::bigint))
  where registro ~ '^\d+$';

comment on index public.certificados_registro_numerico_unico is
  'Impide dos certificados con el mismo Registro N°. Compara por valor numérico, '
  'igual que buscar_certificado_publico, para que 20 y 000020 cuenten como el mismo asiento.';

-- ---------------------------------------------------------------------------

create or replace function public.sincronizar_contador_libro()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_num bigint;
begin
  -- Solo empuja hacia arriba (`valor < v_num`). Nunca retrocede: si alguien
  -- corrige un certificado a un número BAJO —lo normal al asentar uno atrasado—
  -- el contador debe seguir donde estaba, o el siguiente automático repetiría
  -- números ya usados.
  if new.registro ~ '^\d+$' then
    v_num := new.registro::bigint;
    update contadores_libro set valor = v_num, actualizado_en = now()
     where nombre = 'registro' and valor < v_num;
  end if;

  if new.libro ~ '^\d+$' then
    v_num := new.libro::bigint;
    update contadores_libro set valor = v_num, actualizado_en = now()
     where nombre = 'libro' and valor < v_num;
  end if;

  return null;
end;
$function$;

-- AFTER: en INSERT el número ya lo puso `certificados_asignar_libro_registro`
-- desde el propio contador, así que la comparación no hace nada y no estorba.
-- El caso que importa es el UPDATE del modal "Corregir N°".
drop trigger if exists trg_sincronizar_contador_libro on public.certificados;
create trigger trg_sincronizar_contador_libro
  after insert or update of registro, libro on public.certificados
  for each row execute function public.sincronizar_contador_libro();
