# Plan 002 — Panel de resultados /admin

Spec: `specs/002-admin/spec.md` (Estado: aprobada, 2026-10-18, propuestas 6 a 33 y "Riesgos asumidos" aprobados). Cumple la constitución: HTML, CSS y JS sin framework ni build; Supabase como único servicio externo; lógica pura en `js/lib/` sin DOM, red ni fecha; tests con `node --test`; RLS intacto; móvil a 375 px; interfaz en inglés. **Sin cambios en la tabla `responses`, en `save_response` ni en las políticas RLS** (RF-50): no hay migración nueva. **Sin librerías nuevas** (RNF-9).

## 1. Estructura de archivos
```
admin/
└── index.html              página /admin/: formulario de acceso + panel (cabecera, filtros, pestañas, paneles), CSP y noindex
css/
└── admin.css               estilos del panel: @font-face propias, paleta de la encuesta, tabla/tarjetas, barras
js/
├── config.js               + ADMIN_LOGIN_EMAIL (correo interno, público, propuesta 6)
├── lib/                    LÓGICA PURA (tests)
│   ├── admin-auth.js       nombre de usuario → correo, validación de campos, clasificación de acceso/carga, textos
│   ├── admin-load.js       carga paginada por id (keyset) con fetchPage inyectado, deduplicado
│   ├── admin-stats.js      versión actual, filtros comunes, resumen, preguntas, país, redondeo, desempates
│   ├── admin-list.js       búsqueda sin tildes, filtro de comentarios, comentarios coincidentes, orden
│   ├── admin-format.js     fechas de pantalla y CSV con zona horaria inyectada, nombres de archivo
│   └── csv.js              celda CSV (escape + protección de fórmulas), documento (BOM, CRLF), los dos CSV
└── app/admin/              INTERFAZ Y ADAPTADORES (pintan y delegan)
    ├── main.js             arranque, estado del panel, eventos, flujo de sesión
    ├── client.js           carga supabase-js del CDN, cliente con sesión y fetch con timeout de 15 s
    ├── auth.js             signIn, signOut local, sesión recordada, is_admin, aviso de sesión terminada
    ├── data.js             fetchPage(lastId) sobre PostgREST para admin-load
    ├── stats-view.js       pinta resumen, bloques de pregunta (barras) y país
    ├── list-view.js        pinta tabla (≥ 768 px) o tarjetas <details> (< 768 px)
    └── download.js         Blob + enlace temporal para descargar un CSV
docs/supabase.md            paso 4 reescrito: cuenta compartida, admins, contraseña, prueba RF-12, contraseña filtrada
tests/
├── admin-auth.test.js  admin-load.test.js  admin-stats.test.js  admin-list.test.js
├── admin-format.test.js  csv.test.js
└── admin-markup.test.js    lectura como texto de admin/index.html y css/admin.css
```
La encuesta (`index.html`, `css/survey.css`, `js/app/*.js` existentes) no se toca, salvo `js/config.js` (una constante más). `js/app/db.js` solo se **importa** para reutilizar `SUPABASE_JS_VERSION` (una sola versión fijada en el repo).

Local: `node scripts/serve.mjs` → http://localhost:8080/admin/ (con barra final; `serve.mjs` ya sirve `index.html` en las rutas que acaban en `/`). En Pages, `/admin` redirige solo a `/admin/`. Todas las rutas de `admin/index.html` son relativas (`../css/admin.css`, `../js/app/admin/main.js`, `../assets/...`), válidas en local y bajo `/leisuresocietyfeedback/`.

## 2. Datos y configuración — RF-5, RF-28, RF-53, RNF-3
- `js/config.js`: `export const ADMIN_LOGIN_EMAIL = "admin@leisure-city.invalid";` (o `admin@example.com` si T6 lo exige; se anota también en la spec, propuesta 6). Público por diseño. No hay contraseña, hash ni UUID en el repo (RNF-1, RNF-3).
- Textos de preguntas, opciones, tipos y países: `import { CONTENT } from "../../content.js"` (RF-28). Banderas: `../assets/flags/<code>.svg`; `OTHER` con `../assets/icons/other.svg`; código desconocido sin imagen.
- Columnas leídas: `id, content_version, country, status, created_at, updated_at, q1_option, q1_text … q10_option, q10_text` (no `seq`). `id` solo se usa para paginar y desempatar; nunca se pinta ni se exporta (RF-48, RF-62).

## 3. Lógica pura (`js/lib/`)
Todas reciben datos y devuelven datos. La fecha actual, la zona horaria y las funciones de red se inyectan.

