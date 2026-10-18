# MEMORY.md — Leisure City
Memoria del proyecto entre sesiones. Máximo ~50 líneas: resume o elimina lo que ya no aporte.

## Estado actual
- Spec 001 (encuesta pública) implementada (2026-10-16) con dos cambios ya implementados y validados el 2026-10-17: "ciudad en planta, intro, banderas, textos y estilo" y "animaciones y ciudad". Siguiente: spec 002 (/admin). Presentación: 28/10/2026 por la noche.
- Supabase: proyecto ref `xbsrdugimqpgxmlwbpxo` (Frankfurt, plan Free). Registro público desactivado; "Automatically expose new tables" desactivado.
- Contenido: las 10 preguntas reales ya están; los 6 países son aún de prueba (DE, IT, JP, NG, NL, PL). `CONTENT.version` = "2026-10-test-2". Al recibir los reales, subirla (descarta progreso antiguo, RF-52).
- Admins: la lista `public.admins` existe pero vacía; los 4 admins se crean en la spec 002 (parte de RF-66 aplazada por decisión del usuario).
- MCP de Supabase no configurado: la migración se aplicó desde el SQL Editor. El usuario quería el MCP con project ref: decidirlo en la 002.
- GitHub Pages aún NO está activado: Settings → Pages → Deploy from branch → `main` / `(root)`.

## Decisiones (y por qué)
- Flujo: intro → país → ciudad apagada → 10 preguntas → final.
- Intro: plató del primer evento ("Leisure in Jeopardy", Anexo B) con entrada escalonada (luces, cartel, tablero, público, textos y botón) en ≤ 2 s y después bucle continuo; el botón es pulsable desde el principio. Lo pidió el usuario: más animación sin hacer esperar.
- Fundidos entre pantallas y entre preguntas: salida 150 ms + entrada 250 ms (WAAPI), con una puerta de tiempo que ignora toques, Back y atrás del sistema mientras dura (evita dobles avances y payloads duplicados). La respuesta se guarda en el mismo tick del clic, no tras el fundido. Movimiento reducido: solo una entrada de 200 ms.
- Selector de país: cuadrícula de banderas (6 + Other), sin buscador ni nombres: más rápido de tocar.
- Ciudad 2D en planta rediseñada: mapa acotado (no infinito, lo pidió el usuario) con 16 rellenos, 2 zonas verdes, estanque y árboles; nombre bajo cada sitio al encenderse, generado desde `SITE_LAYOUT`. Durante las preguntas solo se encienden los 10 sitios; con los 10, la ola enciende relleno, calles y coches.
- Final: mapa acotado y centrado sobre el panel, con bucles "vivos" (coches, ventanas, farolas, ondas, focos, noria, neones) colgados de `data-final-live`; al recargar terminado, bucles desde el principio sin animación de llegada.
- Nombre del final: "Leisure for Society". Textos con fuentes del sistema, sin look de concurso ("quién quiere ser millonario").
- Aviso offline como línea dentro de la página (bajo Back/Next y bajo "Thank you"): el fijo tapaba opciones a 320 px.
- Preguntas de 2-3 opciones + "Want to tell us why?" opcional (máx. 280) en la misma pantalla. Solo botón Back, sin confirmación.
- Guardado progresivo del estado completo en una fila por participante, con contador creciente y cola local. Escritura solo vía RPC `save_response` (security definer); el UUID v4 actúa de secreto.
- Quien ya terminó ve directamente la pantalla final: evita duplicados.
- supabase-js 2.117.2 fijado, cargado del CDN solo cuando hay algo que enviar. Regla: versiones con ≥ 2 semanas.
- Spec 002: /admin con login para los 4 estudiantes (respuestas, estadísticas por pregunta y país, comentarios, CSV).

## Antes del evento (28/10)
- Activar GitHub Pages (ver arriba) y probar la URL del QR.
- Borrar filas de prueba: `dbcheck…` y content_version "2026-10-test-1" y "2026-10-test-2" (incluida `7dbc4a0e-ce77-4275-92ef-85630c85ba27`): docs/supabase.md paso 6.
- Reactivar Supabase si se pausó (~7 días sin actividad).
- Probar en Android real el atrás físico (RF-33/34: Chrome marca la guarda como "skippable") y "Reducir movimiento" real.

## Aprendizajes y errores a evitar
- Dos animaciones CSS en el mismo elemento se pisan: la entrada/ola anima el contenedor o el hijo, nunca el mismo elemento que el bucle.
- Animar solo `opacity`/`transform` y bucles con ciclos ≥ 1 s: RNF-12 midió 0 tareas largas.
- Chrome DevTools MCP necesita Chrome instalado. El navegador integrado no pega del portapapeles del sistema.
- Supabase puede mostrar "You need additional permissions" tras crear la organización: se arregla recargando.
- Al probar con Supabase bloqueado por initScript, `location.reload()` puede saltarse el bloqueo y escribir filas reales: contarlas como de prueba.

## Mejoras opcionales (reviewer, no bloqueantes)
- `.final__flash` (css/survey.css, fill both, escalado a 1,8) da ~1 s de scroll vertical de 1-3 px a 320×568 durante el destello: limitar el escalado o recortarlo.
- `clampText` (js/lib/text.js) no quita espacios de los extremos; `\s` en el SQL (línea ~224) no cubre U+00A0.
- `.country:active { transform: translateY(1px) }` no se anula con movimiento reducido.
