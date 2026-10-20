# Tareas 002 — Panel de resultados /admin

Plan: `specs/002-admin/plan.md`. Tests con `node --test`: primero en rojo, después el código, luego en verde. Una tarea cada vez. Las tareas marcadas con **[USUARIO]** necesitan una acción del usuario. **Ningún agente ve, pide, genera ni escribe la contraseña de la cuenta compartida** (RNF-1): ni en archivos, ni en comandos, ni en el chat.

- [x] **T1. Lógica de acceso y carga paginada.** RF-4 a RF-12, RF-16, RF-17, RF-21, RF-53, RF-67 a RF-69, RNF-3
  - Archivos: `js/lib/admin-auth.js`, `js/lib/admin-load.js`, `js/config.js` (+ `ADMIN_LOGIN_EMAIL = "admin@leisure-city.invalid"`).
  - Tests primero: `tests/admin-auth.test.js` y `tests/admin-load.test.js` (casos del plan §6); `tests/config.test.js` ampliado (correo de dominio reservado).
  - Hecho cuando: `node --test` en verde, incluidas las 2500 filas en páginas simuladas con escrituras entre páginas sin duplicados ni omisiones.

- [x] **T2. Lógica de estadísticas y filtros comunes.** RF-22 a RF-25, RF-29 a RF-37, RF-57, RF-70
  - Archivos: `js/lib/admin-stats.js`.
  - Tests primero: `tests/admin-stats.test.js` (redondeo entero con ,5 hacia arriba, versión actual + aviso antes de filtros, país opcional con "All countries" por defecto, parciales, opciones con 0, "(open answer)" por tipo, opción desconocida en el denominador, comentarios, orden y desempates por país).
  - Hecho cuando: `node --test` en verde.

- [x] **T3. Lógica de lista, búsqueda, orden y fechas.** RF-19, RF-39 a RF-46, RF-58, RF-64
  - Archivos: `js/lib/admin-list.js`, `js/lib/admin-format.js`.
  - Tests primero: `tests/admin-list.test.js` (sin tildes ni mayúsculas, búsqueda limitada a Qn, comentarios coincidentes, orden con empates y "Oldest first", "Showing X of Y", "Clear filters") y `tests/admin-format.test.js` (UTC y Europe/Amsterdam con el cambio de hora del 25/10/2026, HH:MM, nombres de archivo).
  - Hecho cuando: `node --test` en verde.

- [x] **T4. Generación de los dos CSV.** RF-55, RF-56, RF-59, RF-60, RF-62
  - Archivos: `js/lib/csv.js`.
  - Tests primero: `tests/csv.test.js` (BOM, coma, CRLF, comillas, saltos de línea, emojis; protección de fórmulas con = + - @, tab, CR, espacios y U+00A0 delante; números intactos; columnas y valores de "Download responses"; secciones Filters/Summary/Questions/Participants by country y números iguales a los de `admin-stats`).
  - Hecho cuando: `node --test` en verde.

- [x] **T5. Guía manual de la cuenta compartida.** RF-50, RF-52, RNF-1, RNF-2, RNF-13
  - Archivos: `docs/supabase.md` (paso 4 reescrito según el plan §5: crear la cuenta con Auto Confirm y comprobar el dominio, añadir a admins y comprobarlo, cambiar la contraseña, prueba de RF-12 quitando y poniendo, procedimiento de contraseña filtrada con revocación de sesiones y espera de 1 h).
  - Tests primero: no aplica (documentación). Antes de escribir el SQL de revocación, comprobar con el usuario (o en el esquema `auth` de la documentación de Supabase) los nombres y tipos de `auth.sessions.user_id` y `auth.refresh_tokens.user_id`.
  - Hecho cuando: la guía cubre cada paso manual de RNF-13, no contiene ninguna contraseña y `node --test` sigue en verde.