### admin-auth.js — RF-4 a RF-12, RF-16, RF-21, RF-67 a RF-69
- `ADMIN_USERNAME = "admin"`; `normalizeUsername(s)` = `s.trim().toLowerCase()`.
- `prepareLogin({ username, password }, email)` →
  - `{ error: "empty" }` si el usuario recortado o la contraseña (sin recortar) están vacíos (RF-67);
  - `{ error: "credentials" }` si el usuario no es `admin` (RF-6: mismo mensaje, sin petición);
  - `{ ok: true, email, password }` (la contraseña tal cual, RF-5).
- `classifyAuthResult({ error, timedOut, threw })` → `"ok" | "credentials" | "rate_limited" | "not_confirmed" | "network"`:
  - `timedOut`/`threw`/`error.name` `AuthRetryableFetchError`/`status` 0 o ≥ 500 → `network` (RF-9);
  - `status` 429 o `code` `over_request_rate_limit` → `rate_limited` (RF-8);
  - `code` `email_not_confirmed` → `not_confirmed` (RF-68);
  - `code` `invalid_credentials` o cualquier otro 4xx → `credentials` (RF-7).
- `classifyAdminCheck({ data, error, timedOut, threw })` → `"admin" | "no_access" | "network" | "session_ended"`: `data === true` → admin; `data === false` → no_access (RF-12); 401/JWT inválido → session_ended (RF-16); red/timeout/5xx → network (RF-69).
- `classifyLoadResult(...)` → `"ok" | "network" | "session_ended"` (RF-21, RF-16).
- `MESSAGES`: textos literales de la spec por clave (`empty`, `credentials`, `rate_limited`, `not_confirmed`, `network`, `no_access`, `session_ended`, `load_failed`, `page_failed`).

### admin-load.js — RF-17, RF-21 (propuesta 28)
```
async loadAllRows(fetchPage, pageSize = 1000):
  rows = Map(); lastId = null
  loop:
    page = await fetchPage(lastId, pageSize)        // filas con id > lastId, orden id asc, límite pageSize
    if page.error: return { error: page.error }      // carga entera fallida, sin reintento
    if page.rows.length == 0: break                  // fin (no se confía en "< pageSize": el servidor puede limitar menos)
    for r in page.rows: rows.set(r.id, r)            // deduplicado por si acaso
    lastId = page.rows.at(-1).id
  return { rows: [...rows.values()] }
```
Keyset por `id` (clave primaria, inmutable): una actualización no mueve la fila; una inserción con id menor que `lastId` no desplaza las páginas siguientes. Así cada fila existente al empezar sale exactamente una vez (RF-17). **Descartado**: `range()` por posición (una inserción desplaza filas → duplicados u omisiones) y orden por `updated_at` (cambia con cada escritura).

### admin-stats.js — RF-22 a RF-25, RF-29 a RF-37, RF-57, RF-70
- `percent(count, total)` = `total === 0 ? 0 : Math.floor((200 * count + total) / (2 * total))` (redondeo con ,5 hacia arriba en enteros, sin errores de coma flotante).
- `splitByVersion(rows, version)` → `{ current, hiddenCount }` (hiddenCount antes de filtros, propuesta 33).
- `countryChoices(current, content)` → `[{value:"ALL",label:"All countries"}, …países del contenido en orden, Other, …códigos desconocidos A-Z]` (RF-23).
- `applyCommonFilters(rows, { country = "ALL", status = "all" })` (valores iniciales: sin filtrar, RF-23, RF-24).
- `summary(rows)` → `{ participants, completed, inProgress }` (RF-29).
- `questionStats(rows, content)` → por pregunta `{ id, n, text, answers, comments, options:[{letter,label,count,percent}], unknown:{count,percent}|null }`; `label` con " (open answer)" si `type === "open-required"` (RF-36); `answers` cuenta también las opciones desconocidas (denominador, definición de la spec).
- `byCountry(rows, content)` → `[{ code, name, flag, count, percent }]` ordenado por count desc, luego contenido, `OTHER`, desconocidos A-Z (RF-30, propuesta 30).
- `answeredCount(row)` → 0-10.
Las mismas funciones alimentan la pantalla y `statisticsCsv` (RF-57).

