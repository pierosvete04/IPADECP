# Contexto del proyecto IPADECP — documento de traspaso

> Generado el 2026-07-19 para migrar todo el contexto de trabajo a una cuenta de Claude nueva.
> Este documento resume **todo lo construido hasta ahora**: el LMS/"aula virtual" de IPADECP, su backend en Supabase, y las convenciones/reglas de negocio ya acordadas con Piero (admin de IPADECP).

## 0. Cómo usar este documento

Pega este archivo completo (o súbelo) al iniciar la nueva sesión de Claude para que tenga el mismo contexto que esta cuenta. El proyecto vive en:

```
C:\Users\Oechsle\Desktop\SALUDBAY\PROYECTO OFICIAL - IPADECP\ipadecp-lms
```

y su predecesor/legado en:

```
C:\Users\Oechsle\Desktop\SALUDBAY\PLATAFORMA
```

---

## 1. Qué es IPADECP y qué se está construyendo

**ipadecp-lms** es el LMS ("aula virtual") nuevo de IPADECP, un instituto peruano que vende cursos con certificación. Reemplaza una plataforma PHP/MySQL anterior (ver §7). Tiene tres piezas:

- **Aula del alumno** — cursos, evaluaciones, gamificación, certificados.
- **Panel de administración** — gestión de cursos, ventas, alumnos, certificados, promociones, etc.
- **Verificación pública de certificados** — página `/certificado/[codigo]` sin login.

### Stack técnico

- **Next.js 16.2.10** (App Router), React 19.2.4, TypeScript 5, Tailwind v4.
- **Backend:** solo `@supabase/supabase-js` (sin ORM propio, sin rutas API de Next.js — **cero archivos `route.ts`** en todo el proyecto). Toda la lógica de servidor vive en Supabase (RPCs en SQL + 2 Edge Functions).
- **UI:** shadcn/ui + componentes propios en `src/Componentes/ui/`.
- **PDF de certificados:** `jspdf`, generado 100% en el cliente (`src/lib/certificado.ts`).
- **QR:** paquete `qrcode` (verificación de certificado + enlace de WhatsApp en checkout).
- **Animaciones:** `gsap` vía `src/lib/motion.ts`.
- **Proyecto Supabase:** `gqzahhjphyqdcausuqgl`, nombre "SALUDBAY DATA", organización `ezwilhwxallnmhjvqgkr`.
- **Sin repositorio git** en `ipadecp-lms` (no hay historial de commits que consultar).
- Variables de entorno usadas en el frontend: solo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Ninguna otra API key toca el código Next.js.
- Scripts para Piero (no técnico): `iniciar-aula-virtual.bat` (instala deps + `npm run dev` + abre `localhost:3000/login`) y `conectar-decolecta.bat` (configura el secret `DECOLECTA_API_KEY` de la Edge Function `verificar-dni` sin que la key pase por el chat).

### ⚠️ Limitación importante para la próxima sesión

**No hay carpeta `supabase/` con migraciones ni funciones locales.** Todo el SQL (tablas, RPCs, triggers, RLS) y las Edge Functions se crearon directamente contra el proyecto remoto en sesiones anteriores, y no quedaron versionadas en este repo. Además, en esta sesión el **MCP de Supabase estaba conectado a una cuenta/organización distinta** (solo veía un proyecto `SUPLEVET_DATABASE`, org `ddhpopwmsitlrneluqru`) — todas las llamadas contra `gqzahhjphyqdcausuqgl` devolvieron error de permisos.

**Todo el esquema de base de datos y las funciones descritas abajo (§3) están reconstruidas leyendo cómo el frontend las llama** (`.from()`, `.rpc()`, `.functions.invoke()`), no verificadas contra el SQL real. **La próxima sesión debería:**
1. Conectar el MCP de Supabase a la cuenta/organización correcta (la que tiene `gqzahhjphyqdcausuqgl`), o
2. Correr `supabase db pull` desde la carpeta `ipadecp-lms` (ya está enlazada según `supabase/.temp/linked-project.json`) para traer las migraciones reales, o
3. Usar `get_advisors` / `execute_sql` una vez haya acceso correcto, para confirmar RLS policies y el cuerpo real de `calcular_periodo_certificacion` / `admin_generar_periodo`.

