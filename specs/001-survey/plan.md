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
4. Authentication → Users → "Add user" para los 4 estudiantes y luego `insert into public.admins(user_id,label) values ('<uuid>','<name>');` (RF-66; el login se prueba en la 002).
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
- **Tests** (`tests/markup.test.js`): 2 avisos `data-offline-notice` con `role="status"` y `aria-live="polite"`, uno tras `.actions--nav` y otro tras "Thank you", ninguno en intro ni selector, sin `id="offline-notice"`; `main.js` usa `querySelectorAll("[data-offline-notice]")`; ninguna regla `.offline-notice` con `position: fixed|absolute|sticky` ni `pointer-events`; sin `body:has(.offline-notice` ni `84px`; `.app` con `16px + safe-area`; regla de compensación del panel con `bottom` y `padding-bottom`.

