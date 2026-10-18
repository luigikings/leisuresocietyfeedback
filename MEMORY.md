# MEMORY.md — Leisure City
Memoria del proyecto entre sesiones. Máximo ~50 líneas: resume o elimina lo que ya no aporte.

## Estado actual
- Spec 001 (encuesta pública) implementada (2026-10-16) con tres cambios implementados y validados: "ciudad en planta, intro, banderas, textos y estilo" y "animaciones y ciudad" (17/10), y "estilo de la referencia y ciudad viva" (18/10, T29-T38). Siguiente: spec 002 (/admin). Presentación: 28/10/2026 por la noche.
- Supabase: proyecto ref `xbsrdugimqpgxmlwbpxo` (Frankfurt, plan Free). Registro público y "Automatically expose new tables" desactivados.
- Contenido: las 10 preguntas reales ya están; los 6 países son aún de prueba (DE, IT, JP, NG, NL, PL). `CONTENT.version` = "2026-10-test-2". Al recibir los reales, subirla (descarta progreso antiguo, RF-52).
- Admins: `public.admins` existe pero vacía; los 4 admins se crean en la spec 002 (parte de RF-66 aplazada por el usuario). MCP de Supabase sin configurar (migración aplicada desde el SQL Editor): decidirlo en la 002.
- GitHub Pages aún NO está activado: Settings → Pages → Deploy from branch → `main` / `(root)`.

## Decisiones (y por qué)
- Flujo: intro → país → ciudad apagada → 10 preguntas → final ("Leisure for Society"). Quien ya terminó ve directamente el final: evita duplicados.
- Estilo de la demo (decisión del usuario): marcos en hexágono sin letras A/B, botones dorados y mayúsculas condensadas solo en títulos. Sustituye "fuentes del sistema, sin look de concurso".
- Fuentes Big Shoulders Display + Figtree autoalojadas en `assets/fonts/` con `font-display: optional` (sin servicios externos; si no llegan a tiempo se ve la de reserva sin saltos). `serve.mjs` cachea los `.woff2` un año: con no-store casi nunca llegaban a tiempo en local.
- Títulos en mayúsculas por CSS con `aria-label`/copia `.visually-hidden` con el texto literal (RF-95): el lector lee el texto tal cual.
- Intro: plató del primer evento (Anexo B), entrada escalonada ≤ 2 s y bucles continuos (5 nuevos y cuenta de marcadores); botón pulsable desde el principio.
- Transiciones: salida 200 ms + entrada 350 ms con "rise" (WAAPI), con puerta de tiempo que ignora toques, Back y atrás del sistema (evita dobles avances y payloads duplicados). La respuesta se guarda en el mismo tick del clic. Movimiento reducido: solo un fundido de opacidad de 200 ms.
- Ciudad: rejilla 6×4 de la demo generada desde `js/lib/city-grid.js` con orden fijo y disperso de los 10 sitios (`SITE_CELLS`). Sustituye la ciudad de `SITE_LAYOUT` con rellenos, árboles y estanque. Rótulo bajo cada sitio al encenderse; con los 10, la ola enciende manzanas, calles y farolas.
- HUD en `#city-wrap`: porcentaje y barra de progreso (`js/lib/progress.js`, `js/app/hud.js`).
- Final: mapa acotado sobre el panel con bucles vivos (`data-final-live`); al recargar terminado, bucles desde el principio sin llegada.
- Selector de país: cuadrícula de banderas (6 + Other), sin buscador ni nombres.
- Preguntas de 2-3 opciones + "Want to tell us why?" opcional (máx. 280). Solo botón Back, sin confirmación. Aviso offline como línea dentro de la página (el fijo tapaba opciones a 320 px).
- Guardado progresivo en una fila por participante, con contador creciente y cola local, solo vía RPC `save_response` (security definer); el UUID v4 es el secreto.
- supabase-js 2.117.2 fijado, del CDN solo cuando hay algo que enviar. Regla: versiones con ≥ 2 semanas.

## Antes del evento (28/10)
- Activar GitHub Pages y probar la URL del QR.
- Borrar filas de prueba: `dbcheck…` y content_version "2026-10-test-1"/"2026-10-test-2" (incluida `7dbc4a0e-ce77-4275-92ef-85630c85ba27`): docs/supabase.md paso 6.
- Reactivar Supabase si se pausó (~7 días sin actividad).
- Pruebas a mano pendientes: atrás físico en Android real (RF-33/34, "skippable"); `prefers-reduced-motion: reduce` real (Rendering o ajuste del móvil); DevTools → Network → bloquear `*.woff2`; con una fila de prueba (luego borrarla), que tras volver la red queda una sola fila.

## Aprendizajes y errores a evitar
- Dos animaciones CSS en el mismo elemento se pisan: la entrada/ola anima el contenedor o el hijo, nunca el mismo elemento que el bucle.
- Animar solo `opacity`/`transform` y bucles ≥ 1 s (RNF-12: 0 tareas largas). Para cambiar de color, capa aparte: las farolas apagadas (`.lamps__off`) van debajo y solo se anima la opacidad de las encendidas. RF-140 pide "apagadas", no ocultas.
- Chrome pasa `text-transform` al árbol de accesibilidad: hace falta el texto literal aparte.
- El MCP de Chrome DevTools no emula `prefers-reduced-motion` ni bloquea URLs: se simuló con `matchMedia` falseado y 404 reales. Emular el móvil recarga la página. Necesita Chrome instalado.
- Al probar con Supabase bloqueado por initScript, `location.reload()` puede saltarse el bloqueo y escribir filas reales: contarlas como de prueba.
- Supabase puede mostrar "You need additional permissions" tras crear la organización: se arregla recargando.

## Mejoras opcionales (reviewer, no bloqueantes)
- Precargar Big Shoulders 800 y Figtree 600 (decisión del usuario pendiente).
- Parpadeo del mapa de la Q10 al final (`#city-wrap` se funde en la salida); la intro arranca antes de `render()` al recargar; `.plato__buzzer` anima `filter`; el aviso de abajo tapa Theatre encendido.
- `.final__flash` (escalado a 1,8) da ~1 s de scroll vertical de 1-3 px a 320×568.
- `clampText` (js/lib/text.js) no quita espacios de los extremos; `\s` en el SQL (~línea 224) no cubre U+00A0.
