# AGENTS.md — Leisure City (leisuresocietyfeedback)
Encuesta web para móvil del proyecto universitario "Events and Leisure" (sociedad del ocio y diferencias culturales).
El público entra por QR, responde 10 preguntas y una ciudad nocturna se ilumina; los estudiantes ven los resultados en /admin.

## Stack y estructura
- HTML, CSS y JavaScript sin framework ni build. Gráficos en SVG y animaciones en CSS.
- Supabase (plan gratuito) como base de datos y Auth para /admin. El navegador habla directamente con Supabase.
- Hosting: GitHub Pages (repo público `luigikings/leisuresocietyfeedback`). Estructura de carpetas: se define en la spec 001.

## Comandos
- Arrancar: pendiente (servidor estático local, se define en la spec 001).
- Tests: `node --test` (test runner nativo de Node 24, sin dependencias).

## Convenciones
- Código, nombres y textos de la interfaz en inglés. Docs SDD (specs, MEMORY, constitución) en español.
- Lógica en módulos JS puros sin DOM ni red; la interfaz solo pinta y llama a la lógica.
- Mobile-first: diseño de referencia a 375 px, vertical.

## Reglas de dominio / trampas conocidas
- 10 preguntas = 10 sitios de ocio: cada respuesta enciende exactamente uno.
- Las respuestas se guardan al momento en UNA fila por participante (ID aleatorio en el navegador), no solo al final.
- La clave anon de Supabase es pública: la seguridad depende de RLS. El público solo inserta/actualiza su fila; solo los admins autenticados leen.
- /admin es una página pública en hosting estático: los datos los protege Supabase, no la página.
- Supabase pausa los proyectos gratuitos tras ~7 días sin actividad: probar antes de la presentación.
- "Jeopardy" es la referencia del primer evento; no usar logos ni música de programas reales.

## SDD
- Lee `docs/constitution.md` y la spec activa (`specs/NNN-*/`) antes de tocar código.
- Funcionalidades nuevas: flujo SDD (/coordinator en Claude Code, agente coordinator en OpenCode, o comandos /sdd-*). Cambios pequeños: /feature.
- El usuario aprueba la spec y el plan con tareas. Lo demás avanza solo y se para si algo falla o falta una decisión.

## Memoria
- Al empezar, lee `MEMORY.md`. Actualízalo al cerrar cada spec o ante una decisión importante o un error a evitar.
- Máximo ~50 líneas; si algo se vuelve regla permanente, propón moverlo aquí. Nunca datos sensibles.

## Límites
- ✅ Siempre: respetar `prefers-reduced-motion`; probar a 375 px; actualizar `MEMORY.md` al cerrar cada spec.
- ⚠️ Pregunta antes: dependencias o librerías nuevas, cambios en el formato de la tabla de respuestas o en las políticas RLS.
- 🚫 Nunca: usar la service_role key en el frontend; desactivar RLS; subir claves, tokens o archivos .env.

## Verificación
- `node --test` en verde + flujo completo en el navegador (Chrome DevTools MCP) a 375 px, sin errores en consola.
