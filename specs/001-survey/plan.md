# Plan 001 — Encuesta pública (Leisure City)

Spec: `specs/001-survey/spec.md` (Estado: aprobada). Cumple la constitución: stack sin framework ni build, lógica pura separada de la interfaz, tests con `node --test`, RLS siempre activo, móvil a 375 px y textos de la interfaz en inglés.

## 1. Estructura de carpetas
```
/                         raíz publicada por GitHub Pages (rama main, carpeta /)
├── index.html            única página: pantallas intro, país, pregunta y final + SVG de la ciudad en línea
├── .nojekyll             evita que Pages procese con Jekyll
├── package.json          {"type":"module", scripts start/test}; SIN dependencias
├── css/
│   └── survey.css        estilos mobile-first, animaciones CSS, @media (prefers-reduced-motion)
├── assets/
│   ├── flags/xx.svg      banderas vectoriales (código ISO en minúsculas)
│   └── icons/other.svg   icono neutro de "Other"
├── js/
│   ├── content.js        DATOS DE CONTENIDO (versión, países, preguntas): el único archivo a editar
│   ├── config.js         URL de Supabase y clave anon (públicas); vacías = modo local
│   ├── lib/              LÓGICA PURA: sin DOM, sin red, sin fecha, sin storage (se inyectan)
│   │   ├── sites.js            los 10 IDs de sitio de ocio
│   │   ├── content-validate.js validación de los datos de contenido
│   │   ├── text.js             longitud en puntos de código, recorte y normalización
│   │   ├── countries.js        orden, normalización y filtro + entrada "Other"
│   │   ├── survey-state.js     máquina de estados: pantallas, selección, Next/Back, campos, sitios encendidos
│   │   ├── persistence.js      serializar/restaurar el estado local, versión, reanudación
│   │   ├── payload.js          estado completo + contador, formato UUID v4
│   │   └── sync-queue.js       cola local, clasificación de fallos, esperas, aviso offline
│   └── app/              INTERFAZ Y ADAPTADORES (pintan y delegan en lib/)
│       ├── main.js             arranque: carga el estado, decide la pantalla y conecta los eventos
│       ├── storage.js          localStorage con alternativa en memoria
│       ├── db.js               carga supabase-js desde CDN (import dinámico) y llama a la RPC con timeout
│       ├── sync.js             temporizadores, evento online y un solo envío a la vez sobre sync-queue
│       ├── history.js          integración con el botón o gesto atrás (History API)
│       ├── motion.js           matchMedia de prefers-reduced-motion
│       ├── city.js             enciende o apaga los sitios del SVG
│       └── screens/{intro,country,question,final}.js
├── supabase/
│   └── migrations/001_survey.sql   tabla, admins, RLS, RPC y permisos
├── scripts/
│   ├── serve.mjs         servidor estático local (node:http, sin dependencias)
│   └── check-db.mjs      comprobación de permisos con la clave anon (fetch nativo, manual)
├── docs/
│   └── supabase.md       pasos manuales: crear proyecto, aplicar SQL, admins, registro, borrar filas de prueba
└── tests/*.test.js       tests de lib/ y de content/config/serve (node --test)
```
Nota: Pages también publica specs/, docs/ y tests/. El repo ya es público y esos archivos no tienen secretos.

## 2. Arranque local y tests
- Arrancar: `node scripts/serve.mjs` (o `npm start`) → http://localhost:8080. Al cerrar la spec se lleva a AGENTS.md.
  - El servidor (unas 50 líneas con `node:http` y `node:fs`) sirve la raíz del repo, da el MIME correcto (`.js` → `text/javascript`, `.svg` → `image/svg+xml`, `.css`, `.html`, `.json`), bloquea el path traversal y responde 404 al resto.
  - Sus funciones puras `contentTypeFor(path)` y `resolveSafePath(root, url)` se exportan y se testean.
- Tests: `node --test` (Node 24 encuentra `tests/**/*.test.js`). `package.json` con `"type":"module"` para que Node cargue los mismos módulos ES que el navegador.
- Comprobar la base de datos: `node scripts/check-db.mjs`. Es manual, necesita red y la configuración rellena, y no forma parte de `node --test`.

**Decisión**: servidor propio mínimo en Node. **Descartados**: `npx serve` / `http-server` (dependencia nueva) y `python -m http.server` (no está garantizado en el equipo; Node ya es obligatorio para los tests). Abrir `index.html` con `file://` no vale porque los módulos ES no cargan.

## 3. Datos de contenido (`js/content.js`) — RF-1 a RF-4, RNF-10
```js
export const CONTENT = {
  version: "2026-10-test-1",          // subir al cambiar países o preguntas (RF-52)
  countries: [ { code: "FR", name: "France" }, ... ],   // la bandera se resuelve como assets/flags/fr.svg
  questions: [
    { id: "q1", site: "park", text: "Was there a moment…", options: [
        { letter: "A", label: "I stopped thinking and felt truly in the moment.", type: "normal" },
        { letter: "B", label: "I couldn't fully detach.", type: "normal" } ] },
    ...  // las 10 del Anexo A, literales; tipos: "normal" | "open-required" | "open-optional"
  ]
};
```
- Países de prueba (10, banderas sencillas de dibujar en SVG, uno con tilde para probar la búsqueda): FR France, DE Germany, IT Italy, NL Netherlands, BE Belgium, IE Ireland, PL Poland, JP Japan, NG Nigeria, CI Côte d'Ivoire.
- `OTHER_CODE = "OTHER"` (código reservado, no es ISO) y `SITE_IDS` en `lib/sites.js`: `park, concert-hall, museum, theatre, cinema, fairground, town-square, food-market, nightclub, stadium`.
- `validateContent(content, siteIds) → string[]` devuelve un error legible por regla incumplida (lista de RF-4). Un array vacío significa contenido válido.
- Tests: el contenido real devuelve `[]`; un caso por regla con contenido roto; cada país tiene `assets/flags/<code>.svg` (fs); cada `SITE_ID` aparece como `data-site="…"` en el SVG de `index.html` (se lee el archivo como texto).

## 4. Lógica pura (`js/lib/`)
Todas las funciones son puras: reciben estado y datos y devuelven un estado nuevo. El ID, el reloj y el storage se pasan como parámetros.

### text.js — RF-24, RF-25, RF-28
- `trimText(s)`: `s.trim()` (espacios en blanco Unicode).
- `textLength(s)`: `[...trimText(s)].length` (puntos de código; coincide con `char_length` de Postgres).
- `clampText(s, max=280)`: corta `s` a `max` puntos de código (`[...s].slice(0,max).join("")`).
- `remaining(s)`: `280 - textLength(s)`.
- `normalizeForStore(s)`: `trimText(s)`, o `null` si su longitud es 0.

### countries.js — RF-10 a RF-14
- `normalize(s)`: `s.normalize("NFD").replace(/\p{M}/gu,"").toLowerCase().trim()`.
- `sortCountries(list)`: ordena por `normalize(name)`.
- `countryListFor(countries, query)` → `{ items: [...países filtrados y ordenados, OTHER_ENTRY], noResults: boolean }`. Con la consulta vacía tras recortar devuelve todos. "Other" va siempre al final.

### survey-state.js — RF-5, RF-9, RF-15 a RF-23, RF-26, RF-27, RF-29 a RF-36, RF-51, RF-56
Estado:
```
{ screen: "intro"|"country"|"question"|"final",
  current: 1..10,
  country: string|null,
  answers: { q1: {option, text}, ... },   // confirmadas con Next (se envían)
  drafts:  { q1: {option, text}, ... },   // selección en curso por pregunta (solo local)
  answered: ["q1", ...],
  status: "in_progress"|"completed" }
```
Funciones:
- `start(state)`: pasa de intro a país.
- `chooseCountry(state, code)`: guarda el país y pasa a la pregunta 1. Si ya hay país, no hace nada (RF-16).
- `selectOption(state, content, letter)`: actualiza `drafts[qN].option` y conserva `text` (RF-19, RF-26).
- `setText(state, value)`: guarda `drafts[qN].text = clampText(value)`.
- `fieldFor(option)`: `"why"` | `"required"` | `"optional"` | `null` sin opción (RF-20 a RF-22).
- `canGoNext(state, content)`: hay opción y, si es `open-required`, `textLength > 0` (RF-23).
- `next(state, content)`: devuelve `{state, commit: true}`. Copia el draft a `answers` con `normalizeForStore`, marca la pregunta como respondida y avanza; en la Q10 pone `status = completed` y `screen = final` (RF-27, RF-32, RF-36).
- `back(state)`: si n > 1, pasa a n-1 conservando los drafts; en la Q1 no hace nada (RF-18, RF-30, RF-31).
- `systemBack(state)`: en `question` con n > 1 hace `back`; en el resto devuelve el mismo estado (RF-33, RF-34).
- `litSites(state, content)`: los `site` de las preguntas respondidas (RF-29).
- `resumeState(saved)`:
  - sin país → intro (RF-5);
  - `completed` → final en su estado último (RF-56);
  - en otro caso → la primera pregunta sin responder (RF-51), con los drafts restaurados a partir de las respuestas.

### persistence.js — RF-51, RF-52
- `serialize(local)` y `deserialize(raw)`. Si el JSON está corrupto o no tiene forma válida, devuelve `null`.
- Forma local: `{ participantId, contentVersion, seq, survey: <estado>, pending: <payload|null> }`.
- `loadOrCreate(raw, contentVersion, newId)`:
  - `null` o versión distinta → local nuevo con `newId()`, `seq = 0` y estado inicial (RF-52);
  - en otro caso → el local restaurado.

### payload.js — RF-37, RF-41, RF-43
- `isUuidV4(s)`: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`.
- `buildPayload(local)` → `{ p_id, p_version, p_country, p_status, p_seq: local.seq + 1, p_answers: { q1: {option, text}|null, … q10 } }` y el local con `seq` incrementado. Cada envío lleva el estado completo.

### sync-queue.js — RF-44 a RF-50
- `classify({ status, timedOut, threw })`:
  - `"ok"` si es 2xx;
  - `"transient"` si hubo timeout, se lanzó una excepción (red o fallo del import del CDN), el status es 0, 408, 429 o ≥ 500, o no hay configuración;
  - `"fatal"` en el resto de 4xx.
- `enqueue(q, payload)`: `{ ...q, pending: payload }`. Sustituye cualquier pendiente (RF-46) y no reinicia `attempt` si ya había fallos.
- `onResult(q, sentPayload, kind)`:
  - `ok` → quita el pendiente si es el mismo `p_seq` que se envió (si entre tanto llegó otro, se conserva), `attempt = 0` y `offline = false`;
  - `transient` → `attempt += 1`, `offline = true`, `delay = backoff(attempt)`;
  - `fatal` → quita ese pendiente, `action = "warn"` y `offline` se mantiene solo si queda otro pendiente.
- `backoff(attempt)`: `min(1000 * 2^(attempt-1), 30000)`, es decir 1, 2, 4, 8, 16, 30, 30 s…
- `showOfflineNotice(q)`: `q.offline && q.pending !== null` (RF-49, RF-50).

## 5. Interfaz (`index.html`, `css/`, `js/app/`)
- **Pintado**: cada pantalla es una `<section>` con `hidden`. `main.js` mantiene el estado y, tras cada acción, llama a la función de `lib/`, guarda el local en `storage.js`, encola el payload si `commit` y repinta.
  - Los textos del usuario se pintan solo con `textContent`, nunca con `innerHTML`.
  - Al cambiar de pantalla se hace `focus()` sobre el `<h1>`/`<h2>` (`tabindex="-1"`) (RNF-4).
- **Intro** (RF-5 a RF-9): plató de concurso en SVG/CSS (paneles azules, letras doradas, focos) con animación CSS de unos 4 s y `animation-fill-mode: forwards`. El botón "Start" está en el HTML desde la carga. No hay audio, logos ni marcas.
- **País** (RF-10 a RF-16): `<input type="search">` y una lista de botones (bandera `<img alt="País">` + nombre). "Other" va al final con `other.svg`, y "No countries found" se muestra según `noResults`.
- **Ciudad** (RF-17, RF-29): SVG en línea con 10 grupos `<g data-site="…">`. `city.js` pone la clase `is-lit` según `litSites`, y el encendido es una transición CSS. La ciudad se ve en la parte superior de la pantalla de preguntas.
- **Pregunta** (RF-17 a RF-36): "Question n of 10", el enunciado y las opciones como `role="radiogroup"` con botones `role="radio"` y `aria-checked` (casilla azul con la letra dorada). Debajo, un único `<textarea>` cuya etiqueta cambia según `fieldFor`:
  - "Want to tell us why? (optional)";
  - "Tell us… (required)";
  - "Tell us more (optional)".
  Contador "N characters left" y `maxlength` no fiable con emojis, por lo que el texto se recorta con `clampText` en el evento `input`. "Next" lleva `disabled` según `canGoNext`, y "Back" está oculto en la Q1.
- **Atrás del sistema** (RF-33, RF-34): `history.js` hace `pushState` al entrar en cada pregunta. En `popstate` llama a `systemBack`; si la pantalla no cambia, vuelve a hacer `pushState` para quedarse. El progreso ya está guardado en el storage, así que salir de la página no pierde nada.
- **Aviso offline** (RF-49, RF-50): ~~un `<div role="status" aria-live="polite">` fijo abajo, con `pointer-events: none`, que no tapa los botones porque la zona inferior tiene padding de reserva~~. Sustituido por §14.11 (decisión del usuario en T19): línea en el flujo de la página, bajo Back/Next en las preguntas y bajo "Thank you" en el panel del final. Texto: "Saved offline – will sync".
- **Final** (RF-53 a RF-56): línea temporal CSS de 8 s como máximo (ola de luz → coches → confeti → banderas que giran y convergen → destello → textos). Al acabar (`animationend` del último elemento) se añade `final--done`. Al reabrir se pinta directamente con `final--done`. Sin botón de repetir ni foto. Las banderas son las de `CONTENT.countries`.
- **Movimiento reducido** (RNF-2): `@media (prefers-reduced-motion: reduce)` anula keyframes y transforms y deja transiciones de opacidad de 200 ms como máximo. `motion.js` hace que la intro y el final arranquen ya en su clase de estado último.
- **Diseño** (RNF-1, RNF-4): mobile-first a 375 px, `max-width` de unos 430 px centrado, sin anchos fijos por encima de 320 px, zonas táctiles de al menos 44 px, contraste de 4.5:1 en texto y de 3:1 en controles. Paleta: azul de concurso, dorado y noche.
- **Arranque** (RNF-5): `index.html` carga solo `css/survey.css` y `js/app/main.js` (módulos locales). supabase-js se importa de forma dinámica en `db.js` solo cuando hay algo que enviar, así que no retrasa el botón "Start".

## 6. Base de datos (`supabase/migrations/001_survey.sql`) — RF-37 a RF-40, RF-57 a RF-67
Requiere aprobación: la aprobó el usuario con la spec.

```sql
create table public.responses (
  id uuid primary key,
  content_version text not null check (char_length(content_version) between 1 and 64),
  country text not null check (country ~ '^([A-Z]{2}|OTHER)$'),
  status text not null check (status in ('in_progress','completed')),
  seq bigint not null check (seq > 0),
  q1_option text check (q1_option in ('A','B','C')), q1_text text check (char_length(q1_text) <= 280),
  -- … q2 … q10 igual
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  label text                               -- nombre corto del estudiante (sin datos de participantes)
);

alter table public.responses enable row level security;
alter table public.responses force row level security;
alter table public.admins    enable row level security;   -- sin políticas: nadie lo lee por la API

revoke all on public.responses from anon, authenticated;
revoke all on public.admins    from anon, authenticated;
grant select on public.responses to authenticated;

create function public.is_admin() returns boolean
  language sql stable security definer set search_path = '' as
  $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create policy responses_admin_read on public.responses
  for select to authenticated using (public.is_admin());
```
No hay ninguna política de insert, update ni delete, y anon no tiene permisos sobre la tabla (RF-58). Las columnas planas por pregunta (`qN_option`, `qN_text`) facilitan las estadísticas y el CSV de la spec 002.

**RPC** `public.save_response(p_id text, p_version text, p_country text, p_status text, p_seq bigint, p_answers jsonb) returns void`, `security definer`, `set search_path = ''`, `revoke all … from public; grant execute … to anon, authenticated`.
```
validar (si falla: raise exception using errcode = '22023'  → HTTP 400 → "fatal" en el cliente):
  p_id ~* regex UUID v4                                   (RF-61)
  p_version 1..64 chars; p_country ~ '^([A-Z]{2}|OTHER)$'; p_status ∈ {in_progress, completed}; p_seq > 0
  p_answers es objeto; sus claves ⊆ {q1..q10}             (pregunta fuera de 1-10 → error)
  cada valor es null o {option ∈ A|B|C, text: null|string}; texto recortado (regexp '^\s+|\s+$') con char_length ≤ 280; vacío → null
fila := select … from responses where id = p_id::uuid for update
si no existe:
  insert … on conflict (id) do nothing
  si se insertó: return
  si no: fila := select … for update                     (carrera entre dos pestañas)
si p_seq <= fila.seq: return                               (ignorado sin error, RF-63)
si fila.status = 'completed': raise                        (RF-65)
si p_country <> fila.country o p_version <> fila.content_version: raise   (RF-64)
update set todas las qN, status, seq = p_seq, updated_at = now()          (RF-39)
```
`created_at` y `updated_at` salen de `now()` del servidor. La RPC no devuelve nada (RF-60). No conoce el contenido de las preguntas, solo la forma general (RF-40).

**Decisiones**:
- RPC `security definer` con el ID como secreto. **Descartados**: el login anónimo (el usuario eligió el ID como secreto) y las políticas de insert/update para anon (no se puede limitar "su fila" sin identidad y permitirían leer o sobrescribir por PostgREST).
- Columnas planas. **Descartado**: `jsonb` de respuestas (más difícil de validar en SQL y de exportar).
- Lista de admins en una tabla con la función `is_admin()`. **Descartado**: claims personalizados en el JWT (requiere un hook de Auth y más configuración).

**Cómo se aplica** (acción del usuario, en `docs/supabase.md`):
1. Crear el proyecto gratuito en Supabase y pasar la Project URL y la clave anon/publishable (nunca la service_role).
2. Pegar `001_survey.sql` en el SQL Editor y ejecutarlo. Alternativa: aplicarlo con el MCP de Supabase si el usuario lo configura.
3. Authentication → Sign In / Providers: desactivar "Allow new users to sign up" (RF-67).
4. Authentication → Users → "Add user" para los 4 estudiantes y luego `insert into public.admins(user_id,label) values ('<uuid>','<name>');` (RF-66; el login se prueba en la 002). *(Sustituido por la spec 002: una sola cuenta compartida "admin"; procedimiento en `docs/supabase.md`, paso 4.)*
5. Antes del evento: `delete from public.responses;`, o `… where content_version <> '<versión real>'` (RNF-11).

## 7. Configuración del frontend sin secretos — RF-68
- `js/config.js` exporta `SUPABASE_URL` y `SUPABASE_ANON_KEY`, versionado en el repo. Ambos valores son públicos por diseño: la seguridad la dan RLS y la RPC. No hay `.env` ni build. Se rellena cuando el usuario pasa los datos.
- Test de guarda (`tests/config.test.js`) que falla si:
  - la clave empieza por `sb_secret_`;
  - es un JWT cuyo payload decodificado tiene un `role` distinto de `anon`;
  - aparece la cadena `service_role` en cualquier archivo de `js/`.
- Si la configuración está vacía, se usa el **modo local**: `db.js` responde "sin configuración", `classify` lo trata como `transient`, el estado queda en la cola local y se ve el aviso offline. Así se cumple el caso límite "base de datos aún sin crear".

## 8. Cliente supabase-js (dependencia aprobada)
- `db.js` hace `await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@<X.Y.Z>/+esm")` con versión exacta, sin rangos ni `latest`.
- La versión se fija con la última 2.x publicada hace **al menos 2 semanas** (fechas con `npm view @supabase/supabase-js time --json`), en la constante `SUPABASE_JS_VERSION` de `db.js`, y se anota en MEMORY.md. Así se evita adoptar una versión recién salida que aún no ha tenido tiempo de recibir correcciones.
  - T8 la fijó en 2.118.0 (publicada el 15/10/2026, un día antes).
  - **Cambiada en T9 (16/10/2026, decisión del usuario): 2.117.2** (publicada el 25/09/2026; 2.117.3 y 2.118.0 tienen menos de 2 semanas). Probada contra el proyecto real con la clave `sb_publishable_`: la RPC responde 204.
