-- =============================================================================
-- Segundo número del cliente, para cuando el primero no contesta.
--
-- ESTADO: APLICADA el 2026-08-06 (migración `perfiles_telefono_alternativo`).
--
-- Va de la mano con haber vuelto obligatorio el teléfono en la emisión directa
-- (ver lib/importarCertificados.ts y CertificadosDirectosSection): desde que el
-- correo dejó de pedirse —lo pone el propio cliente al activar su cuenta—, el
-- celular es el único canal para alcanzarlo mientras no haya activado.
--
-- Es una columna y no una lista de N teléfonos a propósito: el número que se
-- imprime en el rótulo tiene que ser uno solo y sin ambigüedad. Con una lista,
-- alguien tendría que decidir cuál imprimir en cada envío, y ahí es donde se
-- cuelan los errores. `telefono` sigue siendo EL número por el que se contacta
-- al cliente; este es el respaldo, y elegir cuál se usa es intercambiarlos
-- desde la ficha.
-- =============================================================================

alter table public.perfiles add column if not exists telefono_alternativo text;

comment on column public.perfiles.telefono_alternativo is
  'Segundo numero de contacto. El que se usa e imprime es `telefono`; este es el respaldo.';