---

## 2. Reglas de negocio ya acordadas con Piero (memorias existentes)

Estas ya estaban guardadas en memoria de sesiones previas; se incluyen aquí completas.

### 2.1 Convención de correos institucionales

Todas las cuentas de alumno creadas por el **admin** (no autorregistro) deben usar el dominio `@ipadecp.com.pe`. Formato: `nombre.apellido@ipadecp.com.pe` (primer nombre + primer apellido, sin tildes/espacios, minúsculas), con sufijo numérico si hay choque (`juan.perez2@ipadecp.com.pe`).

- **Por qué:** Piero pidió explícitamente que las cuentas que él genera lleven ese dominio institucional, y eligió `nombre.apellido` en vez de `dni@ipadecp.com.pe` cuando se le preguntó.
- **Dónde está implementado:** Edge Function `admin-crear-usuario` (ver §3.1), usada desde el panel admin → "Certificados directos". Cualquier futura funcionalidad de creación de cuentas por el admin debe reutilizar esa Edge Function o replicar la misma convención.

### 2.2 Flujo 1 de certificación (directa) — reglas de fechas

El LMS tiene dos flujos de certificación (ver detalle completo en §5):

- **Flujo 2 (evaluado, preexistente):** alumno compra, cursa, rinde tareas/exámenes, certificado se emite automáticamente.
- **Flujo 1 (directo, agregado 2026-07-17):** clientes que solo quieren el certificado. El admin lo emite a mano desde "Certificados directos" ingresando DNI + cargo profesional + una fecha dentro de un período institucional de 6 meses.

**Regla de días hábiles confirmada con el usuario:** sábado **NO** es hábil (se excluyen sábados, domingos y feriados peruanos — tabla editable `feriados_pe`, más Jueves/Viernes Santo por fórmula de Pascua). Si se pide recalcular o ajustar el período, usar esta regla salvo indicación explícita en contra.

**Cálculo del período** (ejemplo validado, jul-dic 2026): `fecha_inicio` = primer día hábil del mes de inicio (1 jul 2026); `fecha_cierre` = último día hábil del mes final (31 dic 2026); `fecha_entrega` = `fecha_cierre` retrocedida 5 días hábiles (23 dic 2026).

**Cómo aplicarlo:** cualquier cambio a esta lógica de fechas debe hacerse en las funciones SQL (`calcular_periodo_certificacion`, `admin_generar_periodo`), no en el frontend. El frontend (`src/Componentes/admin/CertificadosDirectosSection.tsx`, `PeriodosCertificacionSection.tsx`) solo llama a los RPCs.

---

## 3. Backend de Supabase (reconstruido desde el frontend — ver limitación en §1)

### 3.1 Edge Functions (2 confirmadas)

| Función | Se llama desde | Qué hace |
|---|---|---|
| `verificar-dni` | `src/lib/dni.ts` (`verificarDni`), usado en `registro/page.tsx` y `CertificadosDirectosSection.tsx` | Verifica un DNI peruano + nombre contra RENIEC vía la API de **Decolecta** (key guardada como secret `DECOLECTA_API_KEY`). Body: `{ dni, nombre }`. Retorna `{ ok, motivo?, dni?, nombreCompleto?, coincide?, nombres?, apellidoPaterno?, apellidoMaterno? }`. |
| `admin-crear-usuario` | `CertificadosDirectosSection.tsx` | Solo admin: crea un usuario de Supabase Auth + fila en `perfiles` para un cliente de certificado directo que no tiene cuenta. Body: `{ nombres, apellidos, dni, cargo, telefono? }`. Retorna `{ ok, alumno_uid, email, passwordTemporal, yaExistia }`. Genera el email con la convención `nombre.apellido@ipadecp.com.pe` (ver §2.1). Corre casi seguro con service-role key (llama `auth.admin.createUser`), por eso es Edge Function y no RPC. |