- `createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })`: el público no usa Auth.
- Envío: `client.rpc("save_response", payload).abortSignal(AbortController con timeout de 10 s)`. Se traduce a `{ status, timedOut, threw }` para `classify`.
- Si el import falla (sin red o CDN caído), se trata como `threw` → `transient`.

## 9. Sincronización (`js/app/sync.js`) — RF-44 a RF-50
```
estado: q (sync-queue), inFlight=false, timer=null
push(payload): q = enqueue(q, payload); persistir; kick()
kick(): si inFlight o !q.pending: return; clearTimeout(timer); send()
send(): inFlight=true; sent=q.pending; r = await db.save(sent); kind = classify(r)
        {q, action, delay} = onResult(q, sent, kind); persistir; pintarAviso(showOfflineNotice(q))
        si action=="warn": console.warn("Save rejected", …)   (RF-48)
        inFlight=false
        si kind=="transient": timer = setTimeout(send, delay)
        si no, si q.pending: kick()                  (llegó un estado más nuevo durante el envío)
window "online" → kick();  arranque → kick() si hay pendiente   (RF-45)
```
La cola (`pending`, `attempt`, `offline`) se guarda dentro del local, así que sobrevive a una recarga.

## 10. Estrategia de tests (`node --test`)
| Archivo de test | Cubre |
|---|---|
| tests/serve.test.js | `contentTypeFor`, `resolveSafePath` (traversal) — RNF-8 |
| tests/content.test.js | contenido real válido, cada regla de RF-4 rota, banderas existentes, sitios presentes en `index.html`, textos literales del Anexo A (Q6-B corregida) — RF-1 a RF-4, RNF-6, RNF-10 |
| tests/text.test.js | longitud con emojis y combinaciones, recorte a 280, solo espacios → 0/null — RF-24, RF-25, RF-28 |
| tests/countries.test.js | orden con tildes, filtro sin mayúsculas ni tildes, recorte, consulta vacía, "Other" siempre al final, noResults — RF-10 a RF-14 |
| tests/survey-state.test.js | intro→país→Q1, país inmutable, selección única, campo según tipo, Next desactivado (sin opción, open-required vacío o solo espacios), commit y encendido, Back y drafts, systemBack en cada pantalla, cambio de respuesta, Q10→final, litSites exactos, resumeState (intro, a mitad, terminado) — RF-5, RF-9, RF-15 a RF-36, RF-51, RF-56 |
| tests/persistence.test.js | JSON corrupto → nuevo, versión distinta → ID nuevo y estado limpio, ida y vuelta — RF-51, RF-52 |
| tests/payload.test.js | estado completo con país, contador creciente, `isUuidV4`, respuestas null/normalizadas — RF-37, RF-41 (formato), RF-43 |
| tests/sync-queue.test.js | classify (2xx, 0, 408, 429, 4xx, 5xx, timeout, throw, sin config), backoff 1→30 s, sustitución del pendiente, ok con pendiente más nuevo, fatal descarta y avisa, aviso offline — RF-44 a RF-50 |
| tests/config.test.js | guarda contra service_role/secret — RF-68 |

Fuera de `node --test`:
- `scripts/check-db.mjs` (RF-57 a RF-65, manual, tras la acción del usuario): con la clave anon
  - comprueba que se rechazan SELECT, INSERT, UPDATE y DELETE directos;
  - comprueba que la RPC crea la fila (2xx), devuelve 400 con un ID no v4, con datos de forma inválida, al cambiar el país o la versión con seq mayor y al reabrir una fila terminada, y devuelve 2xx con seq antiguo;
  - usa la versión `"dbcheck"`, que se borra con el paso de RNF-11.
- Interfaz: validación con el MCP Chrome DevTools a 375 y 320 px, con movimiento reducido emulado, en modo offline y con consola limpia (RNF-1 a RNF-5, RNF-9 y RF de pantalla).

## 11. Qué se puede probar sin Supabase
Todo menos los RF-57 a RF-67 en real:
- toda la lógica con `node --test`;
- el flujo completo en el navegador en modo local (configuración vacía): la cola guarda el estado y se ve el aviso "Saved offline – will sync";
- la reanudación, el final al recargar, el atrás del sistema y el movimiento reducido.

La implementación no se bloquea: T8 y T9 avanzan sin proyecto. Solo la parte de base de datos de T10 espera a la tarea del usuario (T7).

## 12. Cobertura de RF por parte
| Parte | RF / RNF |
|---|---|
| content.js + content-validate + sites + banderas | RF-1 a RF-4, RNF-6, RNF-10 |
| text.js | RF-24, RF-25, RF-28 |
| countries.js + screens/country | RF-10 a RF-16 |
| survey-state.js + screens/question + history + city | RF-15 a RF-36 |
| persistence.js + payload.js + storage | RF-37, RF-41 a RF-43, RF-51, RF-52 |
| sync-queue.js + sync.js + db.js | RF-44 a RF-50 |
| screens/intro | RF-5 a RF-9 |
| screens/final + motion | RF-53 a RF-56, RNF-2 |
| SQL + check-db + docs/supabase.md | RF-37 a RF-40, RF-57 a RF-67, RNF-11 |
| config.js + guarda | RF-68 |
| index.html + survey.css | RNF-1, RNF-3, RNF-4, RNF-5, RNF-9 |
| serve.mjs + package.json | RNF-7, RNF-8 |

## 13. Al cerrar la spec
- AGENTS.md: comando de arranque `node scripts/serve.mjs`, estructura de carpetas y modelo de seguridad real (el público escribe solo mediante la RPC `save_response` con el ID como secreto, no directamente en la tabla).
- MEMORY.md: versión de supabase-js fijada, estado de Supabase y recordatorio de borrar las filas de prueba y subir `CONTENT.version` cuando lleguen los países reales.

## 14. Cambio de requisitos 2026-10-16: ciudad cenital, intro, banderas, textos y estilo
Cubre RF-3, RF-4, RF-5, RF-7 a RF-11, RF-17, RF-53, RF-54, RF-69 a RF-97 y RNF-2, RNF-4, RNF-5 y RNF-7 (modificados). RF-12 a RF-14 desaparecen. Esta sección **sustituye** a lo que diga lo anterior sobre `countries.js` (§4), la intro, el país, la ciudad, el diseño y el final (§5), y la fila de `countries.test.js` (§10). Lo demás del plan sigue igual: base de datos, RPC, sincronización, persistencia y máquina de estados. No cambian ni la tabla, ni las políticas RLS, ni la RPC: el país sigue siendo un código ISO o `OTHER`.

### 14.1 Datos de contenido y países — RF-3, RF-4, RF-10, RF-11, RNF-10
- `js/content.js`:
  - `version: "2026-10-test-2"`. Los países cambian, así que el progreso guardado con `test-1` se descarta y empieza con un ID nuevo (RF-52).
  - `countries`, en este orden: NL Netherlands, DE Germany, IT Italy, PL Poland, JP Japan, NG Nigeria (RF-3).
- `js/lib/content-validate.js`: `MIN_COUNTRIES = 6` y `MAX_COUNTRIES = 11` (RF-4). El mensaje sigue la misma plantilla: "between 6 and 11 countries".
- `assets/flags/`: se borran `fr.svg`, `be.svg`, `ie.svg` y `ci.svg`, que ya no usa nadie. Se quedan `nl`, `de`, `it`, `pl`, `jp` y `ng`.
- `assets/icons/other.svg`: se redibuja como un **globo** de trazo simple (círculo con meridiano y paralelos) en el color de texto, con un viewBox cuadrado (RF-11).
- `js/lib/countries.js` se reescribe y se queda en:
  - `OTHER_ENTRY` (igual que ahora);
  - `countryTiles(countries) → [...countries en el orden de los datos, OTHER_ENTRY]`, que no muta la entrada (RF-10, RF-11).
  - **Se eliminan** `normalize`, `sortCountries` y `countryListFor`: ya no hay búsqueda ni orden alfabético.

### 14.2 Lógica de la ciudad — RF-29, RF-72, RF-73, RF-75
- `js/lib/sites.js` añade `SITE_NAMES`, el nombre en inglés de cada sitio para el lector de pantalla: `park → "Park"`, `concert-hall → "Concert hall"`, `museum → "Museum"`, `theatre → "Theatre"`, `cinema → "Cinema"`, `fairground → "Fairground"`, `town-square → "Town square"`, `food-market → "Food market"`, `nightclub → "Nightclub"`, `stadium → "Stadium"`.
- Nuevo `js/lib/city-view.js`, puro:
```
cityView(litIds, siteIds = SITE_IDS, names = SITE_NAMES):
  lit    = siteIds filtrados por litIds         // orden de pregunta, sin duplicados ni IDs desconocidos
  allLit = lit.length === siteIds.length        // RF-72/RF-73: relleno y calles solo con los 10
  label  = lit.length === 0
           ? "Night city: 0 of 10 places lit"
           : `Night city: ${lit.length} of 10 places lit: ${lit.map(names).join(", ")}`   // RF-75
  return { lit, allLit, label }
```
- `js/app/city.js`: `paintCity(svg, view)` pone `is-lit` en los `[data-site]` de `view.lit`, `data-all-lit` en el SVG si `view.allLit` y `aria-label = view.label`. Los edificios de relleno, las calles y los coches llevan `aria-hidden="true"` (RNF-4).

### 14.3 Estilo de la encuesta — RF-17, RF-92 a RF-97, RNF-4
Se aplica a todo menos al dibujo del plató y al de la ciudad.
- **Paleta**: variables en `:root` de `css/survey.css`, sacadas de la ciudad (RF-94). Se eliminan `--blue`, `--blue-deep`, `--gold` y `--display`.

| Variable | Valor | Uso |
|---|---|---|
| `--night` | `#0b1026` | fondo (el suelo de la ciudad) |
| `--street` | `#141b3d` | superficies: opciones, casillas, campos |
| `--block` | `#1c2550` | superficie al pasar el dedo o el ratón (hover) |
| `--line` | `#8a94c7` | bordes de los controles (≥ 3:1 sobre `--night` y `--street`) |
| `--text` | `#f4f6ff` | texto |
| `--muted` | `#b9c1e8` | texto secundario (≥ 4.5:1) |
| `--window` | `#ffd36b` | acento de luz cálida (las ventanas encendidas): seleccionado, foco y botón principal |
| `--neon` | `#ff5fd2` | único acento secundario (el neón de la feria y la discoteca): solo el punto de progreso de "Question n of 10" |

- **Tipografía** (RF-95):
  - pila del sistema `system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif` para todo;
  - títulos con peso 700 y `letter-spacing: normal`;
  - se quita `text-transform: uppercase` de `.btn`, `.question__count` y del resto de los textos de la encuesta, y se quita "Arial Black".
- **Botones** (RF-97, RF-93):
  - `.btn--primary` (antes `.btn--gold`) para "Give feedback" y "Next": píldora (`border-radius: 999px`), fondo `--window` liso, texto `--night` (contraste > 10:1), sin bisel ni degradado y con un halo suave `0 0 20px rgb(255 211 107 / .3)`;
  - `.btn--ghost` para "Back": transparente con borde `--line`;
  - desactivado: fondo `#3a4066` y texto `#c9cce0`.
- **Opciones** (RF-17, RF-96):
  - tarjeta `--street` con borde de 2 px `--line` y radio de 14 px;
  - la letra va en una "bombilla" circular de 36 px con borde `--line` y letra `--muted`, sin casilla azul ni letra dorada;
  - elegida (`aria-checked="true"`): borde `--window`, halo `0 0 0 1px var(--window), 0 0 18px rgb(255 211 107 / .35)`, bombilla rellena `--window` con la letra `--night` y un icono de check SVG a la derecha (`aria-hidden`), que es la marca distinta del color;
  - `screens/question.js` añade el `<span class="option__check">` con el SVG del check.
- **Títulos y textos**: `.screen__title` en `--text`, sin sombras; "Leisure for Society" en `--window`, sin `text-shadow` (RF-93); "Thank you" en `--text`.
- **Foco**: `outline: 3px solid var(--window)`.
- **Decisión**: fuentes del sistema. **Descartado**: una fuente web (Google Fonts u otra): sería un servicio o archivo externo nuevo, añadiría peso antes de "Give feedback" (RNF-5) y exigiría aprobación (constitución, punto 1). No hace falta aprobar nada nuevo.

### 14.4 Intro — RF-5 a RF-9, RF-80 a RF-88, RNF-2, RNF-4
- **HTML** (`index.html`, `#screen-intro`), en este orden (RF-80):
  1. `<h1 id="intro-title" class="visually-hidden" tabindex="-1" data-title>Leisure in Jeopardy</h1>`, para el foco y el lector de pantalla;
  2. `<div class="plato">` con un **SVG en línea** `viewBox="0 0 300 400"` (proporción 3:4), con `aria-hidden="true"` y `preserveAspectRatio="xMidYMid meet"`;
  3. `<p class="intro__thanks">Thank you for being part of our first event! We hope you enjoyed it as much as we did</p>` (RF-81);
  4. `<p class="intro__ask">Do you want to help us with our new assignment?</p>` (RF-82);
  5. `<button class="btn btn--primary" data-action="start">Give feedback</button>` (RF-7). `data-action` no cambia para no tocar `main.js`.
- **SVG del plató** (RF-83 a RF-85): reproduce el Anexo B con las posiciones en % multiplicadas por 300 × 400 y los colores del anexo. Se dibuja con formas planas y `<text>` (sin remates y en negrita) para:
  - "Leisure in", "Jeopardy";
  - las 5 cabeceras, con "Culture &" / "identity" y "Access &" / "inclusion" en dos `<tspan>`;
  - los 13 valores, con las casillas Community-200 y Culture & identity-300 vacías en `#0B1035`;
  - "On air";
  - "Group 1/2/3" y "300", "500", "200".

  Los concursantes son `<circle>` + `<path>` (torso redondeado) con los colores del anexo. Clases para animar: `.plato__beam` (4 haces de arriba y los cruzados de abajo), `.plato__bulb` (4 bombillas del cartel), `.plato__spot` (4 focos), `.plato__onair` y `.plato__buzzer`. El plató conserva su estética de concurso: RF-93 no se aplica al dibujo.
- **Bucle continuo** (RF-8), animaciones CSS `infinite`:
  - haces: oscilan con `rotate` ±5° desde su foco, 6 s `alternate`;
  - bombillas del cartel: `opacity` 0.55 ↔ 1, 2.4 s, desfasadas 0.6 s entre sí;
  - focos: brillo `opacity` 0.75 ↔ 1, 3 s;
  - "On air": `opacity` 0.6 ↔ 1, 2 s;
  - pulsadores: halo suave, 2.8 s desfasado por grupo;
  - concursantes: balanceo vertical de 1 px, 4 s desfasado.

  Ningún ciclo dura menos de 1 s y los cambios de opacidad son suaves (`ease-in-out`). Así nunca hay más de 3 destellos por segundo (RF-86).
- **Movimiento reducido** (RF-87, RNF-2): la regla global `@media (prefers-reduced-motion: reduce)` ya anula las animaciones, así que el plató queda estático y completo. Se elimina `.intro--done`: ya no hay último fotograma.
- **`screens/intro.js`**: se queda en enganchar el clic de "Give feedback" a `onStart` (RF-9). Se quitan `animationend` e `intro--done`, y `reducedMotion` deja de usarse en la intro.
- **Encaje** (RF-88):
  - `main.js` pone `#app[data-screen="<pantalla>"]` en cada `render()`;
  - ~~en `intro` y `country`, `.app` pierde el padding inferior de 84 px reservado para el aviso offline, que solo aparece después de elegir país: queda `16px + safe-area`~~; desde §14.11 no hay espacio reservado: `.app` tiene `16px + safe-area` abajo en todas las pantallas, e `intro`/`country` conservan `display: flow-root`;
  - `#screen-intro` es una columna flex de `height: 100dvh`:
    - `.plato { flex: 1 1 auto; min-height: 0; display: flex; justify-content: center }`, con el SVG a `height: 100%; width: auto; max-width: 100%`;
    - textos y botón con `flex: none`.
  - Así el plató se reduce de forma proporcional hasta que todo cabe, sin scroll vertical, con al menos 568 px de alto.
  - `@media (max-height: 567px)`: `#screen-intro { height: auto }` y `.plato svg { height: 300px }`, de modo que aparece el scroll vertical.
  - Estimación a 320×568: unos 290 px de plató (unos 218 px de ancho). A 375×667: unos 400 px (unos 300 px de ancho).
- Texto de la intro: centrado; `.intro__thanks` a 1.05rem, peso 600, `--text`; `.intro__ask` a 1rem, `--muted`.

### 14.5 Selector de país — RF-10, RF-11, RF-15, RF-16, RF-89 a RF-91
- **HTML**: se eliminan el `<form class="search">`, `#country-search` y `.countries__empty` (RF-90). Queda el `<h1>` "Where are you from?" y `<ul class="countries" aria-label="Countries">`.
- **`screens/country.js`**: pinta `countryTiles(countries)` una sola vez. Cada casilla es un `<li><button class="country" data-code="…"><img class="country__flag" alt="<nombre>"></button></li>`:
  - el nombre accesible sale del `alt`: el nombre del país, o "Other" en la casilla de `other.svg` (RF-89);
  - no hay texto visible.

  El clic llama a `onChoose(code)` igual que ahora (RF-15, RF-16).
- **CSS**:
  - `.countries { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px }`;
  - `.country { aspect-ratio: 1; padding: 0; overflow: hidden; border: 2px solid var(--line); border-radius: 14px; background: var(--street) }`;
  - `.country__flag { width: 100%; height: 100%; object-fit: cover }`, así que la bandera rellena la casilla, centrada y recortada por los lados (RF-10);
  - la casilla de "Other" lleva el globo centrado al 55 % sobre `--street`;
  - hover y foco: borde `--window` y halo cálido.
  - A 320 px las casillas miden (288 − 24) / 3 = 88 px ≥ 64 (RF-91). Con 12 casillas (4 filas): 4 × 88 + 3 × 12 = 388 px, más el título (unos 70 px), cabe en 568 − 32 px sin scroll. Con 7 casillas (3 filas) sobra espacio.
- **Decisión**: 3 columnas fijas. **Descartado**: 4 columnas, porque a 320 px las casillas medirían 63 px, por debajo del mínimo de RF-91.