### admin-list.js — RF-39 a RF-46, RF-64
- `fold(s)` = `s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()`; la consulta además `.trim()` (RF-43).
- `matchRow(row, { query, comments })` → `{ visible, matched: [{ q: n, text }] }`; `comments`: `"all" | "any" | "q1"…"q10"`; con una pregunta, la búsqueda solo mira ese comentario (RF-44). `matched` alimenta el resumen de la tarjeta (RF-64).
- `sortRows(rows, order)`: `updated_at`, luego `created_at`, luego `id`; `"oldest"` invierte la comparación entera (RF-41).
- `visibleEntries(rows, listState)` → filtrado + ordenado, con `matched` por fila; `counts` para "Showing X of Y" (RF-45).
- `INITIAL_LIST_STATE` y `clearFilters()` (RF-46).

### admin-format.js — RF-19, RF-40, RF-58, propuesta 17
- `formatDisplay(iso, timeZone)` → "18 Oct 2026, 21:34" (`Intl.DateTimeFormat("en-GB", {…, hour12:false, timeZone})`).
- `formatHHMM(date, timeZone)` para "Last updated HH:MM".
- `formatCsvDate(iso, timeZone)` → "2026-10-18 21:34" (partes de `formatToParts`, no depende del locale).
- `fileStamp(date, timeZone)` → "2026-10-18-2134"; `fileName(kind, date, tz)` → `leisure-city-<kind>-…csv`.
Los tests fijan `timeZone: "UTC"` y `"Europe/Amsterdam"`; la app pasa `Intl.DateTimeFormat().resolvedOptions().timeZone`.

### csv.js — RF-55, RF-56, RF-59, RF-60, RF-62 (propuestas 13, 21, 29)
- `protectFormula(text)`: si el primer carácter es `= + - @ \t \r`, o el primer carácter que no es `\s` (incluye U+00A0 y demás espacios Unicode con `/^\s*/u`) es `= + - @`, antepone `'` (RF-60). Solo para valores de tipo string; números sin tocar.
- `csvCell(value)`: `null/undefined` → `""`; número → `String(n)`; string → `protectFormula`, y entre comillas (con `"` duplicadas) si contiene `,` `"` `\n` `\r` o empieza/acaba en espacio.
- `toCsv(rows)` = `"﻿" + rows.map(r => r.map(csvCell).join(",")).join("\r\n") + "\r\n"` (BOM, coma, CRLF).
- `responsesCsv(entries, content, { timeZone })`: cabecera `started_at (TZ), updated_at (TZ), content_version, country_code, country_name, status, answered, q1_option, q1_label, q1_comment, …`; valores según propuesta 29 (`Completed`/`In progress`, `OTHER`/`Other`, código desconocido con nombre vacío, sin contestar = 3 vacías, `(unknown option)`).
- `statisticsCsv(stats, meta)`: secciones "Filters" (país y estado aplicados, versión, fecha y zona horaria, participantes) / "Summary" / "Questions" (con fila `(unknown option)`) / "Participants by country", separadas por una fila vacía, porcentajes enteros sin "%" (propuesta 21, orden ajustado: país al final).

## 4. Interfaz (`admin/index.html`, `css/admin.css`, `js/app/admin/`)
### 4.1 Página y CSP — RF-1 a RF-3, RF-65, RF-66, RNF-15
`<head>`:
```html
<meta name="robots" content="noindex, nofollow">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdn.jsdelivr.net;
  connect-src https://xbsrdugimqpgxmlwbpxo.supabase.co; img-src 'self' data:; style-src 'self'; font-src 'self';
  object-src 'none'; base-uri 'none'; form-action 'none'">
<link rel="icon" href="data:,">  <link rel="stylesheet" href="../css/admin.css">
<script type="module" src="../js/app/admin/main.js"></script>
```
- Sin estilos ni scripts en línea (la CSP los bloquearía). Las barras se dimensionan con `el.style.width` (CSSOM, permitido por `style-src 'self'`), nunca con atributos `style=` en HTML.
- `frame-ancestors` no funciona en `<meta>` y no hay SRI del CDN: riesgos asumidos de la spec.
- Formulario a prueba de fallos (propuesta 26), triple barrera:
  1. `<form id="login" novalidate>` sin `action`; los `<input>` **sin atributo `name`** (un envío nativo no llevaría nada);
  2. `form-action 'none'` en la CSP bloquea cualquier navegación por envío;
  3. `<button type="submit" disabled>` en el HTML; `main.js` lo activa solo al terminar de arrancar.
  `main.js` hace `preventDefault()` en `submit`. Campos con `id`, `<label for>`, `autocomplete="username"` / `"current-password"`, `type="password"`.