### 3.2 Funciones/RPCs de Postgres (llamadas vía `supabase.rpc(...)`)

| RPC | Parámetros | Desde | Propósito |
|---|---|---|---|
| `es_admin` | — | `auth.ts`, `admin/login` | Chequeo booleano de si el usuario autenticado es admin. |
| `mis_logros` | — | `PerfilTab.tsx` | Lista de logros del alumno actual. |
| `mi_promedio_curso` | `p_curso_id` | `MisCursosTab`, `InicioTab` | Promedio numérico del alumno en un curso. |
| `mi_gamificacion` | — | `InicioTab`, `Topbar` | Snapshot de gamificación: puntos, racha, nivel, ranking, meta diaria. |
| `calcular_total_carrito` | `p_curso_ids`, `p_promocion_id` | `ComprarTab.tsx` | Precio del carrito calculado en servidor (subtotal, descuento, promoción aplicada, métodos de pago permitidos). |
| `listar_promociones_disponibles` | `p_curso_ids` | `ComprarTab.tsx` | Promociones elegibles/cercanas para el carrito actual. |
| `obtener_certificado_publico` | `p_codigo` | `src/lib/certificado.ts` (página pública) | Lookup público/anónimo de un certificado por código de verificación. |
| `canjear_codigo` | `p_codigo` | `CodigoModal.tsx` | Canjea un código de acceso, matriculando al alumno en los cursos que desbloquea. |
| `admin_generar_periodo` | `p_nombre`, `p_mes_inicio` | `PeriodosCertificacionSection.tsx` | **Núcleo Flujo 1.** Crea un período de 6 meses con fechas auto-calculadas (ver §2.2). |
| `admin_ajustar_puntos` | `p_alumno`, `p_delta`, `p_motivo` | `GamificacionSection.tsx` | Admin ajusta manualmente puntos de gamificación con motivo. |
| `borrar_curso` | `p_id` | `CursosSection.tsx` | Borrado en cascada de un curso y todo lo asociado. |
| `obtener_evaluacion` | `p_tarea_id` | `aula/evaluacion/[tareaId]` | Preguntas de un examen/tarea, sin exponer la respuesta correcta. |
| `rendir_evaluacion` | `p_tarea_id`, `p_respuestas` | `aula/evaluacion/[tareaId]` | Califica en servidor; retorna nota, situación, intentos restantes (tope de intentos server-side). |
| `sumar_puntos` | `p_tipo`, `p_ref_id`, `p_puntos` | evaluación, `aula/curso/[id]` | Otorga puntos de gamificación por acción, referenciado por id (para evitar duplicados). |
| `admin_emitir_certificado_directo` | `p_curso_id`, `p_periodo_id`, `p_fecha`, `p_dni`, `p_nombre_completo`, `p_cargo`, `p_alumno_uid` | `CertificadosDirectosSection.tsx` | **Núcleo Flujo 1.** Inserta fila en `certificados` con `modalidad='directo'` y genera `codigo_verificacion`. |
| `intentar_emitir_certificado` | `p_curso_id`, `p_alumno_uid` | `CertificadoBanner.tsx` | **Núcleo Flujo 2.** Red de seguridad: si el alumno completó el curso pero no existe certificado, lo emite manualmente (normalmente un trigger lo hace automático). |

### 3.3 Tablas (esquema reconstruido, no verificado contra SQL real)

**Identidad**
- `perfiles` — 1:1 con `auth.users`. Columnas: `id, nombre, nombres, apellidos, email, telefono, fecha_nacimiento, documento, tipo_documento, documento_verificado, departamento, distrito, genero, avatar_key, cargo, rol, puntos, racha_dias, creado_en`. `rol`: `alumno`/`admin`.
- `historico_alumnos` — tabla de alumnos migrados del sistema PHP anterior (`id_usuario, nombre, email, telefono, doc, rol, estado, fecha`) — evidencia de migración de datos (ver §7).