### 14.6 Ciudad en planta — RF-69 a RF-72, RF-75, RF-76, RF-78
- **SVG** (`index.html`, `#city`), con `viewBox="0 0 400 300"` (4:3), sustituye al perfil actual. Se eliminan `city__sky`, `city__stars`, `city__moon` y `city__skyline` (RF-69).
  - Fondo `--night`. Una cuadrícula de **calles** (`<g class="city__streets" aria-hidden="true">`): 3 avenidas horizontales y 4 verticales de 10-12 unidades de ancho, con línea discontinua central. Apagadas en `#232d5e`; encendidas, con farolas (círculos pequeños `.lamp`) en `--window`.
  - **Manzanas** como rectángulos `#141b3d` con esquinas redondeadas entre las calles.
  - **20 edificios de relleno** (RF-70): `<rect class="filler" data-filler style="--fx:0.xx">` dentro de las manzanas, de tamaños variados, con `aria-hidden`. Apagados en `#232d5e`; encendidos, con ventanas `.win` en `--window`. `--fx` (0-1) es su posición horizontal relativa y sirve para que la ola los encienda a su paso.
  - **10 sitios** `<g class="site" data-site="…">`, cada uno con un icono visto desde arriba, distinto de los demás y de los rectángulos de relleno, sin texto (RF-71):

| Sitio | Icono |
|---|---|
| park | mancha verde redondeada con copas de árbol (círculos) y un camino curvo |
| concert-hall | tejado en abanico (sector circular) con ondas |
| museum | planta cuadrada con patio central y columnas en el perímetro |
| theatre | graderío en semicírculo frente a un escenario rectangular |
| cinema | rectángulo con una banda de película perforada |
| fairground | noria vista desde arriba (círculo con radios) y una carpa de rayas |
| town-square | plaza cuadrada adoquinada con fuente circular en el centro |
| food-market | rejilla de 6 puestos con toldos a rayas |
| nightclub | edificio con una estrella / bola de discoteca de neón |
| stadium | óvalo con campo rectangular y 4 torres de focos |

  - Encendido de cada sitio: luces `.lt` y halo `.glow` (como ahora, con fundido de opacidad).
  - Para la ola y los coches: los `.car`, vistos desde arriba (rectángulo con faros), se colocan sobre las avenidas.
  - **Periferia**: calles y manzanas sin edificios que se dibujan **fuera** del viewBox (y de −200 a 0 y de 300 a 500). El SVG tiene `overflow: visible` y solo se ven en el final a pantalla completa (§14.7). No cuentan como edificios de relleno.
- **Estados por CSS**:
  - `.filler`, `.city__streets .lamp` y `.win` están apagados salvo con `#city[data-all-lit]` (RF-72);
  - `data-all-lit` lo pone `paintCity` cuando `cityView().allLit`, lo que solo ocurre con los 10 sitios, es decir, en el final.
- **Tamaño en las preguntas** (RF-76, RF-78):
  - `[data-screen="question"] .city-wrap { height: min(40dvh, calc((100vw - 32px) * .75)); overflow: hidden; display: flex; justify-content: center }`;
  - el SVG va con `height: 100%; width: auto; max-width: 100%`.
  - A 375×667 eso da como máximo 266 px de alto (40 %), con la ciudad entera y sin zoom (`meet`).
  - La ciudad va arriba y el resto de la pregunta debajo, en el flujo normal, sin superponerse. Se permite scroll vertical en la pregunta, como ahora.

### 14.7 Final — RF-53, RF-54, RF-73, RF-74, RF-77, RF-79
- **Texto**: `<h1 id="final-title">Leisure for Society</h1>` (RF-53, RF-54) y el comentario de `screens/final.js` actualizado.
- **Ciudad a pantalla completa** (RF-79): `[data-screen="final"] .city-wrap { position: fixed; inset: 0; z-index: 0; background: var(--night) }`, con el SVG a `width: 100%; height: 100%` y `meet`. La ciudad entera queda centrada y la periferia (`overflow: visible`) rellena el resto de la pantalla.
- **Banderas y textos** encima (`z-index: 1`), en un panel inferior `rgb(11 16 38 / .82)` con radio de 20 px, para mantener el contraste de 4.5:1 sobre la ciudad encendida (RNF-4). El confeti sigue en `position: fixed`.
- **Encendido total con la ola** (RF-73, RF-74): la fase `wave` de `final-view.js` (0-1400 ms) no cambia de tiempos. Bajo `#app[data-final="play"]`:
  - `.city__wave` (degradado vertical) cruza el viewBox de izquierda a derecha;
  - cada `.filler`/`.win` se enciende con `animation: city-on 300ms ease both`, retrasada `calc(var(--final-wave-start) + var(--fx) * var(--final-wave-dur))`, de modo que se enciende cuando pasa la ola;
  - las calles y las farolas se encienden igual, con su `--fx`;
  - los estilos base con `data-all-lit` son el estado encendido, así que `done`, una recarga y el movimiento reducido lo muestran directamente (RF-54, RF-56, RF-77).
- **Coches**: los 3 `.car` circulan por las avenidas horizontales con la misma fase `cars` y terminan aparcados.
- **Tiempo total**: 7,2 s, sin cambios en `FINAL_PHASES` (≤ 8 s, RF-74). `flagLayout` y `confettiPieces` tampoco cambian. Con 6 banderas, `flagLayout(6)` ya está cubierto por el test de 1 a 20 banderas.
- **Movimiento reducido** (RF-77): sin cambios. `show()` llama a `done()` y la ciudad aparece entera encendida con un fundido de opacidad de 200 ms como máximo, por la regla global.

### 14.8 Tests (`node --test`)
| Archivo | Cambio | Cubre |
|---|---|---|
| tests/content.test.js | **Actualizar**: versión `"2026-10-test-2"`; regla "between 6 and 11 countries" (con 5 → error, con 12 → error, con 6 y con 11 → sin error de número); los tests de nombre y bandera usan `NL` en lugar de `FR` (`country NL.*name`, `country NL.*flag`); nuevo test de que los países son exactamente `[NL, DE, IT, PL, JP, NG]` en ese orden; el test de `flagPath("FR")`/`("CI")` puede quedarse (es la función, no el contenido) | RF-3, RF-4, RNF-10 |
| tests/countries.test.js | **Reescribir**: se eliminan los 14 tests de `normalize`, `sortCountries`, búsqueda y `noResults`. Nuevos: `countryTiles` conserva el orden de los datos, pone "Other" al final, no muta la entrada y con el contenido real da 7 casillas; `OTHER_ENTRY` se queda | RF-10, RF-11, RNF-7 |
| tests/city-view.test.js | **Nuevo**: `lit` en orden de pregunta, sin IDs desconocidos ni duplicados; `allLit` falso con 0, 9 y 9 + duplicado, y verdadero con 10; etiqueta con 0, 3 (nombres en inglés en orden) y 10; `SITE_NAMES` tiene un nombre para cada `SITE_ID` | RF-29, RF-72, RF-73, RF-75 |
| tests/markup.test.js | **Nuevo**, comprobaciones estáticas de `index.html` y `css/survey.css` leídos como texto (como el test de `data-site` que ya existe): intro con los textos literales de RF-81 y RF-82 y el botón "Give feedback", y sin "Start"; plató con las 5 cabeceras, los "Group 1/2/3" con 300/500/200 y "On air"; sin `country-search` ni "No countries found"; final con "Leisure for Society" y sin "Society of Leisure"; entre 15 y 25 `data-filler`, cada uno con `--fx`; sin `city__sky`, `city__moon` ni `city__stars`; en el CSS, toda animación `infinite` dura ≥ 1 s (RF-86), no hay `text-transform: uppercase` ni "Arial Black" (RF-95) y no hay `linear-gradient` en `.option` ni en `.btn` (RF-93) | RF-7, RF-53, RF-54, RF-69, RF-70, RF-81 a RF-86, RF-90, RF-93, RF-95 |
| tests/final-view.test.js | Sin cambios (los tiempos no cambian) | RF-53, RF-74 |
| tests/payload.test.js, tests/persistence.test.js | Sin cambios: usan `"2026-10-test-1"` como dato de prueba propio, independiente de `CONTENT` | — |
| Resto | Sin cambios | — |

Fuera de `node --test`, validación con el MCP Chrome DevTools a 375×667 y 320×568 (además de 430 px de ancho):
- la intro sin scroll y el bucle en marcha (comprobar con `getAnimations()` que hay animaciones `infinite` corriendo);
- el plató comparado con el Anexo B;
- movimiento reducido (simulado como en T10) → plató estático;
- 7 casillas sin scroll y nombres accesibles en el árbol de accesibilidad;
- la ciudad ≤ 40 % del alto en las preguntas;
- el final a pantalla completa con la ola en ≤ 8 s;
- revisión visual de RF-92 a RF-97 y contraste (RNF-4);
- consola limpia;
- "Give feedback" pulsable en < 3 s con Fast 4G y sin caché (RNF-5).

### 14.9 Cobertura del cambio
| Parte | RF / RNF |
|---|---|
| content.js + content-validate + banderas + other.svg | RF-3, RF-4, RF-11, RNF-10 |
| countries.js (`countryTiles`) + screens/country + CSS de la cuadrícula | RF-10, RF-11, RF-15, RF-16, RF-89 a RF-91 |
| sites.js (`SITE_NAMES`) + city-view.js + city.js | RF-29, RF-72, RF-73, RF-75 |
| SVG de la ciudad + CSS de la ciudad | RF-69 a RF-72, RF-76, RF-78 |
| Tokens y estilos de survey.css + screens/question (check) | RF-17, RF-92 a RF-97, RNF-4 |
| SVG del plató + screens/intro + CSS de la intro + `data-screen` en main.js | RF-5 a RF-9, RF-80 a RF-88, RNF-2 |
| screens/final + CSS del final | RF-53, RF-54, RF-73, RF-74, RF-77, RF-79 |
| markup.test.js | comprobaciones estáticas de los RF de texto, plató, ciudad y estilo |

### 14.10 Al cerrar el cambio
- MEMORY.md:
  - versión `2026-10-test-2`;
  - 6 países de prueba;
  - las filas de prueba `2026-10-test-1` también se borran antes del evento;
  - estilo "ciudad de noche" en lugar del de concurso;
  - el plató es la única pieza con estética de concurso.
- AGENTS.md: sin cambios de stack. Si el estilo se consolida, proponer una línea en Convenciones: "estética de ciudad nocturna; el plató de la intro es la única pieza de concurso".

### 14.11 Aviso offline dentro de la página — RF-49, RF-50, RNF-4 (decisión del usuario, T19, 2026-10-17)
Motivo: en la validación de T19, a 320×568, el aviso fijo abajo tapaba parte de la opción B (Q1) o el campo de texto (Q9) hasta hacer scroll, y en el final el panel subía 44 px por el aviso y tapaba ~40 px de nightclub y stadium. Opción elegida: (a) "dentro de la página". Descartadas: (b) aviso fijo arriba, sobre la ciudad, y (c) matizar RF-49 a "al final del scroll".
- **`index.html`**: desaparece el `<div id="offline-notice">` fijo fuera de `<main>`. Hay dos `<p class="offline-notice" data-offline-notice role="status" aria-live="polite">`: uno en `#screen-question`, justo después de `.actions--nav`, y otro en `#screen-final`, justo después de "Thank you" (dentro del panel). En intro y selector no hay aviso.
- **`main.js`**: `setNotice(visible)` escribe el texto y la clase `is-visible` en todos los `[data-offline-notice]`. Solo se ve (y lo anuncia el lector) el de la pantalla visible.
- **`survey.css`**:
  - `.offline-notice` es una línea discreta en el flujo (`--muted`, `.85rem`, `line-height: 1.25`, centrada, con un punto `--window` delante cuando está visible); vacía mide 0 px. Sin `position: fixed` ni `pointer-events`.
  - Se elimina el padding inferior de 84 px de `.app` (queda `16px + safe-area` en todas las pantallas) y la regla `body:has(.offline-notice.is-visible) .screen--final` que subía el panel.
  - En el final, `.screen--final:has(.offline-notice.is-visible)` devuelve la altura de la línea (19 px) desde su propio espacio inferior (`bottom` de 16 a 4 px y `padding-bottom` de 16 a 9 px), así que el borde superior del panel no se mueve y no tapa la ciudad.
  - Mientras suena el final, el aviso del panel entra con los textos (misma animación que "Thank you"); con movimiento reducido aparece directamente.
- **Tests** (`tests/markup.test.js`): 2 avisos `data-offline-notice` con `role="status"` y `aria-live="polite"`, uno tras `.actions--nav` y otro tras "Thank you", ninguno en intro ni selector, sin `id="offline-notice"`; `main.js` usa `querySelectorAll("[data-offline-notice]")`; ninguna regla `.offline-notice` con `position: fixed|absolute|sticky` ni `pointer-events`; sin `body:has(.offline-notice` ni `84px`; `.app` con `16px + safe-area`; regla de compensación del panel con `bottom` y `padding-bottom`. *(Esta regla desaparece en §15.6: el panel pasa a estar en el flujo.)*

## 15. Cambio de requisitos 2026-10-17: animaciones y ciudad
Cubre RF-7, RF-8, RF-54, RF-56, RF-69, RF-71, RF-74, RF-77, RF-79, RF-87 (modificados), RF-98 a RF-118 (nuevos), RNF-2, RNF-4, RNF-7 (modificados) y RNF-12 (nuevo). Esta sección **sustituye** a lo que digan §14.4 (entrada de la intro), §14.6 (periferia, edificios de relleno e iconos), §14.7 (ciudad a pantalla completa, coches que aparcan) y §14.11 (compensación del panel del final). No cambian la tabla, las políticas RLS, la RPC, la sincronización, la persistencia ni la máquina de estados (`survey-state.js`). Sin dependencias nuevas: todo es CSS, SVG en línea y la Web Animations API nativa del navegador.

### 15.1 Lógica pura nueva o ampliada (`js/lib/`) — RNF-7
Todas sin DOM, red ni reloj (el tiempo se pasa como parámetro).

**`intro-entry.js`** (nuevo) — RF-98, RF-100
```
INTRO_ENTRY_MAX_MS = 2000
BUTTON_HIGHLIGHT_MAX_MS = 600
INTRO_ENTRY = [                     // orden de RF-98; ms
  { id: "lights",  start:    0, duration: 500 },   // riel, 4 focos y haces
  { id: "sign",    start:  200, duration: 400 },   // cartel "Leisure in / Jeopardy" y bombillas
  { id: "board",   start:  400, duration: 500 },   // tablero
  { id: "onair",   start:  650, duration: 350 },   // postes y "On air"
  { id: "floor",   start:  800, duration: 300 },   // borde y suelo del escenario
  { id: "people",  start:  950, duration: 500 },   // concursantes y atriles
  { id: "thanks",  start: 1200, duration: 400 },   // texto de RF-81
  { id: "ask",     start: 1350, duration: 400 },   // texto de RF-82
  { id: "button",  start: 1400, duration: 600 },   // realce del botón (sin opacidad ni movimiento)
]
introEntryEndMs(steps) = max(start + duration)
introEntryCssVars(steps) → { "--enter-<id>-start": "<n>ms", "--enter-<id>-dur": "<n>ms" }
```

**`transition.js`** (nuevo) — RF-103 a RF-108
```
TRANSITION_OUT_MS = 150; TRANSITION_IN_MS = 250; REDUCED_FADE_MS = 200
cityMode(screen) = "none" (intro, country) | "question" | "final"
planTransition(prev, next, { reduced }) →
  { scope: "none" | "panel" | "screen", outMs, inMs, totalMs, cityFades: boolean }
  prev = null (primera pintura, recarga, reanudación)            → scope "none"      (RF-107)
  misma pantalla y misma pregunta (elegir opción, escribir)      → scope "none"
  pregunta → otra pregunta                                       → scope "panel", cityFades false (RF-104)
  otro cambio de pantalla                                        → scope "screen", cityFades = cityMode(prev) ≠ cityMode(next)
  reduced: outMs 0, inMs = REDUCED_FADE_MS                       (un solo fundido, RF-108)
  si no:   outMs 150, inMs 250; si next es "final", inMs 0 (el final trae su propia llegada)
  totalMs = outMs + inMs
openGate() → { busyUntil: 0 }
closeGate(gate, now, totalMs) → { busyUntil: now + totalMs }
gateAllows(gate, now) → now >= gate.busyUntil                  (RF-106)
```
La puerta depende solo del tiempo, así que nunca se queda cerrada aunque una animación no termine (pestaña en segundo plano).

**`site-labels.js`** (nuevo) — RF-112, RF-113
```
LABEL_FONT = 11.5          // unidades del viewBox: 11.5 × 288 / 400 = 8.3 px a 320 px (RF-113)
LABEL_LINE = 1.15          // interlineado
CHAR_WIDTH = 0.62          // ancho medio estimado de un carácter en negrita, en em (conservador)
SITE_LAYOUT = { <siteId>: { block: {x,y,w,h}, icon: {x,y,w,h}, label: { x, y, lines: [..] } } }
  // lines = SITE_NAMES partido en 1 o 2 líneas: "Concert"/"hall", "Town"/"square", "Food"/"market"; el resto en 1
labelBox(label) → {x,y,w,h}           // centrado en x; ancho = máx. línea × CHAR_WIDTH × LABEL_FONT + 4 de margen
minLabelPx(mapWidthPx) = LABEL_FONT × mapWidthPx / 400
boxesOverlap(a, b) → boolean
```
El rótulo de cada sitio va bajo su icono: en la parte baja de su manzana y, si no cabe, sobre la calle de debajo (nunca sobre otra manzana con sitio). Los iconos se reducen y suben dentro de su manzana para dejar sitio (§15.4).

**`final-view.js`** (ampliado) — RF-74, RF-114 a RF-117
- `liveDelays({ animate })` → `{ cars: "900ms", city: "1400ms" }` si `animate` (los coches arrancan con la fase `cars`; ventanas, farolas, agua y luces de los sitios cuando acaba la ola), o `{ cars: "0ms", city: "0ms" }` al reabrir. Son `--live-cars-delay` y `--live-delay` en `#app`.
- `FINAL_PHASES` no cambia (7,2 s). Nuevo test: `TRANSITION_OUT_MS + finalEndMs() ≤ FINAL_MAX_MS` (7,35 s ≤ 8 s, RF-74).

**`city-view.js`** (ampliado) — RF-105, RF-73
- `holdFullLight(view)` → `{ ...view, allLit: false }`. Al pulsar "Next" en la Q10 el estadio se enciende al momento (RF-105), pero `data-all-lit` (relleno, ventanas, calles) se pone al cambiar al final, a la vez que `data-final="play"`, para que la ola sea la que enciende la ciudad (RF-73).

### 15.2 Entrada de la intro y paso al bucle — RF-7, RF-8, RF-87, RF-98 a RF-102
- **`index.html`**: los elementos del plató se agrupan, sin moverlos ni cambiar su orden de dibujo, en 6 `<g class="plato__enter" data-enter="lights|sign|board|onair|floor|people">` (los 8 haces, el riel y los 4 focos; cartel con bombillas y textos; tablero; postes y "On air"; suelo, elipse y borde; los 3 grupos). Las clases de bucle (`plato__beam`, `plato__spot`, …) quedan en los hijos, así que **la entrada anima el grupo y el bucle anima los hijos**: no compiten por la misma propiedad `animation` y el bucle sigue sin saltos al terminar la entrada (RF-99).
- **`css/survey.css`**:
  - En `.screen--intro` se declaran literalmente las variables `--enter-<id>-start/-dur` con los valores de `INTRO_ENTRY` (un test comprueba que coinciden). **Decisión**: valores en el CSS. **Descartado**: ponerlos desde JS, porque la intro se pinta antes de que cargue el módulo y habría un parpadeo (todo visible, luego oculto, luego entrando) y más trabajo antes de "Give feedback" (RNF-5).
  - `.plato__enter { animation: intro-enter var(--enter-<id>-dur) ease-out var(--enter-<id>-start) both }` con `@keyframes intro-enter { from { opacity: 0; transform: translateY(6px) } }`; para `people`, `translateY(10px)`; para `lights`, solo opacidad. `.intro__thanks` y `.intro__ask` usan la misma animación con sus variables. Solo `transform` y `opacity`: no cambia el tamaño de nada ni aparece scroll horizontal (RF-102).
  - Botón (RF-100): `.screen--intro .btn { animation: intro-btn-glow var(--enter-button-dur) ease-in-out var(--enter-button-start) both }`, que solo anima `box-shadow` (halo cálido que crece y vuelve al de reposo). Nunca toca `opacity`, `visibility` ni `transform`: está visible, en su sitio y pulsable desde el primer fotograma (RF-7, RF-101).
  - Los desfases de las bombillas usaban `:nth-of-type(5-8)` sobre los `<circle>` del SVG; al quedar dentro de su grupo pasan a `:nth-of-type(1-4)`. Se revisan todos los `:nth-of-type` y `:nth-child` del plató.
  - Movimiento reducido: la regla global `animation: none !important` quita entrada y bucle. Los estilos base son el plató completo, así que todo se ve al momento y quieto (RF-87).
