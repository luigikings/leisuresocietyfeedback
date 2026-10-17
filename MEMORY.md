# MEMORY.md — Leisure City
Memoria del proyecto entre sesiones. Máximo ~50 líneas: resume o elimina lo que ya no aporte.

## Estado actual
- Spec 001 (encuesta pública) implementada el 2026-10-16; cambio de requisitos (ciudad en planta, intro, banderas, textos y estilo) implementado y validado el 2026-10-17. Siguiente: spec 002 (/admin). Presentación: 28/10/2026 por la noche.
- Supabase: proyecto ref `xbsrdugimqpgxmlwbpxo` (Frankfurt, plan Free). Registro público desactivado; "Automatically expose new tables" desactivado.
- Contenido: las 10 preguntas reales ya están; los 6 países son aún de prueba (DE, IT, JP, NG, NL, PL). `CONTENT.version` = "2026-10-test-2". Al recibir los reales, subirla (descarta progreso antiguo, RF-52).
- Admins: la lista `public.admins` existe pero vacía; los 4 admins se crean en la spec 002 (parte de RF-66 aplazada por decisión del usuario).
- MCP de Supabase no configurado: la migración se aplicó desde el SQL Editor. El usuario quería el MCP con project ref: decidirlo en la 002.
- Chrome instalado y Chrome DevTools MCP funcionando.

## Decisiones (y por qué)
- Flujo: intro → país → ciudad apagada → 10 preguntas → final.
- Intro: plató completo del primer evento ("Leisure in Jeopardy", Anexo B de la spec) con animación en bucle constante (haces, focos, bombillas, pulsadores); textos "Thank you for being part of our first event!…" y "Do you want to help us with our new assignment?"; botón "Give feedback". Recrea el evento que el público ya vivió.
- Selector de país: cuadrícula de banderas (6 + Other), sin buscador ni nombres: lo pidió el usuario, más rápido de tocar.
- Ciudad en planta 2D (vista cenital tipo mapa) con 20 edificios de relleno: durante las preguntas solo se encienden los 10 sitios; con los 10, la ola enciende relleno, calles y coches en el final.
- Nombre del final: "Leisure for Society" (antes "Society of Leisure").
- Estilo de textos de ciudad nocturna con fuentes del sistema, sin look de concurso: el usuario lo veía demasiado "quién quiere ser millonario".
- Aviso offline como línea dentro de la página (bajo Back/Next y bajo "Thank you"), no fijo abajo: el fijo tapaba opciones a 320 px.
- Preguntas de 2-3 opciones (A/B/C) + "Want to tell us why?" opcional (máx. 280) en la misma pantalla: menos pantallas, menos abandonos.
- Solo botón Back, sin "¿Es tu respuesta final?": menos toques.
- Guardado progresivo del estado completo en una fila por participante, con contador creciente y cola local: no perder respuestas a medias ni offline.
- Escritura del público solo vía RPC `save_response` (security definer), sin permisos sobre tablas: el UUID v4 del navegador actúa de secreto.
- Quien ya terminó ve directamente la pantalla final: evita duplicados.
- supabase-js 2.117.2 fijado y cargado del CDN solo cuando hay algo que enviar. Regla: usar versiones con ≥2 semanas de antigüedad.
- GitHub Pages sirve la web y Supabase solo los datos: todo gratis y sin backend propio.
- Spec 002: /admin con login para los 4 estudiantes (respuestas, estadísticas por pregunta y país, comentarios, exportar CSV).

## Antes del evento (28/10)
- Borrar filas de prueba (`dbcheck…` y content_version "2026-10-test-1" y "2026-10-test-2"): docs/supabase.md paso 6.
- Reactivar Supabase si se pausó (~7 días sin actividad).
- Probar en Android real el atrás físico (RF-33/34, js/app/history.js: Chrome marca la guarda como "skippable").
- Probar "Reducir movimiento" real en un móvil.

## Aprendizajes y errores a evitar
- Chrome no venía instalado y el Chrome DevTools MCP lo necesita.
- El navegador integrado no puede pegar desde el portapapeles del sistema.
- Supabase puede mostrar "You need additional permissions" justo tras crear la organización: se arregla recargando.
- Al probar con Supabase bloqueado por initScript, `location.reload()` puede saltarse el bloqueo y escribir filas reales: contarlas como filas de prueba.

## Mejoras opcionales (reviewer, no bloqueantes)
- `clampText` (js/lib/text.js) recorta sin quitar espacios de los extremos.
- `\s` en el SQL de la migración (línea ~224) no cubre U+00A0.
- `.country:active { transform: translateY(1px) }` (css/survey.css) no se anula con movimiento reducido.
