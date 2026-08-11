-- =============================================================================
-- Backfill de Registro N° / Libro N° de los certificados anteriores al trigger.
--
-- ESTADO: APLICADA el 2026-08-04 con offset 0.
--
-- Resultado: los 4 certificados que estaban en blanco quedaron numerados
-- 000001–000004 (registro) y 00001–00004 (libro), por orden de id:
--   id 8  → 000001 / 00001
--   id 10 → 000002 / 00002
--   id 11 → 000003 / 00003
--   id 12 → 000004 / 00004
-- y `contadores_libro` quedó en 4 para ambos, así que la próxima emisión toma
-- 000005 / 00005.
--
-- SI EL LIBRO FÍSICO NO ARRANCA EN 1: estos números son corregibles — las
-- columnas eran NULL, no se perdió nada. Volver a ejecutar el paso 1 con el
-- offset correcto sobre esos mismos 4 ids y reajustar los contadores.
--
-- SITUACIÓN
-- El trigger `trg_certificados_libro_registro` asigna registro y libro en cada
-- INSERT, tomándolos de `contadores_libro` vía `siguiente_codigo_libro`. Está
-- bien hecho, pero los certificados emitidos ANTES de que existiera quedaron
-- con registro y libro en NULL, y esos PDFs imprimen el campo vacío.
--
-- Además `contadores_libro` sigue en 0 para ambos: la próxima emisión empezará
-- en 000001 / 00001 conviviendo con los históricos en blanco.
--
-- Comprobar primero cuántos son y cuáles:
--   select id, codigo_verificacion, fecha, registro, libro
--     from certificados where registro is null or libro is null order by id;
-- =============================================================================

begin;

-- 1. Numera los que están en blanco por orden de emisión (id ascendente).
--    AJUSTAR el `+ 0` si el libro físico ya arranca en otro número: por ejemplo,
--    si los cuatro primeros son en realidad el 000012 al 000015, poner `+ 11`.
with pendientes as (
  select id, row_number() over (order by id) as n
    from certificados
   where registro is null or btrim(coalesce(registro, '')) = ''
)
update certificados c
   set registro = lpad((p.n + 0)::text, (select ancho from contadores_libro where nombre = 'registro'), '0'),
       libro    = lpad((p.n + 0)::text, (select ancho from contadores_libro where nombre = 'libro'), '0')
  from pendientes p
 where c.id = p.id;

-- 2. Deja los contadores por encima del mayor asignado, para que la siguiente
--    emisión no reutilice un número ya impreso.
update contadores_libro
   set valor = greatest(
         valor,
         coalesce((select max(registro::bigint) from certificados where registro ~ '^\d+$'), 0)
       ),
       actualizado_en = now()
 where nombre = 'registro';

update contadores_libro
   set valor = greatest(
         valor,
         coalesce((select max(libro::bigint) from certificados where libro ~ '^\d+$'), 0)
       ),
       actualizado_en = now()
 where nombre = 'libro';

-- Revisar el resultado ANTES de confirmar:
--   select id, registro, libro from certificados order by id;
--   select * from contadores_libro;
-- Si algo no cuadra: rollback;
commit;