- **`screens/intro.js`**: sin cambios (solo el clic). El clic durante la entrada funciona porque no hay nada que lo bloquee; la transición de §15.3 hace el resto.

### 15.3 Transiciones de pantalla y de pregunta — RF-103 a RF-108, RNF-4
- **`main.js`** se reorganiza en tres pasos. Así el guardado no espera a ninguna animación y la puerta impide los dobles toques.
```
gate = openGate(); shown = null            // { screen, current } pintados
act(fn): si !gateAllows(gate, performance.now()) → return; fn()      // envuelve TODOS los manejadores:
         onStart, onChoose, onSelect, onText, onNext, onBack y el onBack del historial (RF-106)
update(nextSurvey):
  local = …; persist()                                           // como ahora
  plan = planTransition(shown, target(nextSurvey), { reduced: prefersReducedMotion() })
  view = cityView(litSites(...))
  paintCity(city, target es "final" y plan.scope ≠ "none" ? holdFullLight(view) : view)   // sitio encendido YA (RF-105)
  si plan.scope == "none": render(); return
  gate = closeGate(gate, performance.now(), plan.totalMs)
  fadeOut(elementos que salen, plan.outMs)                       // sección actual (y city-wrap si plan.cityFades)
  setTimeout(() => { render(); fadeIn(elementos que entran, plan.inMs) }, plan.outMs)
onNext: result = next(...); update(result.state); commit()       // commit() justo después: antes de que acabe el fundido
```
  - `render()` es el de ahora: cambia `hidden`, pinta la pregunta y la ciudad (la vista completa, con `allLit`) y arranca el final. El foco pasa al título al empezar el fundido de entrada (RNF-4).
  - En `scope "panel"` solo se funde `#screen-question`; `#city-wrap` no se toca (RF-104). El contenido de la pregunta saliente se queda tal cual durante el fundido de salida, porque `render()` aún no ha corrido.
  - Al abrir o recargar, `shown` es `null`: primera pintura directa (RF-107). La intro se ve con su entrada CSS, y la pregunta reanudada o el final, directamente.
  - Atrás del sistema durante una transición: `act` lo ignora y `history.js` vuelve a poner la guarda como siempre, así que no se sale de la página ni se pierde nada. `history.js` no cambia.
  - Cuando la puerta se abre tras una transición, se repinta la pregunta una vez: si el participante tecleó durante el fundido de entrada, ese texto se descarta y el campo vuelve a mostrar el estado guardado.
- **Fundidos** (nuevo `js/app/fade.js`, adaptador de interfaz sin lógica): `fadeOut`/`fadeIn` usan `el.animate([{opacity:1},{opacity:0}], {duration, fill:"forwards"})` (Web Animations API, nativa) y, al terminar el fundido de entrada, `cancel()` para no dejar estilos colgados. Con duración 0 no se anima nada. **Decisión**: WAAPI con las duraciones de `transition.js`. **Descartado**: clases CSS con `@keyframes`, porque entre dos preguntas la sección es la misma y habría que forzar un reflow para reiniciar la animación, y además la regla global de movimiento reducido (`animation: none !important`) anularía también el fundido de 200 ms que sí exige RF-108.
- **CSS**: se eliminan `.screen { animation: screen-in 200ms }`, `@keyframes screen-in` y su copia en el bloque de movimiento reducido. Si no, se sumarían a los fundidos nuevos y además habría un fundido en la primera pintura, que RF-107 no quiere.
- **Q10 → final**: fundido de salida de 150 ms de la pregunta y de la ciudad (`cityFades`, porque la ciudad cambia de modo); después `render()` pone el final, `data-all-lit` y `data-final="play"` a la vez. La llegada sigue durando 7,2 s, así que termina a 7,35 s de "Next" (RF-74).

### 15.4 Ciudad en planta rediseñada — RF-69, RF-70, RF-71, RF-109 a RF-111, RNF-4
`viewBox 0 0 400 300` y la cuadrícula de calles no cambian (3 avenidas horizontales en y = 70, 145 y 220, y 4 verticales en x = 75, 155, 235 y 315), ni tampoco `data-site`, `data-filler`, `--fx`, `.win`, `.lamp`, `.street--v`, `.city__wave`, `.glow`, `.lt` y `.lt-stroke`, que usan el CSS, `city.js` y los tests.
- **Mapa acotado** (RF-111):
  - se borra toda la periferia: las calles van de 0 a 400 y de 0 a 300, y desaparecen las manzanas con y < 0 o y > 300 y el suelo de −200…600;
  - todo el contenido va dentro de `<g class="city__map" clip-path="url(#map-clip)">`, con `<clipPath id="map-clip"><rect width="400" height="300" rx="12"/></clipPath>`, de modo que nada (coches, ola) se dibuja fuera;
  - encima, fuera del recorte, va `<rect class="city__border" x="1" y="1" width="398" height="298" rx="11">` con trazo de 2 unidades en `--line` al 60 %;
  - `.city { overflow: hidden }` (antes `visible`).
- **Volumen y sombras** (RF-109). Luz desde arriba a la izquierda y sombra hacia abajo a la derecha en toda la ciudad:
  - cada edificio de relleno es `<g class="filler" data-filler style="--fx">` con:
    - `<rect class="shadow" transform="translate(2.5 3)">` (`#050816`, opacidad .45);
    - `.filler__roof` (tono base);
    - `.filler__face`, el faldón iluminado: la mitad superior o izquierda del tejado, un tono más claro;
    - `.filler__ridge`, la línea de cumbrera;
    - las ventanas `.win` dentro de `<g class="filler__lights">` (para el bucle de §15.7).
  - Cada sitio lleva sus `.shadow` con el mismo `translate(2.5 3)` y al menos dos tonos en su tejado: `.body` y `.body--top`, el más claro, en cubiertas, gradas, toldos y cornisas.
  - La ola de la llegada también aclara `.filler__face`.
  - **Decisión**: sombras como copias desplazadas de las formas. **Descartado**: `<filter>` con `feDropShadow`, porque el filtro se recalcularía en cada fotograma mientras parpadean las ventanas y circulan los coches, que están dentro del mismo grupo (riesgo para RNF-12).
- **Naturaleza y agua** (RF-110), en `<g class="city__nature" aria-hidden="true">`:
  - 2 manzanas que ahora no tienen sitio pasan a ser zonas verdes `<rect class="green" data-green>`: la central de la fila 2 (x 168-232, y 83-142) y la de la esquina inferior derecha (x 328-397, y 233-297). Sus 4 edificios de relleno se quitan: quedan **16** (dentro de 15-25, RF-70).
  - En la zona verde central va un estanque `<path class="water" data-water>` con 2 o 3 `.water__ripple` (arcos claros finos).
  - ≥ 12 árboles `<g class="tree">` (sombra + copa `#24504a` + brillo pequeño más claro): unos 5 en cada zona verde y ≥ 2 en los bordes de manzanas de relleno, nunca sobre calles, tejados ni sitios.
  - Con `#city[data-all-lit]`, las zonas verdes y los árboles se aclaran como el parque.
- **Iconos de los sitios** (RF-71): se mantienen los motivos de §14.6 con más detalle (dos tonos, sombra) y se reducen al 75-85 %, subidos dentro de su manzana para dejar el hueco del rótulo. La caja de cada icono queda en `SITE_LAYOUT[id].icon`: en la validación se comprueba con `getBBox()` que el dibujo real cabe en esa caja.
- **Orden de dibujo** dentro de `.city__map`: suelo, calles (con farolas), manzanas, naturaleza, relleno, sitios, coches, **rótulos**, ola. Los rótulos quedan encima de los coches, así que un coche nunca tapa un rótulo (RF-117).
- **Accesibilidad**: el SVG sigue con `role="img"` y el `aria-label` de RF-75. Sus hijos no se exponen y además `.city__labels`, `.city__nature`, `.city__cars` y los grupos de relleno llevan `aria-hidden="true"`, así que los nombres no se leen dos veces (RNF-4).

### 15.5 Rótulos de sitio — RF-71, RF-75, RF-77, RF-112, RF-113
- **`js/app/city.js`**: nueva `mountCityLabels(svg, layout = SITE_LAYOUT)`, que se llama una vez al arrancar. Crea en `<g class="city__labels" aria-hidden="true">` un `<g class="site-label" data-site-label="<id>">` por sitio, con:
  - un rectángulo de fondo `rgb(11 16 38 / .78)` con radio de 3;
  - un `<text>` con 1 o 2 `<tspan>` y el texto puesto con `textContent`.
  `paintCity` también pone `is-lit` en `[data-site-label]` según `view.lit`. **Decisión**: rótulos creados desde `SITE_LAYOUT`, una sola fuente de verdad para posiciones y textos (los tests de solapes miran lo mismo que se pinta) y `index.html` sigue sin `<text>` en la ciudad. **Descartado**: escribirlos a mano en el HTML, porque habría dos copias de las posiciones.
- **CSS**:
  - `.site-label { opacity: 0; transition: opacity 400ms ease }` y `.site-label.is-lit { opacity: 1 }` (RF-112);
  - texto `--text`, `font: 700 11.5px/1.15 var(--sans)` en unidades del viewBox, `text-anchor: middle`;
  - con movimiento reducido, la regla global deja la transición en 200 ms (RF-77).
  En la reanudación y en el final recargado, la ciudad se pinta mientras aún está oculta (`hidden`), así que el rótulo aparece sin fundido.
- **Tamaño**: a 320 px el mapa mide 288 px de ancho, así que 11,5 unidades son 8,3 px (≥ 8, RF-113). A 375 px son 9,9 px, y en el final, más.
- **Contraste**: `--text` sobre el fondo del rótulo al 78 % da ≥ 12:1 sobre la ciudad oscura. Se mide con DevTools el peor caso, sobre el halo encendido de un sitio vecino.

### 15.6 Final con el mapa acotado — RF-54, RF-56, RF-79, RNF-4
- **CSS** (sustituye a §14.7, "Ciudad a pantalla completa"):
  - `.app[data-screen="final"]` pasa a ser una columna flex de `100dvh` (menos el padding inferior), con `display: flex; flex-direction: column; gap: 8px`;
  - `[data-screen="final"] .city-wrap` lleva `flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; margin: 8px -8px 0`. El margen negativo deja 8 px hasta el borde de la pantalla, que es el mínimo de RF-79, en lugar de los 16 px de `.app`. Va **sin** `position: fixed` ni `inset: 0`;
  - `[data-screen="final"] .city` lleva `height: 100%; width: auto; max-width: 100%` (`meet`, sin `slice`): el mapa entero, lo más grande posible y centrado;
  - alrededor se ve el fondo de `body` (noche lisa), sin calles.
- **Panel**: `.screen--final` deja de ser `position: fixed` y queda en el flujo (`flex: none`) bajo el mapa, con el mismo fondo `rgb(11 16 38 / .82)` y radio de 20 px. En el estado final el mapa y el panel nunca se solapan, porque el flex reparte el alto. Se borra `.screen--final:has(.offline-notice.is-visible)`: con el panel en el flujo, el aviso solo encoge un poco el mapa. El confeti sigue en `position: fixed`. Durante el giro, las banderas pueden pasar por encima del mapa (RF-79 solo pide que no se solapen en el estado final).
- **Medidas esperadas**:
  - a 375×667, el mapa mide ≈ 359×269 (en las preguntas, 343×257) y el panel, unos 175 px;
  - a 320×568, el mapa mide ≈ 304×228 (en las preguntas, 288×216).
  Si en una pantalla baja el alto manda, el mapa se reduce entero.

### 15.7 Ciudad viva tras el encendido total — RF-53, RF-54, RF-114 a RF-118
- **`screens/final.js`**: `show({ animate })` pone siempre `#app[data-final-live]` y las variables de `liveDelays({ animate })`. Con `animate`, además, pone `data-final="play"` (como ahora) y luego `done`. `hide()` lo quita todo. Los bucles cuelgan de `[data-final-live]`, que no cambia al pasar de `play` a `done`, así que no se reinician ni saltan (RF-117).
- **Bucles**: todas las reglas llevan `.app[data-final-live] #city[data-all-lit]`, son `infinite`, duran ≥ 1 s y usan `ease-in-out` o `linear`, sin `steps()`.
  - **Coches** (RF-114): 4 `.car` con `data-axis="x|y"`, colocados sobre una calle de su eje (3 en las avenidas horizontales, en sentidos alternos, y 1 en una vertical), con:

    ```css
    animation: car-x-<n> <8-12 s> linear var(--live-cars-delay) infinite backwards;
    ```

    Cruzan el mapa de borde a borde moviéndose solo por su eje (`translateX` o `translateY`). Al llegar al borde los recorta `#map-clip` y vuelven a entrar por el otro lado. La llegada ya no los aparca: se borran `final-car` y `--car-from` (RF-53: "coches circulando" sigue siendo cierto desde los 0,9 s).
  - **Ventanas** (RF-115): un tercio de los `.filler__lights` (marcados con `data-twinkle`) hace `opacity` 1 ↔ .55, de 3-5 s y con desfases. El bucle anima el grupo y la ola anima la `.win` de dentro: no compiten.
  - **Farolas** (RF-115): `.lamps` se divide en 2 grupos (`.lamps__a`, `.lamps__b`) que laten `opacity` 1 ↔ .7, 4 s, en contrafase. Las `.lamp` siguen con su animación de la ola.
  - **Agua** (RF-116): `.water__ripple` con `stroke-dasharray` y `stroke-dashoffset`, 6 s `linear`.
  - **Luces de sitios** (RF-116): focos del estadio (`opacity` 1 ↔ .75, 2,5 s), noria de la feria (`<g class="wheel">` gira 360°, 24 s `linear`, `transform-box: fill-box`) y luces de la discoteca (`opacity` 1 ↔ .6, 1,6 s, en contrafase rosa y blanca).
  - **Destellos** (RF-117): ningún cambio de brillo dura menos de 1 s ni pasa de opacidad .55, así que no hay más de 3 destellos por segundo. Banderas, textos y rótulos no tienen bucle.
- **Movimiento reducido** (RF-118): la regla global quita todos los bucles. Los coches se quedan en su posición base, que está sobre su calle y dentro del mapa, y el estado final se ve completo y quieto. `show()` sigue llamando a `done()` directamente.
- **Recarga terminada** (RF-56): `animate` es falso, así que se ve `done` + `data-final-live` con retrasos de 0 ms: bucles desde el primer momento, sin llegada.

### 15.8 Fluidez (RNF-12) y cómo medirla
- Las animaciones nuevas solo usan `opacity`, `transform`, `box-shadow` (solo en el botón, 600 ms una vez) y `stroke-dashoffset`. No hay filtros nuevos ni JS por fotograma: el JS solo pone atributos y lanza los fundidos de WAAPI.
- **Medición** con el MCP Chrome DevTools a 375×667, sin limitar la CPU:
  1. con `evaluate_script`, se instala `new PerformanceObserver(l => window.__long.push(...l.getEntries())).observe({ type: "longtask", buffered: true })`;
  2. se dejan correr 10 s el bucle de la intro, luego 10 preguntas con sus transiciones, y luego 15 s el estado final vivo;
  3. `window.__long.filter(e => e.duration > 50)` debe estar vacío durante los bucles (RNF-12).
  Además, una traza con `performance_start_trace`/`performance_stop_trace` de 10 s del final vivo sirve para revisar que no hay tareas rojas. Con CPU ×4 se mide solo a título informativo.

### 15.9 Tests (`node --test`)
| Archivo | Cambio | Cubre |
|---|---|---|
| tests/intro-entry.test.js | **Nuevo**: los ids siguen el orden de RF-98; las salidas no decrecen; `introEntryEndMs ≤ 2000`; `button` es el último y dura ≤ 600; las variables CSS tienen el formato `--enter-<id>-start/-dur` | RF-98, RF-100 |
| tests/transition.test.js | **Nuevo**: `prev` null → none; misma pantalla y pregunta → none; pregunta → pregunta → panel sin `cityFades`; intro → país sin `cityFades`; país → pregunta y pregunta → final con `cityFades`; 150/250 (y `inMs` 0 hacia el final); reduced → 0/200; `totalMs ≤ 400`; puerta: cerrada entre `now` y `now + total`, abierta después, abierta al principio | RF-103 a RF-108 |
| tests/site-labels.test.js | **Nuevo**: un `SITE_LAYOUT` por `SITE_ID`; las líneas unidas con espacio dan `SITE_NAMES[id]`; ≤ 2 líneas; `minLabelPx(288) ≥ 8`; cada caja de rótulo dentro de 0-400 × 0-300 y bajo su icono (`label.y ≥ icon.y + icon.h`); ningún par de rótulos se solapa; ningún rótulo se solapa con el icono de otro sitio | RF-112, RF-113 |
| tests/final-view.test.js | **Ampliar**: `liveDelays({animate:true})` = fases `cars` y fin de `wave`; `{animate:false}` = 0 ms; `TRANSITION_OUT_MS + finalEndMs() ≤ FINAL_MAX_MS` | RF-74, RF-114 |
| tests/city-view.test.js | **Ampliar**: `holdFullLight` deja `lit` y `label` y pone `allLit` a false sin mutar la entrada | RF-73, RF-105 |
| tests/markup.test.js | **Actualizar**: (1) "the stage loops forever" excluye las reglas `.plato__enter` del "solo infinitas" y se añade que hay 6 `plato__enter` con los `data-enter` de RF-98, con animación finita `both` cuyas variables existen en `.screen--intro` con los valores de `INTRO_ENTRY`; (2) la regla del botón de la intro anima solo `box-shadow` (no hay `opacity` ni `transform` en `@keyframes intro-btn-glow`); (3) se quita "full screen" (`position: fixed; inset: 0`) y se pasa a "mapa acotado": sin `position: fixed` en `[data-screen="final"] .city-wrap`, SVG `height: 100%` + `max-width: 100%`, sin `slice`, `.city` con `overflow: hidden`; (4) el panel: sin `position: fixed` y sin la regla `:has(.offline-notice.is-visible)`; (5) "no visible text" sigue (sin `<text>` en el `#city` del HTML) | RF-79, RF-87, RF-98 a RF-102 |
| tests/markup.test.js | **Nuevo**: ninguna coordenada de calles, manzanas, naturaleza, relleno o coches fuera de 0-400 × 0-300; `clipPath#map-clip` y `.city__border`; 16 `data-filler` (en 15-25), cada uno con `.shadow`, `.filler__roof` y `.filler__face`; todas las `.shadow` con `translate(2.5 3)`; ≥ 2 `data-green`, ≥ 1 `data-water`, ≥ 12 `.tree`; cada árbol dentro de una manzana sin sitio ni relleno debajo; cada `.block` de `SITE_LAYOUT` existe en el HTML; `.city__labels` no está en el HTML y `city.js` crea `data-site-label`; `.site-label` con `opacity: 0` y `transition` ≤ 400 ms, y encendido solo con `.is-lit`; 4 `.car` con `data-axis`, cada uno sobre una calle de su eje, con `@keyframes car-*` que solo usan `translateX` o `translateY` según su eje; los bucles del final cuelgan de `[data-final-live]` y `[data-all-lit]`; sin `final-car` ni `--car-from`; sin `.screen { animation` ni `screen-in`; `main.js` importa `planTransition` y `gateAllows` y llama a `commit()` justo después de `update(result.state)` en `onNext` | RF-70, RF-105, RF-106, RF-109 a RF-117 |
| tests/markup.test.js | **Se mantienen**: "toda animación `infinite` dura ≥ 1 s" (ahora cubre también los bucles del final, RF-117) y "reduced motion stops every animation" (RF-87, RF-118) | RF-86, RF-117, RF-118 |

