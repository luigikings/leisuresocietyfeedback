# MEMORY.md — Leisure City
Memoria del proyecto entre sesiones. Máximo ~50 líneas: resume o elimina lo que ya no aporte.

## Estado actual
- Spec 001 (encuesta pública) implementada (16/10, con tres cambios validados hasta el 18/10). Spec 002 (panel /admin) implementada (18/10, VEREDICTO: APROBADO); sus 3 pruebas manuales se omitieron por decisión del usuario (ver "Antes del evento"). Presentación: 28/10/2026 por la noche.
- GitHub Pages ACTIVADO: encuesta en https://luigikings.github.io/leisuresocietyfeedback/ y panel en …/admin/.
- Supabase: proyecto ref `xbsrdugimqpgxmlwbpxo` (Frankfurt, plan Free). Registro público y "Automatically expose new tables" desactivados. MCP de Supabase sin configurar (SQL a mano en el SQL Editor).
- Contenido real: 10 preguntas y 6 países (18/10, en orden NL, HU, VE, IT, RO, PL + "Other"). `CONTENT.version` = "2026-10-live-1". Si se añade un país, subirla otra vez (descarta progreso, RF-52; el panel solo cuenta la versión actual) y añadir su bandera SVG 3:2 en `assets/flags/`.

## Decisiones (y por qué)
- Flujo: intro → país → ciudad apagada → 10 preguntas → final ("Leisure for Society"). Quien ya terminó ve directamente el final: evita duplicados.
- Estilo de la demo (decisión del usuario): hexágonos sin letras A/B, botones dorados, mayúsculas condensadas solo en títulos, con `aria-label`/copia `.visually-hidden` con el texto literal (RF-95).
- Fuentes Big Shoulders Display + Figtree autoalojadas (`assets/fonts/`, `font-display: optional`): sin servicios externos ni saltos. `serve.mjs` cachea los `.woff2` un año.
- Transiciones: salida 200 ms + entrada 350 ms (WAAPI) con puerta de tiempo que ignora toques y Back (evita dobles avances). Movimiento reducido: solo fundido de 200 ms.
- Ciudad: rejilla 6×4 desde `js/lib/city-grid.js` (`SITE_CELLS`); HUD con porcentaje y barra; final con bucles vivos.
- Guardado progresivo en una fila por participante, solo vía RPC `save_response` (security definer); el UUID v4 es el secreto. supabase-js 2.117.2 fijado (versiones con ≥ 2 semanas).
- /admin: UNA cuenta compartida "admin" (los 4 estudiantes), traducida al correo interno no secreto `admin@leisure-city.invalid` (dominio reservado). Creada a mano en Supabase con Auto Confirm y añadida a `public.admins` por consulta que la busca por correo: así su UUID no queda en el repo. La contraseña solo existe en Supabase y en el gestor del usuario; ningún agente la ve (repo público, RNF-1).
- Sesión recordada: en el plan Free no caduca sola. Se acepta (4 personas de confianza); si se filtra la contraseña, revocar todas las sesiones (docs/supabase.md §4.5). "Log out" usa `signOut({ scope: "local" })`: sin scope es global y echaría a los demás.
- Estadísticas calculadas en el navegador (pocas filas, sin SQL nuevo ni cambios de RLS); acceso comprobado con `is_admin`, no por lista vacía. Barras horizontales con número y %. País opcional ("All countries" por defecto) y su gráfico al final (decisión del usuario).
- CSV con comas, BOM y CRLF, fórmulas neutralizadas con apóstrofo y sin IDs: el Excel del usuario está en inglés.
- `.retry(false)` en las consultas de supabase-js: reintentaba solo, contra RF-21. Lista: 40 entradas al momento y el resto en bloques (RNF-8).

## Antes del evento (28/10)
- 18/10: el usuario decidió saltarse las 3 pruebas manuales de la 002 ("vamos a pasarnos las pruebas"): CSV en Excel, RF-12 y "Log out"/revocación con dos navegadores quedan sin verificar a mano.
- Borrar filas de prueba (guía paso 6): `dbcheck…`, las de content_version "2026-10-test-1"/"2026-10-test-2" y la de "T19 test row - delete" (Germany, 16 Oct).
- Generar el QR con la URL de Pages y probarlo en un móvil real.
- Supabase sin pausar: el día anterior abrir el dashboard, `node scripts/check-db.mjs` y después el paso 6.
- Pruebas a mano de la 001: atrás físico en Android real (RF-33/34); `prefers-reduced-motion: reduce` real; bloquear `*.woff2`; tras volver la red queda una sola fila.

## Aprendizajes y errores a evitar
- Dos animaciones CSS en el mismo elemento se pisan: la entrada anima el contenedor y el bucle el hijo. Animar solo `opacity`/`transform` y bucles ≥ 1 s; para cambiar de color, capa aparte.
- Chrome pasa `text-transform` al árbol de accesibilidad: hace falta el texto literal aparte.
- Chrome DevTools MCP: no emula `prefers-reduced-motion` ni bloquea URLs; con `--isolated` pierde la sesión de /admin al reiniciarse; emular viewport recarga la página y salta el initScript → peticiones reales a Supabase (contarlas como de prueba).
- `node scripts/check-db.mjs` escribe filas `dbcheck…` en cada ejecución: borrarlas después.
- Supabase puede mostrar "You need additional permissions" tras crear la organización: se arregla recargando.

## Mejoras opcionales (no bloqueantes)
- Precargar Big Shoulders 800 y Figtree 600 (decisión del usuario pendiente).
- Parpadeo del mapa de la Q10 al final; la intro arranca antes de `render()` al recargar; `.plato__buzzer` anima `filter`; el aviso de abajo tapa Theatre; `.final__flash` da 1-3 px de scroll a 320×568.
- /admin: vista en directo para proyectar; "n/10 answered" literal en la columna Answered (RF-40).
- `clampText` (js/lib/text.js) no quita espacios de los extremos; `\s` en el SQL (~línea 224) no cubre U+00A0.
