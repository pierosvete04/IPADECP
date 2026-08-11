-- =============================================================================
-- "Ya existe un registro con ese mismo dato" al crear un segundo diseño del
-- mismo tipo de certificado — aunque el nombre fuera distinto.
--
-- EL PROBLEMA
-- `plantillas_certificado` traía `UNIQUE (tipo)`: como máximo UNA fila por
-- tipo ('digital' / 'imprimir') en TODA la tabla, para siempre. Esa
-- restricción es de una versión vieja del esquema, de cuando solo existía un
-- diseño fijo por tipo. El panel admin (Diseño del certificado →
-- "Guardar como nuevo", "Copiar estructura", la pestaña "Diseños" con la
-- lista completa, la asignación de un diseño puntual por curso) se construyó
-- después asumiendo VARIOS diseños guardados por tipo, marcando uno solo
-- como "activo" — pero nadie quitó el `UNIQUE (tipo)` viejo.
--
-- Resultado: la tabla nunca pudo tener más de 2 filas (una 'digital' y una
-- 'imprimir') pase lo que pase. El primer insert de cada tipo funciona; el
-- segundo siempre choca con la restricción y Postgres devuelve
-- "duplicate key value violates unique constraint ...", que `mensajeError`
-- (lib/copy.ts) traduce a "Ya existe un registro con ese mismo dato" — un
-- mensaje que además confunde, porque no es el nombre lo que choca.
--
-- LA CORRECCIÓN
-- Quitar el `UNIQUE (tipo)`. Un tipo puede tener cuantos diseños guardados
-- se quiera; cuál se usa al emitir lo decide `activa` (aplicación), no la
-- base de datos.
-- =============================================================================

alter table public.plantillas_certificado
  drop constraint if exists plantillas_certificado_tipo_key;