Fuera de `node --test`, validación con el MCP Chrome DevTools a 375×667 y 320×568, con Supabase bloqueado por initScript y el movimiento reducido simulado como en T16/T18:
- entrada de la intro en orden y ≤ 2 s (`getAnimations()` con `startTime` y `effect.getTiming()`), clic a los 300 ms → selector;
- transiciones medidas con `getAnimations()` y doble clic en "Next" → avanza 1;
- `getBBox()` de iconos y rótulos sin solapes con los 10 encendidos;
- final: mapa y panel sin solaparse y bucles vivos a los 20 s;
- RNF-12 con §15.8;
- consola limpia.

### 15.10 Cobertura del cambio
| Parte | RF / RNF |
|---|---|
| intro-entry.js + grupos `plato__enter` + CSS de entrada y halo del botón | RF-7, RF-8, RF-87, RF-98 a RF-102 |
| transition.js + main.js (`update`/`act`/fundidos WAAPI) + CSS sin `screen-in` | RF-103 a RF-108, RF-74, RNF-4 |
| city-view.js (`holdFullLight`) | RF-73, RF-105 |
| SVG de la ciudad (mapa acotado, borde, sombras, tejados, naturaleza, 16 rellenos, iconos) + CSS | RF-69, RF-70, RF-71, RF-109 a RF-111, RNF-4 |
| site-labels.js + city.js (`mountCityLabels`, `paintCity`) + CSS de rótulos | RF-71, RF-75, RF-77, RF-112, RF-113 |
| CSS del final (columna flex, mapa centrado, panel en el flujo) | RF-79 |
| final-view.js (`liveDelays`) + screens/final.js (`data-final-live`) + bucles CSS | RF-53, RF-54, RF-56, RF-114 a RF-118 |
| Bloque de movimiento reducido (sin cambios) + WAAPI con 200 ms | RF-77, RF-87, RF-108, RF-118, RNF-2 |
| Medición con PerformanceObserver y traza | RNF-12 |

### 15.11 Al cerrar el cambio
- MEMORY.md:
  - intro con entrada y bucle;
  - transiciones WAAPI con puerta de tiempo;
  - mapa acotado con 16 rellenos, 2 zonas verdes y estanque;
  - rótulos generados desde `SITE_LAYOUT`;
  - bucles del final colgados de `data-final-live`;
  - error a evitar: dos animaciones CSS en el mismo elemento se pisan (la entrada y la ola animan el contenedor o el hijo, nunca el mismo elemento que el bucle).
- AGENTS.md: sin cambios de stack. Se puede proponer una regla permanente: "animar solo `opacity`/`transform`; los bucles con ciclos ≥ 1 s".

## 16. Cambio de requisitos 2026-10-18: estilo de la referencia y ciudad viva
Cubre los RF y RNF modificados (RF-8, RF-17, RF-35, RF-53, RF-69, RF-70, RF-73, RF-77, RF-79, RF-85, RF-86, RF-93 a RF-97, RF-103, RF-104, RF-112, RF-114, RF-116, RNF-2, RNF-4, RNF-5, RNF-7 y RNF-12), los nuevos (RF-119 a RF-148 y RNF-13) y los derogados RF-109 y RF-110 (spec, cambio del 2026-10-18, propuestas 23 a 40 aprobadas). Esta sección **sustituye** a:
- §14.3 y la parte de estilo de §15: paleta, tipografía, opciones y botones;
- §15.3: solo las duraciones (150/250 pasan a 200/350) y la entrada, que añade "rise";
- §15.4: toda la ciudad (mapa en planta con volumen, sombras, naturaleza, agua y 16 rellenos);
- §15.5: la posición de los rótulos, que ahora van dentro de su celda;
- §15.7: el agua y las calles por las que van los coches.

**Lo que no cambia**: la tabla, RLS, la RPC, la sincronización, la persistencia, `survey-state.js`, `question-view.js`, los datos de contenido y `CONTENT.version` (recolocar sitios no invalida progreso; caso límite de la spec). Los únicos recursos nuevos son 5 archivos de fuente servidos desde el propio sitio (RNF-13). No hay dependencias de JS nuevas.

### 16.1 Lógica pura nueva o ampliada (`js/lib/`) — RNF-7
Igual que antes: sin DOM, red ni reloj, y el tiempo y el azar se pasan como parámetro.

**`city-grid.js`** (nuevo) — RF-69, RF-70, RF-73, RF-111, RF-139 a RF-141
Es la geometría de la rejilla de la demo, en unidades del viewBox (`0 0 400 292`):
```
COLS = 6; ROWS = 4; CELL_W = 56; CELL_H = 62; GAP = 8; MARGIN_X = 12; MARGIN_Y = 10
VIEW_W = 400; VIEW_H = 292; CENTER = { x: 200, y: 146 }
cellBox(col, row) → { x: 12 + col·64, y: 10 + row·70, w: 56, h: 62 }
SITE_CELLS = {                       // propuesta 29 aprobada; [col, row]
  park: [1,2], "concert-hall": [4,0], museum: [0,0], theatre: [3,3], cinema: [5,1],
  fairground: [3,2], "town-square": [2,0], "food-market": [5,3], nightclub: [3,1], stadium: [0,1] }
fillerCells() → las 14 celdas sin sitio, en orden de lectura
areNeighbours(a, b) → |dc| ≤ 1 y |dr| ≤ 1 y a ≠ b            // vecinas, también en diagonal
readingOrder(cells) / columnOrder(cells)                     // para comprobar RF-139
STREETS = { h: [76, 146, 216], v: [72, 136, 200, 264, 328] }  // ejes de las calles interiores
lampPoints() → farolas en el centro de cada lado de manzana sobre calle y en cada cruce interior (unas 50, ≥ 20, RF-140)
waveDelayFraction(x, y) → distancia a CENTER / distancia máxima a una esquina, en [0, 1] (RF-73)
fillerBuildings(seed) → por celda de relleno, entre 2 y 4 rectángulos dentro de la celda, con un generador
  pseudoaleatorio con semilla (Park–Miller, como la demo), así que el resultado es fijo e igual para todos (RF-70)
```
- **Decisión**: geometría en un módulo puro y SVG de calles, relleno y farolas generado por `city.js` a partir de él. **Descartado**: escribir a mano en `index.html` las 14 manzanas, unos 45 edificios y unas 50 farolas. Habría dos copias de la geometría, y los tests (vecinas, rótulos, ola) no mirarían lo que se pinta.
- Los iconos de los 10 sitios sí siguen escritos a mano en `index.html`, cada uno en coordenadas locales de su celda (0-56 × 0-62) dentro de un `<g data-site transform="translate(x y)">`.

**`site-labels.js`** (rehecho) — RF-112, RF-113, RF-141
- `SITE_LAYOUT` se calcula a partir de `city-grid.js`. Por sitio:
  - `cell`, su celda;
  - `icon`: la franja superior de la celda, de alto ≥ 0,55 × 62 = 34,1 (se usa y 2-40, 38 unidades);
  - `label`: la franja inferior, con 1 o 2 líneas.
- `label.y = cell.y + 62 − alto del rótulo − 1`. El rótulo de 2 líneas (unos 28,5) se superpone a la parte baja del icono, y su fondo oscuro `rgb(6 10 34 / .8)` garantiza el contraste.
- Se mantienen `LABEL_FONT = 11.5` (8,28 px a 320 px), `CHAR_WIDTH = 0.62` (estimación conservadora, válida también para la fuente de reserva, RF-145), `labelBox`, `labelLines`, `boxesOverlap` y `minLabelPx`.
- Nueva `labelSpill(id)` → lo que el rótulo sale por la izquierda y por la derecha de su celda. Fairground (75,3 de ancho) sale 9,65 por cada lado: los 8 de la calle más 1,65 sobre las manzanas de relleno (2,2) y (4,2). Nightclub (68,2) sale 6,1 por cada lado.

**`progress.js`** (nuevo) — RF-125 a RF-130
```
progressView({ litCount, total = 10, current })   // current = índice 0-9 de la pregunta en pantalla, o null en el final
  → { percentText: `${litCount·10}%`, placesText: `${litCount} of ${total} places`,
      segments: [{ filled: i < … según respondidas, current: i === current }] × total }
```
`segments[i].filled` sale del conjunto de preguntas respondidas (no de `litCount` en orden), porque con "Back" la respondida puede ir detrás de la actual. Recibe `answeredIndexes`, que da `litSites()` de `survey-state.js`.

**`city-view.js`** (ampliado) — RF-133 a RF-138, RF-148
```
celebration(prevLit, nextLit, { firstPaint, toFinal }) → { siteId | null, ring: bool, toast: string | null }
  firstPaint (reanudación, reapertura, primera pintura) → nada              (RF-138)
  nuevo = ids en nextLit que no estaban en prevLit; si no hay → nada         (cambio de respuesta, RF-138)
  toFinal (Next en Q10) → { siteId: nuevo, ring: false, toast: null }      (RF-148)
  si no → { siteId: nuevo, ring: true, toast: `Lit up: ${SITE_NAMES[nuevo]}` }
toastPlacement(siteId) → "top" si su fila es 3 (la de abajo), si no "bottom"  (RF-137)
TOAST_MS = 1500; RING_MS = 1200; HALO_FADE_MS = 900
```

**`transition.js`** (ampliado) — RF-103, RF-108, RF-143
- `TRANSITION_OUT_MS = 200` y `TRANSITION_IN_MS = 350`. `totalMs` ≤ 550; `REDUCED_FADE_MS` sigue en 200.
- `planTransition` devuelve además `rise`: verdadero si `inMs > 0`, no hay movimiento reducido y `next` no es el final.

**`intro-entry.js`** (ampliado) — RF-86, RF-119 a RF-124
```
INTRO_LOOPS = { bulbs: { count: 4, cycleMs: 1600 }, board: { count: 13, stepMs: 400 },
                markers: { count: 3, cycleMs: 1500 } }
flashesPerSecond(loop) → bulbs/markers: count / (cycleMs/1000) ; board: 1000 / stepMs     // ≤ 3 (definición de destello)
BOARD_SEQUENCE = las 13 casillas con valor en orden de lectura (sin Community-200 ni Culture & identity-300)
MARKER_COUNT = { start: 1000, duration: 800 }      // dentro de INTRO_ENTRY_MAX_MS (RF-123)
markerValueAt(target, elapsedMs) → 0 antes de start; entero creciente (múltiplos de 10); target exacto desde start+duration
markerCountPlan(elapsedMs) → "count" si elapsedMs < MARKER_COUNT.start, si no "skip"
```
Si el módulo carga tarde (con la red lenta, después de que los marcadores ya se vean), no cuenta y deja los valores fijos del HTML. Así nunca se ve un 300 que salta a 0.

**`final-view.js`**: `FINAL_PHASES` no cambia (7,2 s). El test pasa a `TRANSITION_OUT_MS (200) + finalEndMs() = 7400 ≤ 8000` (RF-74).

### 16.2 Tipografías — RF-142, RF-145, RNF-5, RNF-13
- **Archivos**: `assets/fonts/` con:
  - `big-shoulders-display-latin-700.woff2`, `big-shoulders-display-latin-800.woff2`, `figtree-latin-400.woff2`, `figtree-latin-600.woff2` y `figtree-latin-700.woff2`;
  - `OFL-BigShouldersDisplay.txt` y `OFL-Figtree.txt`.
- **Origen**:
  - los woff2 del paquete de Fontsource, con una versión fija publicada hace ≥ 2 semanas (regla de MEMORY), en `https://cdn.jsdelivr.net/npm/@fontsource/figtree@<versión>/files/figtree-latin-<peso>-normal.woff2` y `…/@fontsource/big-shoulders-display@<versión>/files/big-shoulders-display-latin-<peso>-normal.woff2`;
  - las licencias, del repositorio oficial `github.com/google/fonts` (`ofl/figtree/OFL.txt` y `ofl/bigshouldersdisplay/OFL.txt`).
  - **Es una descarga de archivos de terceros: el implementer la confirma con el usuario antes de hacerla** y anota en la tarea la versión y el tamaño de cada archivo. Si no hay red, para y lo pide.
- **CSS**: 5 `@font-face` con `src: url("../assets/fonts/…woff2") format("woff2")`, `font-display: optional` y `unicode-range` latino.
  - `--display: "Big Shoulders Display", var(--sans)` y `--body: "Figtree", var(--sans)`, donde `--sans` es la pila actual del sistema (la fuente de reserva de RF-145).
  - **Decisión**: `optional`. Si la fuente no ha llegado en el primer instante (~100 ms), el navegador usa la de reserva durante toda la visita y no hay cambio de fuente a mitad (RF-145, RF-102); en la visita siguiente ya sale de la caché. **Descartado**: `swap`, porque desplazaría los textos y el botón de la intro durante su entrada.
- **Precarga**: `<link rel="preload" as="font" type="font/woff2" crossorigin>` solo para Figtree 400 y 700 (textos y botón de la intro), para no retrasar "Give feedback" (RNF-5). Las otras 3 se piden cuando se usan.
- **Qué usa cada tipografía**:
  - `--display` (800, mayúsculas): marca "Leisure City", porcentaje, `.screen__title` del selector, "Leisure for Society" y "Thank you", y rótulos de sitio (700);
  - `--body`: el resto.
  - El plató fija `font-family: var(--sans)` en sus `<text>` (`.plato text`), así que no cambia (RF-142).
- **Comprobación**: test de tamaño y licencias (§16.9). En el MCP, `Network.setBlockedURLs(["*.woff2"])` con RF-88, RF-91, RF-113, RF-132 y RF-144 a 320 y 375, y ninguna petición a dominios de fuentes.

### 16.3 Estilo de la encuesta — RF-17, RF-92 a RF-97, RF-144, RNF-4
- **Paleta** (en `:root`), como en la demo:

  | Variable | Valor | Uso |
  |---|---|---|
  | `--night` | `#060a22` | fondo |
  | `--night-2` | `#0e1648` | resplandor radial de arriba en `body` |
  | `--royal-deep` | `#0b1138` | relleno de opción |
  | `--gold` | `#f6b93b` | acento principal |
  | `--lit` | `#ffd36e` | luz cálida |
  | `--text` | `#eef0ff` | texto |
  | `--muted` | `#9aa3d6` | texto secundario |
  | `--line` | `#2a3787` | líneas |
  | `--seg-off` | — | segmento apagado; se elige un azul con ≥ 3:1 sobre `--night` (luminancia ≥ 0,11, p. ej. `#5c66a6`) y se mide (propuesta 40) |

  Se borran las variables y reglas del estilo anterior que ya no se usen.
- **Opciones** (`screens/question.js` y CSS):
  - el botón `.option` no lleva `clip-path`. Dentro van `.option__shape` (el hexágono dorado: `clip-path: polygon(18px 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 18px 100%, 0 50%)` y `padding: 2px`) y `.option__in` (el mismo polígono, fondo `--royal-deep`, `padding: .9rem 1.8rem`, `min-height: 56px`), con el texto y `.option__check`;
  - se quita `.option__letter` y el `aria-label` pasa a ser solo la etiqueta (RF-17);
  - elegida (RF-96): `.option__in` en `--gold`, texto `--night`, `.option__check` visible;
  - el relleno lateral de 1,8 rem (más que los 18 px de la punta) evita que las puntas recorten el texto. A 320 px quedan unos 230 px de texto, que bastan para 3 líneas (RF-144);
  - **foco** (RNF-4): `.option:focus-visible { outline: 3px solid var(--text); outline-offset: 3px }` en el botón, que no está recortado. Así se ve entero, con ≥ 3:1 y distinto de "elegida" (relleno dorado + icono).
  - **Decisión**: el recorte en hijos y el contorno en el padre. **Descartado**: `clip-path` en el botón, como en la demo, porque recorta el `outline`.
- **Botones** (RF-97):
  - `.btn`: fondo `--gold`, texto `--night`, `border-radius: 12px`, `min-height: 52px`, `font: 700 1.05rem var(--body)`;
  - `.btn--secondary` ("Back"): transparente, `box-shadow: inset 0 0 0 1.5px var(--line)`, texto `--text`, ≥ 44×44;
  - `.btn:disabled`: `opacity: .45; cursor: not-allowed`;
  - foco: `outline: 3px solid var(--text); outline-offset: 2px`;
  - `:active { transform: scale(.98) }` va dentro de `@media (prefers-reduced-motion: no-preference)` (de paso, se corrige la mejora pendiente de `.country:active`).
- **Títulos** (RF-95):
  - `.screen__title`, `.final__title` y `.final__thanks`: `font: 800 … var(--display); text-transform: uppercase; letter-spacing: .02em`;
  - `.question__text`: `700 1.35rem/1.25 var(--body)`, en minúsculas normales;
  - `.question__count` y `"N of 10 places"`: `--muted`.
- **RF-93**: sin degradados metálicos (`linear-gradient` con dorados o plateados) ni `text-shadow` o `-webkit-text-stroke` dorados. Lo comprueba un test.

### 16.4 Ciudad en rejilla — RF-69 a RF-72, RF-76, RF-78, RF-111 a RF-113, RF-133, RF-140, RF-141
- **`index.html`**:
  - `#city` pasa a `viewBox="0 0 400 292"`, con el `clipPath#map-clip` y el `.city__border` de 400×292.
  - Dentro de `.city__map`, en este orden:
    1. suelo `--road`;
    2. `<g class="city__streets">`, `<g class="city__fillers">` y `<g class="city__lamps">`, vacíos y aria-hidden;
    3. `<g class="city__halos">`;
    4. los 10 `<g class="site" data-site>`;
    5. coches;
    6. `<g class="city__labels">`;
    7. ola.
  - Se borran:
    - las calles, manzanas, naturaleza, agua, árboles, sombras y los 16 rellenos actuales;
    - las clases `.shadow`, `.filler__face`, `.filler__ridge`, `.green`, `.water`, `.tree`;
    - las reglas CSS de esas clases (`city-face-on`, `city-green-on`, `city-water-on`, `water-ripple`).
- **`js/app/city.js`**: nueva `mountCityGrid(svg, grid = city-grid)`, que se llama una vez al arrancar, antes de `mountCityLabels`. Crea con `createElementNS`:
  - **calles**: las líneas discontinuas de la demo (`.street`) y el rectángulo interior;
  - **relleno**: por cada celda de relleno, `<g class="filler" data-filler>` con el `<rect class="filler__pad">` de la celda y los edificios de `fillerBuildings(11)`: `.filler__b` con la ventana `.win` del edificio, en un `<g class="filler__lights">`. Un tercio lleva `data-twinkle` (para el bucle del final);
  - **farolas**: `<circle class="lamp" r="1.4">` en `lampPoints()`, repartidas en `.lamps__a` y `.lamps__b`;
  - cada elemento lleva `style="--fd: waveDelayFraction(x, y)"` para la ola (§16.7).
