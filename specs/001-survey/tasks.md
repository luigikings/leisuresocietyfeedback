# Tareas 001 — Encuesta pública (Leisure City)

Plan: `specs/001-survey/plan.md`. Tests con `node --test`: primero en rojo, después el código, luego en verde. Una tarea cada vez. Las tareas marcadas con **[USUARIO]** necesitan una acción del usuario.

- [x] **T1. Esqueleto del proyecto y servidor local.** RNF-7, RNF-8
  - Archivos: `package.json` (`"type":"module"`, scripts `start`/`test`, sin dependencias), `.nojekyll`, `scripts/serve.mjs`, `index.html` mínimo, `css/survey.css` vacío, carpetas `js/lib`, `js/app/screens`, `assets/flags`, `assets/icons`, `supabase/migrations`, `docs`, `tests`.
  - Tests primero: `tests/serve.test.js` (`contentTypeFor` para .html/.js/.css/.svg/.json; `resolveSafePath` rechaza `../` y rutas codificadas).
  - Hecho cuando: `node --test` en verde y `node scripts/serve.mjs` sirve `index.html` en http://localhost:8080 con el MIME correcto (`.js` → `text/javascript`).

- [x] **T2. Datos de contenido, sitios, banderas y validación.** RF-1, RF-2, RF-3, RF-4, RNF-6, RNF-10
  - Archivos: `js/content.js` (versión `2026-10-test-1`, 10 países de prueba, 10 preguntas literales del Anexo A con Q6-B corregida), `js/lib/sites.js` (`SITE_IDS`, `OTHER_CODE`), `js/lib/content-validate.js`, `assets/flags/*.svg`, `assets/icons/other.svg`, grupos `<g data-site>` provisionales en el SVG de `index.html`.
  - Tests primero: `tests/content.test.js` (contenido real → `[]`; un caso por cada regla de RF-4; bandera existente por país; cada `SITE_ID` presente en `index.html`; textos literales).
  - Hecho cuando: `node --test` en verde y romper a propósito una regla en una copia del contenido produce el mensaje de esa regla.

- [x] **T3. Lógica de textos y países.** RF-10, RF-11, RF-12, RF-13, RF-14, RF-24, RF-25, RF-28
  - Archivos: `js/lib/text.js`, `js/lib/countries.js`.
  - Tests primero: `tests/text.test.js` (emojis y combinaciones, recorte a 280, solo espacios → 0/null) y `tests/countries.test.js` (orden con tildes, "cote" encuentra "Côte d'Ivoire", recorte, consulta vacía, "Other" al final, `noResults`).
  - Hecho cuando: `node --test` en verde.

- [x] **T4. Máquina de estados de la encuesta.** RF-5, RF-9, RF-15, RF-16, RF-18 a RF-23, RF-26, RF-27, RF-29 a RF-36, RF-51, RF-56
  - Archivos: `js/lib/survey-state.js`.
  - Tests primero: `tests/survey-state.test.js` (intro→país→Q1; país inmutable; selección única; `fieldFor` por tipo; `canGoNext` sin opción y con open-required vacío o solo espacios; `next` hace commit y enciende; `back` conserva drafts; `systemBack` en intro/país/Q1/Q2-10/final; cambio de respuesta; Q10 → completed + final; `litSites` exactos; `resumeState` sin país, a mitad y terminado).
  - Hecho cuando: `node --test` en verde.

- [x] **T5. Persistencia local, payload y cola de sincronización.** RF-37, RF-41, RF-43, RF-44, RF-45, RF-46, RF-47, RF-48, RF-49, RF-50, RF-51, RF-52, RF-68
  - Archivos: `js/lib/persistence.js`, `js/lib/payload.js`, `js/lib/sync-queue.js`, `js/config.js` (valores vacíos = modo local).
  - Tests primero: `tests/persistence.test.js` (JSON corrupto, versión distinta → ID nuevo con `newId` inyectado), `tests/payload.test.js` (estado completo con país, `p_seq` creciente, `isUuidV4`), `tests/sync-queue.test.js` (`classify` en todos los casos, backoff 1/2/4/8/16/30/30 s, sustitución del pendiente, ok con pendiente más nuevo, fatal → warn y sigue, aviso offline), `tests/config.test.js` (guarda contra service_role/`sb_secret_`).
  - Hecho cuando: `node --test` en verde.

- [x] **T6. Migración SQL, script de comprobación y guía de Supabase.** RF-37, RF-38, RF-39, RF-40, RF-57 a RF-67, RNF-11
  - Archivos: `supabase/migrations/001_survey.sql` (tabla `responses`, `admins`, RLS + force, revokes, `is_admin()`, política de lectura, RPC `save_response` con validación, contador e inmutabilidad), `scripts/check-db.mjs` (lee `js/config.js`; comprobaciones del plan §10), `docs/supabase.md` (pasos 1-5 del plan §6).
  - Tests primero: no aplica `node --test` (SQL). Revisión: cada RF de datos y permisos tiene su línea en el SQL y su comprobación en `check-db.mjs`.
  - Hecho cuando: el SQL y el script están completos y revisados contra RF-57 a RF-67, `docs/supabase.md` explica cada paso manual y `node --test` sigue en verde.

- [x] **T7. [USUARIO] Crear y configurar Supabase.** RF-57 a RF-68
  - Acción del usuario (siguiendo `docs/supabase.md`):
    - [x] (a) crear el proyecto gratuito;
    - [x] (b) ejecutar `001_survey.sql` en el SQL Editor;
    - [x] (c) desactivar "Allow new users to sign up";
    - [ ] (d) crear los 4 usuarios admin e insertarlos en `public.admins`; **APLAZADO a la spec 002** (decisión del usuario, 16/10/2026): la tabla `admins` existe vacía y protegida (check-db RF-66 en verde); nadie puede leer respuestas hasta entonces, lo cual es correcto para la 001. *(Hecho en la spec 002, T6: en lugar de 4 usuarios, una sola cuenta compartida "admin", ya en `public.admins`.)*
    - [x] (e) pasar la Project URL y la clave anon/publishable (nunca la service_role).
  - Resultado (16/10/2026): `js/config.js` rellenado; `node --test` 158/158 en verde; `node scripts/check-db.mjs` 38/38 PASS. Quedan filas de prueba con `content_version` "dbcheck…": borrarlas antes del evento (`docs/supabase.md`, paso 6).
  - Agente: rellenar `js/config.js` y ejecutar `node --test` (la guarda de config) y `node scripts/check-db.mjs`.
  - No bloquea T8 ni T9 (modo local). Bloquea solo la parte de base de datos de T10.
  - Hecho cuando: `check-db.mjs` pasa todas las comprobaciones y `node --test` está en verde.