- Mensaje de RF-66: un módulo que no carga no puede avisar de su propio fallo, así que el HTML trae el texto "The admin page couldn't load. Check your connection and reload the page." en el HTML, oculto al principio y mostrado **solo por CSS** pasados 8 s (`animation` de 0 s con `animation-delay: 8s` y `forwards`, sin movimiento), y `main.js` lo elimina al arrancar. Así no parpadea mientras carga, y si el módulo no carga (o JS está desactivado) el mensaje aparece y el botón sigue desactivado. Además `<noscript>` con el mismo texto. Si el módulo carga pero el cliente del CDN no, se aplica RF-9 al intentar entrar.

### 4.2 Cliente y sesión — RF-5, RF-9, RF-11 a RF-16, RF-69, RNF-16
`client.js`:
- `import { SUPABASE_JS_VERSION } from "../db.js"`; mismo CDN que la encuesta: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${SUPABASE_JS_VERSION}/+esm`; import dinámico con carrera de 15 s (fallo → `threw` → `network`, RF-9). Reintento con `?retry=n` como en `db.js`.
- `createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "leisure-city-admin-auth" }, global: { fetch: timedFetch } })`.
- `timedFetch(input, init)` = `fetch(input, { ...init, signal: AbortSignal.any([init?.signal, AbortSignal.timeout(15000)].filter(Boolean)) })`: un único mecanismo de 15 s por petición para Auth, RPC y cada página (propuesta 16).
- El cliente se carga al arrancar la página (hace falta para leer la sesión recordada, RF-13); el formulario se pinta antes y no depende de él para mostrarse.

`auth.js`:
- `signIn(email, password)` → `client.auth.signInWithPassword`; resultado a `classifyAuthResult`.
- `checkAdmin()` → `client.rpc("is_admin")` (la función existente, `execute` para `authenticated`, propuesta 8) → `classifyAdminCheck`.
- `signOutLocal()` → `client.auth.signOut({ scope: "local" })`. **Trampa**: por defecto `signOut()` es global y echaría a los otros 3 estudiantes (RF-15).
- Sesión recordada: `client.auth.getSession()` al arrancar; `onAuthStateChange("SIGNED_OUT")` no provocado por nuestro "Log out" (bandera `leaving`) → RF-16. Si un `signIn` responde después de su timeout, se hace `signOutLocal()` para no dejar una sesión que el usuario cree fallida.

`main.js` (estado único `{ phase: "login"|"checking"|"loading"|"ready", rows, lastUpdated, tab, filters, list, open:Set, error }`):
```
arranque: activar botón; session = getSession()
  si session → checkAdmin()  (RF-11, RF-13)
login submit: prep = prepareLogin(...)   si error → mensaje (RF-6, RF-67), sin red
  botón disabled + "Logging in…" (RF-10); r = signIn; kind≠ok → mensaje (RF-7, RF-8, RF-9, RF-68); limpiar Password si credentials
  ok → checkAdmin()
checkAdmin: admin → load()   no_access → signOutLocal + borrar datos + mensaje (RF-12)
            network → panel sin datos + "Try again" (RF-69)   session_ended → borrar + RF-16
load(): Refresh/Try again disabled (RF-20); "Loading responses…" (RF-18)
  r = loadAllRows(data.fetchPage)   error → mensaje RF-21 conservando rows anteriores
  ok → rows, lastUpdated = now; render()