**Cursos / contenido**
- `cursos` — `id, nombre, categoria_id, introduccion1, img, seccion3_link, precio_antes, precio_ahora, tipo_curso ('estandar'|'premium'), tipo_clase, enlace_clase_vivo, estado, mostrar_en_catalogo`.
- `categorias` — `id, cat_descripcion, cat_estado`.
- `curso_metodos_pago` — join `curso_id, metodo`.
- `modulos` — `id, curso_id, titulo, linkvideo, archivo, estado`.
- `materiales` — `id, curso_id, modulo_id, nombremat, archivo, descrip, estado`.
- `tareas` — `id, curso_id, titulo, categoria ('tarea'|'examen'), cantpreg, entrega ('auto' o URL de consigna), tiempo, estado, id_usu`.
- `preguntas` — `id, tarea_id, titulo, ide, estado`.
- `respuestas` — `id, pregunta_id, tarea_id, titulo, designo (a/b/c/d/e), respuesta, ide, estado`.

**Matrícula / progreso**
- `inscripciones` — `id, alumno_id, curso_id, inscrito_en, origen ('compra'|'admin'|'codigo'), venta_id`.
- `resultados_examen` — `tarea_id, alumno_uid, nota, intento`.
- `entregas` — `tarea_id, alumno_uid, archivo_url, situacion, nota` (bucket `entregas`).

**Certificación**
- `certificados` — `id, curso_id, alumno_uid, codigo_verificacion, fecha, nota, dni, nombre_completo, cargo, periodo_id, modalidad ('evaluado'|'directo')`.
- `periodos_certificacion` — `id, nombre, fecha_inicio, fecha_entrega, fecha_cierre`.
- `cargos_profesionales` — `id, nombre, estado`.

**Comercio**
- `ventas` — `id, curso_id, alumno_uid, nombre_curso, monto, precio_lista, promocion_id, metodo ('culqi'|'transferencia'|'yape_plin'|'pendiente'), estado ('pendiente'|'aprobado'|'rechazado'), fecha, comprobante_url` (bucket `comprobantes`).
- `promociones` — `id, titulo, descripcion, tipo, cantidad_minima, cantidad_gratis, precio_promo, categoria_id, fecha_inicio, fecha_fin, estado`.
- `promocion_cursos`, `promocion_metodos_pago` — joins de alcance de promociones.
- `metodos_pago_config` — `id, metodo, titulo, titular, numero, banco, cci, qr_url, instrucciones, actualizado_en`.
- `cupones` — sistema de cupones separado/legado: `id, codigo, producto, precio, unidades, fechafin, estado` (no parece estar conectado al checkout actual).
- `codigos_acceso` / `codigo_cursos` — sistema de códigos de acceso, canjeado vía `canjear_codigo`.

**Gamificación**
- `niveles_gamificacion` — `nivel (PK), nombre, minimo, maximo`.
- `logros` — `id, icono, nombre, descripcion, criterio_tipo ('manual'|'puntos_minimos'|'cursos_completados'), criterio_valor, estado`.

**Otros**
- `eventos` — anuncios: `id, titulo, contenido, curso_id, link, categoria, estado, idusu`.
- `reclamos` — Libro de Reclamaciones (ley peruana de protección al consumidor): `id, fehareg, tipo_solicitud, nombrecomplet, correo, numcel, tpodoc, numerodoc, departamento, provincia, distrito, direccion, menor_edad, bien_tipo, bien_descripcion, monto_reclamado, mensaje, pedido_consumidor, alumno_uid, estado ('revision'|'atendido')`.

**Buckets de Storage:** `entregas` (privado, tareas), `comprobantes` (privado, URLs firmadas de 5 min), `cursos-imagenes` (público, portadas + QR de pago).

**RLS:** no se pudo leer el SQL real esta sesión (misma limitación de acceso MCP). Por comportamiento del frontend: alumnos leen/escriben solo sus propias filas; `certificados`/`obtener_certificado_publico` debe permitir SELECT anónimo; acciones de admin se gatean con el patrón `es_admin()`. **Confirmar con acceso directo a Supabase en la próxima sesión.**