- [x] **T8. Interfaz: intro, selector de país, ciudad y adaptadores.** RF-5 a RF-16, RF-29, RF-41, RF-44 a RF-50, RNF-1, RNF-3, RNF-5
  - Archivos: `index.html` (secciones y SVG completo de la ciudad con los 10 sitios), `css/survey.css`, `js/app/main.js`, `storage.js`, `db.js` (fijar `SUPABASE_JS_VERSION` exacta, import dinámico, timeout de 10 s), `sync.js`, `city.js`, `motion.js`, `screens/intro.js`, `screens/country.js`.
  - Tests primero: la lógica ya está cubierta. Si aparece lógica nueva, va a `lib/` con su test.
  - Hecho cuando, con el MCP Chrome DevTools a 375 px:
    - la intro anima unos 4 s y se queda quieta, y "Start" responde desde el primer momento;
    - la búsqueda filtra con "Other" al final y muestra "No countries found";
    - elegir un país lleva a la ciudad apagada;
    - en modo local aparece "Saved offline – will sync";
    - "Start" se puede pulsar en menos de 3 s con Fast 4G y sin caché;
    - la consola está limpia y `node --test` en verde.
  - Resultado (16/10/2026): `node --test` 171/171 (nuevos `tests/sync.test.js` y `tests/storage.test.js`). supabase-js fijado en **2.118.0** (`SUPABASE_JS_VERSION` en `js/app/db.js`; última 2.x estable según `npm view`). Validado en el panel Browser de Claude a 375×812 y 320×568 (el MCP Chrome DevTools no arrancó: no hay Chrome instalado en las rutas estándar): intro de 3,95 s que queda en su último fotograma, "Start" pulsable a ~50 ms, búsqueda ("  COTE " → Côte d'Ivoire + Other; "zzz" → "No countries found" + Other), país → ciudad apagada y foco en el título, aviso offline en modo local (config vacía temporalmente) con reintentos, envío pendiente sincronizado al reabrir (RPC 204), sin scroll horizontal y consola limpia. RNF-5 con "Fast 4G" no medido (el panel no limita la red): ~64 KB sin comprimir y 5 niveles de petición; queda para T10 con Chrome DevTools o a mano. Filas de prueba creadas en Supabase con `content_version` "2026-10-test-1" (FR, OTHER, JP): borrarlas antes del evento (`docs/supabase.md`, paso 6).

- [x] **T9. Interfaz: pantalla de preguntas, navegación y atrás del sistema.** RF-17 a RF-36, RF-51, RNF-1, RNF-4
  - Archivos: `js/app/screens/question.js`, `js/app/history.js`, ajustes en `main.js` y `survey.css`.
  - Tests primero: igual que en T8 (solo lógica nueva en `lib/` con test).
  - Hecho cuando, a 375 px:
    - el flujo Q1→Q10 enciende un sitio por respuesta;
    - en la Q1 no hay Back;
    - el campo de texto cambia según el tipo de opción y conserva el texto;
    - Next está desactivado con Q2-A/Q5-A vacías;
    - el contador llega a 0 al pegar más de 280 caracteres;
    - Back y el atrás del navegador conservan los drafts y en la Q1 no salen de la pantalla;
    - al recargar a mitad se retoma en la primera pregunta sin responder;
    - el foco va al título y se puede usar con teclado;
    - `node --test` en verde.
  - Resultado (16/10/2026): `node --test` 183/183 (nuevo `tests/question-view.test.js`: lógica de pantalla en `js/lib/question-view.js`, `questionView()` y `optionForKey()` para el teclado del radiogroup). Archivos: `js/app/screens/question.js`, `js/app/history.js` (una entrada "guard" en el historial: atrás llama a `systemBack` y la vuelve a poner), `main.js`, `index.html`, `survey.css`. Validado en el panel Browser de Claude a 375×812 y 320×568 con el Supabase real: Q1→Q10 enciende un sitio por respuesta (10/10 al final), sin Back en Q1, etiquetas "Want to tell us why? (optional)" / "Tell us… (required)" / "Tell us more (optional)", texto conservado al cambiar de opción, Next desactivado con Q2-A/Q5-A vacías o solo espacios, pegar 300 caracteres → 280 y "0 characters left", Back y `history.back()` conservan drafts sin marcar la pregunta, atrás en intro/país/Q1/final no cambia de pantalla, recarga a mitad → primera sin responder, recarga terminada → final, foco al título, flechas/Home/End/Tab/Enter, sin scroll horizontal, objetivos ≥44 px y consola limpia; todas las RPC 204. Ajuste de T8: supabase-js cambiado a **2.117.2** (última 2.x con al menos 2 semanas; 2.118.0 era del día anterior). Pendiente para T10: probar el atrás físico de Android en un móvil real (Chrome puede saltarse entradas del historial creadas sin gesto del usuario). Fila de prueba nueva en Supabase con `content_version` "2026-10-test-1" (JP, terminada): borrarla antes del evento.

- [x] **T10. Interfaz: final, movimiento reducido y validación completa.** RF-53 a RF-56, RNF-2, RNF-9, más la validación de todos los RF
  - Archivos: `js/app/screens/final.js`, ajustes en `survey.css` (línea temporal de 8 s como máximo, `final--done`, `prefers-reduced-motion`).
  - Hecho cuando:
    - el final reproduce el orden de RF-53 en 8 s como máximo y queda en su estado último;
    - al recargar se ve el estado último sin animación y sin botón de repetir;
    - con movimiento reducido emulado solo hay fundidos de 200 ms como máximo, y la intro y el final salen en su estado último;
    - el flujo completo funciona a 375 y 320 px sin scroll horizontal y con consola limpia;
    - con el proyecto de T7: una prueba offline → online deja una sola fila con el país y el último `seq`, y `check-db.mjs` sale en verde;
    - `node --test` en verde.
  - Resultado (16/10/2026): `node --test` 192/192 (nuevo `tests/final-view.test.js`: lógica del final en `js/lib/final-view.js` — fases y orden de RF-53, ≤ 8 s, variables CSS, banderas sin "Other", posiciones que caben a 320 px, confeti con aleatorio inyectado). Archivos: `js/app/screens/final.js`, `js/lib/final-view.js`, `main.js` (monta el final: anima solo al llegar desde la Q10; al reabrir, estado último), `index.html` (coches y ola de luz en el SVG, escenario de banderas, destello y confeti; `<link rel="icon" href="data:,">` para evitar el 404 de favicon en consola), `survey.css` (línea temporal bajo `#app[data-final="play"]`; los estilos base son el estado último). Validado con el MCP Chrome DevTools: final medido de 0 a 7,2 s (`data-final` play→done a 7205 ms) en el orden ola→coches→confeti→giro→unión→destello→textos; recarga → estado último sin animaciones ni botones; atrás en el final no cambia de pantalla; 375×812 y 320×568 sin scroll horizontal (también durante la animación) y consola limpia; movimiento reducido (simulado: el MCP no emula `prefers-reduced-motion`, se forzó `matchMedia` y la regla `@media` de la hoja) → solo fundidos de opacidad de 200 ms, intro y final en su estado último, sin confeti ni ola; RNF-5 con Fast 4G y sin caché → DOMContentLoaded (módulos ejecutados, "Start" operativo) a 1,17 s; offline→online con perfil limpio: aviso visible, el import del CDN falla sin red y se recupera (`?retry=5` → 200), RPC 204 con el último `seq`, aviso desaparece; terminar sin red → final y envío `completed` (seq 11) al volver la red; `check-db.mjs` 38/38. Pendiente manual: atrás físico/gesto de Android en un móvil real (Chrome registra "Session History Item Has Been Marked Skippable" para la entrada guard creada al cargar sin gesto). Filas de prueba nuevas en Supabase (`content_version` "2026-10-test-1"): IT, OTHER, JP ×2, PL (terminadas) y NL (en curso): borrarlas antes del evento.

## Cambio de requisitos 2026-10-16 (plan §14)
Ciudad cenital, intro, banderas, textos y estilo. Mismas reglas: tests primero en rojo, después el código, luego en verde, y una tarea cada vez. La validación visual se hace con el MCP Chrome DevTools a 375×667 y 320×568 (movimiento reducido simulado como en T10).

- [x] **T11. Contenido: 6 países, nueva versión, límites de RF-4 y lista de casillas.** RF-3, RF-4, RF-10, RF-11, RNF-7, RNF-10
  - Archivos: `js/content.js` (versión `2026-10-test-2`; NL, DE, IT, PL, JP, NG en ese orden), `js/lib/content-validate.js` (6-11), `js/lib/countries.js` (solo `OTHER_ENTRY` + `countryTiles`; se eliminan `normalize`, `sortCountries` y `countryListFor`), se borran `assets/flags/{fr,be,ie,ci}.svg`, `assets/icons/other.svg` pasa a ser un globo, y `js/app/screens/country.js` pasa provisionalmente a `countryTiles` (sin buscador) para que la página no se rompa.
  - Tests primero: `tests/content.test.js` actualizado (versión, "between 6 and 11", NL en lugar de FR, lista exacta de los 6) y `tests/countries.test.js` reescrito (plan §14.8).
  - Hecho cuando: `node --test` en verde, sin ninguna referencia a `countryListFor` en `js/` ni en `tests/`, y la página carga sin errores en consola.
  - Resultado (16/10/2026): `node --test` 186/186. `countries.js` exporta solo `OTHER_ENTRY` y `countryTiles` (test de exportaciones exactas); `grep countryListFor` en `js/` y `tests/` sin resultados. Validado con el MCP Chrome DevTools a 375×667 (contexto aislado, sin elegir país para no crear filas): 7 botones NL, DE, IT, PL, JP, NG, Other con sus imágenes cargadas, globo en `other.svg`, sin scroll horizontal y consola limpia. Ajustes no previstos en el plan: `tests/final-view.test.js` pasa de FR/CI a NL/NG (dependía del contenido real); el `<form class="search">` queda con `hidden` en `index.html` hasta T14, porque sin su guarda de `submit` pulsar Intro en el campo recargaría la página.

- [x] **T12. Lógica de la ciudad: nombres de los sitios, encendido total y alternativa textual.** RF-29, RF-72, RF-73, RF-75, RNF-7
  - Archivos: `js/lib/sites.js` (`SITE_NAMES`), nuevo `js/lib/city-view.js` (`cityView`) y `js/app/city.js` (`paintCity(svg, view)`: `is-lit`, `data-all-lit`, `aria-label`), y en `main.js`, `paintCity(city, cityView(litSites(...)))`.
  - Tests primero: `tests/city-view.test.js` (plan §14.8).
  - Hecho cuando: `node --test` en verde y, en el navegador, el `aria-label` de la ciudad dice "Night city: n of 10 places lit: …" con los nombres en inglés tras responder 2 preguntas.
  - Resultado (16/10/2026): `node --test` 193/193 (nuevo `tests/city-view.test.js`, 7 tests). Validado con el MCP Chrome DevTools a 375×667 (contexto aislado, peticiones a Supabase bloqueadas para no crear filas): tras NL + Q1 + Q2 la ciudad dice "Night city: 2 of 10 places lit: Park, Concert hall", `is-lit` solo en park y concert-hall, sin `data-all-lit`; con los 10 (llamada directa a `paintCity`) aparece `data-all-lit` y se quita al volver a 2; sin scroll horizontal; en consola solo el aviso ya conocido "Session History Item Has Been Marked Skippable". Decisión menor: la etiqueta usa `siteIds.length` en lugar de un 10 fijo (igual con los datos reales; permite inyectar sitios en los tests).

- [x] **T13. Estilo de la encuesta: paleta, tipografía, botones y opción "encendida".** RF-17, RF-92 a RF-97, RNF-4
  - Archivos: `css/survey.css` (variables de §14.3, fuera `--blue`, `--blue-deep`, `--gold`, `--display` y todos los `uppercase`; `.btn--primary` y `.btn--ghost`; opciones con bombilla y check; foco `--window`), `index.html` (`btn--gold` → `btn--primary`) y `js/app/screens/question.js` (`.option__check` con SVG `aria-hidden`).
  - Tests primero: `tests/markup.test.js` con la parte de CSS (sin `uppercase`, sin "Arial Black", sin `linear-gradient` en `.option`/`.btn`).
  - Hecho cuando: `node --test` en verde y, a 375 y 320 px, las preguntas no tienen casillas azules ni letras doradas, la opción elegida tiene borde y halo cálidos y check, el contraste de texto es ≥ 4.5:1 y el de los bordes ≥ 3:1 (comprobado con DevTools), y la consola está limpia.
  - Resultado (16/10/2026): `node --test` 204/204 (nuevo `tests/markup.test.js`, 11 tests: sin `uppercase` ni "Arial Black", pila del sistema sin fuentes web, sin `linear-gradient` en reglas `.option*`/`.btn*`, tokens exactos de §14.3, fuera los tokens de concurso, foco `--window`, `.btn--primary` píldora `--window`/`--night`, opción elegida con borde/halo `--window` y check, check SVG `aria-hidden` en `question.js`). Validado con el MCP Chrome DevTools a 375×667 y 320×568 (contexto aislado `t13`, `fetch` a supabase.co interceptado: 0 peticiones a Supabase): opciones con bombilla circular y letra `--muted`, elegida con borde y halo cálidos, bombilla rellena y check; punto de progreso neón; Back fantasma y Next píldora; contrastes medidos: texto de opción 15,5:1 (13,6:1 en hover), enunciado 17,4:1, contador 10,6:1, letra 9,5:1, botón principal 13,2:1, Next desactivado 6,3:1; bordes `--line` 6,4:1 sobre `--night` y 5,7:1 sobre `--street`; 0 elementos con `text-transform`; sin scroll horizontal; en consola solo el aviso conocido "Session History Item Has Been Marked Skippable". Decisiones: nueva variable `--sans` con la pila del sistema (evita repetirla); `--red` se queda solo para el dibujo de la ciudad; el plató antiguo de la intro (hasta T15) conserva su look de concurso con colores literales, pero pierde `uppercase` y "Arial Black" porque el test de RF-95 mira toda la hoja; el título del final pasa a `--window` sin `text-shadow` y "Thank you" a la pila del sistema (§14.3, "Títulos y textos").

- [x] **T14. Selector de país en cuadrícula de banderas cuadradas.** RF-10, RF-11, RF-15, RF-16, RF-89, RF-90, RF-91, RNF-4
  - Archivos: `index.html` (fuera el formulario de búsqueda y "No countries found"), `js/app/screens/country.js` (casillas con `<img alt>`, sin texto visible), `css/survey.css` (cuadrícula de 3 columnas, `aspect-ratio: 1`, `object-fit: cover`, globo al 55 %) y `js/app/main.js` (`#app[data-screen]`; sin el padding inferior de 84 px en `intro` y `country`).
  - Tests primero: `tests/markup.test.js` (sin `country-search` ni "No countries found").
  - Hecho cuando: `node --test` en verde y, a 375×667 y 320×568, se ven 7 casillas cuadradas (6 banderas + globo) de ≥ 64 px, sin scroll vertical ni horizontal, cada una con su nombre en el árbol de accesibilidad ("Netherlands" … "Other"); tocar una lleva a la ciudad apagada con la Q1 y la consola está limpia.
  - Resultado (16/10/2026): `node --test` 208/208 (4 tests nuevos en `tests/markup.test.js`: sin buscador ni "No countries found" ni `countries__empty`; casillas sin `country__name` ni `textContent`, `alt` = nombre u "Other"; CSS `.countries` 3 columnas, `.country` `aspect-ratio: 1` + `overflow: hidden`, `.country__flag` 100 % + `object-fit: cover`, globo al 55 %, sin reglas `.search`/`.countries__empty`/`.country__name`; `main.js` pone `dataset.screen` y `intro`/`country` llevan `padding-bottom: calc(16px + safe-area)`). Validado con el MCP Chrome DevTools (contexto aislado `t14`, `fetch` a supabase.co interceptado: 0 peticiones a Supabase): 375×667 → 7 casillas de 106×106 px, todas las imágenes cargadas, sin texto visible; 320×568 → 88×88 px; sin scroll vertical ni horizontal en ambos (con 12 casillas simuladas a 320×568 la última acaba en 455 px, sin scroll); árbol de accesibilidad: botones "Netherlands", "Germany", "Italy", "Poland", "Japan", "Nigeria", "Other"; tocar Poland → pregunta "Question 1 of 10" sin Back, ciudad "Night city: 0 of 10 places lit", país PL guardado y aviso offline (por el bloqueo); consola sin mensajes. Decisión no prevista: `display: flow-root` en `#app` para `intro`/`country`, porque el margen superior de 24 px del título colapsaba hacia `body` (`min-height: 100dvh`) y generaba 24 px de scroll vertical. Clase `country__flag--other` para el globo.

- [x] **T15. Intro: plató del Anexo B, textos y botón "Give feedback", sin scroll ≥ 568 px.** RF-5, RF-6, RF-7, RF-9, RF-80 a RF-85, RF-88, RNF-4, RNF-5
  - Archivos: `index.html` (`h1` oculto visualmente, SVG del plató `viewBox 0 0 300 400` con `aria-hidden`, los dos textos y el botón), `css/survey.css` (columna flex de `100dvh`, plató flexible y `@media (max-height: 567px)`; se eliminan los estilos de `.stage`, `.board` y `.tile` antiguos) y `js/app/screens/intro.js` (solo el clic).
  - Tests primero: `tests/markup.test.js` (textos literales de RF-81/RF-82, "Give feedback" y ningún "Start", 5 cabeceras, Group 1/2/3 con 300/500/200, "On air").
  - Hecho cuando: `node --test` en verde y, a 375×667, 320×568 y 430×932, la intro muestra el plató completo (cartel, tablero con las 2 casillas vacías, "On air", haces y 3 grupos de concursantes) seguido de los dos textos y el botón, sin scroll vertical ni horizontal; a 320×500 hay scroll vertical; "Give feedback" lleva al selector; el lector anuncia "Leisure in Jeopardy", los textos y el botón, y no el tablero; la consola está limpia.
  - Resultado (16/10/2026): `node --test` 218/218 (10 tests nuevos en `tests/markup.test.js`: orden h1 oculto → plató → textos literales de RF-81/RF-82 → botón "Give feedback"; sin "Start"; SVG `viewBox 0 0 300 400` con `aria-hidden` y `meet`; cartel "Leisure in"/"Jeopardy", 4 bombillas, 4 focos, ≥ 4 haces, 2 postes; 5 cabeceras y 13 valores en orden con Community-200 y Culture & identity-300 vacías en `#0B1035`; "On air", Group 1/2/3 con 300/500/200, 3 pulsadores `#D93025` y 9 concursantes; sin imágenes ni texto extra; CSS columna flex `calc(100dvh…)`, `.plato` con `min-height: 0`, `@media (max-height: 567px)` y `.visually-hidden`; fuera `.stage`/`.board`/`.tile`/`.intro--done`; `intro.js` solo el clic). Validado con el MCP Chrome DevTools (contexto aislado `t15`, sin elegir país: 0 peticiones a Supabase): 375×667 → plató 341×455, botón acaba en 651 px, sin scroll; 320×568 → plató 250×333, botón acaba en 552 px, sin scroll; 430×932 → plató a todo el ancho (398×531) y el conjunto centrado, sin scroll; 320×500 → scroll vertical (535 px de alto) con plató de 300 px; nunca scroll horizontal; árbol de accesibilidad: heading "Leisure in Jeopardy", los dos textos y el botón "Give feedback", sin nada del tablero; "Give feedback" → selector de país (7 casillas) con foco en su título; consola sin mensajes. Comparado con la imagen de referencia: misma disposición, colores y textos. Decisiones no previstas: la base flexible del plató es su alto a todo el ancho (`min((100vw − 32px) × 4/3, 531px)`) y la columna se centra, para que en pantallas altas no queden bandas vacías dentro del SVG; la altura de la sección descuenta los 16 px + safe-area del padding inferior de `.app` (con `100dvh` exacto habría 16 px de scroll); clase extra `.plato__contestant` en cada concursante y `data-cell` en las casillas vacías (para T16 y los tests); se quita `reducedMotion` de la llamada a `mountIntro` en `main.js`.

- [x] **T16. Intro: animación en bucle continuo y estática con movimiento reducido.** RF-8, RF-86, RF-87, RNF-2
  - Archivos: `css/survey.css` (keyframes `infinite` de haces, bombillas, focos, "On air", pulsadores y concursantes, con ciclos ≥ 1 s; sin `.intro--done`).
  - Tests primero: `tests/markup.test.js` (toda animación `infinite` del CSS dura ≥ 1 s).
  - Hecho cuando: `node --test` en verde; en el navegador, `document.getAnimations()` muestra animaciones `infinite` que siguen corriendo a los 15 s y "Give feedback" responde en mitad del bucle; con movimiento reducido simulado no hay ninguna animación y el plató está completo.
  - Resultado (16/10/2026): `node --test` 222/222 (4 tests nuevos en `tests/markup.test.js`: toda animación `infinite` dura ≥ 1 s y no hay `animation-iteration-count: infinite` ni `animation-duration` que acorte un bucle del plató; beam, bulb, spot, onair, buzzer y contestant tienen animación `infinite` con su `@keyframes` y ninguna animación del plató es finita; sin `steps()`; el bloque de movimiento reducido pone `animation: none !important` a todo y ninguna regla del plató oculta elementos). Animaciones: haces `rotate` ±5° 6 s `alternate` (los de arriba desde su foco, los cruzados desde su vértice en el suelo, cada pareja en sentido opuesto), focos `opacity` 1↔0,75 3 s, bombillas 1↔0,55 2,4 s en persecución (desfase 0,6 s), "On air" 1↔0,6 2 s, pulsadores halo `drop-shadow` 2,8 s desfasado por grupo, concursantes `translateY` −1 px 4 s desfasados; todas `ease-in-out`. Validado con el MCP Chrome DevTools (contexto aislado `t16`, `fetch` a supabase.co interceptado: 0 peticiones): 375×667 → 29 animaciones del plató, todas `infinite` y `running` a los 21 s (duración mínima 2 s), sin scroll, botón acaba en 651 px; "Give feedback" en mitad del bucle → selector (7 casillas); clic en el evento `load` (43 ms) → selector; 320×568 → 29 animaciones corriendo, plató 250×333, botón en 552 px, sin scroll; movimiento reducido (la propia regla `@media (prefers-reduced-motion: reduce)` de la hoja activada con `mediaText = "all"` y `matchMedia` forzado antes de cargar) → 0 animaciones en el plató (solo el fundido `screen-in` de 200 ms de la sección), `transform: none` en los haces, ningún elemento del SVG oculto, plató completo y estático. Consola: solo el aviso conocido "Session History Item Has Been Marked Skippable". Decisiones no previstas: los desfases usan `:nth-of-type` (los 8 `<polygon>` del SVG son los haces y los `<circle>` 1-4 y 5-8 de su nivel son focos y bombillas; documentado en el comentario del CSS) para no tocar `index.html`; el halo del pulsador se hace con `filter: drop-shadow` en vez de opacidad.

- [x] **T17. Ciudad en planta: calles, manzanas, 20 edificios de relleno e iconos de los 10 sitios.** RF-69, RF-70, RF-71, RF-72, RF-76, RF-78, RNF-4
  - Archivos: `index.html` (nuevo SVG `viewBox 0 0 400 300`: calles, manzanas, 20 `.filler[data-filler]` con `--fx`, 10 `<g data-site>` con los iconos de §14.6, coches sobre las avenidas, periferia fuera del viewBox; fuera el cielo, la luna, las estrellas y el skyline) y `css/survey.css` (relleno y calles apagados salvo `[data-all-lit]`; `.city-wrap` en preguntas `min(40dvh, …)`).
  - Tests primero: `tests/markup.test.js` (de 15 a 25 `data-filler` con `--fx`; sin `city__sky`, `city__moon` ni `city__stars`); el test de `data-site` que ya existe sigue en verde.
  - Hecho cuando: `node --test` en verde y, a 375×667 y 320×568, la ciudad se ve desde arriba y entera, sin zoom ni scroll horizontal, ocupa ≤ 40 % del alto a 375×667 y no tapa la pregunta; los 10 sitios se distinguen entre sí y del relleno; responder enciende solo su sitio; con 9 respondidas (Back) el relleno y las calles siguen apagados; la consola está limpia.
  - Resultado (16/10/2026): `node --test` 227/227 (5 tests nuevos en `tests/markup.test.js`: `#city` con `viewBox 0 0 400 300` y sin `city__sky`/`city__moon`/`city__stars`/`city__skyline` en HTML ni CSS, calles y manzanas con `aria-hidden`; 20 `data-filler` con `class="filler"` y `--fx` entre 0 y 1 dentro de `.city__fillers` `aria-hidden`; 10 `<g class="site" data-site>` distintos y ningún `<text>`; `.win` y `.lamp` con `opacity: 0` por defecto y toda regla que enciende relleno, ventanas o farolas lleva `[data-all-lit]`; `[data-screen="question"] .city-wrap` con `height: min(40dvh, …)` + `overflow: hidden` y el SVG con `height: 100%` + `max-width: 100%`, sin `slice`). Validado con el MCP Chrome DevTools (contextos aislados `t17` y `t17b`, `fetch` a supabase.co interceptado): 375×667 → ciudad 343×257 px (38,6 % del alto), la pregunta empieza en 285 px, sin solaparse; 320×568 → 288×216 px (38 %), pregunta en 244 px; sin scroll horizontal en ambos; encendido sitio a sitio Q1→Q9 (park … nightclub, uno por respuesta y en orden); con 9 respondidas y Back a la Q9, sin `data-all-lit` y ventanas y farolas a opacidad 0; tras la Q10 el final actual sigue funcionando (`data-final` done, 10 sitios, `data-all-lit`, ventanas y farolas encendidas, coches sobre las avenidas); `aria-label` "Night city: n of 10 places lit: …"; consola: solo el aviso conocido "Session History Item Has Been Marked Skippable". Decisiones no previstas: cada edificio de relleno es un `<g class="filler" data-filler style="--fx">` con su tejado (`.filler__roof`) y sus ventanas (`.win`, un rect con `pattern` de luces), para que en T18 las ventanas hereden `--fx`; las farolas `.lamp` también llevan `--fx`; manzanas en tablero (sitios en las casillas pares, 2 rellenos en cada impar); se quitan el borde redondeado y el anillo de la ciudad (el suelo es `--night`, como el fondo) y `.city-wrap` recorta la periferia (`overflow: hidden`) hasta que T18 la muestre a pantalla completa; `.city__wave` pasa a 300 de alto. A 320×568 los botones quedan bajo el pliegue (scroll vertical permitido por el plan): con el aviso offline visible hay que bajar 92 px para verlos por encima del aviso.

- [x] **T18. Final: encendido total con la ola, coches por las calles, ciudad a pantalla completa y "Leisure for Society".** RF-53, RF-54, RF-56, RF-73, RF-74, RF-77, RF-79, RNF-2, RNF-4
  - Archivos: `index.html` (título "Leisure for Society", panel de banderas y textos), `css/survey.css` (`[data-screen="final"] .city-wrap` fijo a pantalla completa, `overflow: visible`, ola que cruza la planta, `city-on` retrasado por `--fx`, coches por las avenidas, panel con fondo `rgb(11 16 38 / .82)`) y `js/app/screens/final.js` (comentario y textos).
  - Tests primero: `tests/markup.test.js` ("Leisure for Society" y ningún "Society of Leisure"); `tests/final-view.test.js` sigue en verde (≤ 8 s).
  - Hecho cuando: `node --test` en verde y, con el MCP, tras la Q10 la ola cruza la ciudad y enciende el relleno y las calles a su paso, luego los coches, el confeti, las banderas, el destello y los textos, todo terminado antes de 8 s desde "Next" (`data-final` play→done); la ciudad ocupa toda la pantalla a 375×667 y 320×568 y los textos tienen un contraste ≥ 4.5:1; al recargar se ve directamente la ciudad entera encendida; con movimiento reducido, estado último directo con fundido de ≤ 200 ms; la consola está limpia.
  - Resultado (16/10/2026): `node --test` 232/232 (5 tests nuevos en `tests/markup.test.js`: `h1#final-title` "Leisure for Society" y "Thank you", sin "Society of Leisure" en HTML, CSS ni `final.js`; `[data-screen="final"] .city-wrap` `position: fixed; inset: 0` con fondo `--night` y el SVG al 100 % × 100 % sin `slice`; panel `.screen--final` con `rgb(11 16 38 / .82)`, radio de 20 px y `z-index: 1`; bajo `[data-final="play"]` y `#city[data-all-lit]`, `.win`, `.lamp`, `.filler__roof` y `.street--v` animados con retraso por `--fx` y la fase `wave`, 4 calles verticales con `--fx`, ola `linear`; `transition: none` en la ciudad mientras suena). Validado con el MCP Chrome DevTools (contexto aislado `t18`, `fetch` a supabase.co bloqueado con initScript): 375×667 → Next de la Q10 a `data-final` play en 10 ms y done en 7222 ms; la ventana de menor `--fx` empieza a encenderse a ~300 ms y la de mayor después de 1100 ms (encendida a 1700 ms), panel invisible hasta 3,4 s; ciudad a pantalla completa (wrap 375×667), los 10 sitios acaban en y = 465 y el panel empieza en 505, título en una línea; recarga con la encuesta terminada → `done` directo, solo el fundido `screen-in` de 200 ms. 320×568 → done a 7220 ms, sitios hasta 396 px y panel desde 410, sin scroll horizontal en toda la animación (scrollWidth 320) ni vertical. Contraste del texto sobre el panel compuesto (peor caso: panel sobre blanco) 7,8:1 el título y 10,3:1 "Thank you" (sobre la ciudad real ≥ 12,4:1). Movimiento reducido (matchMedia forzado en initScript + la regla `@media` de la hoja con `mediaText = "all"`) → done a 4 ms, solo transiciones de opacidad de 200 ms y `screen-in`, sin ola, confeti ni coches en movimiento; ventanas y farolas a 1. Capturas: `t18-wave-700ms-375.png`, `t18-spin-4600ms-375.png`, `t18-final-375-reload.png`, `t18-final-320.png`, `t18-final-reduced-375.png` (scratchpad de la sesión). Consola: solo el aviso conocido "Session History Item Has Been Marked Skippable". Decisiones no previstas: la ola pasa a velocidad constante (`linear`) y el retraso es `wave-start + wave-dur × (.115 + .77 × --fx)`, que es cuando su centro (x de −60 a 460) llega a x = 400 × fx; las avenidas horizontales, que cruzan todo el ancho, se aclaran durante toda la fase `wave` y las verticales (`.street--v`, `--fx` 0,2/0,4/0,6/0,8) al paso de la ola; el panel (`::before`) aparece con un fundido de 400 ms al empezar el giro de las banderas, para que la ola cruce la ciudad entera sin tapar nada; el panel se dimensiona para el estado último (escenario de 54 px en vez de 148) y las banderas giran por encima de la ciudad, porque con 148 px tapaba la última fila de la ciudad (estadio incluido) a 375×667; con el aviso offline visible el panel sube a 60 px del borde (`body:has(.offline-notice.is-visible)`) para no solaparse con él (entonces tapa ~4 px del borde inferior del estadio); título con `clamp(1.5rem, 7.4vw, 2rem)` para que quepa en una línea desde 320 px. Incidencia: una recarga con `location.reload()` no aplicó el bloqueo y escribió una fila de prueba real en Supabase (participant_id `56970a8a-c1a2-4b83-b422-93889d01b1fe`, `content_version` "2026-10-test-2", país NL): hay que borrarla con las demás filas de prueba.

- [x] **T19. Validación completa del cambio y cierre.** Todos los RF y RNF del cambio (plan §14), RNF-1, RNF-5, RNF-9
  - Archivos: `MEMORY.md` y, si procede, una propuesta para `AGENTS.md` (plan §14.10).
  - Hecho cuando:
    - `node --test` en verde;
    - flujo completo intro → país → 10 preguntas (con Back, atrás del sistema, cambio de respuesta, AO y AP) → final a 375×667 y 320×568 sin scroll horizontal y con la consola limpia, también con movimiento reducido;
    - "Give feedback" pulsable en < 3 s con Fast 4G y sin caché;
    - la fila se guarda en Supabase con `content_version` "2026-10-test-2" y un país de los 6 (RPC 204);
    - revisión RF por RF del cambio con VEREDICTO: APROBADO;
    - MEMORY.md actualizado (versión nueva y filas de prueba `test-1` y `test-2` que hay que borrar antes del evento).
  - Validación (16/10/2026, sin cierre: falta la revisión del reviewer, MEMORY.md y el estado de la spec): `node --test` 232/232; `check-db.mjs` 38/38. MCP Chrome DevTools: flujo real a 375×667 (contexto `t19real`, DE) intro (29 animaciones `infinite` corriendo, sin scroll, botón en 651 px) → atrás en el selector sin cambio → Q1 sin Back → Q2-A vacía y con espacios con Next desactivado → Back desde Q3 conserva la selección → cambio Q2 A→B con el texto conservado → atrás del navegador en Q4 → Q5-A obligatoria → recarga en Q6 (reanuda en la 6 con 5 sitios) → Q6-Q8 sin red (aviso visible, 6 envíos `ERR_INTERNET_DISCONNECTED`) → Q9-B opcional con texto → vuelve la red (RPC 204 a los 0,5 s, aviso oculto) → Q10-B opcional vacía → final `play` a 9 ms y `done` a 7220 ms, 10/10 y `data-all-lit`, sin scroll horizontal → atrás en el final sin cambio → recarga → final `done` sin animaciones ni botones. RPC: 10 envíos 204 (los `p_seq` 9-11 sin red se sustituyeron por el 12), el último `completed`, `p_seq` 13, `content_version` "2026-10-test-2", país DE. 320×568 (Supabase bloqueado por initScript): intro 250×333 sin scroll, 7 casillas de 88 px, flujo completo con Back, atrás del navegador, pegar 300 → 280 y "0 characters left", objetivos ≥ 44 px, final `done` a 7220 ms sin scroll; recarga → final directo. Movimiento reducido (matchMedia + regla `@media` forzadas antes de cargar) a 375×667 y 320×568: intro sin animaciones, en todo el flujo solo `screen-in` y transiciones de opacidad de 200 ms, final directo (~60 ms) con ventanas encendidas y sin confeti. RNF-5: Fast 4G sin caché → DOMContentLoaded a 1,14 s (78 KB). Consola: solo `ERR_INTERNET_DISCONNECTED` sin red y el aviso conocido "Skippable". Fila de prueba nueva: participant_id `31c45c3c-1214-4bf6-8b7f-1ce36012aafe` (DE, terminada). Problema encontrado: a 320×568 el aviso offline fijo tapaba parte de la opción B (Q1) o el campo (Q9) hasta hacer scroll (RF-49), y en el final con el aviso visible el panel tapaba ~40 px de nightclub y stadium.
  - Decisión del usuario (17/10/2026): opción (a), aviso dentro de la página (plan §14.11). Implementado con tests primero: `node --test` 235/235 (3 tests nuevos en `tests/markup.test.js` y el de intro/country adaptado a `flow-root`). Archivos: `index.html` (dos `<p class="offline-notice" data-offline-notice role="status" aria-live="polite">`, tras Back/Next y tras "Thank you"; fuera el `<div id="offline-notice">` fijo), `js/app/main.js` (`setNotice` en todos los avisos), `css/survey.css` (línea en el flujo, sin los 84 px reservados ni `body:has(...)`; el panel del final compensa la línea con su `bottom` y `padding-bottom` y entra con los textos). Revalidado con el MCP Chrome DevTools y Supabase bloqueado (0 filas nuevas): a 375×667 y 320×568, sin red, en Q1 sin opción, Q1 con campo, Q2-A obligatoria, Q9-B y Q10-B opcionales, el aviso queda bajo Back/Next sin solaparse con opciones, etiquetas, campos, contador ni botones, y nunca hay scroll horizontal; final sin red: 375 → sitios hasta 477 px y panel desde 505 (igual que con red), 320 → sitios hasta 406 y panel desde 410 (igual que con red), aviso dentro del panel bajo "Thank you", `done` a 7256 ms; recarga → final directo con el aviso en el panel; movimiento reducido a ambos tamaños: mismas medidas, solo `screen-in` y opacidad de 200 ms, final directo en ~25 ms; intro y selector sin aviso y sin scroll; consola solo con el aviso conocido "Skippable". Capturas `t19n-01` a `t19n-07` en el scratchpad de la sesión.
  - Cierre (17/10/2026): revisión del reviewer con VEREDICTO: APROBADO (`node --test` 235/235, `check-db.mjs` 38/38, flujo completo en Chrome DevTools a 375 y 320 px, movimiento reducido, sin red → con red, intro comparada con el Anexo B). Spec marcada como implementada y MEMORY.md actualizado (versión `2026-10-test-2` y filas de prueba que hay que borrar antes del evento).

## Cambio de requisitos 2026-10-17 (plan §15)
Animaciones y ciudad. Mismas reglas: tests primero (en rojo), después el código, luego en verde, y una tarea cada vez. La validación visual se hace con el MCP Chrome DevTools a 375×667 y 320×568, en un contexto aislado con las peticiones a supabase.co bloqueadas por initScript (no se crean filas) y con el movimiento reducido simulado como en T16/T18 (`matchMedia` forzado + regla `@media` de la hoja con `mediaText = "all"`). La consola debe quedar limpia (salvo el aviso conocido "Skippable").

- [x] **T20. Lógica: entrada de la intro y transiciones.** RF-98, RF-100, RF-103 a RF-108, RNF-7
  - Archivos: nuevos `js/lib/intro-entry.js` (`INTRO_ENTRY`, `INTRO_ENTRY_MAX_MS`, `BUTTON_HIGHLIGHT_MAX_MS`, `introEntryEndMs`, `introEntryCssVars`) y `js/lib/transition.js` (`TRANSITION_OUT_MS`, `TRANSITION_IN_MS`, `REDUCED_FADE_MS`, `cityMode`, `planTransition`, `openGate`, `closeGate`, `gateAllows`), plan §15.1.
  - Tests primero: `tests/intro-entry.test.js` y `tests/transition.test.js` (plan §15.9).
  - Hecho cuando: `node --test` en verde y ningún módulo nuevo usa `document`, `window`, `fetch`, `Date` ni `performance`.

- [x] **T21. Lógica: rótulos, bucles del final y encendido total diferido.** RF-73, RF-74, RF-105, RF-112, RF-113, RF-114, RNF-7
  - Archivos: nuevo `js/lib/site-labels.js` (`SITE_LAYOUT` con manzana, caja del icono y rótulo de cada sitio, `LABEL_FONT`, `labelBox`, `boxesOverlap`, `minLabelPx`); `js/lib/final-view.js` (`liveDelays`); `js/lib/city-view.js` (`holdFullLight`), plan §15.1.
  - Tests primero: `tests/site-labels.test.js` (nuevo) y las ampliaciones de `tests/final-view.test.js` y `tests/city-view.test.js` (plan §15.9).
  - Hecho cuando: `node --test` en verde, con 10 rótulos sin solapes entre sí ni con iconos ajenos, `minLabelPx(288) ≥ 8` y `TRANSITION_OUT_MS + finalEndMs() ≤ 8000`.
  - Resultado (17/10/2026): `node --test` 267/267 (en rojo antes del código: 3 archivos sin poder importar). Nuevo `tests/site-labels.test.js` (10 tests: una entrada por sitio y congelado; líneas = `SITE_NAMES` en 1-2 líneas, con Concert/hall, Town/square, Food/market; `minLabelPx(288)` = 8,28; `labelBox` centrado y con alto por línea; `boxesOverlap` con bordes que se tocan = sin solape; icono dentro de su manzana y todo dentro de 0-400 × 0-300; rótulo bajo su icono; sin solapes entre rótulos ni con iconos o manzanas de otros sitios; manzanas sin solaparse), 3 tests nuevos en `tests/final-view.test.js` (`liveDelays` 900/1400 ms y 0/0 ms; 150 + 7200 ≤ 8000) y 2 en `tests/city-view.test.js` (`holdFullLight`). Ningún módulo usa `document`, `window`, `fetch`, `Date` ni `performance`. Decisiones no previstas: `label.y` es el borde superior de la caja del rótulo (T25 calcula la línea base a partir de él); la caja suma 4 de margen horizontal y 2 vertical (alto = líneas × 11,5 × 1,15 + 2); las manzanas son las del SVG actual (los sitios siguen en las casillas pares); "Fairground" (75,3 de ancho) no cabe en su manzana de 69, así que su centro pasa a x = 40 y el rótulo invade 2,7 unidades de la calle vertical junto a una manzana de relleno, y "Nightclub" (68,2) invade también un poco las calles laterales; Concert hall, Town square y Food market (2 líneas) bajan sobre la calle de debajo, que da a manzanas sin sitio; test extra: ningún rótulo se solapa con la manzana de otro sitio (regla de §15.1).

- [x] **T22. Intro: entrada escalonada, halo del botón y paso al bucle.** RF-7, RF-8, RF-87, RF-98 a RF-102, RNF-2
  - Archivos: `index.html` (6 `<g class="plato__enter" data-enter>` sin cambiar el orden de dibujo), `css/survey.css` (variables `--enter-*` en `.screen--intro` iguales a `INTRO_ENTRY`, `@keyframes intro-enter` e `intro-btn-glow`, `:nth-of-type` de las bombillas corregidos), plan §15.2.
  - Tests primero: `tests/markup.test.js` (puntos 1 y 2 de §15.9: grupos de entrada, variables iguales a `INTRO_ENTRY`, halo solo con `box-shadow`, el bucle sigue `infinite` en los hijos); los tests de T15/T16 siguen en verde.
  - Hecho cuando: `node --test` en verde y, a 375×667 y 320×568, `getAnimations()` muestra la entrada en el orden de RF-98, terminada ≤ 2 s, y después solo bucles `infinite` sin salto visible; el botón tiene opacidad 1 en el fotograma 0 y un clic a los 300 ms lleva al selector; sin scroll horizontal ni vertical (RF-88) durante la entrada; con movimiento reducido, 0 animaciones y el plató completo al momento.
  - Resultado (17/10/2026): `node --test` 274/274 (en rojo antes del código: 6 tests nuevos de `tests/markup.test.js`). `index.html`: 6 `<g class="plato__enter" data-enter>` directos bajo el `<svg>` (lights, sign, board, onair, floor, people) sin mover nada; la pared queda fuera (siempre visible). `css/survey.css`: 18 variables `--enter-*` en `.screen--intro` iguales a `INTRO_ENTRY`; `intro-fade` (solo opacidad, luces) e `intro-enter` (opacidad + `translateY(var(--enter-dy, 6px))`, 10px en people) con `both`; textos con `intro-enter`; botón con `intro-btn-glow` (solo `box-shadow`); bombillas `:nth-of-type(2/4/3)`. Tests nuevos: grupos en orden y sin anidar, contenido de cada grupo, todos los `:nth-of-type`/`:nth-child` del plató aciertan dentro de su grupo, variables = `introEntryCssVars()`, entradas finitas `both` con sus variables y keyframes solo de `opacity`/`transform`, halo solo `box-shadow`, nada oculto en reposo; "loops forever" excluye `.plato__enter`. MCP (contexto aislado, Supabase bloqueado): a 375×667 y 320×568 la entrada sigue el orden de RF-98 y acaba a 2000 ms, después 29 bucles `infinite` y los grupos en opacidad 1 y transform identidad; botón con opacidad propia 1 y misma posición en todos los fotogramas; 0 px de desborde horizontal y vertical durante la entrada; clic a 305 ms → selector visible; reduced-motion (matchMedia + regla @media forzadas) → 0 animaciones de entrada o bucle, todo en opacidad 1; consola limpia. Pendiente de T23: `.screen { animation: screen-in 200ms }` sigue fundiendo la sección de la intro (y con ella el botón) los primeros 200 ms; el botón tiene opacidad 1 propia, pero la opacidad efectiva sube con la sección hasta que T23 quite `screen-in`.

- [x] **T23. Transiciones de pantalla y de pregunta con la puerta de entradas.** RF-74, RF-103 a RF-108, RNF-2, RNF-4
  - Archivos: `js/app/main.js` (`act()` en todos los manejadores y en el `onBack` del historial; `update()` en 3 pasos: guardar, `paintCity` inmediato con `holdFullLight` hacia el final y fundido de salida, y `render()` + fundido de entrada; repintar la pregunta al abrir la puerta), un módulo pequeño `js/app/fade.js` (`fadeOut`/`fadeIn` con WAAPI) y `css/survey.css` (fuera `.screen { animation: screen-in }`, `@keyframes screen-in` y su copia de movimiento reducido), plan §15.3.
  - Tests primero: `tests/markup.test.js` (sin `screen-in`; `main.js` importa `planTransition`/`gateAllows` y en `onNext` hace `commit()` justo después de `update(result.state)`).
  - Hecho cuando: `node --test` en verde y, con el MCP:
    - cada cambio de pregunta funde solo el panel (≤ 150 + 250 ms) y la ciudad no se mueve; intro → país → Q1 y Q10 → final con fundido;
    - un doble clic en "Next" avanza una sola pregunta y crea un solo payload (cola local);
    - `history.back()` durante una transición no cambia nada;
    - el sitio se enciende y el payload se encola antes de que termine el fundido;
    - el foco va al título;
    - la recarga a mitad pinta la pregunta sin fundido;
    - con movimiento reducido hay un solo fundido de ≤ 200 ms;
    - Q10 → final `done` en ≤ 8 s desde "Next".
  - Resultado (17/10/2026): `node --test` 279/279 (en rojo antes del código: 4 de los 5 tests nuevos de `tests/markup.test.js`; el de `commit()` tras `update(result.state)` ya se cumplía). Nuevo `js/app/fade.js` (`fadeOut` con `fill: "forwards"`, `fadeIn` que se cancela al terminar, `cancelFades`; solo cancela sus propios fundidos, nunca las animaciones CSS). `main.js`: `act()` en los 6 manejadores y en el `onBack` del historial; `update()` guarda, pinta la ciudad (con `holdFullLight` hacia el final), cierra la puerta y funde; `render()` + `fadeIn` al acabar la salida (síncrono si `outMs` = 0) y repintado de la pregunta al abrirse la puerta. `css/survey.css`: fuera `screen-in` (base y movimiento reducido); el halo del botón pasa a `backwards`. Tests nuevos: sin `screen-in` ni animación en `.screen`; halo sin `both`/`forwards`; imports de `planTransition`/`gateAllows`/`holdFullLight` y todos los manejadores con `act()`; `commit()` justo tras `update(result.state)`; `fade.js` con WAAPI, solo `opacity` y `cancel()`. MCP (contextos aislados, supabase.co bloqueado): a 375×667, intro → país, país → Q1 (sección + ciudad), pregunta → pregunta (solo `#screen-question`, 150 + 250 ms, rect de la ciudad idéntico) y Q10 → final (pregunta y ciudad 150 ms, entrada 0); primera pintura y recarga a mitad (320×568) sin ningún fundido; foco al título al empezar la entrada; triple clic y doble clic real en "Next" → una pregunta y un payload (`p_seq` +1); sitio encendido y payload encolado en el mismo tick del clic; `history.back()` y "Back" durante la transición ignorados con la guarda repuesta, después funcionan; texto tecleado y opción pulsada durante la entrada descartados y repintados; Q10 → final: estadio encendido al momento, `data-all-lit` a la vez que `data-final="play"`, `done` a 7373 ms; 0 px de desborde a 320×568 durante las transiciones; movimiento reducido → un solo fundido de entrada de 200 ms sin salida, 0 animaciones CSS, final `done` directo; consola sin errores (solo el aviso conocido "Session History Item Has Been Marked Skippable"). Decisión no prevista: si el participante pulsa durante el fundido de salida, el texto queda en el campo saliente hasta `render()`, que lo sustituye por el estado guardado.

- [x] **T24. Ciudad: mapa acotado con borde, naturaleza, agua y 16 rellenos con volumen.** RF-69, RF-70, RF-72, RF-76, RF-78, RF-109, RF-110, RF-111, RNF-4
  - Archivos: `index.html` (sin periferia, `clipPath#map-clip`, `.city__map`, `.city__border`, `.city__nature` con 2 `data-green`, estanque `data-water` con `.water__ripple` y ≥ 12 `.tree`; 16 `.filler` con `.shadow`, `.filler__roof`, `.filler__face`, `.filler__ridge` y `.filler__lights`) y `css/survey.css` (`.city { overflow: hidden }`, tonos, sombras y aclarado con `[data-all-lit]`; la ola también aclara `.filler__face`), plan §15.4.
  - Tests primero: `tests/markup.test.js` (coordenadas dentro de 0-400 × 0-300, recorte y borde, 16 rellenos con sombra y dos tonos, `translate(2.5 3)` igual en todas las sombras, zonas verdes, agua y árboles sin solaparse con calles, rellenos ni sitios; los tests de T17/T18 se adaptan a 16 rellenos).
  - Hecho cuando: `node --test` en verde y, a 375×667 y 320×568, el mapa se ve con borde, sin nada fuera, tejados de dos tonos, sombras hacia abajo a la derecha, zonas verdes, estanque y árboles; ≤ 40 % del alto en las preguntas; relleno y calles apagados hasta los 10 sitios; consola limpia.
  - Resultado (17/10/2026): `node --test` 286/286 (en rojo antes del código: 7 tests nuevos de `tests/markup.test.js`). `index.html`: `clipPath#map-clip` (rect 400×300, rx 12) y todo dentro de `<g class="city__map">` (suelo, calles con farolas y pasos de cebra, manzanas, naturaleza, relleno, sitios, coches, ola), con `.city__border` encima, fuera del recorte; calles de 0-400 / 0-300 y sin periferia; `.city__nature` con 2 `data-green` (central de la fila 2 y esquina inferior derecha) con caminos `.green__path`, estanque `data-water` con 3 `.water__ripple` y 21 `.tree` (11 en zonas verdes, 10 en manzanas de relleno); 16 `.filler` con `.shadow` `translate(2.5 3)`, `.filler__roof`, `.filler__face` (mitad izquierda si es alto, superior si es ancho), `.filler__ridge` y `.win` en `.filler__lights`, con la `.win` ajustada a la rejilla del patrón (sin ventanas cortadas). `css/survey.css`: `.city { overflow: hidden }`, `.city__border`, `.shadow`, tonos de cara, cumbrera, verde, agua, árboles y cebras, versión aclarada con `#city[data-all-lit]`, y la ola aclara también caras, verdes, agua y copas (`city-face-on`, `city-green-on`, `city-water-on`, con `transition: none` en el modo play). Tests nuevos: mapa acotado (ninguna forma fuera de 0-400 × 0-300), recorte + borde + orden de dibujo + `.city` oculta el desborde, 16 rellenos con sus partes y sombra = copia del tejado dentro de manzanas sin sitio, todas las `.shadow` con `translate(2.5 3)` y sin filtros en la ciudad, ≥ 2 zonas verdes + estanque con ondas + ≥ 12 árboles, árboles dentro de manzanas sin sitio sin tocar rellenos, estanque ni otros árboles (≥ 4 por zona verde y ≥ 2 en manzanas de relleno), cara más clara que el tejado apagada y encendida y ola en las caras. MCP (contexto aislado, Supabase bloqueado): a 375×667 la ciudad mide 257 px (38,6 %) y a 320×568, 216 px (38 %; 32,4 % de 667), sin scroll horizontal; con 9 sitios, relleno, ventanas, farolas y calles apagados; en el final, todo encendido; consola sin errores (solo el aviso conocido "Session History Item Has Been Marked Skippable"). Capturas antes/después en el scratchpad de la sesión. Decisiones no previstas: `--fx` también en zonas verdes, estanque y árboles para que la ola los aclare a su paso; pasos de cebra en los dos cruces centrales como detalle; en el test, el helper se llama `elHas` porque `hasClass` ya existía para el plató. Pendiente de T26: en el final el mapa toca los bordes de la pantalla a 320 y 375 px (sigue el `fixed` a pantalla completa).

- [x] **T25. Ciudad: iconos de los sitios con volumen y rótulos bajo cada sitio.** RF-71, RF-75, RF-77, RF-109, RF-112, RF-113, RNF-4
  - Archivos: `index.html` (los 10 `data-site` con `.shadow`, `.body--top` e icono reducido y subido según `SITE_LAYOUT[id].icon`; la noria dentro de `<g class="wheel">`), `js/app/city.js` (`mountCityLabels`, y `paintCity` con `is-lit` en `[data-site-label]`), `js/app/main.js` (llamar a `mountCityLabels` al arrancar) y `css/survey.css` (`.site-label` con fundido de 400 ms, fondo y texto), plan §15.4 y §15.5.
  - Tests primero: `tests/markup.test.js` (sin `<text>` en el `#city` del HTML, `city.js` crea `data-site-label`, `.site-label` apagado por defecto y encendido solo con `.is-lit`, `transition` ≤ 400 ms, cada `.block` de `SITE_LAYOUT` existe en el HTML).
  - Hecho cuando: `node --test` en verde y, con el MCP, cada respuesta muestra el rótulo de su sitio con fundido; con los 10 encendidos, `getBBox()` de cada icono cabe en su caja de `SITE_LAYOUT` y ningún rótulo se solapa con otro ni con un icono, a 375×667 y 320×568; el texto mide ≥ 8 px a 320 px y tiene contraste ≥ 4.5:1 en el peor caso; el árbol de accesibilidad solo muestra el `aria-label` de la ciudad (sin rótulos sueltos); con la recarga a mitad, los rótulos aparecen sin fundido; con movimiento reducido, fundido de ≤ 200 ms.
  - Resultado (17/10/2026): `node --test` 301/301 (en rojo antes del código: `tests/city.test.js` y `tests/site-labels.test.js` sin poder importar y 8 tests nuevos de `tests/markup.test.js`). `index.html`: los 10 sitios redibujados dentro de `<g class="site__icon">` (el halo `.glow` queda fuera y centrado en la caja del icono), cada uno con `.shadow` `translate(2.5 3)`, `.body` y `.body--top`: Park (césped, camino iluminado, templete de tejado a cuatro aguas y 5 árboles), Concert hall (tejado en forma de piano de cola con tapa abierta, cuerdas encendidas y teclado; sustituye al abanico que se parecía al teatro), Museum (cuatro aguas alrededor de un patio acristalado y pórtico con columnas), Theatre (anfiteatro con anillo de palco, filas encendidas y escenario con telón rojo y pliegues), Cinema (película perforada y marquesina de bombillas), Fairground (noria en `<g class="wheel">` centrada en 0 0 con sombra de anillo, y carpa a gajos), Town square (plaza con pavimento en diagonal, bancos, farolas y fuente), Food market (6 puestos con toldo de rayas y faldón claro, guirnalda de luces), Nightclub (bloque con peto claro, neón, estrella y bola), Stadium (anillo, gradas claras, campo y 4 torres de luz); `<g class="city__labels" aria-hidden="true"></g>` vacío entre coches y ola. `js/lib/site-labels.js`: `labelLines(label)` (texto, x y línea base de cada línea). `js/app/city.js`: `mountCityLabels(svg, layout = SITE_LAYOUT)` (fondo `rx 3` + `<text>` con `<tspan>` por línea vía `textContent`; repetible) y `paintCity` con `is-lit` en `[data-site-label]`. `js/app/main.js`: `mountCityLabels(city)` antes del primer `render()`. `css/survey.css`: `.site .body--top`, `.site .fold`, `.shadow--ring`, `.site-label` (opacidad 0, `transition: opacity 400ms`), `.site-label.is-lit`, `.site-label__bg`, `.site-label__text`. Tests nuevos: `tests/city.test.js` (4, DOM falso: un rótulo por sitio con fondo y líneas de `SITE_LAYOUT`, sin duplicar al repetir, error sin `.city__labels`, `paintCity` enciende solo los rótulos de los sitios encendidos), 2 en `tests/site-labels.test.js` (`labelLines`) y 9 en `tests/markup.test.js` (grupo de rótulos vacío, oculto y entre coches y ola; `city.js` con `textContent` y sin `innerHTML`; `main.js` monta antes del primer render; rótulo apagado y fundido ≤ 400 ms solo con `.is-lit`; estilo de texto y fondo; manzanas de `SITE_LAYOUT` en el HTML; sombra y dos tonos por sitio; noria en `.wheel`; rect/circle/ellipse de cada icono dentro de su caja). MCP (contextos aislados, Supabase bloqueado por initScript): a 375×667 y 320×568, cada respuesta enciende su rótulo con fundido (opacidad 0 → 0,63 a 150 ms → 1 a 450 ms); con los 10, `getBBox()` de cada `.site__icon` cabe en su caja y ningún rótulo se solapa con otro ni con un icono ni sale del mapa (comprobado en unidades del viewBox y en px a 320); letra de 9,86 px a 375 y 8,28 px a 320; contraste peor caso 8,86:1 (fondo al 78 % sobre blanco puro; 10,3:1 sobre la luz cálida); Back con 9 encendidos: los 9 siguen en opacidad 1 sin volver a fundirse; recarga a mitad: 9 rótulos en opacidad 1 desde el primer fotograma y 0 transiciones; árbol de accesibilidad: solo el `aria-label` de la ciudad; movimiento reducido (reglas del @media aplicadas a la fuerza): `transition: opacity 0.2s`, 0 → 0,79 a 100 ms → 1 a 220 ms; sin scroll horizontal; consola sin errores (solo el aviso conocido "Session History Item Has Been Marked Skippable"). Capturas: `t25-375-q10-9lit.png`, `t25-375-final-10lit.png`, `t25-320-q10-9lit.png`, `t25-320-final-10lit-reduced.png` en el scratchpad de la sesión. Decisiones no previstas: el icono va en `.site__icon` para medirlo con `getBBox()` sin el halo; la línea base es `label.y + 1 + (i + 0,82) × 11,5 × 1,15` (mayúsculas centradas en la caja); la sombra de la noria es un anillo con trazo (`.shadow.shadow--ring`) en vez de un disco; el test de cajas solo mide rect/circle/ellipse (los path con arcos se comprobaron con `getBBox()` en el MCP).

- [x] **T26. Final: mapa acotado centrado y panel en el flujo.** RF-54, RF-79, RNF-1, RNF-4
  - Archivos: `css/survey.css` (`.app[data-screen="final"]` como columna flex, `.city-wrap` sin `fixed`, con margen de 8 px, `.city` con `meet`, `.screen--final` en el flujo; fuera la regla `:has(.offline-notice.is-visible)`) y el comentario de `js/app/screens/final.js`, plan §15.6.
  - Tests primero: `tests/markup.test.js` (puntos 3 y 4 de §15.9, sustituyen al test "full screen" y a la parte de compensación del panel del test del aviso offline).
  - Hecho cuando: `node --test` en verde y, a 375×667 y 320×568 (también con el aviso offline visible y a 430×932):
    - el mapa entero está centrado y es al menos tan grande como en las preguntas, a ≥ 8 px de los bordes, con fondo liso alrededor;
    - en el estado final no se solapa con el panel;
    - no hay scroll horizontal ni vertical;
    - el contraste de los textos es ≥ 4.5:1;
    - la recarga terminada tiene el mismo aspecto.
  - Resultado (17/10/2026): `node --test` 302/302 (en rojo antes del código: 4 tests de `tests/markup.test.js`). `css/survey.css`: `.app[data-screen="final"]` columna flex (`gap: 8px`, `height: 100dvh`, con `100vh` de respaldo; el padding inferior de `.app` queda dentro por `border-box`); `[data-screen="final"] .city-wrap` sin `fixed`/`inset`/fondo propio, con `flex: 1 1 auto; min-height: 0`, centrado y `margin: 8px -8px 0`; `.city` con `width: auto; height: 100%; max-width: 100%` (`meet`); `.screen--final` en el flujo (`flex: none; position: relative; z-index: 1`, sin `left/right/bottom` ni ancho fijo) con el mismo fondo y radio; borrada la regla `.screen--final:has(.offline-notice.is-visible)`. `js/app/screens/final.js`: comentario. Tests: "full screen" sustituido por "flex column" y "whole bounded map, centred, 8 px from the edges" (sin `fixed`/`inset`, flex, márgenes, `meet`, `.city` con `overflow: hidden`); el del panel pasa a "in the flow" (sin `fixed/absolute/sticky` ni `bottom/left/right/inset`, `flex: none`, sin `transform`, sin `.screen--final:has(`); el del aviso offline comprueba que no hay `:has(.offline-notice`. MCP (contextos aislados, `fetch` a supabase.co interceptado: 204 o error): llegada de 7409 ms (375×667) y 7394 ms (320×568) desde el Next de la Q10 hasta `data-final="done"`. Mapa (borde) en el estado final: 357×268 a 375×667 (preguntas 341×256), 303×227 a 320×568 (preguntas 287×215), 412×308 a 430×932; a 8,8-9 px de los lados, centrado (desvío 0), mismo hueco arriba y abajo; panel a 16 px del borde inferior; 0 px de scroll horizontal y vertical; ningún rótulo, bandera ni texto se solapa con el otro bloque, también con el aviso offline visible (375×667 y 320×568: el panel crece 19 px y el mapa conserva el tamaño). Pantalla baja 320×480: mapa 303×227 sin solape; horizontal 667×375: mapa reducido entero a 229×172, sin solape ni scroll. Contraste sobre el panel en el peor fondo (panel al 82 % sobre #1a2464): título 12,7:1, "Thank you" 16,8:1, aviso 10,2:1. Recarga terminada: `final="done"` directo, mismas medidas al píxel, 0 animaciones. Movimiento reducido (matchMedia + reglas del @media forzadas): `done` a los 23 ms, 0 animaciones, mismas medidas. Consola sin errores (solo "Session History Item Has Been Marked Skippable"). Capturas: `t26-375-final.png`, `t26-375-final-offline.png`, `t26-320-final-offline.png`, `t26-375-final-reduced.png` en el scratchpad de la sesión. Decisiones no previstas: `position: relative; z-index: 1` en el panel para contener su `::before` y pintar las banderas sobre el mapa durante el giro; el wrap pierde su `background` propio (se ve el de `body`, sin calles); con `align-items: center` el mapa queda centrado también en vertical en el hueco libre (a 375×667, ~110-119 px por arriba y por abajo).

- [x] **T27. Final: ciudad viva en bucle tras el encendido total.** RF-53, RF-54, RF-56, RF-114 a RF-118, RNF-2
  - Archivos: `index.html` (4 `.car` con `data-axis` sobre sus calles; `data-twinkle` en un tercio de los `.filler__lights`; farolas en `.lamps__a`/`.lamps__b`), `js/app/screens/final.js` (`data-final-live` y las variables de `liveDelays` en `show()`, que se quitan en `hide()`) y `css/survey.css` (bucles de coches, ventanas, farolas, agua, estadio, noria y discoteca bajo `[data-final-live] #city[data-all-lit]`; fuera `final-car` y `--car-from`), plan §15.7.
  - Tests primero: `tests/markup.test.js` (coches con `data-axis` sobre una calle de su eje y `@keyframes car-*` solo por su eje; bucles bajo `[data-final-live]` y `[data-all-lit]`; sin `final-car`); siguen en verde "toda animación `infinite` ≥ 1 s" y "reduced motion stops every animation".
  - Hecho cuando: `node --test` en verde y, con el MCP:
    - tras la Q10, los coches circulan desde ~0,9 s y no se paran;
    - a los 20 s y a los 60 s `getAnimations()` muestra los bucles de coches, ventanas, farolas, agua y 3 sitios `running`, con el mismo `startTime` antes y después del paso `play` → `done`;
    - ningún coche se dibuja fuera del borde;
    - banderas, textos y rótulos no se mueven;
    - la recarga terminada muestra los bucles desde el principio, sin llegada;
    - con movimiento reducido no hay ninguna animación y el estado final está completo.
  - Resultado (17/10/2026): `node --test` 315/315 (en rojo antes del código: 11 tests; nuevo `tests/final-screen.test.js` con DOM falso y 8 tests nuevos en `tests/markup.test.js`). `index.html`: 4 `.car` con `data-axis` en el carril derecho de su calle (1 → en y 70-80, 2 ← en y 145-155, 3 → en y 220-230, 4 ↓ en x 155-165), de 13 × 4,4 con los faros dentro de la carrocería; 5 de 16 `.filler__lights` con `data-twinkle` y `--tw` (0-2,3 s); las 55 farolas repartidas en `.lamps__a` (28) y `.lamps__b` (27), alternas. `js/app/screens/final.js`: `show()` pone siempre `data-final-live` y `--live-cars-delay`/`--live-delay` de `liveDelays({ animate: animate && !reducedMotion() })`; `hide()` los quita. `css/survey.css`: fuera `final-car`, `--car-from` y las reglas de coches de `play`; nuevo bloque "Living city" bajo `.app[data-final-live] #city[data-all-lit]`: coches `car-x-1/2/3` y `car-y-4` (10/11/9/8 s, `linear`, velocidad constante desde su sitio de reposo hasta el borde, salto fuera del mapa al borde contrario y vuelta al reposo, sin costura), ventanas 1 ↔ .55 (4 s `alternate`), farolas 1 ↔ .7 en contrafase (4 s, +4 s), ondas con `stroke-dasharray` y `stroke-dashoffset` (6 s), focos del estadio 1 ↔ .75 (2,5 s), noria 360° (24 s, `fill-box`), neón de la discoteca rosa contra blanco 1 ↔ .6 (1,6 s, +1,6 s). Tests nuevos: coches en una calle de su eje (3 avenidas distintas + 1 vertical), keyframes solo por su eje, de 0 a 0, saliendo entero por los dos bordes, salto solo fuera del mapa, velocidad constante y sentidos alternos; sin `final-car`/`--car-from`; un tercio de ventanas y farolas en 2 grupos; bucles de ventanas, farolas, agua, estadio, noria y discoteca colgados de `[data-final-live]` + `[data-all-lit]` y nunca de `data-final=`; cada cambio de brillo ≥ 1 s, opacidad ≥ .55, solo `opacity`/`transform`/`stroke-dashoffset`, sin `steps()` ni filtros; banderas, textos y rótulos sin bucle; `final.js` con `liveDelays`; DOM falso: play (900/1400 ms), play → done conserva `data-final-live` y retrasos, reapertura y movimiento reducido con 0 ms, `hide()` lo limpia. MCP (contextos aislados, Supabase bloqueado por initScript): a 375×667 y 320×568, flujo completo hasta el final; los coches siguen quietos hasta ~0,9 s y luego circulan (a 320 px, +4,8 px cada 150 ms); a los 20 s (y a los 60 s a 375) 25 animaciones de bucle `running` (4 coches, 5 ventanas, 2 grupos de farolas, 3 ondas, 4 focos, noria, 6 luces de discoteca) con el mismo `startTime` que durante `play`; los coches que salen por el borde quedan recortados por `#map-clip`; 0 animaciones en banderas, textos y rótulos; 0 px de desborde horizontal y vertical; recarga terminada: `done` + `data-final-live` con 0 ms, ninguna animación de llegada y los 25 bucles desde el primer momento; movimiento reducido (matchMedia + reglas del @media forzadas): 0 animaciones, ciudad encendida con 10 rótulos y coches en su sitio de reposo; PerformanceObserver `longtask`: 0 tareas > 50 ms en toda la sesión (flujo + 60 s de final vivo), también en una ventana específica de 15 s del final; consola sin errores (solo el aviso conocido "Session History Item Has Been Marked Skippable"). Capturas: `t27-375-final-live-25s.png`, `t27-320-final-live-20s.png`, `t27-375-final-reduced.png` en el scratchpad de la sesión. Decisiones no previstas: los pulsos usan `alternate` y la duración del plan es cada subida o bajada (así la discoteca de 1,6 s cumple "≥ 1 s por cambio"); los coches no usan `backwards`, sino keyframes que empiezan y acaban en su sitio de reposo (sin salto al arrancar a los 0,9 s); el coche 3 pasa a x = 318 (el test del aviso offline prohíbe el literal `84px`); las ventanas usan una sola duración (4 s) con desfases `--tw`, porque el test de bucles lee la duración del primer valor del atajo.

- [x] **T28. Validación completa del cambio, RNF-12 y cierre.** Todos los RF y RNF del cambio (plan §15), RNF-1, RNF-5, RNF-9, RNF-12
  - Archivos: `MEMORY.md` (plan §15.11) y, si procede, una propuesta para `AGENTS.md`.
  - Hecho cuando:
    - `node --test` en verde;
    - flujo completo intro → país → 10 preguntas (con Back, atrás del sistema, doble toque en Next, cambio de respuesta, AO y AP) → final a 375×667 y 320×568, también con movimiento reducido y sin red, sin scroll horizontal y con la consola limpia;
    - RNF-12 medido como en plan §15.8: 0 tareas largas (> 50 ms) durante 10 s del bucle de la intro, durante las transiciones y durante 15 s del final vivo;
    - "Give feedback" pulsable en < 3 s con Fast 4G y sin caché (RNF-5);
    - una fila real con RPC 204 (y anotarla como fila de prueba);
    - revisión RF por RF del cambio con VEREDICTO: APROBADO;
    - spec marcada como implementada y MEMORY.md actualizado.
  - Validación (17/10/2026). Sin cambios de código. `node --test` 315/315; `check-db.mjs` 38/38. MCP Chrome DevTools, contextos aislados con `fetch` a supabase.co interceptado por initScript (204, o error si `navigator.onLine` es falso), salvo el flujo real:
    - **Intro** (375×667 y 320×568): entrada en el orden de RF-98 (lights 0-500, sign 200-600, board 400-900, onair 650-1000, floor 800-1100, people 950-1450, thanks 1200-1600, ask 1350-1750 ms; halo del botón hasta 2000), después 29 bucles `infinite` `running`; muestreo por fotograma desde los 23 ms: opacidad efectiva del botón siempre 1 y misma posición (y = 599 a 375, 500 a 320), 0 px de desborde horizontal y vertical; clic a los 306 ms (a 320, con los grupos aún en 0,70/0,22/0…) → selector con fundido 150 + 250 ms.
    - **Transiciones**: intro → país, país → Q1 (sección + ciudad, 150 + 250) y pregunta → pregunta (solo `#screen-question`, 150 + 250; la ciudad sin animaciones, opacidad 1 y misma posición en todos los fotogramas); foco al título al empezar la entrada; sitio encendido y payload encolado en el mismo tick del clic; doble clic real (MCP) y triple clic en "Next", y doble clic en una bandera → avanza 1 y un solo payload; `history.back()` y "Back" durante la transición ignorados (guarda repuesta), después funcionan. Q10 → final: pregunta y ciudad 150 ms, `data-all-lit` y `play` a los 165-171 ms, `done` a 7374 ms (375) y 7377 ms (320) desde "Next".
    - **10 preguntas** (375 y 320): Q1 sin Back; Q2-A vacía o con espacios → Next desactivado; Q5-A obligatoria y pegar 300 → 280 y "0 characters left"; Q9-B/Q10-B opcionales ("Tell us more (optional)"); Back desde Q4 conserva C en Q3 y A + texto en Q2; cambio Q2 A → B con el texto conservado; atrás del navegador en Q5 → Q4 con su respuesta; Back con 9 encendidos: 9 sitios y 9 rótulos sin volver a fundirse (opacidad mínima 1), sin `data-all-lit`, ventanas y farolas a 0; rótulo de feria 0 → 1 en ~390 ms al encenderse; objetivos ≥ 52 px; nunca scroll horizontal.
    - **Recargas**: a mitad (Q6) → Q6 con 5 sitios, 0 fundidos WAAPI, 0 animaciones, rótulos en opacidad 1 desde el primer fotograma; terminada → `done` + `data-final-live` con retrasos 0 ms, 25 bucles desde el principio, sin animaciones de llegada ni botones; atrás en el final no cambia nada.
    - **Final**: mapa 357×267 a 375 (panel desde 505, mapa hasta 386), 302×226 a 320 (panel desde 410, mapa hasta 318), 412 px de ancho a 430×932; rótulos sin solapes entre sí, con iconos ajenos ni fuera del mapa (320: letra 8,7 px; 430: 11,8 px); a los 33 s, 25 bucles `running` (4 coches, 5 ventanas, 2 grupos de farolas, 3 ondas, 4 focos, noria, 6 neones) con el mismo `startTime` que a los 18 s; 0 animaciones en banderas, textos y rótulos.
    - **Sin red → con red** (375, emulación Offline desde Q6): aviso "Saved offline – will sync" bajo los botones y en el panel, 6 envíos fallidos (con reintentos), Back y Next siguen funcionando; al volver la red, RPC 204 con `p_seq` 14 y aviso oculto; Q10 → `completed` `p_seq` 15.
    - **Movimiento reducido** (matchMedia forzado y regla `@media` con `mediaText = "all"` a los 25 ms, antes de que cargue `main.js`, que lo detecta: `outMs` 0): intro con 0 animaciones, grupos en opacidad 1 y haces sin `transform` (375 y 320, botón en 552 px a 320 sin scroll); cada cambio de pantalla y pregunta, un solo fundido de entrada de 200 ms y 0 animaciones CSS en todo el flujo; rótulos con `transition: opacity 0.2s`; doble Next, Back y atrás del navegador igual que sin reducir; final `done` a 18 ms, 10 rótulos, ventanas a 1, coches quietos (`transform: none`), sin confeti ni bucles; recarga a 320: estático, sin solapes ni scroll.
    - **RNF-12**: PerformanceObserver `longtask` (buffered desde la carga): 0 tareas en 10 s de intro (375 y 320), en las transiciones del flujo completo (375 Q6-Q10 y 320 completo) y en 15 s de final vivo (375 y 320); traza de Chrome DevTools de 14 s del final vivo (CPU 1×): 14 848 tareas del hilo principal, ninguna > 50 ms (máx. 11,3 ms), CLS 0.
    - **RNF-5**: Fast 4G, contexto nuevo sin caché, 375×667: botón en el DOM a 210 ms, FCP a 492 ms, `main.js` ejecutado y "Give feedback" operativo a 1362 ms (DOMContentLoaded), 27 recursos y 171 KB transferidos.
    - **Consola**: solo el aviso conocido "Session History Item Has Been Marked Skippable" en todos los contextos.
    - **Flujo real** (375, IT, AO en Q2 y Q5, AP con texto en Q9): 11 RPC 204, la última `completed` `p_seq` 11, `content_version` "2026-10-test-2". Fila de prueba: participant_id `7dbc4a0e-ce77-4275-92ef-85630c85ba27` (borrarla con las demás). Ningún otro contexto escribió en Supabase.
    - Capturas en el scratchpad de la sesión: `t28-01-intro-375.png`, `t28-02-q6-5lit-375.png`, `t28-03-q9-offline-375.png`, `t28-04-q10-9lit-offline-375.png`, `t28-05-final-live-375.png`, `t28-06-q10-9lit-320.png`, `t28-07-final-live-320.png`, `t28-08-final-reduced-375.png`; traza `t28-trace-final-live.json.gz`.
    - Observación (no incumple ningún RF, no se ha tocado): a 320×568, durante ~1 s del destello (6394-7373 ms desde "Next" en Q10, fase `flash` de la llegada), `.final__flash` (fill both, escalado a 1,8) sobresale 1-3 px por debajo de la pantalla y crea 1-3 px de scroll vertical transitorio; en el estado final no hay scroll. No incumple: RNF-1 y RF-76 solo prohíben el scroll horizontal. Aparece desde T26 (panel en el flujo). Mejora opcional anotada en MEMORY.md (limitar el escalado o recortarlo).
  - Revisión del reviewer (17/10/2026): **VEREDICTO: APROBADO** (315/315 tests, `check-db.mjs` 38/38, flujo completo a 375 y 320, movimiento reducido, sin red → con red, RNF-12 con 0 tareas largas). Cierre: spec marcada como implementada y MEMORY.md actualizado (plan §15.11).

## Cambio de requisitos 2026-10-18 (plan §16)
Estilo de la referencia y ciudad viva. Se trabaja igual que en el cambio anterior:
- una tarea cada vez, con los tests primero (en rojo), después el código y luego en verde;
- la validación visual, con el MCP Chrome DevTools a 375×667 y 320×568, en un contexto aislado con supabase.co bloqueado por initScript y el movimiento reducido simulado como en T16/T18;
- la consola, limpia (salvo el aviso conocido "Skippable").

- [x] **T29. Lógica: rejilla, colocación de los sitios, rótulos, farolas y ola.** RF-69, RF-70, RF-73, RF-112, RF-113, RF-139, RF-140, RF-141, RNF-7
  - Archivos (plan §16.1):
    - nuevo `js/lib/city-grid.js`: constantes, `cellBox`, `SITE_CELLS`, `fillerCells`, `areNeighbours`, `readingOrder`, `columnOrder`, `STREETS`, `lampPoints`, `waveDelayFraction` y `fillerBuildings`;
    - `js/lib/site-labels.js`, rehecho: `SITE_LAYOUT` desde la rejilla y `labelSpill`.
  - Tests primero: `tests/city-grid.test.js` (nuevo) y `tests/site-labels.test.js` (rehecho), plan §16.9.
  - Hecho cuando:
    - `node --test` pasa los tests de lógica nuevos y los que ya había. Los de `markup.test.js` que miran la ciudad anterior se dejan como están hasta T33;
    - se cumplen RF-139 y RF-141 con el reparto de la propuesta 29;
    - ningún módulo nuevo usa `document`, `window`, `fetch`, `Date`, `performance` ni `Math.random`.
  - Hecho (18/10/2026): `node --test` 327/327 en verde.
    - Archivos: `js/lib/city-grid.js` (nuevo), `js/lib/site-labels.js` (rehecho, cada sitio con `cell`, `icon` y `label`, más `labelSpill`), `tests/city-grid.test.js` (nuevo, 15 tests) y `tests/site-labels.test.js` (rehecho, 14 tests).
    - **Desviación aprobada por el usuario (opción a)**: rehacer `SITE_LAYOUT` dejaba en rojo 5 tests de la ciudad anterior en `tests/markup.test.js`, así que su eliminación se adelanta de T33 a T29. Son los tests de los 16 rellenos con sombra, las 2 zonas verdes con estanque y árboles, los árboles en manzanas sin sitio, "every block of SITE_LAYOUT is a block of the city map" y los iconos dentro de la caja `icon` absoluta. Se quitan también `SITE_BLOCKS` y la importación de `SITE_LAYOUT` en ese archivo.
    - Hasta T33, los rótulos se colocan en la rejilla nueva sobre el dibujo de la ciudad anterior (fase intermedia prevista).
    - Detalles no fijados en el plan:
      - `fillerBuildings` sigue la demo (2×2 huecos, 8 % vacíos, Park–Miller), pero con 2 huecos vacíos como máximo, para que haya de 2 a 4 edificios por celda; cada edificio lleva su ventana `win`;
      - `lampPoints()` da 53 farolas (18 + 20 + 15 cruces);
      - `waveDelayFraction` está limitada a 1;
      - `readingOrder`/`columnOrder` devuelven una copia ordenada;
      - la caja `icon` va en coordenadas absolutas (ancho de la celda, y 2-40);
      - `labelSpill` devuelve `{ left, right }`: Fairground ≈ 9,65 y Nightclub ≈ 6,085.

- [x] **T30. Lógica: progreso, celebración, transiciones 200/350 con "rise" y bucles e intro.** RF-86, RF-103, RF-108, RF-119 a RF-121, RF-123, RF-125 a RF-130, RF-133 a RF-138, RF-143, RF-148, RNF-7
  - Archivos (plan §16.1):
    - nuevo `js/lib/progress.js` (`progressView`);
    - `js/lib/city-view.js`: `celebration`, `toastPlacement` y las constantes de tiempo;
    - `js/lib/transition.js`: 200/350 y `rise`;
    - `js/lib/intro-entry.js`: `INTRO_LOOPS`, `flashesPerSecond`, `BOARD_SEQUENCE`, `MARKER_COUNT`, `markerValueAt` y `markerCountPlan`.
  - Tests primero: `tests/progress.test.js` (nuevo) y las ampliaciones de `city-view`, `transition`, `intro-entry` y `final-view` (plan §16.9).
  - Hecho cuando:
    - `node --test` en verde, con `totalMs ≤ 550`, `200 + finalEndMs() ≤ 8000` y ≤ 3 destellos por segundo en los 3 bucles;
    - ningún módulo usa DOM, red ni reloj.
  - Hecho (18/10/2026): `node --test` 349/349 en verde (22 tests nuevos).
    - Archivos: `js/lib/progress.js` (nuevo), `js/lib/city-view.js`, `js/lib/transition.js`, `js/lib/intro-entry.js`; tests: `tests/progress.test.js` (nuevo, 8), `tests/city-view.test.js` (+7), `tests/intro-entry.test.js` (+6), `tests/transition.test.js` (actualizado a 200/350 y `rise`, +1) y `tests/final-view.test.js` (200 + 7200 = 7400).
    - Detalles no fijados en el plan:
      - `progressView` calcula el porcentaje como `round(litCount·100/total)` (igual a N·10 con 10 preguntas); sin `answeredIndexes`, rellena los `litCount` primeros; `current` por defecto es null;
      - `celebration` acepta `names` como 4.º parámetro (por defecto `SITE_NAMES`) y, si hubiera varios sitios nuevos a la vez, usa el primero en el orden de `nextLit`;
      - `toastPlacement` acepta `cells` (por defecto `SITE_CELLS`) y devuelve "bottom" para un id desconocido;
      - `BOARD_SEQUENCE`: objetos `{ col, row, column, value }` (col 0-4, row 0-2);
      - `markerValueAt` es lineal y redondea hacia abajo a múltiplos de 10; `markerCountPlan` devuelve "skip" si `elapsedMs` no es un número finito;
      - intro → selector también lleva `rise` (regla del plan: `inMs > 0`, sin movimiento reducido y no hacia el final).

- [x] **T31. Tipografías propias: descarga confirmada, licencias, `@font-face` y precarga.** RF-142, RF-145, RNF-5, RNF-13
  - **Antes de empezar**:
    - confirmar con el usuario la descarga de los 5 woff2 (Fontsource vía jsDelivr, versión fija con ≥ 2 semanas) y de los 2 OFL (`github.com/google/fonts`), según plan §16.2;
    - si no hay red o el usuario no confirma, parar.
  - Archivos:
    - `assets/fonts/` con los 5 woff2 y los 2 OFL;
    - `css/survey.css`: `@font-face` con `optional` y `unicode-range`, `--display`, `--body`, y `.plato text { font-family: var(--sans) }`;
    - `index.html`: precarga de Figtree 400 y 700.
  - Tests primero: los de fuentes de `tests/markup.test.js` (≤ 5 archivos, ≤ 150 KB, OFL presentes, `font-display: optional`, `url()` relativas, sin `http` de fuentes).
  - Hecho cuando:
    - `node --test` en verde;
    - en el MCP no hay peticiones a dominios externos de fuentes;
    - con `*.woff2` bloqueado, la intro y el selector se ven con la fuente de reserva, sin scroll, a 320×568 y 375×667;
    - con las fuentes cargadas, el plató no cambia (comparar capturas);
    - se anotan las versiones y los KB de cada archivo.
  - Hecho (18/10/2026): `node --test` 355/355 en verde (6 tests nuevos de fuentes en `markup.test.js` y 1 de MIME en `serve.test.js`).
    - Origen (descarga autorizada por el usuario): Fontsource **5.3.0** (publicada el 19/07/2026) de las dos familias, `https://cdn.jsdelivr.net/npm/@fontsource/big-shoulders-display@5.3.0/files/big-shoulders-display-latin-{700,800}-normal.woff2` y `https://cdn.jsdelivr.net/npm/@fontsource/figtree@5.3.0/files/figtree-latin-{400,600,700}-normal.woff2`; licencias de `https://raw.githubusercontent.com/google/fonts/main/ofl/{bigshouldersdisplay,figtree}/OFL.txt`.
    - Tamaños (todos con cabecera `wOF2`): Big Shoulders Display 700 = 14 424 B, 800 = 14 556 B; Figtree 400 = 11 384 B, 600 = 11 544 B, 700 = 11 376 B. Total 63 284 B (61,8 KB ≤ 150 KB). OFL: 4 396 B y 4 388 B.
    - `unicode-range`: el subconjunto latino de Fontsource 5.3.0 (U+0000-00FF, U+0131, …, U+FFFD).
    - MCP (375×667 y 320×568): solo peticiones de fuentes a localhost (Figtree 400/700 precargadas y 600 al usarse); sin errores en consola. El plató mantiene `system-ui` con las fuentes cargadas. Con la fuente de reserva forzada (`--body`/`--display` = `var(--sans)`), intro y selector sin scroll (scrollHeight = alto de la vista, sin scroll horizontal).
    - Desviaciones:
      - `body` pasa a `var(--body)` ya en T31 (si no, la precarga de Figtree no se usaba). El resto de reglas que fijan `var(--sans)` (p. ej. `.btn`) se cambian en T32/T34;
      - se actualizan 2 tests de T13 que la spec ya derogó: "no web fonts" (ahora exige `var(--body)` en `body` y sigue prohibiendo `@import`) y "quiz tokens are gone" (sin `--display`, que vuelve según §16.2; `--gold` lo resuelve T32);
      - `scripts/serve.mjs` sirve `.woff2` como `font/woff2` (antes `application/octet-stream`), igual que GitHub Pages;
      - el bloqueo real de `*.woff2` (`Network.setBlockedURLs`) no está disponible en el MCP: se simuló forzando la fuente de reserva. Queda por probar a mano: DevTools → Network → bloquear `*.woff2` → recargar a 320×568 y 375×667.


- [x] **T32. Estilo de la demo: paleta, botones dorados, opciones hexagonales sin letra, títulos y foco.** RF-17, RF-35, RF-92 a RF-97, RF-144, RNF-4
  - Archivos (plan §16.3):
    - `css/survey.css`: paleta, `.btn`, `.btn--secondary`, `:disabled`, opciones con `.option__shape` y `.option__in`, títulos en mayúsculas y foco;
    - `js/app/screens/question.js`: sin `.option__letter`, `aria-label` = etiqueta y la estructura del hexágono;
    - fondo de `body`.
  - Tests primero: `tests/markup.test.js` (sin letra, sin `clip-path` en `.option`, `:focus-visible`, `min-height` ≥ 52, sin degradados ni sombras doradas) y `question-view` sin cambios.
  - Hecho cuando:
    - `node --test` en verde;
    - a 320×568 y 375×667, todas las opciones de las 10 preguntas se ven enteras (≤ 3 líneas, sin recorte en las puntas);
    - la elegida se rellena de dorado con el icono;
    - el foco con Tab se ve entero (≥ 3:1) y es distinto de "elegida";
    - los títulos del selector y del final van en mayúsculas condensadas, y los enunciados en minúsculas normales;
    - el contraste de textos, bordes y botón desactivado está medido;
    - no hay confirmación "final answer".
  - Hecho (18/10/2026): `node --test` 366/366 en verde.
    - Archivos: `css/survey.css` (paleta de §16.3 con `--seg-off: #5c66a6`, fondo de `body` con `--night-2`, `.btn` dorado, `.btn--secondary`, `:disabled`, opciones con `.option__shape`/`.option__in`, títulos en mayúsculas con `--display`, foco claro), `js/app/screens/question.js` (sin `.option__letter`, `aria-label` = etiqueta, hexágono anidado, `.option__tick`), `index.html` ("Back" pasa a `btn btn--secondary`); `tests/markup.test.js`: el bloque de estilo de T13 (§14.3) se sustituye por los tests de §16.3.
    - Tests de T13 sustituidos (los derogó el cambio del 18/10 y §16 sustituye a §14.3): "never all capitals", paleta de §14.3, "quiz tokens" (ahora exige `--gold` y prohíbe `--street`, `--block`, `--window` y `--radius`), foco con `--window`, `.btn--primary` en píldora, `.btn--ghost` y opción elegida con borde cálido.
    - Contraste medido: `--text` sobre `--night` 17,3:1 y sobre `--royal-deep` 16,1:1; `--night` sobre `--gold` 11,1:1; `--muted` 8,0:1; borde dorado 11,1:1; `--seg-off` 3,6:1; "Next" desactivado 3,0:1 (exento; se distingue por opacidad y cursor); `--line` 1,9:1, solo como línea decorativa de "Back" (lo identifica su texto).
    - MCP (375×667 y 320×568, Supabase bloqueado con initScript, sin errores en consola): las 21 opciones de las 10 preguntas caben en ≤ 3 líneas sin recorte en las puntas, también con la fuente de reserva (3 líneas solo Q7-A y Q8-B a 320), con 60 px de alto mínimo; la elegida se rellena de dorado con el icono; el foco con Tab es un contorno claro de 3 px entero y distinto de "elegida"; título del selector, "Leisure for Society" y "Thank you" en mayúsculas condensadas (en una línea con Big Shoulders a 320), enunciados en minúsculas normales; intro y selector sin scroll a 320×568; sin confirmación "final answer".
    - Decisiones no fijadas en el plan:
      - `.btn--primary` se queda en el HTML solo como nombre (el aspecto es de `.btn`), para no tocar los tests de la intro;
      - foco global (`:focus-visible`) también en `--text`; bordes del campo de texto y de las casillas de país en `--muted` (≥ 3:1; `--line` no llega);
      - se quita el punto neón de "Question n of 10" (RF-94 ya no admite neón en el estilo de la encuesta); `--neon` y `--red` siguen solo para la ciudad hasta T33, y la ciudad usa `--lit` donde usaba `--window`;
      - `.final__title` en `--gold`; el brillo de "Give feedback" en la entrada sale de 0 y vuelve a 0 (el botón ya no tiene sombra en reposo);
      - el test de `var(--sans)` exime a `.site-label` (lo cambia T33).
    - Nota: el servidor local manda `Cache-Control: no-store`, así que Big Shoulders (sin precarga) casi nunca llega a tiempo para `optional` en local y se ve la fuente de reserva; se comprobó con un `@font-face` temporal con `block`. En GitHub Pages sí se guarda en caché.

- [x] **T33. Ciudad en rejilla: calles, relleno y farolas generados, iconos en celdas, halo y rótulos dentro de la celda.** RF-69 a RF-72, RF-75, RF-76, RF-78, RF-111 a RF-113, RF-133, RF-140, RF-141, RNF-4
  - Archivos (plan §16.4):
    - `index.html`: viewBox 400×292, recorte y borde, grupos vacíos, 10 iconos redibujados en coordenadas de celda con `.site__ring`, `.city__halos` y `#glow`; fuera la ciudad anterior;
    - `js/app/city.js`: `mountCityGrid` y `paintCity` con halo e `instant`;
    - `js/app/main.js`: monta la rejilla antes de los rótulos;
    - `css/survey.css`: rejilla, halo, rótulos; fuera sombras, verdes, agua y árboles.
  - Tests primero:
    - `tests/city.test.js` ampliado;
    - en `tests/markup.test.js`, quitar los tests de la ciudad anterior y añadir los de la rejilla (plan §16.9).
      - Desviación: 5 de esos tests (rellenos con sombra, zonas verdes y estanque, árboles, bloques de `SITE_LAYOUT` e iconos en la caja absoluta) ya se quitaron en T29, por decisión del usuario. En T33 quedan por quitar los demás de la ciudad anterior (sombras `translate(2.5 3)`, `--fx`, `water-ripple`, etc.).
  - Hecho cuando:
    - `node --test` en verde;
    - a 375×667 y 320×568 se ven la rejilla 6×4, los 14 rellenos apagados y los 10 sitios distinguibles, sin nada fuera del borde;
    - el mapa mide ≤ 40 % del alto (RF-78);
    - cada respuesta enciende su sitio con halo (≤ 900 ms) y su rótulo dentro de la celda;
    - con los 10, `getBBox()` no muestra solapes con otro sitio ni salidas del borde, la letra mide ≥ 8 px a 320 y el contraste es ≥ 4.5:1;
    - en la reanudación, halo y rótulo aparecen sin fundido;
    - el árbol de accesibilidad solo muestra el `aria-label` de la ciudad.
  - Hecho (18/10/2026): `node --test` 377/377 en verde (11 tests nuevos y 12 quitados por obsoletos).
    - Archivos:
      - `index.html`: `#city` con viewBox 400×292 y los grupos de §16.4 (vacíos los generados), 10 halos y 10 sitios redibujados en su celda, coches movidos y sin la ciudad anterior;
      - `js/app/city.js`: `mountCityGrid` y `paintCity` con halos e `instant`;
      - `js/app/main.js`: `mountCityGrid(city)` antes de los rótulos e `instant: shownScreen === null`;
      - `css/survey.css`: sección de la ciudad rehecha, ola provisional con `--fd`, sin estanque ni `car-y-4` antiguo;
      - `scripts/serve.mjs`;
      - tests: `tests/city.test.js` (+7), `tests/markup.test.js` (−12 y +15) y `tests/serve.test.js` (+1).
    - **Desviación aprobada por el usuario (opción a)**: se adelanta de T37 la parte de coches y agua.
      - Los 4 coches pasan a las calles de `STREETS`: y = 76, 146 y 216 en sentidos alternos, y x = 200.
      - Se recalcula `car-y-4` para el borde 292 (192 px al 62,951 %).
      - Los 2 tests de coches se reescriben con `STREETS` y el borde 400×292.
      - Se quitan el bucle del estanque y `.water__ripple` de la lista de bucles vivos, con lo que el mínimo de bucles pasa a ≥ 11.
    - **Cambio aprobado por el usuario**: `scripts/serve.mjs` manda `Cache-Control: public, max-age=31536000` para los `.woff2` (`cacheControlFor`) y `no-store` para lo demás, para que en local se vea Big Shoulders. Va con su test en `tests/serve.test.js`.
    - **Interpretaciones confirmadas por el usuario**:
      - el test de ventanas que titilan y farolas en dos grupos pasa a `tests/city.test.js` con DOM falso;
      - se quitan los tests que §16.9 da por obsoletos: viewBox 400×300, rellenos con `--fx`, mapa 0-400×0-300, recorte 400×300, sombras, caras, verdes y agua, sombra y `.body--top` por sitio, ola con `--fx` y estilo de rótulo de §15.5;
      - hasta T37, la ola usa `var(--fd, 0)` en lugar de `var(--fx)` (la banda sigue barriendo de izquierda a derecha);
      - los rótulos van en `--display` 700, dorados, con trazo `--night` (`paint-order: stroke`) sobre el fondo `rgb(6 10 34 / .8)`, en minúsculas normales;
      - cada sitio tiene `.site__pad`;
      - cada `<g data-site>` va en `translate(celda)` y el icono en `translate(0 2)`;
      - se mantienen las clases `.lt`, `.wheel`, `.lt--pink` y `.lt-stroke--pink`.
    - Detalles no fijados en el plan:
      - edificios encendidos con un tono cálido por edificio (`--wl`, los 7 de la demo, por turnos) y la ventana `.win` como detalle oscuro del tejado, como en la demo;
      - `data-twinkle` en 5 de los 14 bloques (i % 3 = 1), con `--tw` de 0 a 2,8 s;
      - farolas alternas entre `.lamps__a` (27) y `.lamps__b` (26);
      - el anillo interior de calles va en 6,5 con 388 × 282 y rx 8, como la demo;
      - `data-instant` se quita en el segundo `requestAnimationFrame`, porque un callback de rAF corre antes de que se pinte su fotograma;
      - con movimiento reducido, `transition-duration: 0s !important` bajo `data-instant`;
      - tokens nuevos `--road`, `--pad` y `--pad-on` (de la demo), y `--neon` y `--red` se quedan para la ciudad;
      - colores de las luces `lt--green`, `lt--pond`, `lt--violet`, `lt--sand` y `lt--white` (`lt--pond` y no `lt--blue`, por el test de tokens antiguos);
      - test nuevo: en `#city` solo hay `transform="translate(…)"`, para que las cajas que miden los tests sean las reales.
    - MCP Chrome DevTools, en contextos aislados con `fetch` a supabase.co bloqueado por initScript, con el servidor propio en el puerto 8093; 15 y 7 envíos bloqueados y ninguna petición a supabase.co:
      - **375×667**:
        - mapa de 343 × 250,4 (37,5 % del alto);
        - 14 bloques, 48 edificios, 53 farolas y 9 calles;
        - sitios apagados distinguibles;
        - con 9 sitios, 9 halos y 9 rótulos dentro de su celda;
        - final con los 10: `getBBox` sin solapes entre rótulos, con otro sitio ni fuera del mapa;
        - letra de 10,3 px en el final; Big Shoulders cargada.
      - **320×568**:
        - mapa de 288 × 210,2 (37 %);
        - el halo pasa de 0 a 0,99 en unos 820 ms (transición de 900 ms);
        - recarga en la Q5: `data-instant` en los primeros fotogramas, halos y rótulos a opacidad 1 desde el primer fotograma pintado y 0 `transitionrun`;
        - final con los 10, sin solapes y con letra de 8,28 px (preguntas) y 8,74 px (final).
      - Sin scroll horizontal. Consola: solo el aviso conocido "Skippable".
      - Capturas en el scratchpad: `t33-01-q1-375.png`, `t33-02-q10-9lit-375.png`, `t33-03-final-375.png`, `t33-04-q5-resume-320.png` y `t33-05-final-320.png`.

- [x] **T34. Cabecera de progreso, barra de preguntas, anillo y aviso "Lit up".** RF-125 a RF-138, RF-148, RF-77, RNF-4
  - Archivos (plan §16.5):
    - `index.html`: `.hud`, `.city-box`, `.city__toast` y `.segs` en `#city-wrap`;
    - nuevo `js/app/hud.js`;
    - `js/app/main.js`: `prevLit`, `paintHud` y `celebrate` en `update()`;
    - `css/survey.css`.
  - Tests primero: `tests/hud.test.js` (nuevo, DOM falso) y los de cabecera, aviso y barra de `tests/markup.test.js`.
  - Hecho cuando:
    - `node --test` en verde;
    - con el MCP, cada "Next" actualiza el porcentaje, "N of 10 places" y los segmentos en el mismo tick;
    - "Back" a una respondida la marca como actual sin bajar el porcentaje;
    - el anillo dura ≤ 1,2 s y el aviso 1,5 s (abajo, o arriba con Theatre y Food market) sin tapar su sitio ni los controles;
    - un cambio de respuesta, la reanudación y la reapertura no muestran anillo ni aviso, y la Q10 tampoco;
    - el cálculo de RF-132 está medido con `getBoundingClientRect()` a 375×667 (≤ 333 px), y el porcentaje cabe en una línea a 320 px;
    - con movimiento reducido no hay anillo, y aviso y halo se funden en ≤ 200 ms.
  - Hecho (18/10/2026): `node --test` 391/391 en verde (6 tests nuevos en `tests/hud.test.js` y 8 en `tests/markup.test.js`).
    - Archivos:
      - `index.html`: `.hud` (marca, `.hud__pct` y `.hud__count`), `.city-box` con `#city` y `.city__toast`, y `.segs` en `#city-wrap`, todo `aria-hidden` salvo el SVG;
      - `js/app/hud.js` (nuevo): `mountHud`, `paintHud` y `celebrate`;
      - `js/app/main.js`: `prevLit` y `paintProgress`, llamados con cada `paintCity`, en `render()` y en `update()` (mismo tick), y `mountHud` al arrancar;
      - `css/survey.css`: cabecera, barra, aviso, `@keyframes ring` (1,1 s a 1,22) y aviso sin movimiento con movimiento reducido;
      - tests: `tests/hud.test.js` (nuevo) y `tests/markup.test.js`.
    - **Desviaciones aprobadas por el usuario (opción a)**:
      - la regla del 40 % pasa de `.app[data-screen="question"] .city-wrap` a `.city-box`. El test "on questions the city is at most 40 %…" solo cambia de selector y mantiene las comprobaciones. `.city-wrap` pasa a ser una columna con `gap: 8px`;
      - se adelanta de T37 lo mínimo para que el final no se rompa: en el final, los hijos de `#city-wrap` con `align-self: stretch` y `.city-box { flex: 1; min-height: 0; display: flex; justify-content: center }`.
    - Otros cambios en tests: el test de mayúsculas de RF-95 admite `.hud__brand` (además de `.brand`).
    - Decisiones de `hud.js` confirmadas por el usuario:
      - los temporizadores se pueden inyectar;
      - un sitio nuevo sin aviso (Q10 hacia el final) oculta el aviso que siga visible de la Q9;
      - `prevLit = null` marca la primera pintura;
      - `current = survey.current - 1`, y null en el final.
    - MCP Chrome DevTools, en contextos aislados con `fetch` a supabase.co bloqueado por initScript y el servidor propio en el puerto 8094. Ninguna petición a supabase.co.
      - **RF-132 a 375×667**, con `getBoundingClientRect()`:
        - cabecera de 48,6 px (porcentaje 32,4 + texto 16,2), separación de 8, mapa de 343 × 250,4 (37,5 %), separación de 8 y barra de 6;
        - en total, `#city-wrap` mide 321 px ≤ 333 y termina en y = 333.
      - **A 320×568**: 48,6 + 8 + 210,2 + 8 + 6 = 280,8 px. El porcentaje ("90%", 75,5 px de ancho) y "9 of 10 places" caben en una línea cada uno, sin scroll horizontal.
      - **Q1 a Q9**, en las dos medidas:
        - justo tras el clic en "Next", ya han cambiado el porcentaje, "N of 10 places", los segmentos y `is-new`;
        - anillo `ring` de 1100 ms, con `is-new` retirado a unos 1218 ms;
        - aviso oculto a unos 1533 ms;
        - aviso arriba con Theatre y Food market y abajo con el resto, siempre dentro del mapa, sin tapar su sitio ni su rótulo;
        - un "Next" 620 ms después del anterior deja un solo aviso, el nuevo.
      - **Sin anillo ni aviso**:
        - "Back" desde la Q10: 90 % y Q9 rellena y actual;
        - cambio de respuesta en la Q9 y "Next";
        - recarga en la Q10 (`MutationObserver`: ninguna clase `is-new` ni `is-shown`);
        - Q10 → final: "100%", "10 of 10 places" y 10 segmentos sin actual.
      - Consola: solo el aviso conocido "Skippable".
      - Capturas en el scratchpad: `t34-01-q10-375.png`, `t34-02-final-375.png`, `t34-03-q10-toast-320.png` y `t34-04-toast-top-320.png` (esta con el aviso forzado por script para verlo).
      - **Movimiento reducido**: el MCP no lo emula. Lo cubren los tests de CSS (regla global y aviso fijo en `translate(-50%, 0)`).
        - Queda por probar a mano: DevTools → Rendering → `prefers-reduced-motion: reduce` → responder una pregunta. No debe haber anillo, y el aviso y el halo deben fundirse en 200 ms sin subir.

- [x] **T35. Transiciones de 200 + 350 ms con "rise", vuelta arriba y foco sin scroll.** RF-103, RF-104, RF-106, RF-107, RF-108, RF-131, RF-143, RF-146, RF-147, RNF-2, RNF-4
  - Archivos (plan §16.6): `js/app/fade.js` (`rise`) y `js/app/main.js` (`plan.rise`, `scrollTo(0, 0)` y `focus({ preventScroll: true })`).
  - Tests primero: en `tests/markup.test.js`, que `fade.js` solo anime `opacity`/`transform` con `translateY(10px)` como máximo y que `main.js` use `preventScroll`.
  - Hecho cuando:
    - `node --test` en verde;
    - con `getAnimations()`, la salida dura 200 ms y la entrada 350 ms (±20);
    - entre preguntas, la cabecera, la ciudad y la barra no se mueven;
    - del selector a la Q1 entran juntas con "rise", y de la Q10 al final no hay "rise";
    - un doble toque en "Next" avanza 1 y crea un solo payload;
    - en la Q7 o la Q8, con scroll forzado a 320×568, al pulsar "Next" la página vuelve arriba y se ven el halo, el anillo y el aviso, y el foco está en el título;
    - con movimiento reducido hay un solo fundido de ≤ 200 ms, sin `transform`.
  - Hecho (18/10/2026): `node --test` 394/394 en verde (3 tests nuevos en `tests/markup.test.js`).
    - Archivos: `js/app/fade.js` (`fadeIn(elements, ms, { rise = false } = {})` con `translateY(10px)` → `none`; `fadeOut` solo opacidad), `js/app/main.js` (`fadeIn(..., plan.inMs, { rise: plan.rise })`; en `render()`, `window.scrollTo(0, 0)` y después `focus({ preventScroll: true })` del título) y `tests/markup.test.js`.
    - El test de T23 "fade.js ... only opacity" pasa a llamarse "fade.js fades with the Web Animations API and cancels when done" (sigue exigiendo opacidad en los fotogramas simples); el límite de `transform` lo cubre el test nuevo.
    - MCP (servidor propio en 8093, `fetch` a supabase.co bloqueado, 0 peticiones a supabase.co): salida 200 ms y entrada 350 ms; intro → selector y selector → Q1 con "rise" (sección y `#city-wrap` juntos); entre preguntas solo `#screen-question` (`#city-wrap` sin animaciones y en la misma posición); triple toque en "Next" avanza 1 y el contador `seq` sube 1; Q7 → Q8 a 320×568 con scroll forzado (365 px): `scrollY` = 0 al empezar la entrada, foco en el título, aviso "Lit up: Town square" visible y anillo animándose; Q10 → final sin entrada ni "rise"; movimiento reducido (`matchMedia` simulado): solo entradas de 200 ms de opacidad. Consola: solo el aviso conocido "Session History Item Has Been Marked Skippable".
    - Nota: de la Q10 al final `#city-wrap` también se funde en la salida (200 ms), porque `cityMode` cambia de "question" a "final"; ya era así antes de T35 y lo revisa T37/T38.

- [x] **T36. Intro: bombillas en secuencia, recorrido del tablero, marcadores, focos, suelo y cuenta.** RF-8, RF-85, RF-86, RF-87, RF-119 a RF-124, RNF-2
  - Archivos (plan §16.8):
    - `index.html`: `.plato__cell-glow` en las 13 casillas con valor, `.plato__score-glow` y el `<g>` de giro de los focos;
    - `css/survey.css`: `plato-chase`, `plato-cell`, `plato-screen`, el giro de los focos y el suelo;
    - `js/app/screens/intro.js`: la cuenta con `markerCountPlan` y `markerValueAt`, que para en `hide()`.
  - Tests primero: en `tests/markup.test.js`, que el CSS coincida con `INTRO_LOOPS`, 13 resplandores sin las 2 vacías, textos del tablero y marcadores intactos en el HTML (300/500/200), bucles ≥ 1 s y "reduced motion stops".
  - Hecho cuando:
    - `node --test` en verde;
    - con el MCP, a 375×667 y 320×568, los marcadores cuentan de 0 a 300/500/200 antes de 2 s y luego quedan fijos;
    - los bucles nuevos están `running` sin scroll;
    - "Give feedback" a los 1200 ms (con la cuenta a medias) lleva al selector al momento;
    - con movimiento reducido, el plató es estático con 300/500/200.
  - Hecho (18/10/2026): `node --test` 408/408 en verde (9 tests nuevos en `tests/markup.test.js` y 5 en `tests/intro.test.js`, nuevo, con DOM falso).
    - Archivos: `index.html` (13 `.plato__cell-glow` entre cada casilla con valor y su número, con `opacity="0"` y `style="--i:N"`; 3 `.plato__score-glow` entre la pantalla y el marcador; cada `.plato__spot` dentro de un `<g class="plato__swing" style="transform-origin: <cx>px 6px">`; la elipse del suelo con `.plato__floor-light`), `css/survey.css` (`plato-chase` 1,6 s con retrasos 0/0,4/0,8/1,2 s en sentido horario y opacidad 1 → 0,55; `plato-cell` 5,2 s lineal con `calc(var(--i) * 400ms)`, pico 0,35 al 3,8 % y apagado al 7,6 %; `plato-screen` 1,5 s `alternate` 0 → 0,22 con retrasos 0/0,5/1 s; `plato-swing` ±6° 4 s `alternate` con `transform-box: view-box`; `plato-floor` ±4 % 7 s `alternate`; se retira `plato-glow-bulb`), `js/app/screens/intro.js` (`mountIntro` devuelve `{ show, hide }`; reloj y `requestAnimationFrame` inyectables), `js/app/main.js` (`introScreen.show()`/`hide()` en `render()`), `tests/markup.test.js` y `tests/intro.test.js`.
    - Decisión no cubierta por el plan: con movimiento reducido no hay animación de entrada del grupo `people` (la regla global pone `animation: none`), así que `elapsed` es `NaN` y `markerCountPlan` da "skip"; `intro.js` no consulta `matchMedia` (el test de T15 sigue prohibiendo `reducedMotion` en `intro.js`). El desfase del brillo de los focos pasa a `.plato__swing:nth-of-type(2n) .plato__spot`, porque cada foco queda solo en su grupo.
    - MCP (servidor propio en 8136, `fetch` a supabase.co bloqueado): a 375×667 los marcadores pasan a 0/0/0 al cargar, cuentan desde ~1080 ms y quedan en 300/500/200 a los 1867 ms (a 320×568, 1848 ms) y fijos hasta los 11 s; bombillas, 13 resplandores, 3 marcadores, 4 focos y suelo en `running`; sin scroll (máx. `scrollWidth`/`scrollHeight` = 320/568 durante 11 s a 320×568). "Give feedback" a los 1204 ms (marcadores en 60/110/40): vuelven a 300/500/200 en el mismo clic y el selector se ve a los 209 ms (la salida de 200 ms de RF-103). Movimiento reducido (regla `animation: none !important` inyectada antes de los módulos): 0 animaciones, sin cuenta, resplandores a opacidad 0 y 300/500/200. RNF-12: traza de 16,5 s a 375 px sin limitación de CPU, 0 tareas de más de 50 ms (máx. 29 ms en la carga y 5,6 ms con los bucles). Consola: solo el aviso conocido "Session History Item Has Been Marked Skippable".

- [x] **T37. Final en la rejilla: ola desde el centro, farolas, coches en las calles nuevas, bucles vivos y disposición con cabecera y barra.** RF-53, RF-54, RF-56, RF-73, RF-74, RF-79, RF-114 a RF-118, RF-130, RF-140, RNF-2
  - Archivos (plan §16.7):
    - `index.html`: `.city__wave` como círculo con `#wave-ring` y 4 `.car` sobre `STREETS`;
    - `css/survey.css`: `--fd` en lugar de `--fx`, `city-on` para edificios, ventanas, farolas y calles, bucles sin agua, y `#city-wrap` del final con la cabecera y la barra;
    - `js/app/screens/final.js`, si hace falta.
  - Desviación (decisión del usuario en T34, opción a): ya se hizo en T34 lo mínimo para que el final no se rompa (`#city-wrap` en columna, hijos con `align-self: stretch` y `.city-box { flex: 1; min-height: 0 }`). Aquí queda el resto de la disposición: hoy, a 375×667, el mapa queda centrado en una caja de 403 px con huecos arriba y abajo, y la cabecera y la barra van a 8 px del borde de la pantalla.
  - Desviación (decisión del usuario en T33, opción a): los coches ya van sobre `STREETS` con sus tests reescritos, y el agua y su bucle ya no están (mínimo de bucles ≥ 11). Aquí quedan la ola radial, `city-on` con `--fd` (hoy provisional sobre la banda que barre) y la disposición del final.
  - Tests primero: en `tests/markup.test.js`, ola con `scale` y `opacity`, bucles bajo `[data-final-live]` + `[data-all-lit]`, y la disposición del final sin `fixed`.
  - Hecho cuando:
    - `node --test` en verde;
    - con el MCP, la ola sale del centro y enciende relleno, farolas y calles por distancia;
    - `done` llega en ≤ 8 s desde "Next" en la Q10;
    - la cabecera muestra "100%" con 10 segmentos rellenos y sin actual;
    - el mapa entero queda centrado, a ≥ 8 px de los bordes, sin solaparse con la cabecera, la barra, las banderas ni los textos, a 375×667, 320×568 y 430×932;
    - los coches, ventanas, farolas y 3 sitios siguen en bucle a los 20 s;
    - la recarga terminada va directa al estado vivo;
    - con movimiento reducido, el final es estático.
  - Hecho (18/10/2026): `node --test` 413/413 en verde (5 tests nuevos en `tests/markup.test.js`).
    - Archivos:
      - `index.html`: `radialGradient#wave-ring` (transparente hasta 0,8, banda clara de 0,55 en 0,93 y transparente en 1) y `.city__wave` como `<circle cx="200" cy="146" r="266">`; fuera el `linearGradient#wave` y el `rect` que barría;
      - `css/survey.css`: `.city__wave` con `transform-box: fill-box; transform-origin: center`; `@keyframes final-wave` de `scale(0)` a `scale(1)` con opacidad 1 → 0 desde el 85 %, lineal; `city-on` y compañía con `var(--fd)` (sin el `0` provisional); disposición del final rehecha (ver abajo);
      - `js/app/screens/final.js`: solo el comentario de cabecera (`--fx` → `--fd`, ola en anillo);
      - `tests/markup.test.js`: anillo centrado y sincronizado con `--fd`, ola solo con `scale`/`opacity`, encendido por `--fd` de `.win`, `.lamp`, `.filler__b` y `.street`, bucles colgados de `[data-final-live]` + `[data-all-lit]` y nunca de `play`/`done`, y disposición del final.
    - Sincronía de la ola: `r = 266` para que la banda clara (0,93 × 266 = 247,4) llegue a las esquinas (247,6) justo al acabar la fase de 1,4 s, igual que `--fd` = 1. Medido: a 300/700/1100 ms de la ola, banda en 51/121/193 y farolas encendidas (opacidad > 0,5) hasta 35/105/175 de distancia, con las apagadas desde 64/119 (el retraso de ~150 ms es la mitad del fundido `city-on` de 300 ms).
    - **Decisión no fijada en el plan (disposición, RF-79/RF-130)**: con `.city-box { flex: 1 }` (§16.7) la caja medía 403 px de alto para un mapa de 262 y dejaba huecos entre la cabecera, el mapa y la barra. Ahora `#city-wrap` del final es `container-type: size`, y sus 3 hijos (cabecera, caja y barra) van con `flex: none` y un mismo ancho `min(100cqw, (100cqh - 74px) * 400 / 292)` (74 = cabecera de 52 como máximo + 8 + 8 + barra de 6); la caja lleva `aspect-ratio: 400 / 292`, así que mide justo lo que el mapa. El grupo queda junto y centrado en vertical y horizontal; la cabecera y la barra se alinean con los bordes del mapa (a 8 px de la pantalla cuando el mapa usa todo el ancho). Se quita la regla de T34 `.city-wrap > * { align-self: stretch }` y `.city-box` deja `flex: 1`.
    - **Q10 → final y el fundido de `#city-wrap` (pendiente de T35)**: se mantiene. No choca con RF-143: la ciudad se funde en la salida junto con la pregunta (200 ms, `cityFades` porque cambia el modo de la ciudad, plan §15.3), y el final aparece sin entrada ni "rise", con el mapa ya en su tamaño (sin animar el cambio), y su llegada es la ola (RF-53). Alternativa, si se prefiere: no fundir la ciudad hacia el final (`cityFades` falso cuando `next` es el final), que cambiaría `transition.js` y su test.
    - MCP Chrome DevTools, contexto aislado, servidor propio en 8137 y `fetch` a supabase.co bloqueado por initScript (ninguna petición a supabase.co en la red):
      - **375×667**: Q10 → `done` en 7434, 7461 y 7455 ms (≤ 8000); `#city-wrap` con un fundido de salida de 200 ms; cabecera "100%", "10 of 10 places", 10 segmentos rellenos y 0 actuales; cabecera de 359×48,6 en y 78,7, mapa 359×262,1 (y 135,3), barra en y 405,4, panel desde y 490,1; sin solapes ni scroll (375×667).
      - **320×568** (recarga terminada): cabecera 304×48,6 en y 51,2, mapa 304×221,9 (≥ 288×210,2 de las preguntas), barra en y 337,7, panel desde y 394,9; sin scroll. Sin animaciones de llegada (`animationstart` sin `final-wave`, `city-on` ni confeti), `data-final="done"` y los 9 bucles en marcha.
      - **430×932**: mapa 414×302,2 centrado (cabecera en y 189,1, barra en 555,9, panel desde 751,1), sin scroll.
      - A los 37 s de la recarga, `city-twinkle` (5), `city-lamps` (2), `site-wheel`, `site-neon` (7), `site-flood` (6) y los 4 coches siguen `running` con iteraciones infinitas.
      - Movimiento reducido (`matchMedia` simulado y regla `animation: none !important` inyectada), 320×568: Q10 → `done` sin animaciones, ciudad entera encendida, farolas a opacidad 1, ola en `display: none` y la misma disposición.
      - RNF-12: traza de unos 10,7 s a 375 px sin limitación de CPU durante Q10 → final y los bucles: 0 tareas de más de 50 ms (máx. 15,2 ms); `PerformanceObserver` de `longtask`: ninguna.
      - Consola: sin mensajes.
      - Capturas en el scratchpad: `t37-01-final-375.png`, `t37-02-final-reload-320.png` y `t37-03-wave-320.png` (ola en pausa a ~750 ms).
  - **Corrección tras la validación (18/10/2026, reviewer: CAMBIOS NECESARIOS)**: las farolas no se veían durante las preguntas (`.lamp` a opacidad 0), contra RF-140 ("apagadas", no ocultas) y el Anexo C. Ahora `mountCityGrid` dibuja en `.city__lamps` primero un `<g class="lamps__off">` con un `.lamp-off` (r 1,4, `fill: #1c2670`, el tono apagado de la demo, sin animación) en cada punto de `lampPoints()`, y encima `.lamps__a`/`.lamps__b` con las `.lamp` encendidas de antes, que siguen a opacidad 0 hasta `#city[data-all-lit]` y entran con la ola (`city-on`, solo opacidad). Así no se anima `fill` (RNF-12) y el bucle `city-lamps`, la recarga terminada y el movimiento reducido no cambian.
    - **Decisión no fijada en el plan**: capa apagada aparte en lugar de animar `fill` de `.lamp` (como `city-building-on`), para animar solo opacidad.
    - Tests: `tests/city.test.js` (nuevo: farola apagada en cada punto, primera en el grupo; `city__lamps` con 3 hijos) y `tests/markup.test.js` (nuevo: `.lamp-off` visible con `#1c2670`, nunca oculta ni animada; `.lamp` con `fill: var(--lit)` y `transition: opacity`). `node --test` 416/416.
    - MCP, contexto aislado, servidor propio en 8137 y `fetch` a supabase.co bloqueado: en Q1 a 375×667 y 320×568, 53 `.lamp-off` visibles (opacidad 1, `rgb(28, 38, 112)`) y `.lamp` a 0, sin scroll horizontal; ola a 375×667: la farola del centro llega a 1 a ~500 ms y la más lejana (`--fd` 0,705) a ~1500 ms, con la capa apagada siempre a 1; `done` a ~7,5 s; recarga terminada: `.lamp` a 1 sin animaciones propias y `city-lamps` en marcha en `.lamps__a/b`. Consola: solo el aviso conocido "Session History Item Has Been Marked Skippable".

- [x] **T38. Validación completa del cambio.** Todos los RF y RNF del cambio (plan §16), RNF-1, RNF-5, RNF-9, RNF-12
  - Archivos: ninguno, salvo las correcciones que salgan.
  - Hecho cuando:
    - `node --test` en verde;
    - flujo completo a 375×667 y 320×568: intro → país → 10 preguntas (con Back, atrás del sistema, doble toque, cambio de respuesta, AO, AP y una pregunta con scroll) → final;
      - también con movimiento reducido, sin red y con las fuentes bloqueadas;
      - sin scroll horizontal y con la consola limpia;
    - RNF-12 medido como en plan §16.10: 0 tareas > 50 ms;
    - "Give feedback" pulsable en < 3 s con Fast 4G, sin caché y con las fuentes;
    - recarga a mitad (sitios en sus celdas nuevas) y recarga terminada;
    - revisión RF por RF del cambio con VEREDICTO: APROBADO.
  - La actualización de MEMORY.md y AGENTS.md (plan §16.12) y el paso de la spec a "implementada" quedan para el cierre, después del APROBADO.
  - Hecho (18/10/2026): `node --test` 414/414 en verde (1 test nuevo y 2 ajustados en `tests/markup.test.js`).
    - Archivos:
      - `tests/markup.test.js`: el test del panel del final (T26, línea ~999) tenía un byte 0x08 en lugar de `\b` en `/\b(bottom|left|right|inset)\s*:/`, así que nunca podía fallar; corregido y en verde. Test nuevo de RF-95 (texto literal para el lector) y el de "Thank you" de T18 adaptado;
      - `index.html`: `aria-label` con el texto literal en los `h1` "Where are you from?" y "Leisure for Society", y "Thank you" como `<span aria-hidden="true">` visible más una copia `.visually-hidden`;
      - `css/survey.css`: `.visually-hidden { text-transform: none }` y el comentario de `.final__title` corregido (en una línea con Big Shoulders; con la fuente de reserva puede ocupar 2).
    - **Decisión del usuario (opción b)**: Chrome pasa al árbol de accesibilidad el texto ya en mayúsculas (`text-transform`), y RF-95 pide que el lector lea el texto tal cual. Tras el cambio, el snapshot muestra `heading "Where are you from?"`, `heading "Leisure for Society"`, `StaticText "Thank you"` y las regiones con esos nombres. El aspecto no cambia: mismas cajas a 320×568 (título 461-485, "Thank you" 489-517, panel 395-552) y a 375×667 ("Thank you" 588-616), en mayúsculas, y la llegada del final sigue terminando en `done` (7536 ms).
    - MCP Chrome DevTools, servidor propio en 8138 y `fetch` a supabase.co bloqueado por initScript (ninguna petición a supabase.co):
      - **375×667** (Netherlands) y **320×568** (Other): flujo completo con Back, atrás del sistema, cuádruple toque en "Next" (avanza 1, `seq` +1), cambio de respuesta (sin anillo, aviso ni subida del porcentaje), AO con solo espacios ("Next" desactivado) y pegado de 300 (contador 0), AP vacía, y Q7 con scroll forzado (vuelve a 0, foco en el título, anillo y aviso a la vista). Transiciones de 200/350 con "rise"; del selector a la Q1 entran juntos la sección y `#city-wrap`. Q10 → final sin anillo ni aviso, `done` en 7,4-7,6 s; sin solapes ni scroll horizontal. Recarga a mitad (Q7, 320): sitios en sus celdas de `SITE_CELLS`, halos a 1 desde el principio, 0 `transitionrun`, sin anillo ni aviso. Recarga terminada: directa a `done`, sin ola ni confeti.
      - Movimiento reducido (simulado: `matchMedia` falseado y la hoja real con el bloque `reduce` aplicado y `no-preference` anulado): intro sin animaciones y con 300/500/200; solo fundidos de opacidad de 200 ms sin `transform`; sin anillo; final estático.
      - Sin red (emulación "Offline" del MCP, a 500 px porque emular el móvil recarga la página): flujo completo, aviso offline en preguntas y final, estado `completed` con `p_seq` 11 en la cola; al volver la red se reintenta al momento. Consola: solo `ERR_INTERNET_DISCONNECTED`.
      - Fuentes bloqueadas (simulado con un 404 real de los 5 woff2 y de las precargas): intro y selector sin scroll a 320 y 375, RF-132 = 321 px a 375, opciones ≤ 3 líneas, 10 rótulos sin solapes a 8,74 px, y "Leisure for Society" en 2 líneas sin solapes.
      - Fast 4G en un contexto nuevo (sin caché): primer pintado a 540 ms, "Give feedback" pulsable a 1439 ms.
      - RNF-12 (375 px, sin limitar la CPU): trazas de la intro (entrada + ~11 s de bucles) y del flujo (9 encendidos, ola y 10 s del final vivo) con 0 tareas > 50 ms (máx. 31,5 y 19,9 ms); `longtask`: ninguna.
      - Consola: solo el aviso conocido "Skippable" y los errores de red esperados.
    - Puntos revisados: el panel del final aparece con el giro de las banderas a propósito (RF-53: los textos siguen saliendo tras el destello); el fundido de salida de 200 ms de `#city-wrap` de la Q10 al final es compatible con RF-143 (sin entrada ni "rise" y el mapa ya en su tamaño).
    - Queda por probar a mano: DevTools → Network → bloquear `*.woff2`; Rendering → `prefers-reduced-motion: reduce`; Network → Disable cache + Fast 4G; y, con una fila de prueba que luego se borra, que tras volver la red queda una sola fila en la base de datos.
  - Revisión del reviewer (18/10/2026): **VEREDICTO: APROBADO** tras la corrección de RF-140 (farolas apagadas visibles en `.lamps__off`), `node --test` 416/416. Cierre: spec marcada como implementada, MEMORY.md y AGENTS.md actualizados (plan §16.12).

## Cambio de requisitos 2026-10-19 (plan §17)
Intro legible y Q3 de opción múltiple. La parte del panel son las tareas T11-T13 de `specs/002-admin/tasks.md` (plan 002 §11).

Cómo se trabaja:
- una tarea cada vez, con los tests primero (en rojo), después el código y luego en verde;
- validación visual con el MCP Chrome DevTools en un contexto aislado, con `supabase.co` bloqueado por initScript hasta T45;
- **ningún commit ni push hasta T45**, y T45 solo después de T42;
- ningún agente usa la clave service_role; la migración la aplica el usuario.

**Orden de ejecución**: T39 → T40 → T41 → T43 → T44 → T44b → T44c → (002) T11 → T12 → T13 → T45. **T42 [USUARIO]** se puede hacer en cuanto esté T41 y bloquea solo T45.

- [x] **T39. Lógica: `choice.js`, contenido de Q3 y versión nueva, validación.** RF-4, RF-154, RF-161, RF-164, RF-166, RNF-7
  - Archivos (plan §17.2):
    - nuevo `js/lib/choice.js` (`MULTI_VALUES`, `isMultiple`, `lettersOf`, `toggleLetter`);
    - `js/content.js` (`version: "2026-10-live-2"`, Q3 con `multiple: true`);
    - `js/lib/content-validate.js` (reglas de opción múltiple).
  - Tests primero: `tests/choice.test.js` (nuevo) y `tests/content.test.js` ampliado (plan §17.8).
  - Hecho cuando:
    - `node --test` en verde;
    - `choice.js` no usa DOM, red ni reloj;
    - un contenido con Q1 `multiple: true`, o con Q3 sin `multiple`, da el error correspondiente.

- [x] **T40. Lógica: Q3 en el estado de la encuesta, vuelta a lo guardado (RF-169) y vista de la pregunta.** RF-17, RF-19, RF-20, RF-23, RF-26, RF-155 a RF-163, RF-169, RNF-7
  - Archivos:
    - `js/lib/survey-state.js` (`selectOption`, `fieldFor`/`canGoNext` para multi, `settle`, `back`/`systemBack` con `content`, `resumeState`);
    - `js/lib/question-view.js` (`multiple`, `hint`, `checkedLetters`);
    - `js/app/main.js` (solo pasar `CONTENT` a `back` y `systemBack`).
  - Tests primero: `tests/survey-state.test.js`, `tests/question-view.test.js` y `tests/payload.test.js` ampliados (plan §17.8), incluidos los 4 casos de RF-169 y que `back` sin `content` se comporta como hoy.
  - Hecho cuando:
    - `node --test` en verde, y los tests anteriores de Q1-Q10 de respuesta única siguen en verde sin cambios;
    - Q3 "AC" llega tal cual al envío;
    - con Q3 respondida, todo desmarcado y Back, el borrador vuelve a lo guardado.
  - Hecho (19/10/2026): `node --test` 625/625 en verde (26 tests nuevos: 21 en `tests/survey-state.test.js`, 4 en `tests/question-view.test.js` y 1 en `tests/payload.test.js`).
    - Nota: 2 tests antiguos describían Q3 como de respuesta única (RF-19 anterior al cambio) y se adaptaron: el de `survey-state` ahora comprueba que A y luego C dan "AC", y el de `question-view` usa Q1 (Q3 era la única pregunta con 3 opciones).
    - Nota: el campo visible sale de `currentField(state, content)` (nuevo en `survey-state.js`); `fieldFor(option)` no cambia. `next` guarda las letras de Q3 reordenadas A, B, C aunque el borrador llegue desordenado. `question-view.js` exporta `MULTIPLE_HINT`.
    - Nota: hasta T43, `js/app/screens/question.js` pinta la marca con `checkedLetter`, que en Q3 vale `null`: en el navegador Q3 no muestra aún las opciones marcadas.

- [x] **T41. Base de datos: migración 002, comprobación y guía.** RF-37, RF-62, RF-164, RF-165
  - Archivos (plan §17.4, §17.5, §17.7):
    - nuevo `supabase/migrations/002_q3_multiple.sql`;
    - `supabase/migrations/001_survey.sql` (solo el comentario de orden en la cabecera);
    - `scripts/check-db.mjs` (casos de Q3);
    - `docs/supabase.md` (§2 orden de migraciones, §2.1 pasos del cambio de Q3, §6 filas de "2026-10-live-1").
  - Tests primero: `tests/migration.test.js` ampliado con la 002 (plan §17.8).
  - Hecho cuando:
    - `node --test` en verde;
    - la 002 no contiene ninguna clave, `grant` a tablas ni `disable row level security`;
    - se puede ejecutar dos veces seguidas: la segunda avisa "q3 constraints dropped: 0" y deja la misma regla;
    - la guía tiene los pasos del usuario en orden, con las consultas de solo lectura de antes y de después.
  - Hecho (19/10/2026): `node --test` 633/633 en verde (8 tests nuevos en `tests/migration.test.js`, que comprueban además que el cuerpo de `save_response` en la 002 es el de la 001 salvo la regla de la opción). La migración NO se ha ejecutado (T42, del usuario); sin Postgres local, el SQL se revisó a mano.
    - Nota: la consulta de solo lectura filtra por `ilike '%q3_option%'` (la misma condición que usa la 002), no por `'%q3%'` como en plan §17.4: esa también encuentra la regla de longitud de `q3_text` y daría 2 filas.
    - Nota: además del `raise notice`, la 002 termina con un `select` (columnas `result` y `q3_option_rules`), porque el SQL Editor muestra el último resultado y no siempre los avisos. El número pasa del bloque `do` al `select` con `set_config('leisure_city.q3_dropped', …)`.
    - Nota: `docs/supabase.md` §6 tiene un punto nuevo (3) para borrar las filas de "2026-10-live-1"; los siguientes se renumeran.

- [x] **T42. [USUARIO] Aplicar la migración 002 en el SQL Editor de Supabase y comprobarla.** RF-62, RF-164, RF-165
  - Acción del usuario, con `docs/supabase.md` §2.1. El coordinador puede acompañarle en el navegador integrado, pero **la ejecución es del usuario** en su sesión del panel de Supabase; ningún agente usa la clave service_role.
    - [x] (a) ejecutar la consulta de solo lectura del nombre de la regla de q3, que debe dar 1 fila, y anotar aquí el nombre;
    - [x] (b) pegar `002_q3_multiple.sql` entero y pulsar Run; debe aparecer el aviso "q3 constraints dropped: 1" y ningún error;
    - [x] (c) repetir la consulta: solo queda `responses_q3_option_multi_check` con los 7 valores;
    - [x] (d) `node scripts/check-db.mjs` (lo puede lanzar un agente: solo usa la clave pública) con todos los casos en PASS, también los nuevos de Q3;
    - [x] (e) borrar las filas `dbcheck…` (guía, paso 6).
  - Si (a) no da exactamente 1 fila, o (b) da error: parar y avisar (no se improvisa SQL).
  - Bloquea: T45 (push). No bloquea T43, T44 ni T11-T13.
  - Hecho cuando: el usuario confirma (b) y (c), y (d) está en verde.
  - Estado 2026-10-20 (con el usuario):
    - (a) la consulta de solo lectura da 1 fila, que ya es `responses_q3_option_multi_check`, con `CHECK ((q3_option = ANY (ARRAY['A','B','C','AB','AC','BC','ABC'])))`. La 002 ya se había aplicado en una sesión anterior y no se anotó el nombre de la regla antigua. No se volvió a ejecutar (es idempotente y no hacía falta).
    - (b) y (c): cumplidas por ese resultado.
    - (d) `node scripts/check-db.mjs`: 50/50 PASS, incluidos los casos RF-164 y RF-62 de Q3.
    - (e) el usuario borró a mano las 65 filas `dbcheck…` (24 completed y 41 in_progress) el 2026-10-20. Una consulta de recuento posterior da 0 filas `dbcheck…`; quedan live-1: 3, live-2: 1, test-1: 15 y test-2: 11.
  - Hecho (20/10/2026): (a)-(e) cumplidos; T42 cerrada. Ya no bloquea T45.

- [x] **T43. Interfaz de Q3: grupo de casillas, aviso "Choose one or more" y teclado.** RF-17, RF-96, RF-155 a RF-159, RF-169, RNF-4
  - Archivos (plan §17.3):
    - `index.html` (`#question-hint`);
    - `js/app/screens/question.js` (rol del grupo y de las opciones, `aria-describedby`, tabIndex, `boxIcon`);
    - `css/survey.css` (`.question__hint`, `.option__box` en los dos estados).
  - Tests primero: `tests/markup.test.js` (`#question-hint` con `aria-hidden`), y los de lógica de T40.
  - Hecho cuando:
    - `node --test` en verde;
    - en Chrome DevTools a 375×667 y 320×568 (con `supabase.co` bloqueado):
      - Q3 muestra el aviso y casillas vacías;
      - marca y desmarca 1, 2 y 3 opciones;
      - "Next" desactivado con 0 marcadas;
      - un solo campo "Want to tell us why?", que desaparece con 0 y vuelve con su texto;
      - Back y recarga conservan lo marcado;
      - Q3 respondida, todo desmarcado y Back: al volver, lo guardado;
      - el museo es el único sitio que se enciende;
      - Q1 y Q4 siguen como antes;
    - en el árbol de accesibilidad: `group` con descripción "Choose one or more" (leída una vez), `checkbox` marcados o sin marcar en Q3 y `radio` en las demás;
    - teclado: Tab recorre las 3 opciones, Espacio e Intro marcan, y el foco no se mueve;
    - contraste de la casilla ≥ 3:1 en los dos estados (medido);
    - consola limpia.
  - Hecho (19/10/2026): `node --test` 637/637 en verde (4 tests nuevos en `tests/markup.test.js`). Comprobado en Chrome DevTools (servidor propio en 8093, `fetch` a supabase.co bloqueado por initScript, 0 peticiones reales) a 375×667 y 320×568: aviso y casillas vacías; marcar C y luego A da "AC"; 1, 2 y 3 marcadas; con 0 marcadas "Next" desactivado y campo oculto con el texto conservado, que vuelve al marcar; Next con "AB" enciende solo el museo; Q4 vuelve a `radiogroup`/`radio` con roving y flechas; Back conserva lo marcado y el texto; RF-169 con Back y con recarga vuelve a "AB"; cambio a "ABC" y Next sustituye la respuesta. Árbol: `group` con description "Choose one or more" y el párrafo `ignored`; `checkbox` en Q3. Teclado: Tab pasa de A a B, Espacio marca, Intro desmarca, la flecha no hace nada y el foco no se mueve. Contraste medido: casilla sin marcar 16,1:1, marcada 11,1:1; aviso 15 px a 8,0:1. Sin scroll horizontal. Consola sin errores (solo el aviso de Chrome "Session History Item Has Been Marked Skippable").
    - Nota: el cuadrado es un `span` con borde CSS (20×20, 2 px, radio 3 px) y solo la marca es SVG; el plan hablaba de "un cuadrado SVG". Así el color del borde y del relleno se comprueban como reglas CSS en los tests.
    - Nota: `.question__hint` lleva `margin: -8px 0 8px` (el plan dice margen inferior de 8 px) para que el aviso quede pegado al enunciado, cuyo margen inferior es de 16 px.
    - Nota: la "recarga" se hizo navegando a about:blank y volviendo con el initScript, no con reload (que lo perdería).

- [x] **T44. Intro: textos grandes sobre el plató, con panel.** RF-80, RF-88, RF-121, RF-123, RF-149 a RF-153, RF-167, RF-168, RNF-4, RNF-12
  - Archivos (plan §17.6):
    - `index.html` (`.intro__scene` y `.intro__panel`);
    - `css/survey.css` (`--stage-w`, rejilla, panel, tipografía, entrada del panel; se quita el `flex` del plató de §14.4).
  - Tests primero: `tests/markup.test.js` (estructura y CSS de la intro, plan §17.8); `tests/intro.test.js` y `tests/intro-entry.test.js` siguen en verde.
  - Hecho cuando:
    - `node --test` en verde;
    - en Chrome DevTools, con fuentes y con las fuentes bloqueadas, a 320×568, 375×667, 375×568 y 430×568:
      - sin scroll;
      - el panel empieza bajo el tablero y queda a ≥ 8 px de los lados;
      - riel, cartel y tablero enteros a la vista;
      - botón igual que antes, debajo;
      - tamaños calculados 22 (o 20) y 18 px;
      - cajas reales anotadas junto a la tabla de plan §17.6;
    - contraste medido ≥ 4.5:1 en los dos textos sobre lo más claro que pasa por detrás tras la aparición: foco, haz, ámbar y realce del botón;
    - entrada en el orden de RF-98 y estática con movimiento reducido (simulado como en T38);
    - marcadores y su cuenta comprobados con el panel oculto en DevTools;
    - RNF-12 sin tareas > 50 ms con el panel puesto;
    - "Give feedback" pulsable desde el principio;
    - consola limpia.
  - Hecho (19/10/2026): `node --test` 643/643 en verde (6 tests nuevos en `tests/markup.test.js`). Comprobado en Chrome DevTools (servidor propio en 8094, `fetch` a supabase.co bloqueado por initScript, 0 peticiones bloqueadas: la intro no llama a Supabase).
    - Cajas reales (px CSS; fuentes simuladas sustituyendo `--body` por `--sans`: mismas cajas y líneas que con Figtree):

      | Pantalla | `--stage-w` | Plató (alto) | Panel (arriba / alto) | Panel − fin del tablero | Panel bajo el plató | Panel → botón | Scroll |
      |---|---|---|---|---|---|---|---|
      | 320×568 | 288 | 384 | 264,3 / 182,8 (RF-81 en 4 líneas a 20 px, RF-82 en 2 a 18 px) | +1,0 | +6,1 (paso 1 de RF-168) | 12 | no |
      | 375×667 | 343 | 457,3 | 319,8 / 164,6 (3 + 2 líneas, 22 y 18 px) | +1,1 | −45,8 (dentro) | 57,8 | no |
      | 375×568 | 343 | 457,3 | 270,3 / 164,6 | +1,1 | −45,8 | 57,8 | no |
      | 430×568 | 354 (por alto) | 472 | 270,9 / 164,6 | +1,2 | −52,6 | 64,6 | no |
      | 320×480 (regla < 568) | 225 | 300 | 178 / 232,2 | +0,8 | +94,2 | 12 | 10 px vertical (permitido) |
    - Panel a 8 px de cada lado del plató en todas; riel, cartel y tablero enteros por encima del panel; botón igual (52 px, Figtree 700 16,8 px, dorado, radio 12), debajo.
    - Contraste medido en capturas a 2x con los textos transparentes, píxel más claro dentro de la caja de cada texto, varias fases del bucle y el realce del botón congelado en su pico: RF-81 ≥ 11,66:1 y RF-82 ≥ 5,40:1 (peor caso = panel sobre blanco, 43,47,67); a 320×568 el realce queda detrás del panel (no aparece dorado).
    - Entrada (rAF, opacidad ≥ 0,5): luces 219 ms, cartel 385, tablero 621, On air 816, suelo 955, personas 1170, panel 1385, RF-82 1538; marcadores cuentan de 0/0/0 a 300/500/200; botón opaco y habilitado desde el primer fotograma. Marcadores con el panel oculto: 3 `plato-screen` de 1,5 s infinitos y 300/500/200.
    - Movimiento reducido simulado (`matchMedia` + `animation: none !important` inyectados antes del primer pintado): panel y RF-82 a opacidad 1 sin transformación desde el primer fotograma, ninguna animación, marcadores fijos.
    - RNF-12 (375×667, sin limitar CPU, entrada + ~10 s de bucles con el panel): 0 tareas > 50 ms (máx. 37,3 ms); `longtask`: ninguna.
    - Árbol de accesibilidad: título, RF-81, RF-82 y botón, en ese orden, una vez. Consola: solo el aviso "Skippable". Capturas en el scratchpad de la sesión.
    - Nota: el test anterior de la entrada de los textos (T38) apuntaba a `.intro__thanks`; ahora apunta a `.intro__panel`, como manda plan §17.6 (el texto RF-81 entra con su panel).
    - Nota: `.intro__panel` lleva `position: relative; z-index: 1` (no está en el plan) para pintarse encima del realce del botón, que si no se dibujaría sobre el fondo del panel; `.intro__scene` fija la primera fila de la rejilla al alto del plató, para que el exceso del panel vaya a la segunda; `@supports not (height: 100dvh)` da la misma `--stage-w` con `vh`.

- [x] **T44b. Intro: panel alto en el plató (RF-81 arriba, RF-82 abajo, cerca del botón).** RF-80, RF-84, RF-88, RF-120, RF-121, RF-123, RF-150, RF-151, RF-167, RF-168, RNF-12 — ajuste 2026-10-19 aprobado por el usuario ("Osea yo haría el recuadro un poco más grande el texto blanco más arriba y el texto más gris si tiene que estar cerca del botón sabes"; duda 61 resuelta)
  - Archivos (plan §17.12): solo `css/survey.css`:
    - `.intro__panel`: `margin` (3/8 + 4px) 8px 0, `min-height` 23/24 − 12px, `box-sizing: border-box`, `padding: 16px 14px`, flex en columna con `space-between`;
    - fuera el `margin-top` 0,72;
    - comentario del bloque actualizado.
    - `index.html` no cambia.
  - Tests primero (en rojo): `tests/markup.test.js` según plan §17.12 (reglas CSS y la regla `max(A, Pmin)` con las 5 filas de la tabla); `tests/intro.test.js` y `tests/intro-entry.test.js` siguen en verde.
  - Hecho cuando:
    - `node --test` en verde;
    - en Chrome DevTools (servidor propio, `supabase.co` bloqueado por initScript), con fuentes y con las fuentes bloqueadas o simuladas, a 320×568, 375×667, 375×568 y 430×568:
      - cajas anotadas junto a la tabla de plan §17.12: plató, fila de categorías, panel, RF-81, RF-82 y botón;
      - borde superior del panel a 4 px (±1) bajo la fila de categorías;
      - borde inferior a 8 px (±1) sobre el fondo del plató (20 px hasta el botón);
      - RF-81 a 16 px (±1) del borde superior del panel y RF-82 a 16 px (±1) del inferior, con ≥ 8 px entre ellos;
      - riel, cartel y fila de categorías enteros a la vista; panel a ≥ 8 px de cada lado; sin scroll; botón igual que antes, 12 px bajo el plató;
      - 320×480: el panel crece por debajo del plató, baja el botón y se permite scroll vertical (RF-168);
    - contraste medido ≥ 4.5:1 en RF-81 y RF-82 tras la aparición, en las 4 pantallas, sobre:
      - el realce blanco de una casilla del tablero en su pico;
      - los números ámbar, el haz y los marcadores;
      - el realce dorado del botón en su pico, detrás de RF-82;
    - filas del tablero, atriles y marcadores (tapados) comprobados con el panel oculto: el recorrido de RF-120, el bucle de RF-121 y la cuenta de RF-123 siguen;
    - entrada en el orden de RF-98, estática con movimiento reducido (simulado como en T44), sin saltos del panel (RF-102);
    - RNF-12 sin tareas > 50 ms; "Give feedback" pulsable desde el principio; consola limpia;
    - captura a 375×667 y a 320×568 en el scratchpad, para enseñársela al usuario.
  - Hecho (19/10/2026): `node --test` 662/662 en verde (en `tests/markup.test.js` el test del `margin-top` 0,72 se sustituye por 3 tests: márgenes, `min-height` y `box-sizing`; relleno y flex; regla `max(A, Pmin)` con las 5 filas, constantes leídas del CSS). Comprobado en Chrome DevTools (servidor propio en 8096, `fetch` a supabase.co bloqueado por initScript, 0 peticiones bloqueadas).
    - Cajas reales (px CSS desde el borde superior del plató; iguales a la tabla de plan §17.12):

      | Pantalla | `--stage-w` | Plató H | Fin categorías | Panel (arriba-abajo) | Panel → fondo plató | Panel → botón | RF-81 (líneas) | RF-82 (líneas) | Hueco | Scroll |
      |---|---|---|---|---|---|---|---|---|---|---|
      | 320×568 | 288 | 384 | 108 | 112-376 | 8 | 20 | 128-232 (4, 20 px) | 313,2-360 (2) | 81,2 | no |
      | 375×667 | 343 | 457,3 | 128,6 | 132,6-449,3 | 8 | 20 | 148,6-234,4 (3, 22 px) | 386,5-433,3 (2) | 152,1 | no |
      | 375×568 | 343 | 457,3 | 128,6 | 132,6-449,3 | 8 | 20 | igual | igual | 152,1 | no |
      | 430×568 | 354 | 472 | 132,8 | 136,8-464 | 8 | 20 | 152,8-238,5 (3) | 401,2-448 (2) | 162,7 | no |
      | 320×480 | 225 | 300 | 84,4 | 88,4-328,5 (sale 28,6) | −28,6 | 12 | 104,4-234,4 (5) | 242,4-312,5 (3) | 8 | 0 px (permitido, no hace falta) |
    - En todas: panel a 4,0 px de las categorías, 8 px a cada lado, RF-81 a 16 px del borde superior y RF-82 a 16 px del inferior; botón 52 px, Figtree 700 16,8 px, 12 px bajo el plató (a 320×480, 40,5 px, bajado por el panel).
    - Fuente de reserva (forzada con `!important` en los dos textos): system-ui/Segoe UI y Arial dan las mismas líneas que Figtree; Verdana (+1 línea en RF-81) deja el hueco en 55,2 px a 320×568, 123,5 a 375×568 y 134,1 a 430×568; el panel no cambia de tamaño y no hay scroll.
    - Contraste (capturas a 2x con los textos transparentes, píxel más claro dentro de la caja de cada texto, todo en el peor caso a la vez: las 13 casillas con el realce blanco a opacidad 1 (pico real 0,35), los marcadores a opacidad 1 (pico real 0,22), focos, "On air" y bombillas a 1, halos rojos y el realce dorado del botón congelado en su pico): RF-81 11,66:1 en las 4 pantallas (y a 320×480); RF-82 5,40:1 a 320×568 y 375×667, 5,37:1 a 375×568 y 430×568. La franja de 20 px del panel por la que entra el halo dorado da ≥ 5,31:1 con el color de RF-82.
    - Panel oculto (430×568): las 13 casillas con `plato-cell` 5,2 s infinito, los 3 `plato-screen` de 1,5 s infinitos y la cuenta 0/0/0 → 300/500/200 terminada a 1846 ms.
    - Entrada (rAF, opacidad ≥ 0,5): panel ~1380 ms y RF-82 ~1545 ms en las 4 pantallas; el alto y la posición del panel no cambian en ningún fotograma (solo el `translateY` de 6 px de la entrada). Movimiento reducido simulado (`matchMedia` + `animation: none !important` antes del primer pintado): panel y RF-82 a opacidad 1 sin transformación desde el primer fotograma, 0 animaciones, marcadores en 300/500/200.
    - RNF-12 (375×667, sin limitar CPU, entrada + ~11 s de bucles): 0 `longtask`, ningún fotograma > 50 ms (máx. 21,1 ms). "Give feedback" opaco, habilitado y es el elemento pulsado en su centro desde el primer fotograma (10 ms).
    - Árbol de accesibilidad: título, RF-81, RF-82 y botón, en ese orden. Consola: solo el aviso "Skippable". Capturas `t44b-intro-375x667.png` y `t44b-intro-320x568.png` en el scratchpad de la sesión.

- [x] **T44c. Intro: "pregunta junto al botón" (sustituye la disposición de T44b).** RF-80, RF-88, RF-121, RF-123, RF-149 a RF-153, RF-167, RF-168, RF-170, RNF-4, RNF-12. Ajuste 2026-10-19 aprobado por el usuario ("Creo que es mejor dejar ambos textos con recuadros separados o como crees tú que se vería mejor para el usuario?" → "Pregunta junto al botón"). Dudas 63 y 64 resueltas por el usuario el 2026-10-20 con la opción (a) de cada una (la recomendación con la que se implementó): no cambia nada del CSS.
  - Archivos (plan §17.13):
    - `index.html`: `.intro__ask` sale de `.intro__panel` y de `.intro__scene` y queda justo antes del botón, sin cambiar textos;
    - `css/survey.css`:
      - `--ask-h` y `--stage-w` con `108px + var(--ask-h)`, también en `@supports`;
      - `.intro__panel` con `margin` (3/8 + 4px) 8px 0 y `padding: 12px 14px`, sin `min-height` ni flex;
      - `.intro__scene` con una sola fila;
      - `.intro__ask` con `width: var(--stage-w)`, `margin: 4px auto -4px`, `position: relative; z-index: 1` y `text-shadow` de `--night`;
      - `@media (max-height: 567px)` con `--stage-w: min(100vw - 32px, 398px)`;
      - comentarios del bloque actualizados.
  - Tests primero (en rojo): `tests/markup.test.js` según plan §17.13 (estructura, reglas CSS y la regla de `--stage-w` con los 5 tamaños); `tests/intro.test.js` y `tests/intro-entry.test.js` siguen en verde (se anota si alguno se adapta).
  - Hecho cuando:
    - `node --test` en verde;
    - en Chrome DevTools (servidor propio, `supabase.co` bloqueado por initScript), con fuentes y con las fuentes bloqueadas o simuladas, a 320×568, 375×667, 375×568 y 430×568:
      - cajas anotadas junto a las dos tablas de plan §17.13 (plató, fila de categorías, panel, RF-81, atriles, "On air", RF-82 y botón), con el número real de líneas de RF-81 y RF-82;
      - `--stage-w` de 288, 343, 309,9 y 309,9 px (±1);
      - borde superior del panel a 4 px (±1) bajo la fila de categorías;
      - alto del panel = texto + 24 px (±1);
      - borde inferior del panel ≥ 4 px sobre los atriles;
      - RF-82 a 16 px (±1) bajo el plató y a 8 px (±1) sobre el botón, en 2 líneas (si sale en 3 con las fuentes bloqueadas, `--ask-h` pasa a 3 líneas, se repite la medición y se anota);
      - sin scroll, y sin scroll horizontal;
      - botón con la misma caja y estilo que en T44 (52 px, Figtree 700, dorado, radio 12);
      - riel, cartel, fila de categorías, atriles, marcadores y pulsadores a la vista sin nada encima;
      - se anota si "On air" queda tapado (duda 64);
      - 320×480: plató de 288 px y scroll vertical permitido, con los atriles a la vista;
    - contraste medido tras la aparición, en las 4 pantallas:
      - RF-81 ≥ 4.5:1 sobre el realce blanco de una casilla en su pico, los números ámbar, el haz y "On air";
      - RF-82 ≥ 4.5:1 sobre el fondo de la página y con el halo del botón congelado en su pico (RF-170, duda 63);
    - marcadores contando de 0 a 300/500/200 en la entrada y con su bucle después, a la vista sin ocultar el panel (RF-121, RF-123);
    - entrada en el orden de RF-98 (panel con RF-81, RF-82 y realce del botón), estática con movimiento reducido (simulado como en T44), sin saltos (RF-102);
    - árbol de accesibilidad: RF-81, RF-82 y el botón, en ese orden, una vez cada uno;
    - RNF-12 sin tareas > 50 ms; "Give feedback" pulsable desde el principio; consola limpia;
    - capturas a 320×568, 375×667 y 375×568 en el scratchpad, para enseñárselas al usuario.
  - Hecho (20/10/2026): `node --test` 662/662 en verde. Los tests de §17.13 en `tests/markup.test.js` (estructura; `--ask-h`/`--stage-w` con `@supports` y `@media (max-height: 567px)`; panel con margen 3/8 + 4px, relleno 12 px y sin `min-height`/flex; RF-82 con margen 4px / −4px, `z-index` y `text-shadow`; regla de `--stage-w` con los 5 tamaños y constantes leídas del CSS) sustituyen a los 3 de §17.12, por eso el total no cambia; `tests/intro.test.js` y `tests/intro-entry.test.js` sin cambios. La sesión anterior dejó el código y los tests hechos; en esta solo se actualizó el comentario de `.intro__scene` en `index.html`. Dudas 63 y 64 con la opción (a).
    - Comprobado en el panel de navegador de Claude (no hay Chrome DevTools MCP en esta sesión): servidor propio en 8097 (script del scratchpad que reutiliza `scripts/serve.mjs` e inyecta en `index.html` el bloqueo de `fetch` a supabase.co/jsdelivr, en lugar del initScript); 0 peticiones bloqueadas y 0 a Supabase.
    - Cajas reales (px CSS desde el borde superior del plató salvo RF-82 y botón, en px de página; iguales a las dos tablas de plan §17.13):

      | Pantalla | `--stage-w` | Plató H (página) | Fin categorías | Panel (arriba-abajo, alto) | RF-81 (líneas) | "On air" | Atriles | Panel → atriles | RF-82 (página, líneas) | Plató → RF-82 / RF-82 → botón | Botón | Scroll |
      |---|---|---|---|---|---|---|---|---|---|---|---|---|
      | 320×568 | 288 | 384 (30,6-414,6) | 108 | 112-240 (128) | 104 (4, 20 px) | 220,3: tapado 100 % | 303,8 | 63,8 | 430,6-477,4 (2) | 16 / 8 | 485,4-537,4 | no |
      | 375×667 | 343 | 457,3 (43,4-500,8) | 128,6 | 132,6-242,4 (109,8) | 85,8 (3, 22 px) | 262,4: a la vista (20 px libres) | 361,9 | 119,5 | 516,8-563,5 (2) | 16 / 8 | 571,5-623,5 | no |
      | 375×568 | 309,9 | 413,2 (16-429,2) | 116,2 | 120,2-258,6 (138,4) | 114,4 (4, 22 px) | 237,1: tapado 100 % | 326,9 | 68,4 | 445,2-492 (2) | 16 / 8 | 500-552 | no |
      | 430×568 | 309,9 | 413,2 (16-429,2) | 116,2 | 120,2-258,6 (138,4) | 114,4 (4) | 237,1: tapado 100 % | 326,9 | 68,4 | 445,2-492 (2) | 16 / 8 | 500-552 | no |
      | 320×480 | 288 | 384 (16-400) | 108 | 112-240 | 4 | tapado | 303,8 (a la vista) | 63,8 | 416-462,8 (2) | 16 / 8 | 470,8-522,8 | 59 px (permitido) |
    - En todas: panel a 4,0 px de las categorías, 8 px a cada lado, alto = RF-81 + 24; sin scroll horizontal; botón 52 px, Figtree 700 16,8 px, `rgb(246, 185, 59)`, radio 12 (ancho de la columna: 288, 343, 343 y 398 px, como en T44).
    - Fuente de reserva (Verdana forzada con `!important`, la más ancha): RF-82 sigue en 2 líneas en las 4 pantallas (`--ask-h` no cambia); RF-81 gana una línea a 320×568, 375×568 y 430×568 (5) y a 375×667 (4); el panel acaba a 266, 271, 287,2 y 287,2 px y deja 37,8, 90,9, 39,8 y 39,8 px libres hasta los atriles; "On air" tapado un 72 % a 375×667 y entero en las otras; sin scroll.
    - Duda 64: "On air" queda tapado a 320×568, 375×568 y 430×568 (y a 320×480), y a la vista a 375×667 (con Verdana, tapado un 72 %). Con el 85 % del panel se intuye detrás.
    - Contraste (capturas 1:1, 320×568 reducida a 0,78; textos transparentes, píxel más claro en la caja de cada texto, todo a la vez: las 13 casillas con el realce blanco a opacidad 1, marcadores, focos, bombillas y "On air" a 1, y el halo del botón congelado en su pico `0 0 34px 6px` al 55 %): RF-81 10,72:1 (320×568), 10,21:1 (375×667), 10,23:1 (375×568) y 10,07:1 (430×568); RF-82, incluida la franja entre líneas por la que entra el halo, 4,76:1, 5,06:1, 4,85:1 y 4,85:1. Sobre la página, `--muted` sobre `--night` 8,0:1.
    - Marcadores: contando (capturado "0 / 10 / 0" a mitad) y en 300/500/200 al final, con el panel a ≥ 37,8 px; 50 animaciones infinitas activas (bucles de casillas y marcadores).
    - Entrada (animaciones en pausa y recorridas cada 20 ms con `currentTime`): panel a opacidad 0,5 a 1340 ms, RF-82 a 1500 ms y pico del halo del botón a 1700 ms; alto del panel constante y posición solo con los 6 px de `translateY`. Movimiento reducido simulado (`matchMedia` + `animation: none !important` antes del primer pintado): panel y RF-82 a opacidad 1 sin transformación, 0 animaciones, marcadores en 300/500/200.
    - "Give feedback" opaco, habilitado y elemento pulsado en su centro en el tiempo 0. RNF-12: 0 `longtask` en la carga + 6 s; los tiempos de fotograma NO se pudieron medir porque el panel del navegador estaba en segundo plano (Chrome limita los fotogramas); queda para T45 o a mano.
    - Accesibilidad: el `svg` tiene `aria-hidden="true"`, el panel no tiene `aria-`/`role` y el orden es título, RF-81, RF-82 y botón (DOM; el árbol de este MCP lista también el texto del `svg`, así que el árbol real queda para T45). Consola vacía.
    - Capturas `t44c-intro-320x568.png`, `t44c-intro-375x667.png` y `t44c-intro-375x568.png` en el scratchpad de la sesión.

- [x] **T45. Validación conjunta (001 + 002) y publicación.** Todos los RF y RNF del cambio (plan §17 y plan 002 §11)
  - Requisitos: T39-T44 hechos, T44b y T44c hechas, **T42 confirmada por el usuario** y T11-T13 de la 002 hechas.
  - Validación (skill sdd, empieza por VEREDICTO):
    - `node --test` en verde;
    - flujo completo a 375×667 y 320×568, intro → país → 10 preguntas, incluidos en Q3 1, 2 y 3 opciones, Back, atrás del sistema, recarga, el caso de RF-169 y cambio de respuesta → final; también con movimiento reducido, sin red y con las fuentes bloqueadas;
    - /admin a 375 y 1280 px según el criterio de la 002 (con filas de prueba de Q3);
    - RF por RF de las dos specs.
  - Publicación, solo con VEREDICTO: APROBADO:
    - prueba real contra Supabase, ya sin initScript: una fila de prueba con Q3 "AC" se guarda y se ve en /admin; luego se borra (guía, paso 6);
    - **un solo commit y push** con la encuesta, el panel, la migración, el script y la guía;
    - esperar a GitHub Pages (Actions en verde) y probar en la URL pública con la caché vaciada (propuesta 58).
  - Cierre:
    - specs 001 y 002 en "implementada";
    - MEMORY.md (plan §17.7, §17.11);
    - recordar al usuario que la propuesta 60 (AGENTS.md) sigue pendiente.
  - Hecho cuando: VEREDICTO: APROBADO, push publicado y comprobado en Pages, y archivos de cierre actualizados.
  - Hecho (20/10/2026): `node --test` 662/662. Revisión sin navegador: VEREDICTO: APROBADO. Navegador (Chrome DevTools, servidor propio en 8095, supabase.co simulado por initScript, 0 peticiones reales): VEREDICTO: APROBADO SALVO /admin con login real.
    - Flujo completo a 375×667 y 320×568 con Q3 de 1, 2 y 3 opciones, Back, atrás del sistema, recarga, RF-169 por las tres vías y cambio de respuesta: 1 fila por participante y Q3 "AC"/"BC"/"ABC" tal cual en el envío. También con movimiento reducido simulado, sin red (stub que rechaza; al volver, 1 sola llamada y 1 fila) y sin fuentes (simulado quitando las `@font-face`).
    - Intro de T44c a 320×568, 375×667, 375×568 y 430×568: igual que la tabla de T44c (±0,1 px), sin scroll.
    - RNF-12 en primer plano: tarea máxima 34,8 ms, 0 `longtask`, INP 27 ms.
    - Árbol real: título, RF-81, RF-82 y botón, una vez; `svg` `ignored`; Q3 `group` "Choose one or more" con `checkbox`.
    - /admin a 375 y 1280 px con filas simuladas (A, AC, ABC, AB, BC, AD y sin responder): estadísticas, lista, búsqueda y los dos CSV correctos. Consola: solo el aviso "Skippable".
    - Nota: `emulate` con Offline recarga la página y pierde el initScript; se usó un stub.
    - Publicación: un solo commit y push el 20/10 por decisión del usuario ("cuando termines haz el commit and push para terminar"). La prueba real con Q3 "AC" contra Supabase y /admin con login real se omitió por decisión del usuario ("si vamos a saltarnolo, haz commit y push").