- [x] **T6. [USUARIO] Crear la cuenta compartida en Supabase.** RF-50, RF-52, RNF-1, RNF-2 (propuestas 6 y 7)
  - Acción del usuario, siguiendo `docs/supabase.md` paso 4. **Solo el usuario conoce la contraseña; no la comparte con ningún agente.**
    - [x] (a) generar en su gestor de contraseñas una contraseña de 16 o más caracteres al azar;
    - [x] (b) Authentication → Users → Add user con `admin@leisure-city.invalid`, esa contraseña y "Auto Confirm User"; si Supabase rechaza el dominio, usar `admin@example.com` y decírselo al agente (se cambian `ADMIN_LOGIN_EMAIL` y la spec);
    - [x] (c) ejecutar en el SQL Editor el `insert` en `public.admins` y la consulta de comprobación (1 fila, confirmed = true);
    - [x] (d) confirmar al agente "cuenta creada y en admins" (sin la contraseña).
  - Bloquea: la comprobación en el navegador con login real de T8, T9 y T10. T7 se puede hacer antes (credenciales incorrectas y script bloqueado no necesitan la cuenta).
  - Hecho cuando: el usuario confirma (d) y el correo final coincide con `ADMIN_LOGIN_EMAIL`.
  - Hecho (2026-10-18) por el usuario: `admin@leisure-city.invalid` creada con Auto Confirm y en `public.admins` (comprobado en el SQL Editor: 1 fila, label "Shared admin", confirmed = true). El dominio `.invalid` funcionó: `ADMIN_LOGIN_EMAIL` no cambia. Ningún agente conoce la contraseña.

- [x] **T7. Página /admin, formulario y sesión.** RF-1 a RF-16, RF-65 a RF-69, RNF-15, RNF-16
  - Archivos: `admin/index.html` (CSP, noindex, formulario sin `name`, botón `disabled`, mensaje de RF-66 por CSS y `<noscript>`), `css/admin.css` (base: fuentes, paleta, formulario, cabecera), `js/app/admin/client.js`, `js/app/admin/auth.js`, `js/app/admin/main.js` (fases login/checking/loading/ready, Log out local, sesión recordada, RF-16).
  - Tests primero: `tests/admin-markup.test.js` (plan §6).
  - Hecho cuando: `node --test` en verde y en Chrome DevTools a 375 px, sin errores en consola: campos vacíos y usuario ajeno sin petición en Network; contraseña incorrecta → "Wrong username or password."; offline → mensaje de RF-9; con `js/app/admin/main.js` bloqueado, el botón sigue desactivado, Intro no cambia la URL y aparece el mensaje de RF-66; la CSP aplicada sin avisos. Con T6 hecho: entrar, recargar (sesión recordada) y "Log out".

- [x] **T8. Carga, filtros, pestañas y estadísticas.** RF-17 a RF-38, RF-54, RF-56, RF-57, RF-70
  - Archivos: `js/app/admin/data.js`, `js/app/admin/stats-view.js`, `js/app/admin/download.js`, `js/app/admin/main.js` (Refresh, Last updated, filtros, pestañas, "Download statistics"), `css/admin.css` (filtros, pestañas, barras, máximos de 1200 y 760 px).
  - Tests primero: los de T1-T4 cubren la lógica; añadir casos que falten si aparece lógica nueva (nunca en `js/app/`).
  - Hecho cuando: `node --test` en verde; con login real (T6) a 375 y 1280 px: "Statistics" en el orden resumen → Q1-Q10 → país; los números coinciden con una consulta a mano en el SQL Editor; país opcional ("All countries" por defecto) y estado cambian todo; "Refresh" desactivado mientras carga; "See comments" abre "Responses" filtrado; "Download statistics" se abre en Excel con cada valor en su celda.
  - Hecho (2026-10-18) con datos simulados (Supabase interceptado en el navegador, 1503 filas): `node --test` 571/571; orden resumen → Q1-Q10 → país, números iguales a un recuento independiente (todo, BR, BR + In progress), filtros, "Refresh" desactivado durante la carga y conservando los filtros, fallo y servidor que no avanza conservando los datos, "See comments", pestañas con flechas, CSV con BOM, a 375 y 1280 px sin errores en consola. Añadidos: guarda `STALLED_PAGE` en admin-load.js, `.retry(false)` en data.js (supabase-js reintentaba solo, contra RF-21), `countText`/`fromAdminPage` en admin-format.js y `countryChoices(…, selected)`.
  - **Pendiente de T6** (se comprueba en T10): login real, números contra una consulta en el SQL Editor y abrir "Download statistics" en el Excel en inglés.