---

## 4. Estructura de la app Next.js

**No existen rutas API de Next.js** (`route.ts`) en todo el proyecto — arquitectura 100% cliente, con llamadas directas a Supabase desde componentes `'use client'`.

### 4.1 Aula del alumno (`src/app/aula/**`)

- **`aula/page.tsx`** — shell principal, tabs vía `?sec=` (`inicio`, `cursos`, `comprar`, `perfil`, `historial`) sin rutas separadas. Fuerza `DatosObligatoriosModal` (no cerrable) si faltan `nombres`/`apellidos`/`fecha_nacimiento` en `perfiles`.
- **`aula/curso/[id]/page.tsx`** — vista de curso con sub-tabs `?tab=` (`general`/`modulos`/`tareas`/`examenes`). Verifica matrícula, carga módulos/materiales/tareas/resultados en paralelo, muestra `CertificadoBanner`, maneja subida de archivos a `entregas`, llama `sumar_puntos` al abrir un módulo.
- **`aula/evaluacion/[tareaId]/page.tsx`** — rendición de examen/tarea vía `obtener_evaluacion`/`rendir_evaluacion`, +50 puntos al aprobar.

### 4.2 Panel admin (`src/app/admin/**`)

- **`admin/page.tsx`** — shell único, registro `SECCIONES` mapeando `?sec=` a 17 secciones: dashboard, categorias, cursos, modulos, materiales, evaluaciones, eventos, promociones, metodospago, alumnos, gamificacion, codigos, **certificados-directos**, **periodos-certificacion**, cargos, cupones, ventas, reclamos. Protegido por `useRequireAdmin()`.
- **`admin/login/page.tsx`** — login separado que además verifica `es_admin()` tras el `signInWithPassword` (si es false, cierra sesión).

### 4.3 Verificación pública de certificado

`src/app/certificado/[codigo]/page.tsx` — sin login, llama `obtenerCertificadoPublico(codigo)`, botón de descarga que regenera el PDF en cliente con los datos retornados (incluye info de período para certificados Flujo 1).

### 4.4 Auth

- `src/lib/supabase/client.ts` — cliente único con anon key.
- `src/lib/supabase/auth.ts` — hooks `useRequireSession()` y `useRequireAdmin()` (además de `es_admin()`, hace `cerrarSesion` si falla), `cerrarSesion(destino)`.
- `app/login/page.tsx` — login alumno + manejo de recuperación de contraseña (`type=recovery` en el hash de la URL, evento `PASSWORD_RECOVERY`).
- `app/registro/page.tsx` — autorregistro. Verifica DNI en vivo contra RENIEC (`verificarDni`), exige coincidencia de nombre o un checkbox de responsabilidad si no coincide; Carnet de Extranjería siempre exige el checkbox (nunca verificable). `signUp` con datos extra en `options.data`.
- `app/recuperar/page.tsx` — `resetPasswordForEmail`.

### 4.5 Páginas legales/estáticas

`cookies`, `politica-privacidad`, `politica-reembolso`, `terminos-servicio`, `reclamos` (formulario completo de Libro de Reclamaciones vía `ReclamosClient.tsx`, inserta en tabla `reclamos`, con fallback `mailto:`).

---

## 5. Componentes clave (`src/Componentes/`)

- **`admin/`** — 17 secciones + helpers compartidos (`CursoSelector.tsx`, `useCursosAdmin.ts`). Destacan:
  - `CertificadosDirectosSection.tsx` (~410 líneas): flujo completo de Flujo 1 — DNI → verificar RENIEC → crear cuenta si no existe → emitir vía RPC → descargar PDF.
  - `PeriodosCertificacionSection.tsx`: sugiere automáticamente el próximo mes de inicio y nombre en español a partir del cierre del último período; delega todo el cálculo de fechas al RPC.
  - `DashboardSection.tsx`: gráficos con `recharts` (ventas por mes, ventas por método de pago) + KPIs + lista de clientes nuevos.