Refresh: checkAdmin() → load()   (RF-20)
Log out: leaving=true; signOutLocal(); state = inicial (borra rows de memoria); formulario vacío (RF-15)
```

### 4.3 Carga — RF-17, RF-21
`data.js`: `fetchPage(lastId, size)` = `client.from("responses").select(COLS).order("id").limit(size)` + `.gt("id", lastId)` si hay `lastId`; devuelve `{ rows }` o `{ error }` (clasificado con `classifyLoadResult`; 401 → sesión terminada).

### 4.4 Filtros, pestañas y estadísticas — RF-22 a RF-38, RF-70
- Barra común sobre las pestañas: aviso de otras versiones (RF-22), `<select>` "Country" (valor inicial "All countries", opcional), `<select>` "Status" ("All"), "N participants" (RF-25).
- Pestañas `role="tablist"`/`tab`/`tabpanel` con `aria-selected` y flechas de teclado; "Statistics" por defecto (RF-26, RF-27). Cambiar de pestaña solo muestra/oculta: el estado no se toca.
- `stats-view.js`, en el orden de RF-70: tarjetas de resumen → bloques Q1-Q10 → "Participants by country" al final.
  - Bloque de pregunta: `<h3>` "Q<n>" + enunciado, "N answers · N comments", y por opción una fila: línea de texto "A · etiqueta" y debajo pista + barra (`div` con `width: p%`, dorado sobre azul oscuro, `aria-hidden`) con "count · p%" visible al lado (RF-32, RF-33). La alternativa textual es el propio texto visible (RNF-7). "No answers yet" si n = 0 (RF-35). Aviso de opción desconocida. Botón "See comments" (RF-37, RF-38) → `list.comments = "qN"`, `list.query = ""`, `tab = "responses"`.
  - Botón "Download statistics" junto a los filtros de la pestaña (RF-54, RF-56).
- Sin animaciones (RNF-6): las barras aparecen ya con su ancho.

### 4.5 Lista y descargas — RF-39 a RF-48, RF-54, RF-55, RF-61 a RF-64
- `list-view.js` elige con `matchMedia("(min-width: 768px)")` y repinta al cambiar (RF-42, RF-63). **Descartado**: pintar tabla y tarjetas y ocultar una con CSS (DOM doble con 1000 filas).
- Tabla: `<table>` dentro de un contenedor con `overflow-x: auto`; primera columna `position: sticky; left: 0`; celdas Qn con "A · etiqueta" y el comentario debajo (`white-space: pre-wrap`).
- Tarjetas: `<details>`/`<summary>` (accesible y con estado plegado/desplegado anunciado, RNF-7). El estado abierto se guarda en `open` (Set de ids) y se reaplica al repintar, así escribir en la búsqueda no pliega ni despliega (RF-64). Con búsqueda/filtro activos, el `<summary>` incluye los `matched` con su "Q<n>".
- Controles: "Search comments" (`input type="search"`, evento `input`), "Comments", "Newest first"/"Oldest first", "Showing X of Y responses", "No responses match your filters." + "Clear filters" (RF-43 a RF-46).
- Todo texto de usuario con `textContent`; nunca `innerHTML` con datos (RF-47).
- `download.js`: `new Blob([csv], { type: "text/csv;charset=utf-8" })`, `URL.createObjectURL`, `<a download>` temporal, `revokeObjectURL`. "Download responses" desactivado sin entradas (RF-61). Nombre con `fileName` (RF-58).

### 4.6 Estilo y medidas — RNF-4, RNF-5, RNF-7, propuestas 20 y 32
- `css/admin.css` con sus propias `@font-face` (Figtree 400/600/700 y Big Shoulders 800, `../assets/fonts/`, `font-display: optional`) y las variables de color de `survey.css` copiadas (`--night`, `--royal-deep`, `--gold`, `--text`, `--muted`, `--line`). **Descartado**: extraer una hoja común y tocar `survey.css` (riesgo de regresiones en la encuesta a 10 días del evento).
- `main` con `max-width: 1200px` centrado; bloques de estadísticas `max-width: 760px`; texto ≥ 16 px en móvil, ≥ 14 px en celdas de tabla; contraste 4.5:1 / 3:1; foco visible (`:focus-visible` con contorno dorado); zonas táctiles ≥ 44 px; `overflow-wrap: anywhere` en comentarios (palabras largas sin scroll).
- Big Shoulders solo en la marca "Leisure City · Admin" y los títulos; todo lo demás en Figtree.

## 5. Base de datos y guía manual (`docs/supabase.md`) — RF-50, RF-52, RNF-1, RNF-2, RNF-13 (propuestas 6, 7, 25)
No hay SQL nuevo en `supabase/migrations/`. Se reescribe el **paso 4** de la guía ("Crear los 4 admins") como "Cuenta compartida del panel /admin":
1. **Crear la cuenta** (lo hace el usuario; ningún agente ve ni escribe la contraseña): Authentication → Users → Add user → Create new user; email `admin@leisure-city.invalid`; contraseña de ≥ 16 caracteres generada en su gestor (RNF-2), pegada solo ahí; **Auto Confirm User** marcado. Si Supabase rechaza el dominio, repetir con `admin@example.com` y avisar al agente para cambiar `ADMIN_LOGIN_EMAIL` y la spec.
2. **Añadirla a admins** (SQL Editor):
   ```sql
   insert into public.admins (user_id, label)
   select id, 'Shared admin' from auth.users where email = 'admin@leisure-city.invalid'
   on conflict (user_id) do nothing;
   select a.label, u.email, u.email_confirmed_at is not null as confirmed
   from public.admins a join auth.users u on u.id = a.user_id;   -- 1 fila, confirmed = true
   ```
3. **Cambiar la contraseña**: Authentication → Users → la cuenta → cambiar contraseña (o "Send password recovery": no sirve, el correo no existe).
4. **Prueba de RF-12** (quitar y volver a poner): `delete from public.admins where user_id = (select id from auth.users where email = '…');` → probar → repetir el `insert` del punto 2.
5. **Contraseña filtrada** (propuesta 25), en este orden: (1) quitar de admins (punto 4); (2) revocar todas las sesiones:
   ```sql
   delete from auth.refresh_tokens where user_id = (select id::text from auth.users where email = '…');
   delete from auth.sessions       where user_id = (select id       from auth.users where email = '…');
   ```
   (T5 verifica los nombres y tipos de columna en el proyecto antes de documentarlo; si el panel ofrece cerrar todas las sesiones del usuario, se menciona como alternativa); (3) cambiar la contraseña; (4) esperar el tiempo de vida del token de acceso (Authentication → Sessions/JWT expiry, 3600 s por defecto) y volver a añadir a admins; (5) comunicar la contraseña nueva en persona o por canal privado.
6. Recordatorios: registro público desactivado (paso 3, RF-52); el correo interno no es secreto; nunca pegar la contraseña en el repo, en un issue ni en un chat con agentes (RNF-1).

`scripts/check-db.mjs` no cambia: sigue comprobando con la clave pública que no se puede leer (RF-50).

## 6. Estrategia de tests (`node --test`)
| Archivo | Cubre |
|---|---|
| tests/admin-auth.test.js | `normalizeUsername` ("Admin ", "ADMIN"), `prepareLogin` (vacíos, usuario ajeno sin petición, contraseña con espacios tal cual), `classifyAuthResult` (400 invalid_credentials, 429, email_not_confirmed, status 0, 5xx, timeout, throw, AuthRetryableFetchError), `classifyAdminCheck` (true, false, 401, red), `classifyLoadResult`, textos literales — RF-4 a RF-12, RF-16, RF-21, RF-67 a RF-69 |
| tests/admin-load.test.js | 0 filas; 2500 filas en páginas de 1000; servidor que limita a 500 por página; inserción con id menor y actualización entre páginas (ni duplicados ni omisiones de las existentes); página que falla → error sin filas parciales — RF-17, RF-21 |
| tests/admin-stats.test.js | `percent` (0/0, 1/3, 2/3, 1/8 = 13, 5/8 = 63), `splitByVersion` + hiddenCount sin filtros, `countryChoices` (orden, Other, desconocidos A-Z), filtros por país y estado (valor inicial sin filtrar), `summary`, `questionStats` (parciales cuentan solo lo respondido, opciones con 0, "(open answer)" por tipo, desconocida en denominador, comentarios), `byCountry` (orden y desempates) — RF-22 a RF-37, RF-70 (datos) |
| tests/admin-list.test.js | `fold` con tildes/mayúsculas, búsqueda recortada, comentarios "any"/"qN" limitando la búsqueda, `matched`, orden con empates y "oldest", "Showing X of Y", `clearFilters` — RF-39 a RF-46, RF-64 |
| tests/admin-format.test.js | fechas en UTC y Europe/Amsterdam (cambio de hora 25/10/2026), HH:MM 24 h, nombres de archivo — RF-19, RF-40, RF-58 |
| tests/csv.test.js | BOM, coma, CRLF, comillas, saltos de línea, emojis; `protectFormula` (= + - @, tab, CR, espacios y U+00A0 delante; números intactos; texto normal intacto); columnas y valores de `responsesCsv`; secciones y orden de `statisticsCsv`; los números del CSV = `questionStats`/`summary`/`byCountry` — RF-55 a RF-62 |
| tests/admin-markup.test.js | `admin/index.html`: meta robots noindex, CSP exacta (script-src, connect-src, form-action 'none', object-src, base-uri), `<button type="submit" disabled>`, inputs sin `name` y con `autocomplete`, sin `<script>`/`style=` en línea, mensaje de RF-66 presente; la encuesta no enlaza a `admin` — RF-1 a RF-3, RF-65, RF-66, RNF-15 |
| tests/config.test.js (ampliado) | `ADMIN_LOGIN_EMAIL` termina en `.invalid` o `@example.com`; sigue la guarda de la clave — RNF-3, RF-53 |

Fuera de `node --test` (validación, T10): Chrome DevTools MCP a 375 px y 1280 px con login real; bloqueo de `js/app/admin/main.js` (RF-65/66); dos navegadores para "Log out" local y revocación; RF-12 con el procedimiento del §5.4; `node scripts/check-db.mjs`; Excel en inglés para los CSV; rendimiento de RNF-8 con 1000 filas (Performance de DevTools sobre los datos reales o filas de prueba `dbcheck` creadas y borradas después).

## 7. Qué se puede hacer sin la cuenta (T6)
Toda la lógica y sus tests (T1-T4), la guía (T5) y la página con su formulario, CSP, errores de campos vacíos/usuario ajeno/contraseña incorrecta y la prueba con el script bloqueado (T7). **Bloquea**: ver datos reales en el navegador (T8, T9 y la validación T10).

## 8. Cobertura de RF por parte
| Parte | RF / RNF |
|---|---|
| admin/index.html + admin-markup test | RF-1 a RF-3, RF-65, RF-66, RNF-14, RNF-15 |
| admin-auth.js + auth.js + client.js + main.js | RF-4 a RF-16, RF-53, RF-67 a RF-69, RNF-16 |
| admin-load.js + data.js | RF-17, RF-18, RF-21 |
| main.js (Refresh, Last updated) + admin-format.js | RF-19, RF-20, RF-40, RF-58 |
| admin-stats.js + stats-view.js | RF-22 a RF-38, RF-70 |
| admin-list.js + list-view.js | RF-39 a RF-48, RF-63, RF-64 |
| csv.js + download.js | RF-49 (sustituido), RF-54 a RF-62 |
| docs/supabase.md + T6 | RF-50 a RF-52, RNF-1 a RNF-3, RNF-13 |
| css/admin.css | RNF-4 a RNF-7 |
| todo | RNF-8 a RNF-12 (validación) |

## 9. Decisiones técnicas (y alternativa descartada)
1. Paginación keyset por `id` — descartado `range()` por posición y orden por `updated_at` (§3).
2. Un `fetch` con timeout global inyectado en el cliente — descartado envolver cada llamada con `Promise.race` (no cancela la petición y deja huecos, p. ej. el refresco de sesión).
3. `signOut({ scope: "local" })` — el valor por defecto (global) echaría a todos.
4. Agregación en el navegador sobre todas las filas — descartado una RPC/vista de estadísticas (cambiaría la base de datos y sus permisos, RF-50).
5. Tabla o tarjetas según `matchMedia` — descartado pintar ambas.
6. CSS propio del panel con fuentes y variables copiadas — descartado refactorizar `survey.css`.
7. Formulario sin `name`, botón `disabled` y `form-action 'none'` — descartado confiar solo en `preventDefault`.
8. Versión de supabase-js importada de `db.js` — descartado repetir el número (dos sitios que se desincronizan).
9. Sin MCP de Supabase: la cuenta y la contraseña las crea el usuario en el panel (propuesta 19).

## 10. Al cerrar la spec
- Correcciones de "4 admins" (criterio de la spec): nota en la definición "Admin" de `specs/001-survey/spec.md` que remita a la 002, paso 4 de `docs/supabase.md` (ya en T5) y `MEMORY.md`.
- MEMORY.md: cuenta compartida y correo interno final, trampa de `signOut` global, sesión sin caducidad y procedimiento de revocación, URL `/admin/`.
- AGENTS.md: proponer añadir `admin/` y `js/app/admin/` a la estructura y la regla "la contraseña del panel nunca pasa por un agente".

## 11. Cambio de requisitos 2026-10-19: Q3 de opción múltiple
Cubre las definiciones modificadas, RF-32, RF-34, RF-40, RF-50, RF-55, RF-56, RNF-11 y los nuevos RF-71 a RF-76, aprobados por el usuario el 2026-10-19 junto con las propuestas 34 a 39.

Va junto al cambio de la spec 001 (plan 001 §17): reutiliza `js/lib/choice.js`, que crea la T39 de la 001, y se publica en el mismo push, después de la migración (plan 001 §17.9, T42 y T45 de la 001).

**Lo que no cambia**: carga, acceso, filtros, búsqueda, filtro de comentarios (RF-75), orden, formato de fechas y de los CSV (BOM, coma, CRLF, protección de fórmulas), y la base de datos desde esta spec (RF-50). Sin consultas nuevas.

### 11.1 `admin-stats.js` — RF-71, RF-72, RF-76 (propuestas 34, 37, 39)
```
questionStats(rows, content), por pregunta q:
  multi = isMultiple(q)                                   // de choice.js
  por fila con opción guardada (texto no vacío):
    answers += 1                                          // una vez por fila (RF-71)
    si multi: letras = lettersOf(valor)                   // sin repetidas
      por letra: conocida → counts[letra] += 1; desconocida → unknownCounts[letra] += 1
      si alguna desconocida → unknownRows += 1            // RF-76: filas, no letras
    si no: como hoy (el valor entero, p. ej. "AC" en Q1, es una opción desconocida)
  options: como hoy, percent(count, answers)              // definición "Porcentaje de una opción"
  unknown: { count: unknownRows (multi) o el total de hoy, percent, options: [{ letter, count, percent }] }
  multiple: multi
  note: multi ? "Multiple choice – percentages can add up to more than 100%" : null      // RF-72
