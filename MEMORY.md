# MEMORY.md — Leisure City
Memoria del proyecto entre sesiones. Máximo ~50 líneas: resume o elimina lo que ya no aporte.

## Estado actual
- Proyecto vacío, recién inicializado con SDD. Presentación: 28/10/2026 por la noche.

## Decisiones (y por qué)
- Flujo: intro con plató animado estilo "Leisure in Jeopardy" (recrea el primer evento) → elegir país (≤20, con buscador y banderas SVG) → ciudad apagada → 10 preguntas → final.
- 10 preguntas de 2-3 opciones (A/B/C en casillas azules con letra dorada) + "Want to tell us why?" opcional en la misma pantalla (máx. 280 caracteres) y botón Next: menos pantallas, menos abandonos.
- Solo botón Volver, sin "¿Es tu respuesta final?": menos toques.
- Final: ola de luz, coches y confeti; las banderas giran, se juntan con un destello y aparece "Society of Leisure" + "Thank you". Sin foto del equipo.
- Guardado progresivo en una fila por participante: no perder respuestas a medias.
- Quien ya terminó ve directamente la pantalla final: evita duplicados.
- Pregunta de país al inicio: el tema son las diferencias culturales y hay que poder segmentar.
- GitHub Pages sirve la web y Supabase solo los datos: todo gratis y sin backend propio.
- Dos specs: 001 encuesta pública; 002 /admin con login para los 4 estudiantes (respuestas, estadísticas por pregunta y país, comentarios, exportar CSV).
- Supabase MCP limitado al proyecto; pasarlo a solo lectura o quitarlo cuando haya datos reales.

## Aprendizajes y errores a evitar
- (vacío por ahora)

## Próximos pasos
- Constitución → spec 001 (encuesta pública). Pendiente de recibir: las 10 preguntas y la lista de países.
- Crear el proyecto en Supabase y pasar el project ref para configurar su MCP.