- **Sitios** (RF-71, RF-133): los 10 iconos se redibujan dentro de 0-56 × 0-38 con los motivos de la demo y los actuales:
  - park: césped, camino, estanque y árboles (salvedad de RF-110);
  - concert-hall: piano de cola;
  - museum: patio y columnas;
  - theatre: anfiteatro con escenario;
  - cinema: película y marquesina;
  - fairground: noria en `.wheel` y carpa;
  - town-square: pavimento y fuente;
  - food-market: puestos con toldo;
  - nightclub: neón;
  - stadium: campo y torres de luz.

  Cada sitio mantiene `.body`, `.lt` y `.lt-stroke` (apagado y encendido como ahora) y lleva, además:
  - `<rect class="site__ring">` con la caja de la celda (RF-134);
  - en `.city__halos`, una `<ellipse class="site__halo" data-halo="<id>" fill="url(#glow)">` centrada en la celda, de radio unas 50 unidades (como la demo), por debajo de los iconos y los rótulos, así que nunca tapa un rótulo (RF-133).
- **Encendido**: `paintCity(svg, view, { instant })` pone `is-lit` en `[data-site]`, `[data-halo]` y `[data-site-label]`.
  - `.site__halo { opacity: 0; transition: opacity 900ms }` pasa a `.is-lit { opacity: 1 }`.
  - Con `instant` (primera pintura, RF-138), `city.js` pone `data-instant` en el SVG durante un fotograma (`transition: none`) y luego lo quita.
- **Tamaños** (RF-76, RF-78):
  - a 375 px el mapa mide 343 × 250,4 (37,5 % de 667);
  - a 320 px, 288 × 210,2.

### 16.5 Cabecera, barra, anillo y aviso — RF-125 a RF-138, RF-146, RF-148
- **`index.html`**, dentro de `#city-wrap` (así hereda el comportamiento de la ciudad en las transiciones, RF-131):
  ```html
  <header class="hud" aria-hidden="true"><span class="hud__brand">Leisure City</span>
    <span class="hud__meter"><span class="hud__pct">0%</span><small class="hud__count">0 of 10 places</small></span></header>
  <div class="city-box"> <svg id="city" …> <p class="city__toast" aria-hidden="true"></p> </div>
  <div class="segs" aria-hidden="true"></div>      <!-- 10 <i> creados por JS -->
  ```
  `aria-hidden` en la cabecera, el aviso y la barra (propuesta 27, RNF-4). El `aria-label` del SVG sigue siendo la alternativa de RF-75.
- **Nuevo `js/app/hud.js`** (adaptador de interfaz):
  - `mountHud(wrap)`: crea los 10 segmentos;
  - `paintHud(wrap, progressView(...))`: textos y clases `is-filled` / `is-current`;
  - `celebrate(wrap, celebration(...))`:
    - con `ring`, pone `is-new` en el `[data-site]` y se lo quita a los `RING_MS`;
    - con `toast`, pone el texto con `textContent` y `data-place="top|bottom"` (`toastPlacement`), lo muestra y lo oculta a los `TOAST_MS` con un único `setTimeout` que se cancela si llega otro aviso (RF-136).
- **`main.js`**:
  - guarda `prevLit` (los sitios pintados por última vez);
  - en `update()`, a la vez que `paintCity` (en el mismo tick del clic, RF-105 y RF-127), llama a `paintHud` y a `celebrate(celebration(prevLit, lit, { firstPaint: shown === null, toFinal: target es "final" }))`;
  - en el final, `current` es null (RF-130).
- **CSS**:
  - `.hud`: `display: flex; justify-content: space-between; align-items: flex-end; max-height: 52px`;
  - `.hud__brand`: `800 1.15rem/1 var(--display)`, mayúsculas, `letter-spacing: .14em`, `--gold`;
  - `.hud__pct`: `800 36px/.9 var(--display)`, `tabular-nums`;
  - `.hud__count`: `.78rem/1.3`, `--muted`, `white-space: nowrap`;
  - `.segs`: `grid-template-columns: repeat(10, 1fr); gap: 4px`. Cada `i` mide 6 px de alto, con radio de 3, y es `--seg-off`, o `--gold` si `.is-filled`; `.is-current` añade `outline: 1.5px solid var(--text); outline-offset: 1px` (también con movimiento reducido; sin pulso, RNF-2);
  - `#city-wrap` es una columna con `gap: 8px`;
  - `.site__ring`: `fill: none; stroke: var(--gold); stroke-width: 2; opacity: 0; transform-box: fill-box; transform-origin: center`, y `.site.is-new .site__ring { animation: ring 1.1s ease-out }` con `@keyframes ring { from { opacity: .9; transform: scale(1) } to { opacity: 0; transform: scale(1.22) } }`. El 22 % de crecimiento no llega al 25 % de RF-134. En las celdas del borde, el `#map-clip` recorta lo que salga;
  - `.city__toast`: `position: absolute; left: 50%`, `bottom: 8px` o `top: 8px` según `data-place`, `transform: translate(-50%, 8px)`, `opacity: 0`, `transition: opacity .3s, transform .3s`; `.is-shown` lo deja en `translate(-50%, 0)` y opacidad 1. Fondo `--night`, borde `--gold`, texto `--lit` (≥ 4.5:1), `pointer-events: none`;
  - movimiento reducido: la regla global ya quita la animación del anillo y deja las transiciones en 200 ms. Se añade `transform: translate(-50%, 0)` fijo para el aviso (RF-77).
- **Cálculo de RF-132** (a 375×667):

  | Elemento | Alto |
  |---|---|
  | cabecera (32,4 del porcentaje + 16,2 de "N of 10 places") | 48,6 px |
  | separación | 8 px |
  | mapa | 250,4 px |
  | separación | 8 px |
  | barra | 6 px |
  | **total** | **321 px ≤ 333 px (50 %)** |

  - El mapa solo ocupa un 37,5 % (≤ 40 %, RF-78).
  - A 320×568: 48,6 + 8 + 210,2 + 8 + 6 = 280,8 px.
  - En la validación se miden los `getBoundingClientRect()` reales.
- **Scroll** (RF-146): la cabecera, la ciudad y la barra van en el flujo, sin `position: fixed` ni `sticky`.

### 16.6 Transiciones con "rise" y vuelta arriba — RF-103, RF-104, RF-106 a RF-108, RF-131, RF-143, RF-147
- `fade.js`: `fadeIn(els, ms, { rise })` usa `[{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }]` si `rise`, y si no solo opacidad. `fadeOut` sigue siendo solo de opacidad.
- `main.js`: pasa `plan.rise`.
  - Entre preguntas solo entra `#screen-question`, así que `#city-wrap`, con la cabecera y la barra, no se mueve.
  - Del selector a la Q1 (`cityFades`) entran juntos la sección y `#city-wrap`, con la misma subida.
  - De la Q10 al final, `inMs` es 0: no hay "rise", y el mapa pasa a su tamaño del final al hacerse `render()` (RF-143).
  - La puerta usa `plan.totalMs`, que ahora es 550.
- **Vuelta arriba** (RF-147): al empezar `fadeIn`, `window.scrollTo(0, 0)` y después `title.focus({ preventScroll: true })`. Se cambia el `focus()` de `main.js` (línea ~98), que si no haría scroll hasta el título.

### 16.7 Final en la rejilla — RF-53, RF-54, RF-56, RF-73, RF-74, RF-79, RF-114 a RF-118, RF-130, RF-140
- **Ola desde el centro** (RF-73):
  - `.city__wave` pasa a ser un `<circle cx="200" cy="146" r="250" fill="url(#wave-ring)">` (gradiente radial con un anillo claro) que anima `transform: scale(0 → 1)` y `opacity` durante `--final-wave-dur` (1,4 s), con `transform-box: fill-box; transform-origin: center`;
  - cada `.filler__b`, `.win`, `.lamp` y `.street` se enciende con `animation: city-on 300ms ease calc(var(--final-wave-start) + var(--final-wave-dur) * var(--fd)) both`. Sustituye a `--fx`, que era la posición horizontal;
  - las farolas encendidas pasan a `--lit` (RF-140).
- **Coches** (RF-114): 4 `.car` sobre las calles nuevas (`STREETS.h` en y = 76, 146 y 216, en sentidos alternos, y `STREETS.v` en x = 200), con keyframes que solo mueven su eje, de borde a borde, como en T27. El test de "sobre una calle de su eje" usa `STREETS`.
- **Bucles vivos** (RF-115 a RF-117):
  - se mantienen las ventanas (`data-twinkle`), las farolas (`.lamps__a/b`), el estadio, la noria y la discoteca, con los mismos ciclos;
  - se borra el agua;
  - todo cuelga de `[data-final-live] #city[data-all-lit]`, como ahora.
- **Disposición** (RF-79, RF-130): en `[data-screen="final"]`, `#city-wrap` es la columna flex que ya existe (`flex: 1 1 auto`), con la cabecera y la barra arriba y abajo (`flex: none`) y `.city-box` con `flex: 1; min-height: 0`; el SVG con `height: 100%; max-width: 100%` (`meet`).
  - Banderas y textos siguen en el panel `.screen--final`, en el flujo, así que nada se solapa en el estado final.
  - La cabecera muestra "100%" y "10 of 10 places", con los 10 segmentos `is-filled` y ninguno `is-current`.
- **RF-74**: 200 + 7200 = 7400 ms ≤ 8000.

### 16.8 Intro: más bucles y cuenta de los marcadores — RF-8, RF-85, RF-86, RF-87, RF-119 a RF-124
Todo en CSS, salvo la cuenta. Como en §15.2, el bucle anima a los hijos y la entrada al grupo `plato__enter`.
- **Bombillas** (RF-119): las 4 `.plato__bulb` con `animation: plato-chase 1.6s ease-in-out infinite` y `animation-delay` de 0, 0,4, 0,8 y 1,2 s en el sentido de las agujas del reloj. La opacidad va de 1 a 0,55 y nunca a 0.
- **Tablero** (RF-120):
  - sobre cada una de las 13 casillas con valor va un `<rect class="plato__cell-glow">` (blanco al 0 %, en el mismo `<g>` del tablero) con `animation: plato-cell 5.2s linear infinite` y `animation-delay: calc(var(--i) * 400ms)`;
  - `@keyframes plato-cell` sube a 0,35 entre el 0 y el 3,8 % y baja al 7,7 % (los 400 ms de su turno);
  - las 2 casillas vacías no tienen `rect`, y los `<text>` no se tocan.
- **Marcadores** (RF-121): `<rect class="plato__score-glow">` sobre cada pantalla de marcador, con `animation: plato-screen 1.5s ease-in-out infinite alternate` y desfases de 0, 0,5 y 1 s.
- **Focos y suelo** (RF-122):
  - `.plato__spot` gira ±6° con `transform-origin` en su enganche del riel (4 s, `alternate`), en un `<g>` hijo distinto del que ya tiene `plato-glow-spot`, para que no se pisen;
  - la elipse del suelo hace `translateX(±4%)` (7 s, `alternate`).
  - Todo dentro del plató, sin tocar `width` ni `height`, así que no aparece scroll.
- **Cuenta** (RF-123), en `screens/intro.js`:
  - `show()` lee `elapsed` del `currentTime` de la animación de entrada del grupo `people`;
  - si `markerCountPlan(elapsed)` es `"count"` y no hay movimiento reducido, pone los 3 marcadores a 0 (aún invisibles, porque `people` entra a los 950 ms) y, con `requestAnimationFrame`, escribe `markerValueAt` solo cuando el valor cambia. Para al llegar al valor, en `hide()` o al pulsar "Give feedback" (RF-124);
  - el HTML lleva los valores finales: sin JS, con movimiento reducido o si carga tarde, se ven 300, 500 y 200 (RF-85, RF-87).
- **Destellos** (RF-86): `flashesPerSecond` da 2,5 (bombillas), 2,5 (tablero) y 2 (marcadores). Un test comprueba que el CSS usa los valores de `INTRO_LOOPS`.

### 16.9 Tests (`node --test`)
| Archivo | Cambio | Cubre |
|---|---|---|
| tests/city-grid.test.js | **Nuevo**:<br>• 10 `SITE_CELLS` únicas dentro de 6×4 y 14 de relleno<br>• RF-139: ningún par consecutivo es vecino, también en diagonal, y el orden no es el de lectura ni el de columnas<br>• Fairground y Nightclub con relleno a izquierda y derecha<br>• `cellBox` dentro de 400×292<br>• ≥ 20 farolas, todas sobre calles (fuera de las celdas) y dentro del mapa<br>• `waveDelayFraction`: 0 en el centro, ≤ 1 y creciente con la distancia<br>• `fillerBuildings(11)`: fijo, de 2 a 4 por celda y dentro de su celda | RF-69, RF-70, RF-73, RF-139, RF-140 |
| tests/site-labels.test.js | **Rehecho**:<br>• rótulo dentro de su celda en vertical<br>• icono ≥ 55 % del alto<br>• lo que sale en horizontal no toca ninguna celda de otro sitio ni sale del borde<br>• sin solapes entre rótulos<br>• `minLabelPx(288) ≥ 8`<br>• líneas = `SITE_NAMES` | RF-112, RF-113, RF-141 |
| tests/progress.test.js | **Nuevo**:<br>• 0 → "0%" / "0 of 10 places"<br>• 4 → "40%"<br>• 10 → "100%"<br>• segmentos rellenos = respondidas (también fuera de orden tras Back)<br>• `current` marca uno<br>• final sin actual | RF-125 a RF-130 |
| tests/city-view.test.js | **Ampliar** `celebration`:<br>• sitio nuevo → anillo y "Lit up: Cinema"<br>• ya encendido → nada<br>• `firstPaint` → nada<br>• `toFinal` → sin anillo ni aviso<br>• no muta las entradas<br>**Ampliar** `toastPlacement`: fila 3 → top; resto → bottom | RF-133 a RF-138, RF-148 |
| tests/transition.test.js | **Actualizar**: 200/350, `totalMs` ≤ 550, `rise` verdadero entre preguntas y del selector a la Q1, falso con movimiento reducido y hacia el final | RF-103, RF-108, RF-143 |
| tests/intro-entry.test.js | **Ampliar**:<br>• `flashesPerSecond` ≤ 3 en los 3 bucles<br>• `BOARD_SEQUENCE`: 13 casillas, sin las vacías<br>• `MARKER_COUNT` termina ≤ 2000<br>• `markerValueAt`: 0, creciente y valor exacto al final<br>• `markerCountPlan` | RF-86, RF-119 a RF-121, RF-123 |
| tests/final-view.test.js | **Actualizar**: 200 + `finalEndMs()` ≤ 8000 | RF-74 |
| tests/city.test.js | **Ampliar** (DOM falso):<br>• `mountCityGrid` crea 14 rellenos, las farolas y las calles con `--fd`, sin `innerHTML`<br>• `paintCity` enciende halo y rótulo | RF-70, RF-133, RF-140 |
| tests/hud.test.js | **Nuevo** (DOM falso):<br>• `paintHud` pone textos y clases<br>• `celebrate` pone `is-new` y el aviso, y un segundo aviso sustituye al primero (un solo temporizador) | RF-125 a RF-136 |
| tests/markup.test.js | **Quitar** los tests de la ciudad anterior: 16 rellenos, sombras `translate(2.5 3)`, zonas verdes, agua, árboles, cajas de icono en coordenadas absolutas, `--fx` y `water-ripple`.<br>**Nuevo**:<br>• viewBox 400×292, recorte y borde<br>• orden de grupos<br>• 10 `data-site` con `.site__ring` y halo<br>• iconos dentro de 0-56 × 0-38 (rect/circle/ellipse)<br>• cabecera, aviso y barra `aria-hidden` dentro de `#city-wrap`<br>• `@keyframes ring` con escala ≤ 1,25 y duración ≤ 1,2 s<br>• aviso con `pointer-events: none`<br>• opción sin `.option__letter` y sin `clip-path` en `.option`, con `:focus-visible` en `.option`<br>• `.btn` con `min-height` ≥ 52 px<br>• sin `linear-gradient` dorado ni `text-shadow` dorado<br>• `.plato text` con `var(--sans)`<br>• fuentes de §16.2: ≤ 5 woff2 en `assets/fonts`, ≤ 150 KB en total (`fs.stat`), 2 OFL, `@font-face` con `font-display: optional` y `url()` relativas, sin `http` en ninguna hoja ni en `index.html` para fuentes<br>• CSS de los bucles de la intro = `INTRO_LOOPS`<br>• ningún `position: fixed`/`sticky` en `.hud`, `.city-wrap` ni `.segs`<br>**Se mantienen**: bucles ≥ 1 s y "reduced motion stops every animation" | RF-17, RF-86, RF-93, RF-95 a RF-97, RF-111, RF-119 a RF-122, RF-131, RF-134, RF-137, RF-142, RF-144, RF-146, RNF-4, RNF-13 |

Fuera de `node --test`, todo se comprueba con el MCP Chrome DevTools, como en §15.9. Además:
- con las fuentes bloqueadas;
- `getBoundingClientRect()` para RF-132;
- `getAnimations()` para el anillo, el aviso y los bucles de la intro;
- un scroll forzado en Q7/Q8 antes de "Next" para RF-147.

### 16.10 Rendimiento y movimiento reducido — RNF-2, RNF-12
- **Lo que se anima** sigue siendo solo `opacity` y `transform`:
  - el halo, el anillo, el aviso, la ola (escala de un círculo) y los bucles de la intro;
  - el resplandor del tablero y de los marcadores (`rect` con opacidad);
  - no hay `filter`.
- **JS por fotograma**: solo la cuenta de los marcadores (≤ 0,8 s, un `textContent` por cambio de valor).
- **Medición**, como en §15.8, añadiendo:
  - 3 encendidos de sitio seguidos (halo, anillo y aviso);
  - la ola del final con unos 45 edificios, unas 50 farolas y los coches;
  - 10 s de los bucles nuevos de la intro.

  Ninguna tarea debe pasar de 50 ms.
- **Movimiento reducido**:
  - la regla global quita el anillo, el "rise" (`fadeIn` sin `transform`), los bucles de la intro, la ola y los coches;
  - la cuenta no se hace;
  - las transiciones del halo, el aviso y el rótulo quedan en 200 ms;
  - el segmento actual se marca sin pulso (RNF-2, RF-77, RF-87, RF-108, RF-118, RF-124).

### 16.11 Cobertura del cambio
| Parte | RF / RNF |
|---|---|
| city-grid.js + `mountCityGrid` + iconos en celdas + CSS de la rejilla | RF-69 a RF-72, RF-76, RF-78, RF-111, RF-139, RF-140, RF-141 |
| site-labels.js rehecho + `mountCityLabels` | RF-112, RF-113, RF-141 |
| progress.js + hud.js + cabecera y barra | RF-125 a RF-132 |
| city-view.js (`celebration`, `toastPlacement`) + hud.js (`celebrate`) + halo, anillo y aviso | RF-133 a RF-138, RF-148, RF-77 |
| transition.js (200/350, `rise`) + fade.js + main.js (vuelta arriba y foco) | RF-103, RF-104, RF-106 a RF-108, RF-131, RF-143, RF-146, RF-147, RNF-4 |
| Fuentes + `@font-face` + precarga | RF-142, RF-145, RNF-5, RNF-13 |
| Paleta, opciones hexagonales, botones, títulos y foco | RF-17, RF-35, RF-92 a RF-97, RF-144, RNF-4 |
| Bucles de la intro + intro-entry.js + cuenta en intro.js | RF-8, RF-85, RF-86, RF-87, RF-119 a RF-124 |
| Ola radial, farolas, coches, bucles vivos y disposición del final | RF-53, RF-54, RF-56, RF-73, RF-74, RF-79, RF-114 a RF-118, RF-130 |
| Medición y bloque de movimiento reducido | RNF-2, RNF-12 |