- **`aula/`** — tabs y modales del alumno: `InicioTab`, `MisCursosTab`, `ComprarTab` (catálogo + carrito + promociones + `CheckoutView`), `CheckoutView.tsx` (checkout, inserta `ventas`, flujo de comprobante por WhatsApp con QR), `PerfilTab.tsx` (el componente más grande, ~415 líneas: datos personales, seguridad, logros, avatar, historial de compras), `CodigoModal`, `DatosObligatoriosModal`, `HistorialList`, `AvatarPickerModal`, `CursandoItem`, `CursoGrandeCard`.
- **`brand/Logo.tsx`** — logo institucional.
- **`curso/`** — `InformacionTab`, `ModulosTab`, `TareasTab`/`ExamenesTab`/`EvalRow.tsx`, y **`CertificadoBanner.tsx`** (motor del Flujo 2: chequea certificado existente, llama `intentar_emitir_certificado` como fallback si corresponde, muestra banner con QR + descarga PDF o progreso).
- **`layout/`** — `AulaShell`/`AdminShell`, `Topbar`, `Sidebar` (admin, 4 categorías colapsables — contenido, clientes Flujo 2, "Certificación directa" Flujo 1, reportes — con comentario explícito de por qué Flujo 1 y Flujo 2 están separados), `AuthCard`, `Footer`, `BodyClass`.
- **`legal/`** — `LegalLayout.tsx`, `ReclamosClient.tsx`.
- **`ui/`** — primitivos shadcn (`button`, `card`, `table`, `sidebar`, `chart`, `sheet`, `tooltip`, `badge`, `skeleton`, `separator`, `input`) + propios: `DataTable.tsx`, `Modal.tsx`, `Avatar.tsx`, `CourseArt.tsx` (arte de curso: imagen o gradiente+monograma generado), `LinkQrCode.tsx`, `WhatsAppIcon.tsx`, `PasswordField.tsx`.

---

## 6. Los dos flujos de certificación — detalle completo

- **Flujo 2 ("evaluado", preexistente):** alumno compra el curso, cursa módulos/tareas/exámenes, y `CertificadoBanner.tsx` + RPC `intentar_emitir_certificado` (respaldado por un trigger de BD sobre `entregas`/`resultados_examen`) emiten el certificado automáticamente al completar el 100% de las `tareas` del curso.
- **Flujo 1 ("directo", agregado 2026-07-17):** para clientes que solo quieren el certificado sin cursar. Flujo en `CertificadosDirectosSection.tsx`:
  1. DNI → verificación opcional contra RENIEC (`verificar-dni`).
  2. Nombre completo, `cargo_profesional`, `periodo_certificacion`, fecha limitada por `min`/`max` al rango `[fecha_inicio, fecha_cierre]` del período (la validación de día hábil/feriado se enforce en servidor).
  3. Si no existe `perfiles` para ese DNI, se llama `admin-crear-usuario` (email `nombre.apellido@ipadecp.com.pe`, contraseña temporal mostrada una vez al admin) — el cliente siempre termina con acceso al aula.
  4. `admin_emitir_certificado_directo` inserta `certificados` (`modalidad='directo'`) y retorna `codigo_verificacion`.
  5. Se hace upsert de una fila en `inscripciones` para que el curso aparezca como "suyo" en el aula, aunque no haya cursado nada.
  6. Dos variantes de PDF: certificado digital completo (`generarCertificadoPDF`) y variante "para imprimir" (`generarCertificadoImprimirPDF`) con coordenadas fijas en milímetros para papel membretado pre-impreso del instituto (posiciones en la constante `IMPRIMIR_POS` de `src/lib/certificado.ts`; hay un comentario que menciona un futuro editor visual planeado).

**Regla de días hábiles y cálculo de período:** ver §2.2 (ya confirmada con el usuario).

---

## 7. Sistema legado: `PLATAFORMA`