- [x] **T9. Lista de respuestas y "Download responses".** RF-39 a RF-48, RF-55, RF-58 a RF-64
  - Archivos: `js/app/admin/list-view.js`, `js/app/admin/main.js` (búsqueda, filtro de comentarios, orden, Clear filters, estado abierto de las tarjetas, "Download responses"), `css/admin.css` (tabla con primera columna fija, tarjetas `<details>`).
  - Tests primero: los de T3 y T4; añadir casos si aparece lógica nueva.
  - Hecho cuando: `node --test` en verde; con login real: tabla a 1280 px y tarjetas a 375 px sin scroll horizontal de página; búsqueda con tildes y mayúsculas distintas; los comentarios coincidentes se ven en la tarjeta plegada y escribir no pliega ni despliega; comentarios con HTML se ven como texto; "Download responses" con un filtro activo tiene las mismas filas y orden que la lista y se abre bien en Excel en inglés.
  - Hecho (2026-10-18) con datos simulados (Supabase interceptado en el navegador, 1000 y 1500 filas, comentarios con `<script>`, `<img onerror>`, `<b>`, "=cmd", "  +SUM", "@here", saltos de línea, emojis, tildes y una palabra de 272 letras): `node --test` 582/582; tabla a 1280 px con "Started" fija y scroll solo dentro de la tabla; tarjetas a 375 px sin scroll horizontal de página; búsqueda "musica" = "MÚSICA" = "éxito"; abrir tarjetas y escribir no las pliega y las plegadas muestran los comentarios que coinciden con su Qn; HTML visto como texto (0 elementos inyectados); "See comments" → "With a comment in Q4"; "Clear filters" devuelve también país y estado; "Download responses" con estado + comentarios + búsqueda + "Oldest first" = 564 filas en el mismo orden que la lista, BOM, CRLF, fórmulas con apóstrofo y sin IDs; sin errores en consola ni peticiones reales. Añadidos: `describeEntry`, `NO_RESPONSES_MESSAGE` y `UNKNOWN_OPTION_LABEL` en admin-list.js; `countryName` exportado en admin-stats.js; formateadores `Intl` reutilizados por zona en admin-format.js. Para RNF-8 (1000 filas < 200 ms) la lista pinta 40 entradas al momento y el resto en bloques de 120 en tareas siguientes (cancelados si se vuelve a pintar), con `table-layout: fixed` y `content-visibility: auto` en las tarjetas: cambiar filtro, orden o búsqueda ≈ 45-65 ms a 1280 px y < 20 ms a 375 px.
  - **Pendiente de T6** (se comprueba en T10): login real, abrir "Download responses" en el Excel en inglés y el cambio en vivo tabla ↔ tarjetas al cruzar 768 px (no se emuló para no recargar sin el initScript).