### 16.12 Al cerrar el cambio
- **MEMORY.md**:
  - estilo de la demo con hexágonos sin letras (se retira "sin look de concurso");
  - fuentes propias con `optional`;
  - rejilla 6×4 con el reparto de la propuesta 29 (se retiran los 16 rellenos, árboles y estanque);
  - transiciones de 200 + 350 ms con "rise";
  - cabecera y barra en `#city-wrap`;
  - errores nuevos, si aparecen.
- **AGENTS.md**:
  - estructura: `assets/fonts/` (woff2 + OFL);
  - regla: "sin servicios externos de fuentes ni de imágenes".

## 17. Cambio de requisitos 2026-10-19: intro legible y Q3 de opción múltiple
Cubre los RF y RNF modificados (RF-4, RF-17, RF-19, RF-20, RF-23, RF-37, RF-62, RF-80, RF-88, RF-96, RF-121, RF-123, RNF-4, RNF-7 y RNF-12) y los nuevos (RF-149 a RF-169), aprobados por el usuario el 2026-10-19 junto con las propuestas 46 a 59. La propuesta 60 no está aprobada: **no se toca AGENTS.md**. La parte del panel /admin está en `specs/002-admin/plan.md` §11 (tareas T11-T13 de la 002). Las dos specs se implementan juntas y se publican a la vez, después de la migración (§17.9).

**Lo que no cambia**: RLS, permisos y políticas (RF-57 a RF-60, RF-66, RF-165), la sincronización y la cola local (`sync.js`, `sync-queue.js`), `persistence.js`, la ciudad, las transiciones, el final y el dibujo del plató. La forma de la fila y del envío se mantiene: `option` sigue siendo un texto, ahora "A", "AC", "ABC"… en Q3. No hay dependencias nuevas.

### 17.1 Formato de Q3 en el navegador: un solo texto ordenado — RF-37, RF-161, RF-164
- El borrador y la respuesta de Q3 guardan `option` como **el texto de letras ordenadas** ("A", "AC", "ABC") o `null` si no hay ninguna marcada. Es el mismo formato que va a la base de datos (duda 41, opción a).
- **Decisión**: un texto en todo el recorrido (estado, almacenamiento local, envío, tabla, panel). **Descartado**: un array en el estado y pasarlo a texto al enviar, porque habría dos formatos que mantener sincronizados en `survey-state.js`, `payload.js`, `persistence.js` y el panel.
- `payload.js` no cambia de código: envía `option` tal cual. Solo se amplían sus tests con "AC".

### 17.2 Lógica pura nueva o ampliada (`js/lib/`) — RNF-7
Igual que antes: sin DOM, red ni reloj.

**`choice.js`** (nuevo, compartido con el panel) — RF-154, RF-155, RF-161, RF-164
```
MULTI_VALUES = ["A","B","C","AB","AC","BC","ABC"]            // los mismos 7 valores que la regla de la tabla (§17.4)
isMultiple(question) → question.multiple === true
lettersOf(value) → letras distintas del texto, en el orden en que aparecen ("AC" → ["A","C"]; "" o null → [])
toggleLetter(value, letter, allLetters) → texto con `letter` añadida o quitada, ordenado según allLetters,
  sin repeticiones; null si queda vacío          ("A","C" → "AC"; "AC","A" → "C"; "C","A" → "AC"; "A","A" → null)
```

**`content.js`** — RF-154, RF-166
- `version: "2026-10-live-2"`.
- Q3 lleva `multiple: true`. Las demás no llevan la propiedad.

**`content-validate.js`** — RF-4 (propuesta 47)
- Errores nuevos: "question q3 must be multiple choice", "question qN: only q3 can be multiple choice" y "question q3: multiple choice options must be normal".
- `multiple`, si está, debe ser booleano.

**`survey-state.js`** — RF-19, RF-20, RF-23, RF-26, RF-155, RF-158 a RF-163, RF-169
```
selectOption(state, content, letter):
  si isMultiple(q) → draft.option = toggleLetter(draft.option, letter, letras de q)        (RF-155, RF-161)
  si no → como hoy (sustituye)                                                              (RF-19)
chosen(state, q) → para multi: lettersOf(draft.option) ∩ letras de q; para única: la opción como hoy
fieldFor: para multi, "why" si hay ≥ 1 marcada, null si no                                   (RF-20, RF-158, RF-159)
canGoNext: para multi, ≥ 1 marcada                                                          (RF-23)
next: guarda { option: draft.option (ya ordenado), text } como hoy                          (RF-160, RF-163)
settle(state, qid, content):                                                                (RF-169)
  si isMultiple(q) y qid ∈ answered y draft.option es null
    → drafts[qid] = { option: answers[qid].option, text: answers[qid].text ?? "" }
  si no → state sin cambios
back(state) / systemBack(state): settle(pregunta actual) y después n → n-1 como hoy
resumeState: tras reconstruir, settle() de cada pregunta multi respondida (recarga en ese estado, RF-169)
```
- `back` y `systemBack` necesitan `content` para saber si la pregunta es múltiple: se les añade como segundo parámetro opcional. Sin `content` se comportan como hoy, así que los tests actuales siguen valiendo; `main.js` pasa `CONTENT`.
- El texto escrito con todo desmarcado se conserva en el borrador mientras se sigue en la pregunta (RF-159). Si la pregunta no estaba respondida, `settle` no hace nada (borrador vacío conservado, RF-31).

**`question-view.js`** — RF-17, RF-156, RF-157, RNF-4
- La vista añade:
  - `multiple: boolean`;
  - `hint: "Choose one or more" | null`;
  - `checkedLetters: string[]`;
  - en cada opción, `checked` calculado por letra.
- `checkedLetter` se mantiene para las de respuesta única. En multi vale `null`.
- `optionForKey` solo se usa en las de respuesta única.
- `FIELD_LABELS` no cambia.

### 17.3 Interfaz de Q3 — RF-17, RF-96, RF-156, RF-157, RNF-4 (propuestas 48, 49, 57)
- **`index.html`**: tras el `h1` de la pregunta, `<p class="question__hint" id="question-hint" hidden aria-hidden="true">`. Va oculto para el lector porque su texto llega una sola vez, como descripción del grupo.
- **`js/app/screens/question.js`**:
  - **Al pintar una pregunta nueva**:
    - el contenedor `.options` pasa a `role="group"` con `aria-describedby="question-hint"` en multi, y a `role="radiogroup"` sin descripción en las de respuesta única;
    - el aviso se muestra con el texto de `view.hint`.
  - **Botones de opción**: `role="checkbox"` en multi y `role="radio"` en las demás, con `aria-checked` por letra.
  - **Teclado en multi**: todas las opciones con `tabIndex = 0`, sin el manejador de flechas. El botón nativo ya marca con Espacio e Intro mediante `click`. Los botones no se recrean al marcar (solo cambian `aria-checked` y la clase), así que el foco se queda en la opción.
  - **Marca visual**: en multi, `checkIcon()` se sustituye por `boxIcon()`, un cuadrado SVG de 20×20 con esquinas de 3 px. Sin marcar, solo borde. Marcada, relleno y marca de verificación.
- **`css/survey.css`**:
  - `.question__hint`: Figtree 400, 15 px, `--muted` sobre `--night` (6,7:1 aprox.), margen inferior de 8 px.
  - `.option__box`:
    - sin marcar: borde de 2 px de `--text` (≥ 3:1 sobre el azul noche del hexágono);
    - marcada: dentro del hexágono dorado, cuadrado relleno de `--night` con la marca en dorado (el borde oscuro sobre el dorado da ≥ 3:1).
  - En las de respuesta única, la marca actual no cambia.
- **`js/app/main.js`**: `back(local.survey, CONTENT)` y `systemBack(local.survey, CONTENT)`.

### 17.4 Base de datos: migración nueva — RF-62, RF-164, RF-165 (propuestas 51, 52, 59)
Archivo nuevo: `supabase/migrations/002_q3_multiple.sql`. Se ejecuta **después** de `001_survey.sql`, entera, en una transacción y sin borrar datos.
```
begin;
-- 1) Localiza la regla actual de q3 por su definición en el catálogo (nombre real; con el nombre por defecto de
--    Postgres sería responses_q3_option_check, pero no se supone).
do $$ declare c record; n int := 0; begin
  for c in select conname from pg_constraint
           where conrelid = 'public.responses'::regclass and contype = 'c'
             and conname <> 'responses_q3_option_multi_check'
             and pg_get_constraintdef(oid) ilike '%q3_option%'
  loop execute format('alter table public.responses drop constraint %I', c.conname); n := n + 1; end loop;
  raise notice 'q3 constraints dropped: %', n;      -- 1 la primera vez, 0 al repetir
end $$;
-- 2) Regla nueva con nombre propio (idempotente)
alter table public.responses drop constraint if exists responses_q3_option_multi_check;
alter table public.responses add constraint responses_q3_option_multi_check
  check (q3_option in ('A','B','C','AB','AC','BC','ABC'));
-- 3) save_response re-creada: el mismo cuerpo que en 001, cambiando SOLO la validación de la opción:
--    i = 3 → (v_option #>> '{}') in ('A','B','C','AB','AC','BC','ABC'); resto → in ('A','B','C')
--    owner, revoke y grant iguales que en 001 (execute a anon y authenticated)
commit;
notify pgrst, 'reload schema';
```
- **Antes de ejecutarla** (paso de la guía): consulta de solo lectura `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.responses'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%q3%';`. Debe dar exactamente 1 fila. El usuario anota el nombre en la tarea T42. Si da 0 o más de 1, se para y se pregunta.
- Las filas existentes ya cumplen la regla nueva, porque una letra es uno de los 7 valores: `add constraint` las valida sin cambiar nada (RF-165).
- **`001_survey.sql`**: no cambia su SQL. Solo se añade en la cabecera un comentario: "Después de este archivo, aplicar siempre `002_q3_multiple.sql`. Si se vuelve a ejecutar este archivo, ejecutar a continuación la 002 (si no, `save_response` vuelve a aceptar solo una letra)".
- **Decisión**: buscar la regla en el catálogo y crear una con nombre propio. **Descartado**: `drop constraint responses_q3_option_check` a ciegas, que fallaría o no haría nada si el nombre real es otro (punto 3 de la revisión QA).
- **Decisión**: repetir entero el cuerpo de `save_response` en la 002. **Descartado**: editar la 001 para que sea la única fuente, porque la 001 ya está aplicada y ese cambio no se aplicaría solo.

### 17.5 Comprobación de la base de datos (`scripts/check-db.mjs`) — RF-62, RF-164 (propuesta 52)
- **Casos que deben guardarse** (Q3): "A", "AC", "BC", "ABC".
- **Casos que deben rechazarse con 400**:
  - en Q3: "", "CA", "AA", "AD", "ABCD" y "ac";
  - en otra pregunta: q1 "AB".
- **Fila completa**: además se guarda una con Q3 "AB" y status `completed`.
- Las filas siguen usando `content_version` "dbcheck…" y se borran después (guía, paso 6).
- **Cuándo se ejecuta**: tras la migración. Antes de ella, los casos "AC", "BC", "ABC" y "AB-completed" fallan; así se ve si la migración no está aplicada.

### 17.6 Intro: textos grandes sobre el plató — RF-80, RF-88, RF-149 a RF-153, RF-167, RF-168, RNF-12 (propuestas 46, 54 a 56)
**Estructura (`index.html`)**: los dos `<p>` pasan dentro del bloque del plató, y el botón queda fuera.
```
<section class="screen screen--intro">
  <div class="intro__scene">
    <div class="plato">…svg sin cambios…</div>
    <div class="intro__panel"><p class="intro__thanks">…</p><p class="intro__ask">…</p></div>
  </div>
  <button … data-action="start">Give feedback</button>      ← sin cambios (RF-152)
</section>
```
El orden de lectura es el mismo: plató (oculto), RF-81, RF-82 y botón (RNF-4).

**Medidas explícitas, sin JS (`css/survey.css`)**. Sustituyen el `flex` del plató de §14.4:
```
.screen--intro { --stage-w: min(100vw - 32px, 398px, (100dvh - 96px) * 3 / 4); }
   96 px = 16 (arriba) + 16 (abajo) + 52 (botón) + 12 (separación); el término en dvh es el paso (2) de RF-168
.intro__scene { display: grid; width: var(--stage-w); margin-inline: auto; }
.plato  { grid-area: 1 / 1; width: var(--stage-w); height: calc(var(--stage-w) * 4 / 3); }
.intro__panel { grid-area: 1 / 1 / 3 / 2;              ← ocupa la fila del plató y la de debajo
  margin-top: calc(var(--stage-w) * 0.72);              ← fin del tablero: 54 % del alto = 0,72 del ancho (sustituido por §17.12, aprobado por el usuario)
  margin-inline: 8px; align-self: start;                ← RF-167
  background: rgb(6 10 34 / .85); border-radius: 12px; padding: 12px 14px; }
```
- La segunda fila de la rejilla (`auto`) solo crece si el panel pasa del borde inferior del plató: es el paso (1) de RF-168, que alarga el panel por debajo y baja el botón.
- Por debajo de 568 px de alto se mantiene el `@media (max-height: 567px)` con un plató de 300 px de alto (`--stage-w: 225px`) y scroll vertical (paso 3).
- Sin `backdrop-filter`, para no tener que medir un desenfoque en RNF-12 (propuesta 56).
- **Decisión**: CSS con el ancho del plató en una variable y el panel superpuesto en la misma celda de la rejilla. **Descartado**: medir el panel con JS y recolocar, porque movería el plató durante su entrada (RF-102) y en movimiento reducido daría un salto.

**Tipografía**:
- `.intro__thanks`: Figtree 600, 22 px (`@media (max-width: 374px)`: 20 px), interlineado 1,3, `--text`.
- `.intro__ask`: Figtree 400, 18 px, interlineado 1,3, `--muted`.
- Separación de 8 px entre los dos textos.

**Cálculo con estas medidas** (el implementer lo comprueba en DevTools y anota las cajas reales):

| Pantalla | `--stage-w` | Plató (alto) | Bajo el tablero | Panel estimado | Hueco libre de la columna | ¿Cabe? |
|---|---|---|---|---|---|---|
| 320×568 | 288 | 384 | 177 | 195-220 (fuente de reserva: ≈ 245) | 536 − 384 − 64 = 88 | sí: sale 18-68 px por debajo, dentro de los 88 |
| 375×667 | 343 | 457 | 210 | ≈ 190 | 635 − 457 − 64 = 114 | sí, dentro del plató |
| 375×568 | 343 | 457 | 210 | ≈ 190 | 15 | sí, dentro del plató |
| 430×568 | 354 (por alto) | 472 | 217 | ≈ 190 | 0 | sí, dentro del plató |

El panel a 320 px mide 272 px de ancho (264 de texto con el relleno): unas 24 letras por línea a 20 px, es decir 4 líneas × 26 px para RF-81, más 2-3 líneas × 23 px para RF-82, más 8 px de separación y 24 px de relleno.

**Contraste (RF-151)**: el texto se mide sobre el color resultante del panel al 85 % encima de lo más claro que puede pasar por detrás.
- Sobre blanco: unos (43, 47, 67).
- Sobre el foco #FFE9A8: unos (43, 42, 54).
- Sobre el realce dorado del botón: más oscuro aún.

Con eso, `--text` #eef0ff da unos 13:1 y `--muted` #9aa3d6 unos 5,3:1, por encima de 4.5:1. La validación lo mide con el selector de color de DevTools.

**Entrada y movimiento reducido (RF-153)**:
- El panel usa la misma animación `intro-enter` con `--enter-thanks-start` y `--enter-thanks-dur`, y los textos dentro de él no se animan aparte (se quita su `animation`).
- La única excepción es `.intro__ask`, que conserva su retraso de 150 ms con un fundido de opacidad solo dentro del panel ya visible. Así el orden de RF-98 se mantiene.
- Con movimiento reducido, la regla global `animation: none` lo deja todo estático.
- `INTRO_ENTRY` en `intro-entry.js` no cambia: el test que compara sus valores con el CSS sigue valiendo.

### 17.7 Documentación — propuesta 59
- **`docs/supabase.md`, §2 "Aplicar el SQL"**: orden de las migraciones (001 y después 002), con la advertencia de §17.4 sobre volver a ejecutar la 001.
- **`docs/supabase.md`, §2.1 nuevo "Cambio de Q3 (2026-10-19)"**, con estos pasos:
  1. consulta de solo lectura del nombre de la regla;
  2. pegar y ejecutar `002_q3_multiple.sql` en el SQL Editor (Run), y ver el aviso "q3 constraints dropped: 1";
  3. comprobar con `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.responses'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%q3%';` que solo queda `responses_q3_option_multi_check`;
  4. `node scripts/check-db.mjs` en verde;
  5. borrar las filas `dbcheck…`.
- **`docs/supabase.md`, §6 "Borrar las filas de prueba"**: añadir las filas de `content_version = '2026-10-live-1'` (las de antes del cambio y las que cree un navegador con la encuesta antigua en caché).
- **`MEMORY.md`**, al cerrar:
  - formato de Q3 ("A", "AC", "ABC");
  - versión "2026-10-live-2";
  - orden de las migraciones y del despliegue;
  - trampa: volver a ejecutar la 001 deshace el cambio.

### 17.8 Tests (`node --test`) — primero en rojo
- `tests/choice.test.js` (nuevo):
  - `toggleLetter`: añadir, quitar, orden (C, luego A → "AC"), quitar la última → null, repetir y letra fuera de la pregunta;
  - `lettersOf`;
  - `MULTI_VALUES` con los 7 valores.
- `tests/content.test.js`: versión "2026-10-live-2", Q3 `multiple: true` y la validación en verde.
- `tests/content-validate` (dentro de `content.test.js`, donde están hoy):
  - error si Q3 no es múltiple;
  - error si otra pregunta lo es;
  - error si una opción de Q3 no es normal;
  - error si `multiple` no es booleano.
- `tests/survey-state.test.js`:
  - marcar 1, 2 y 3 y desmarcar en Q3 sin tocar las demás;
  - el orden;
  - Q1 sigue siendo de respuesta única;
  - "Next" con 0/1/2/3;
  - campo "why" con ≥ 1 y null con 0, con el texto conservado;
  - `next` guarda "AC" y enciende solo "museum";
  - cambio de respuesta de "ABC" a "B";
  - RF-169:
    - Q3 respondida "AC", desmarcar todo, `back` → borrador "AC" con su texto;
    - igual con `systemBack`;
    - igual con `resumeState`;
    - Q3 sin responder, desmarcar todo, `back` → borrador vacío conservado y no respondida;
  - sin `content`, `back` se comporta como hoy.
- `tests/question-view.test.js`: `multiple`, `hint` solo en Q3, `checked` por letra y `checkedLetter` null en multi.
- `tests/payload.test.js`: Q3 "AC" va tal cual en `p_answers.q3.option`.
- `tests/migration.test.js`, ampliado con `002_q3_multiple.sql`:
  - no hay `grant` a anon salvo `execute` en `save_response`;
  - no aparece `disable row level security`;
  - la regla `responses_q3_option_multi_check` tiene exactamente los 7 valores;
  - se busca en `pg_constraint` por definición;
  - en `save_response` la rama de i = 3 tiene los 7 valores y la otra A/B/C;
  - `security definer` y `search_path = ''`;
  - `begin`/`commit`;
  - el comentario de orden en la cabecera de la 001.