`C:\Users\Oechsle\Desktop\SALUDBAY\PLATAFORMA` es el sitio PHP clásico anterior — páginas `.php` sueltas en la raíz (`index.php`, `cursos.php`, `curso.php`, `registro.php`, `procesaroPago.php`, `libro_reclamaciones.php`, `preguntas.php`, etc.), una carpeta `wp-content` (sugiere un montaje híbrido con WordPress), y su propia carpeta `aula/` con una app de aula PHP a medida (no Moodle) con `admin/`, `certific/`, `boleta/`, `culqi/` (integración real de pago con Culqi, a diferencia del proyecto nuevo), y una carpeta `anterior/` que sugiere que a su vez reemplazó algo más viejo. Hay un dump MySQL de 604 KB (`ufdbdrfm_aula.sql`) en la raíz.

**Todos los archivos** del árbol completo (raíz y `aula/`) tienen la misma fecha de modificación: **22 de junio de 2026 (~10:47–11:06)**, sin cambios posteriores — es la firma de una descarga/backup masivo de hosting, no edición activa.

Dado el vocabulario coincidente (cursos, aula, certificados, libro de reclamaciones, Culqi) y el dump MySQL, esto es casi con certeza **el sistema predecesor directo** que `ipadecp-lms` está reemplazando/migrando — reforzado por la tabla `historico_alumnos` en el nuevo esquema de Supabase, que parece un snapshot importado de la tabla de usuarios de este sistema viejo. No hay evidencia de mantenimiento activo en paralelo; es una copia de referencia archivada para consultar datos/lógica histórica durante la reescritura, no un sistema vivo.

---

## 8. Otras integraciones

- **PDF:** `jspdf`, 100% cliente (`src/lib/certificado.ts`, dos layouts de certificado). Sin renderizado server-side.
- **QR:** paquete `qrcode` — QR de verificación de certificado (PDF + banner in-app) y QR de enlace WhatsApp en checkout (`LinkQrCode.tsx`).
- **"Pasarela de pago":** `culqi` es solo una **etiqueta de texto** (opción de radio en checkout) — no hay SDK de Culqi ni integración real de cobro con tarjeta en este proyecto (a diferencia de `PLATAFORMA`, que sí lo tenía). Elegir "Tarjeta de crédito/débito (Culqi)" solo crea una fila en `ventas` con `estado:'pendiente'`; el admin la aprueba manualmente en `VentasSection.tsx`. Transferencia y Yape/Plin muestran datos configurados por el admin (`metodos_pago_config`) y piden enviar captura de pantalla por WhatsApp.
- **Verificación de identidad:** API de Decolecta (RENIEC), solo dentro de la Edge Function `verificar-dni`.
- **Mensajería:** solo enlaces de WhatsApp (`wa.me/51992951855`, `src/lib/site-config.ts`) — sin envío de emails propio (ningún Resend/SendGrid), salvo los emails transaccionales nativos de Supabase Auth (confirmación de registro, recuperación de contraseña) y un `mailto:` en el formulario de Reclamos.
- **Animación:** `gsap` vía `src/lib/motion.ts`, con comentarios explícitos de nunca animar `opacity` (para evitar contenido invisible atascado si un re-render interrumpe el tween).
- **Storage:** buckets `entregas` (privado), `comprobantes` (privado, URLs firmadas 5 min), `cursos-imagenes` (público).

---

## 9. Índice de memorias relacionadas (en esta cuenta de Claude)

Estas memorias ya existen en `C:\Users\Oechsle\.claude\projects\C--Users-Oechsle-Desktop-SALUDBAY\memory\`:

- `ipadecp_cuentas_correo.md` — convención `nombre.apellido@ipadecp.com.pe` (resumida en §2.1).
- `ipadecp_certificacion_flujo1.md` — reglas de período de 6 meses y días hábiles (resumida en §2.2).

Si migras de cuenta, considera recrear estas dos memorias (o pegar este documento completo) en la cuenta nueva para no perder estas reglas de negocio ya acordadas con Piero.