- [x] **T10. Validación completa y cierre.** Todos los RF y RNF de la spec 002
  - Validación (skill sdd, empieza por VEREDICTO): recorrer la spec RF por RF con su test o comprobación; Chrome DevTools MCP a 375 px y 1280 px sin errores en consola (RNF-12); RNF-8 con 1000 filas; RF-12 retirando y volviendo a añadir la cuenta (guía §4); dos navegadores: "Log out" local no echa al otro y la revocación de sesiones (guía §5) deja al otro sin datos (RF-16/RF-12); `node scripts/check-db.mjs` sigue pasando (el público no lee); el repositorio no contiene la contraseña (RNF-1).
  - Cierre (solo con VEREDICTO: APROBADO): spec en "implementada"; corregir "4 admins" → cuenta compartida en la definición "Admin" de `specs/001-survey/spec.md`, en `docs/supabase.md` (si queda algo) y en `MEMORY.md`; actualizar MEMORY.md (correo final, trampa de `signOut` global, sesión sin caducidad y revocación, URL `/admin/`); proponer los cambios de AGENTS.md del plan §10. Borrar las filas de prueba que se hayan creado (guía, paso 6).
  - Hecho cuando: VEREDICTO: APROBADO y los archivos de cierre actualizados.
  - Avance (2026-10-18), con login real (el usuario escribió la contraseña; ningún agente la vio) y Supabase real, sin initScript: `node --test` 582/582; `node scripts/check-db.mjs` 38/38 (el público no lee `responses` ni `admins`, `is_admin` no es invocable por el público, registro desactivado; se ejecutó dos veces y dejó filas `dbcheck…`). En el panel: 11 participantes de la versión actual (9 Completed, 2 In progress) y "50 responses from other content versions are hidden."; país empieza en "All countries"; Netherlands → 4 y Netherlands + In progress → 0 con "No answers yet" en las 10; los recuentos de Netherlands coinciden con la tabla de "Responses"; "Refresh" desactivado durante la carga y "Last updated" actualizado; "See comments of Q2" → "Responses" con "With a comment in Q2" (2 de 11) sin cambiar filtros y con búsqueda vacía; búsqueda "  DÁNCING " → 1; sin coincidencias → "No responses match your filters.", "Download responses" desactivado y "Clear filters" lo devuelve todo; "Oldest first" con el mismo orden en pantalla y en el CSV. CSV (Netherlands): BOM, CRLF sin LF sueltos, comillas en los textos con coma, sin IDs, nombres `leisure-city-{statistics,responses}-2026-10-18-HHMM.csv` (están en Descargas del usuario), estadísticas idénticas a la pantalla. 1280×800 y 375×667 sin scroll horizontal (tabla con scroll propio a 1280; tarjetas a 375 con el comentario coincidente en la tarjeta plegada; abrir y escribir no pliega); paso en vivo tarjetas (700 px) → tabla (1000 px) sin recargar; zonas táctiles ≥ 44 px a 375; recarga con sesión recordada → `is_admin` antes de cargar filas (RF-11/RF-13); Refresh sin conexión → mensaje de RF-21 con "Try again", conservando los datos, y "Try again" ya con red recupera; CSP y `noindex, nofollow` presentes; formulario usable en ~1,3 s con Fast 4G y sin caché; "Log out" → `POST /auth/v1/logout?scope=local` (204), formulario sin datos, ninguna clave en el almacenamiento y la recarga muestra el formulario. Consola: solo errores de red del navegador (el 400 del primer intento de login del usuario y ERR_INTERNET_DISCONNECTED de la prueba sin conexión). Búsqueda en el repo y en el historial de asignaciones de contraseñas: solo valores ficticios de los tests.
  - Pendiente del usuario (texto original del avance; el punto 1 ya está hecho): (1) consulta de solo lectura en el SQL Editor para comparar los números; (2) abrir los dos CSV en el Excel en inglés con doble clic; (3) RF-12 con la guía §4.4; (4) dos navegadores: "Log out" en uno no cierra el otro, y revocación de sesiones (guía §4.5, pasos 1, 2 y 5) deja al otro sin datos. Antes del evento, además: borrar las filas `dbcheck…` y la de la versión actual con el comentario "T19 test row - delete" (Germany, 16 Oct 20:51).
  - Hecho (2026-10-18): VEREDICTO: APROBADO del reviewer (582/582; check-db 38/38), validado con login real. La comparación de números con la base de datos (punto 1 de arriba) la hizo el coordinador con una consulta de solo lectura y coincide. Spec cerrada como implementada; MEMORY.md, AGENTS.md y la definición "Admin" de la spec 001 actualizados. Las filas de prueba no se borran aún (siguen haciendo falta para las pruebas pendientes): quedan en "Antes del evento" de MEMORY.md.
  - **Pendientes del usuario antes del evento** (decidió hacerlas después sobre GitHub Pages, "publica ya"): (a) abrir los dos CSV en el Excel en inglés con doble clic (RF-59, RNF-11); (b) RF-12 retirando y volviendo a añadir la cuenta en admins (guía §4.4); (c) dos navegadores: "Log out" local no cierra el otro y la revocación de sesiones deja al otro sin datos (RF-15, RF-16; guía §4.5, pasos 1 y 2).

## Cambio de requisitos 2026-10-19 (plan §11): Q3 de opción múltiple
Va junto al cambio de la spec 001 (`specs/001-survey/tasks.md`, T39-T45).