- `tests/markup.test.js`:
  - los dos textos dentro de `.intro__panel`, dentro de `.intro__scene` y después del `svg`;
  - el botón fuera de `.intro__scene`;
  - `#question-hint` con `aria-hidden`;
  - CSS de la intro: `.intro__thanks` ≥ 22 px y ≥ 20 px por debajo de 375, `.intro__ask` ≥ 18 px, panel con `margin-inline` ≥ 8 px y `margin-top` 0,72 del ancho, y sin `backdrop-filter`.
- Lo visual (contraste medido, cajas, lector de pantalla y teclado) se valida en el navegador (T46).

### 17.9 Orden de despliegue — propuesta 51
1. Código y tests en local (T39-T41, T43-T45 y T11-T13 de la 002), sin publicar. En las pruebas en el navegador se bloquea `supabase.co` por initScript, como en cambios anteriores, para no escribir filas de la versión nueva antes de tiempo.
2. **[USUARIO]** Migración aplicada y comprobada (T42).
3. Validación conjunta (T46). Después, **un solo commit y push** con la encuesta y el panel juntos. Nunca push antes de T42.
4. Tras el push, esperar a que GitHub Pages termine de desplegar (Actions en verde) y probar con la caché vaciada (riesgo de caché mezclada aceptado, propuesta 58).

### 17.10 Cobertura del cambio
| Parte | RF / RNF |
|---|---|
| choice.js + content.js + content-validate.js | RF-4, RF-154, RF-161, RF-164 (formato), RF-166 |
| survey-state.js + question-view.js | RF-17, RF-19, RF-20, RF-23, RF-26, RF-155 a RF-163, RF-169 |
| question.js + index.html + CSS de las casillas y el aviso | RF-96, RF-156, RF-157, RNF-4 |
| 002_q3_multiple.sql + check-db.mjs + guía | RF-37, RF-62, RF-164, RF-165 |
| Intro: estructura, CSS, panel y tipografía | RF-80, RF-88, RF-121, RF-123, RF-149 a RF-153, RF-167, RF-168, RNF-12 |
| Tests | RNF-7 |

### 17.11 Al cerrar el cambio
- MEMORY.md según §17.7. La spec vuelve a "implementada" solo tras el APROBADO.
- AGENTS.md **no** se toca (propuesta 60 pendiente). Se recuerda al usuario que sigue pendiente.

### 17.12 Ajuste 2026-10-19: panel alto en el plató (T44b) — **SUPERADO por §17.13** ("pregunta junto al botón"); se conserva como historia
Cita del usuario: "Osea yo haría el recuadro un poco más grande el texto blanco más arriba y el texto más gris si tiene que estar cerca del botón sabes". Sustituye el `margin-top: calc(var(--stage-w) * 0.72)` de §17.6 (panel bajo el tablero, implementado en T44) y el borrador anterior de esta sección, que centraba el panel con ±8 px. El resto de §17.6 no cambia: tipografía, fondo al 85 %, sin `backdrop-filter`, entrada y `z-index`.

**Medidas del plató** (viewBox 300 × 400, escala s = `--stage-w` / 300):
- borde inferior de la fila de categorías: y = 112,5 → **3/8 × `--stage-w`**; hueco hasta la fila 100: 112,5-117,5;
- fila 100: 117,5-142,5; fila 200: 147,5-172,5; fila 300: 177,5-202,5; fin del tablero: 215;
- cabezas de los concursantes desde 266; atriles 316,5-374,5; marcadores 332,2-350,4; pulsadores hasta 366,3;
- alto del plató H = 4/3 × `--stage-w`.

**Regla** (RF-150, RF-168):
- T0 = 3/8 × `--stage-w` + 4 px (borde superior);
- alto mínimo A = H − 8 − T0 = **23/24 × `--stage-w` − 12 px** (borde inferior a 8 px sobre el fondo del plató);
- Pmin = contenido + 32 px de relleno (16 + 16). Alto del panel = max(A, Pmin). Si T0 + Pmin > H, la segunda fila de la rejilla crece y baja el botón (paso 1).

**Cómo se pinta, sin JS y sin envoltorio (`css/survey.css`; `index.html` no cambia)**:
```
.intro__panel { grid-area: 1 / 1 / 3 / 2; align-self: start;            ← como en T44
  box-sizing: border-box;
  margin: calc(var(--stage-w) * 3 / 8 + 4px) 8px 0;                       ← T0 y 8 px a los lados (RF-167)
  min-height: calc(var(--stage-w) * 23 / 24 - 12px);                      ← A
  padding: 16px 14px;                                                     ← antes 12px 14px
  display: flex; flex-direction: column; justify-content: space-between; }
.intro__ask { margin-top: 8px; }                                          ← sin cambios: separación mínima
```
- Si el contenido cabe, el panel mide A: borde inferior a H − 8, RF-81 pegado arriba, RF-82 pegado abajo y el sobrante entre los dos (`space-between`).
- Si no cabe, `min-height` deja que crezca hacia abajo desde T0; si pasa de H, la fila `auto` crece y baja el botón (RF-168, paso 1). Nunca sube sobre las categorías.
- El paso 2 (plató más pequeño por el término en `dvh`) y el `@media (max-height: 567px)` (paso 3, `--stage-w: 225px`) no cambian: las dos medidas dependen de `--stage-w`.
- El orden de lectura no cambia (RNF-4). La animación `intro-enter` sigue en `.intro__panel` (RF-153). El fundido de `.intro__ask` no cambia.
- **Decisión**: `min-height` + flex `space-between` en el propio panel. **Descartados**:
  - (1) dar al panel un alto fijo (`height`), porque con la fuente de reserva el texto se saldría del fondo;
  - (2) un envoltorio con márgenes `auto` (borrador anterior), que ya no hace falta sin centrado;
  - (3) medir con JS, porque movería el panel durante la entrada (RF-102).

**Cálculo con las cajas reales de T44** (px CSS desde el borde superior del plató; contenido = P de T44 − 24 de relleno antiguo; Pmin = contenido + 32; el botón empieza 12 px bajo el plató):

| Pantalla | `--stage-w` | Plató H | Fin categorías | Panel arriba (T0) | Pmin / A | Panel abajo | Panel → fondo del plató | Panel → botón | RF-81 (caja) | RF-82 (caja) | Hueco entre textos | Scroll |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 320×568 | 288 | 384 | 108 | 112 | 190,8 / 264 | 376 | 8 | 20 | 128-232 (4 líneas) | 313,2-360 (2) | 81,2 | no (el botón sube 6 px respecto a T44) |
| 375×667 | 343 | 457,3 | 128,6 | 132,6 | 172,6 / 316,7 | 449,3 | 8 | 20 | 148,6-234,4 (3) | 386,5-433,3 (2) | 152,1 | no |
| 375×568 | 343 | 457,3 | 128,6 | 132,6 | 172,6 / 316,7 | 449,3 | 8 | 20 | igual | igual | 152,1 | no |
| 430×568 | 354 | 472 | 132,8 | 136,8 | 172,6 / 327,3 | 464 | 8 | 20 | 152,8-238,6 (3) | 401,2-448 (2) | 162,6 | no |
| 320×480 (< 568) | 225 | 300 | 84,4 | 88,4 | 240,2 / 203,6 | 328,6 | −28,6 (sale) | 12 | — | — | 8 | permitido (RF-168 pasos 1 y 3) |

- Fuente de reserva con una línea más (≈ +25 px, peor caso de §17.6): a 320×568 Pmin ≈ 216 < 264 y el hueco baja a unos 56 px; a 375 px Pmin ≈ 198 < 317. **Cabe en los 4 tamaños de 568 px de alto o más sin scroll y sin el paso (1).**
- El alto total de la columna es el de T44 sin el exceso del panel: plató + 12 + botón, como antes de este cambio.

**Qué queda tapado** (coordenadas del plató ÷ s; el panel cubre de 116 a 392 en las 4 pantallas):
- tapado: fila 100 entera (sin filas cortadas, duda 61 (b)), filas 200 y 300, fin del tablero, haces bajos, postes, "On air", borde del escenario, suelo, concursantes, atriles con "Group n", marcadores y pulsadores;
- a la vista: riel con los focos, cartel, fila de categorías, el arranque de los haces superiores, dos franjas de 8 px a los lados (pared y suelo) y una franja de 8 px de suelo abajo.

**Contraste (RF-151)**:
- Lo más claro que puede pasar por detrás sigue siendo blanco: el realce `.plato__cell-glow`, relleno `#fff`, en su pico. El panel al 85 % sobre blanco da (43, 47, 67), el mismo peor caso de §17.6, en el que T44 midió RF-81 ≥ 11,66:1 y RF-82 ≥ 5,40:1.
- El realce dorado del botón vuelve a quedar detrás de la parte baja del panel: entra 22 px en el plató y el panel acaba a 8 px del fondo. Sobre dorado el panel es más oscuro que sobre blanco, pero se mide en su pico detrás de RF-82.
- También se miden en las 4 pantallas: el realce de una casilla, los números ámbar `#FFB400`, el haz y los marcadores.

**Tests (`node --test`), primero en rojo** (`tests/markup.test.js`; sustituyen la comprobación de `margin-top` 0,72 de §17.8):
- estructura de T44 sin cambios: los dos textos dentro de `.intro__panel`, dentro de `.intro__scene`, después del `svg`; el botón fuera;
- `.intro__panel`:
  - `margin-top` = `--stage-w` × 3/8 + 4px y `margin-inline` ≥ 8 px;
  - `min-height` = `--stage-w` × 23/24 − 12px y `box-sizing: border-box`;
  - `padding` de 16 px arriba y abajo;
  - `display: flex`, `flex-direction: column` y `justify-content: space-between`;
  - sin `height` fija ni `backdrop-filter`;
- `.intro__ask` con `margin-top` ≥ 8 px;
- un test de la regla con los números de la tabla: función de prueba `alto = max(23/24·w − 12, Pmin)`, `abajo = T0 + alto`, sobre las 5 filas. Las constantes 3/8, 4, 23/24 y 12 se leen del CSS, para que un cambio rompa el test;
- `tests/intro.test.js` y `tests/intro-entry.test.js` siguen en verde sin cambios.
- Lo visual (cajas, distancias, contraste, captura) se valida en el navegador en T44b.

**Cobertura**: CSS de `.intro__panel` → RF-80, RF-150, RF-167, RF-168; medición en el navegador → RF-84, RF-120, RF-121, RF-123, RF-151; tests → RNF-7.

### 17.13 Ajuste 2026-10-19: pregunta junto al botón (T44c) — RF-80, RF-88, RF-121, RF-123, RF-150, RF-151, RF-152, RF-167, RF-168, RF-170 (propuestas 54, 55, 62; dudas 63 y 64) — aprobado por el usuario
Pregunta del usuario: "Creo que es mejor dejar ambos textos con recuadros separados o como crees tú que se vería mejor para el usuario?". Elige "Pregunta junto al botón". Sustituye la disposición de §17.12 (T44b). Se mantienen de §17.6 la tipografía, el fondo del panel al 85 %, la ausencia de `backdrop-filter`, la entrada y el `z-index` del panel.

**Estructura (`index.html`)**: `.intro__ask` sale del panel y del plató y pasa a ser hermano directo entre `.intro__scene` y el botón. El botón no cambia ni de elemento ni de sitio en el DOM (RF-152).
```
<section class="screen screen--intro">
  <div class="intro__scene">
    <div class="plato">…svg sin cambios…</div>
    <div class="intro__panel"><p class="intro__thanks">…</p></div>
  </div>
  <p class="intro__ask">Do you want to help us with our new assignment?</p>
  <button … data-action="start">Give feedback</button>
</section>
```
El orden de lectura no cambia: RF-81, RF-82 y el botón (RNF-4).

**CSS (`css/survey.css`)**:
```
.screen--intro { gap: 12px;                                               ← sin cambios
  --ask-h: calc(18px * 1.3 * 2);                                          ← 46,8 px: 2 líneas de RF-82 reservadas
  --stage-w: min(100vw - 32px, 398px,
                 (100dvh - 108px - var(--ask-h) - env(safe-area-inset-bottom)) * 3 / 4); }
   108 = 16 arriba + 16 abajo + 16 plató→RF-82 + 8 RF-82→botón + 52 botón (las dos separaciones salen del gap de 12 ± 4)
   (también en el @supports con vh)
.intro__panel { grid-area: 1 / 1; align-self: start;
  margin: calc(var(--stage-w) * 3 / 8 + 4px) 8px 0;                       ← 4 px bajo las categorías, 8 px a los lados
  padding: 12px 14px; }                                                   ← sin min-height, sin flex: alto = contenido + 24
.intro__ask { width: var(--stage-w); margin: 4px auto -4px;               ← gap 12 + 4 = 16 bajo el plató; 12 − 4 = 8 sobre el botón
  position: relative; z-index: 1;                                         ← se pinta encima del halo del botón
  text-shadow: 0 0 2px var(--night), 0 0 6px var(--night); }              ← duda 63, opción (a)
@media (max-height: 567px) { .screen--intro { height: auto; --stage-w: min(100vw - 32px, 398px); } }   ← antes 225px
```
- `.intro__scene` vuelve a una sola fila del alto del plató, porque el panel ya nunca sale de él.
- `.intro__ask` mantiene su fundido de entrada (`intro-fade`, 1350 ms). Ahora va solo, fuera del panel. El orden de RF-98 se mantiene: panel con RF-81, RF-82 y el realce del botón.
- **Decisión**: RF-82 como hermano del botón, con márgenes de 4 / −4 px sobre el `gap` de 12 px. **Descartados**:
  - (1) un envoltorio `.intro__cta` con RF-82 y el botón: el botón cambiaría de contenedor y podría cambiar su ancho (RF-152);
  - (2) calcular `--stage-w` sin reservar el alto de RF-82, porque el plató no se reduciría y habría scroll a 568 px de alto;
  - (3) el plató de 225 px por debajo de 568 px de alto, porque a ese tamaño el panel de RF-81 (unas 6 líneas a 181 px) taparía los atriles (RF-167).

**Encaje de la columna** (px de página; columna = alto − 32; contenido = H + 16 + 46,8 + 8 + 52 = H + 122,8; la columna centra el sobrante):

| Pantalla | `--stage-w` (cuál manda) | Plató H | Plató (arriba-abajo) | RF-82 (2 líneas) | Botón | Sobrante | Scroll |
|---|---|---|---|---|---|---|---|
| 320×568 | 288 (ancho) | 384 | 30,6-414,6 | 430,6-477,4 | 485,4-537,4 | 29,2 | no |
| 375×667 | 343 (ancho) | 457,3 | 43,5-500,8 | 516,8-563,6 | 571,6-623,6 | 54,9 | no |
| 375×568 | 309,9 (alto; antes 343) | 413,2 | 16-429,2 | 445,2-492 | 500-552 | 0 | no |
| 430×568 | 309,9 (alto; antes 354) | 413,2 | 16-429,2 | 445,2-492 | 500-552 | 0 | no |
| 320×480 (< 568) | 288 (ancho) | 384 | igual que 320×568 | | | −58,8 | sí, 59 px (permitido) |

- RF-82 a 18 px tiene unos 47 caracteres y ocupa 2 líneas con 288-310 px de ancho, con Figtree (unos 8,5 px por carácter) y con la fuente de reserva (unos 9,5 px). **Riesgo**: si con las fuentes bloqueadas saliera en 3 líneas, a 375×568 y 430×568 habría unos 23 px de scroll. En ese caso `--ask-h` pasa a 3 líneas (el plató bajaría a unos 292 px) y se anota en T44c.

**Panel de RF-81 sobre el plató** (px desde el borde superior del plató; s = `--stage-w` / 300; "On air" empieza en y = 229,5; postes en 241; cabezas en 266; atriles en 316,5):

| Pantalla | Fin categorías | Panel arriba | RF-81 | Panel alto / abajo | "On air" (arriba) | Atriles (arriba) | Hueco panel → atriles |
|---|---|---|---|---|---|---|---|
| 320×568 | 108 | 112 | 4 líneas a 20 px (medido en T44) | 128 / 240 | 220,3 → tapado | 303,8 | 63,8 |
| 375×667 | 128,6 | 132,6 | 3 líneas a 22 px (medido) | 109,8 / 242,4 | 262,4 → a la vista (20 px libres) | 361,9 | 119,5 |
| 375×568 y 430×568 | 116,2 | 120,2 | 4 líneas a 22 px (estimado: 266 px de texto) | 138,4 / 258,6 | 237,1 → tapado | 326,9 | 68,3 |

- Si a 310 px RF-81 cupiera en 3 líneas, el panel acabaría a 230 px y "On air" se vería con 7 px libres.
- Con la fuente de reserva y una línea más (+26 a +29 px), el panel acaba a 266, 271 y 287 px. Tapa lo alto de algunas cabezas, y "On air" también a 375×667. Los atriles siguen libres con 38, 90 y 40 px.
- **Tapado**: filas 100-300, fin del tablero, haces y, según la pantalla, "On air", lo alto de los postes y lo alto de las cabezas (duda 64).
- **Siempre a la vista**: riel, cartel, fila de categorías, concursantes (casi enteros), atriles, marcadores y pulsadores (RF-121, RF-123, RF-167).

**Contraste**:
- RF-151 (RF-81): peor caso, el blanco del realce de las casillas. Con el panel al 85 % sale (43, 47, 67), y T44 midió ≥ 11,66:1. Ya no hay halo del botón detrás del panel.
- RF-170 (RF-82): `--muted` sobre `--night` da 8,0:1 (medido en el proyecto).
- Halo del botón en su pico (`0 0 34px 6px` dorado al 55 %): sin protección, el gris quedaría por debajo de 2:1. Con la sombra oscura de las letras (duda 63 (a)), lo que hay justo detrás del texto es `--night`. Se mide en T44c, con el halo congelado en su pico. Si el usuario elige (b) o (c) en la duda 63, se cambia solo esa línea del CSS.

**Tests (`node --test`), primero en rojo** (`tests/markup.test.js`; sustituyen los de §17.12):
- **Estructura**:
  - `.intro__thanks`, solo, dentro de `.intro__panel`, dentro de `.intro__scene`, después del `svg`;
  - `.intro__ask` fuera de `.intro__scene`, justo antes del botón;
  - el botón sigue siendo hijo directo de la sección.
- **CSS**:
  - `--ask-h` de 2 líneas de 18 px × 1,3;
  - `--stage-w` con el término `100dvh - 108px - var(--ask-h)` (y su versión `vh`);
  - `.intro__panel` con `margin-top` 3/8 + 4px, laterales ≥ 8 px y `padding` de 12 px en vertical, sin `min-height`, `height` ni `backdrop-filter`;
  - `.intro__ask` con `margin` 4px / −4px, `z-index` y `text-shadow`;
  - `@media (max-height: 567px)` sin `225px`.
- **Regla**: función de prueba `w = min(vw − 32, 398, (vh − 108 − 46,8) · 3/4)` sobre los 5 tamaños de la tabla (288; 343; 309,9; 309,9; 288), con `H + 122,8 ≤ vh − 32` en los 4 de 568 px de alto o más. Las constantes se leen del CSS.
- `tests/intro.test.js` y `tests/intro-entry.test.js` siguen en verde. Si alguno apunta a `.intro__ask` dentro del panel, se adapta y se anota.

**Cobertura**:
- estructura y CSS → RF-80, RF-150, RF-152, RF-167, RF-168, RF-170;
- medición en el navegador → RF-88, RF-121, RF-123, RF-151, RF-170;
- tests → RNF-7.

