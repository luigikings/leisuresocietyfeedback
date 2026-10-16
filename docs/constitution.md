# Constitución — Leisure City

Principios innegociables. Toda spec, plan y tarea debe cumplirlos.

1. **Stack mínimo y gratis**: HTML, CSS y JS sin framework ni paso de build, servidos por GitHub Pages; Supabase gratuito como único servicio externo. Cualquier librería nueva requiere aprobación explícita.
2. **La spec manda**: no se implementa nada que no esté en una spec aprobada; un cambio de requisitos pasa primero por la spec.
3. **Lógica separada de la interfaz**: la lógica (progreso, validación, guardado, estadísticas) vive en módulos puros que no tocan DOM, red ni fecha; la interfaz solo pinta y delega.
4. **Tests de la lógica**: toda función de lógica tiene tests con `node --test` y deben estar en verde antes de cerrar una tarea; la interfaz se valida en navegador a 375 px.
5. **Datos anónimos y protegidos**: no se pide ningún dato personal (solo país y respuestas); RLS siempre activo; el público solo escribe su propia fila y solo los admins autenticados leen; la service_role key nunca sale de Supabase.
6. **Móvil primero y accesible**: todo funciona en un móvil a 375 px, respeta `prefers-reduced-motion` y no se pierde ninguna respuesta por un fallo de red.
7. **Idioma**: código, nombres y textos de la interfaz en inglés; documentación SDD en español.