- **Orden**: T39 → T40 → T41 → T43 → T44 de la 001, luego T11 → T12 → T13 de aquí, y por último T45 de la 001.
- **Dependencia**: T11 necesita `js/lib/choice.js`, que crea la T39 de la 001.
- **Sin commit ni push**: la validación conjunta y la publicación son la T45 de la 001, después de la migración (T42 [USUARIO]).
- Las pruebas en el navegador se hacen con Supabase interceptado (datos simulados), como en T8 y T9.

- [x] **T11. Lógica: estadísticas de Q3 por participante, aviso y opciones desconocidas.** RF-32, RF-34, RF-71, RF-72, RF-76
  - Archivos: `js/lib/admin-stats.js` (plan §11.1).
  - Tests primero: `tests/admin-stats.test.js` ampliado (plan §11.5).
  - Hecho cuando:
    - `node --test` en verde, con el caso "A", "AC", "ABC" y sin responder → 3 answers y 100/33/67;
    - `unknown.count` cuenta filas;
    - las preguntas de respuesta única dan los mismos números que antes.

- [x] **T12. Lógica: Q3 en la lista y en los dos CSV.** RF-40, RF-55, RF-56, RF-57, RF-73, RF-74
  - Archivos: `js/lib/admin-list.js` (`lines`, plan §11.2) y `js/lib/csv.js` (Q3 "A, C" / "The theme; A message" y columna `choice`, plan §11.3).
  - Tests primero: `tests/admin-list.test.js` y `tests/csv.test.js` ampliados (plan §11.5).
  - Hecho cuando:
    - `node --test` en verde;
    - las preguntas de respuesta única salen idénticas en los dos CSV, salvo la columna `choice` nueva del de estadísticas.

- [x] **T13. Vistas del panel: aviso de Q3 y opciones marcadas en la lista.** RF-72, RF-73, RF-75, RNF-5, RNF-7
  - Archivos: `js/app/admin/stats-view.js`, `js/app/admin/list-view.js` y `css/admin.css` (plan §11.4).
  - Tests primero: los de T11 y T12; añadir casos si aparece lógica nueva (nunca en `js/app/`).
  - Hecho cuando:
    - `node --test` en verde;
    - en Chrome DevTools a 375 y 1280 px, con datos simulados (filas de "2026-10-live-2" con Q3 "A", "AC", "ABC", "AD" y sin responder, y alguna fila de "2026-10-live-1"):
      - el bloque de Q3 muestra 100/33/67, el aviso "Multiple choice – percentages can add up to more than 100%" (también con un filtro que deje "No answers yet") y el aviso de opción desconocida contando filas;
      - la tabla y las tarjetas muestran una línea por opción marcada y "X · (unknown option)";
      - "See comments" y la búsqueda funcionan en Q3;
      - las filas de la versión anterior se ocultan con su aviso (RF-22);
      - los dos CSV llevan "A, C", "The theme; A message" y la columna `choice`, con los mismos números que la pantalla;
      - sin scroll horizontal de página a 375 px y consola limpia.
  - Hecho (2026-10-19): `stats-view.js` pinta `q.note` en `<p class="stat-block__note">` justo debajo de "N answers", antes de la rama de "No answers yet"; el aviso de opción desconocida sigue con `q.unknown.count` (filas). `list-view.js` pinta `a.lines` (un `<span class="answer">` por línea, "—" si no hay) y el comentario debajo, en tabla y tarjetas. `css/admin.css`: `.stat-block__note` 15 px en `--muted` (7,4:1 sobre `--royal-deep`). Tests nuevos en `tests/admin-markup.test.js` (3, primero en rojo); `node --test` 660/660. Chrome DevTools con Supabase interceptado (sesión falsa, `is_admin` true, filas "2026-10-live-2" NL "A"/"AC"/"ABC", HU "AD"/sin Q3 y una "2026-10-live-1"), a 375×667 y 1280×800: "1 response from other content versions is hidden."; todos → 4 answers, 100/25/50, aviso y "1 answer with an unknown option"; Netherlands → 3 answers, 100/33/67; Hungary + In progress → "No answers yet" con el aviso; tarjetas y tabla con una línea por opción y "D · (unknown option)"; "See comments of Q3" → 2 de 5 y búsqueda → 1; los dos CSV con "A, C", "The theme; A message", "A, D"/"The theme; (unknown option)" y `choice`, mismos números que la pantalla; sin scroll horizontal y consola vacía.