```
- `answeredCount` no cambia: un texto no vacío cuenta como respondida.
- `MULTIPLE_NOTE` se exporta como constante para la vista y los tests.

### 11.2 `admin-list.js` — RF-73
- `describeEntry` añade `lines` en cada respuesta:
  - multi: una línea por letra de `lettersOf(valor)`, en orden A, B, C, como `"A · The theme"`, o `"X · (unknown option)"` si la letra no existe;
  - única: `[answer]`;
  - sin responder: `[]`.
- `answer` se mantiene (las líneas unidas por "\n" en multi) para no romper el uso actual.

### 11.3 `csv.js` — RF-74, RF-76 (duda 45 de la 001, propuesta 36)
- `answerCells` en Q3 (multi): q3_option `lettersOf(v).join(", ")` → "A, C"; q3_label con las etiquetas unidas por "; " → "The theme; A message", con "(unknown option)" en el lugar de una letra desconocida; q3_comment como hoy.
- `statisticsCsv`:
  - la cabecera de "Questions" añade `choice` al final;
  - cada fila lleva `"multiple"` o `"single"` según `q.multiple`, también las filas "(unknown option)";
  - los números salen de `questionStats`, así que son iguales a la pantalla (RF-57).
- **Decisión**: "A, C" se queda en una sola celda; `csvCell` ya la pone entre comillas por llevar coma. **Descartado**: columnas 1/0 por letra (duda 45, opción b, no elegida).

### 11.4 Vistas — RF-72, RF-73
- `js/app/admin/stats-view.js`: si `q.note`, un `<p class="stat-block__note">` junto a "N answers". Se pinta siempre, también con "No answers yet". El aviso de opción desconocida sigue igual con `q.unknown.count` (filas).
- `js/app/admin/list-view.js`: pinta `a.lines` como un `<span class="answer">` por línea (con `textContent`, RF-47), o "—" si no hay líneas. Igual en la tabla y en las tarjetas.
- `css/admin.css`: `.stat-block__note` en texto normal de 14 px o más, `--muted`, contraste ≥ 4.5:1 (RNF-5); `.answer` en bloque si hay varias líneas.

### 11.5 Tests (`node --test`) — primero en rojo
- `tests/admin-stats.test.js`:
  - el caso límite de la spec: 4 filas "A", "AC", "ABC" y sin responder → 3 answers, A 3/100, B 1/33, C 2/67;
  - `note` solo en Q3, también con 0 respuestas;
  - una letra desconocida en "AD" → A suma 1, `unknown.count` 1 (filas), y otra fila con "AD" → 2;
  - "AC" guardado en Q1 → opción desconocida entera;
  - filas antiguas con "B" en Q3 cuentan como B.
- `tests/admin-list.test.js`: `lines` en Q3 ("A · The theme", "C · A message"), con letra desconocida y en una pregunta única.
- `tests/csv.test.js`:
  - q3_option `"A, C"` entre comillas;
  - q3_label "The theme; A message";
  - columna `choice` con "multiple" en las filas de Q3 (también "(unknown option)") y "single" en las demás;
  - números iguales a `questionStats`.
- `tests/admin-markup.test.js`: solo si cambia el HTML (no se espera).

### 11.6 Cobertura
| Parte | RF |
|---|---|
| admin-stats.js | RF-32, RF-34, RF-71, RF-72, RF-76 |
| admin-list.js + list-view.js | RF-40, RF-73, RF-75 |
| csv.js | RF-55, RF-56, RF-57, RF-74 |
| stats-view.js + admin.css | RF-72 |

### 11.7 Al cerrar
Junto con la T45 de la 001: spec en "implementada" tras el APROBADO; MEMORY.md (Q3 en el panel: recuento por participante y "A, C" en el CSV).
