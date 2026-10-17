# Supabase — guía de configuración (spec 001)

Pasos manuales para dejar la base de datos lista. Los hace el usuario (tarea T7 de `specs/001-survey/tasks.md`); el agente solo rellena `js/config.js` y ejecuta las comprobaciones.

Mientras no se hagan, la encuesta funciona en **modo local**: las respuestas se quedan en la cola del navegador y se ve el aviso "Saved offline – will sync".

## Modelo de seguridad (resumen)
- El público (clave anon/publishable) **no tiene ningún permiso sobre las tablas**. Solo puede ejecutar la función `save_response`, que crea o actualiza la fila del ID (UUID v4) que recibe y no devuelve nada. El ID es el secreto del participante.
- `save_response` valida la forma (preguntas 1-10, opción A/B/C, textos de 280 como máximo, país ISO alfa-2 o `OTHER`, versión, estado y contador), ignora los envíos con contador antiguo, no deja cambiar país ni versión y no deja tocar una fila terminada.
- RLS está activo y forzado en `responses` y `admins`. Solo leen las respuestas los usuarios autenticados que estén en `public.admins`.
- Las fechas las pone el servidor. No se guarda la IP ni ningún dato personal (los registros técnicos propios de Supabase quedan fuera de nuestro control).
- **Riesgos asumidos** (aprobados en la spec): quien conozca el ID de un participante podría sobrescribir su fila mientras no esté terminada, y cualquiera con la clave pública podría crear filas falsas con IDs válidos. Los admins pueden revisarlas y borrarlas a mano (paso 6).

## Lo que NUNCA hay que hacer
- Poner en el repo, en `js/config.js` o en un chat la clave **service_role** / **secret** (`sb_secret_…`) ni la contraseña de la base de datos.
- Desactivar RLS o añadir políticas de insert/update/delete para `anon` o `authenticated`.
- Activar el registro público de usuarios.

---

## 1. Crear el proyecto
1. Entra en https://supabase.com/dashboard → **New project**.
2. Organización: la tuya (plan **Free**). Nombre: por ejemplo `leisure-city`.
3. **Database password**: genera una y guárdala en tu gestor de contraseñas. No hace falta para la encuesta y **no se comparte** con nadie ni se sube al repo.
4. Región: la más cercana al lugar del evento (por ejemplo, una de Europa).
5. Pulsa **Create new project** y espera a que termine de prepararse (1-2 minutos).

## 2. Aplicar el SQL
1. En el menú lateral, **SQL Editor** → **New query**.
2. Abre `supabase/migrations/001_survey.sql` del repo, copia **todo** su contenido y pégalo.
3. Pulsa **Run**. Si Supabase avisa de una "destructive operation" es por los `drop policy if exists` (solo recrean las políticas): confirma.
4. Debe terminar con "Success. No rows returned". Se puede volver a ejecutar sin perder filas.
5. (Opcional) Comprueba el resultado con esta consulta; debe salir `true`/`true` en las dos tablas y ninguna fila para `anon`:
   ```sql
   select relname, relrowsecurity as rls, relforcerowsecurity as forced
   from pg_class where oid in ('public.responses'::regclass, 'public.admins'::regclass);

   select grantee, table_name, privilege_type
   from information_schema.role_table_grants
   where table_schema = 'public' and table_name in ('responses', 'admins')
     and grantee in ('anon', 'authenticated');
   -- Esperado: solo "authenticated | responses | SELECT".
   ```
6. En **Project Settings → Data API**, comprueba que la Data API está activada y que el esquema `public` está expuesto (es lo normal en un proyecto nuevo). La encuesta llama a `save_response` a través de ella.

## 3. Desactivar el registro público (RF-67)
1. **Authentication → Sign In / Providers** (en algunas versiones: Authentication → Settings).
2. Desactiva **Allow new users to sign up** y guarda.
3. Con esto, solo los usuarios que crees tú a mano (paso 4) pueden iniciar sesión.

## 4. Crear los 4 admins (RF-66)
1. **Authentication → Users → Add user → Create new user**.
2. Para cada uno de los 4 estudiantes: su correo y una contraseña, con **Auto Confirm User** marcado. Cada uno puede cambiar su contraseña más adelante.
3. Añádelos a la lista de admins en el **SQL Editor** (cambia los correos y los nombres cortos):
   ```sql
   insert into public.admins (user_id, label)
   select u.id, v.label
   from auth.users u
   join (values
     ('estudiante1@example.com', 'Name1'),
     ('estudiante2@example.com', 'Name2'),
     ('estudiante3@example.com', 'Name3'),
     ('estudiante4@example.com', 'Name4')
   ) as v(email, label) on u.email = v.email
   on conflict (user_id) do nothing;
   ```
4. Comprueba que salen los 4:
   ```sql
   select a.label, u.email from public.admins a join auth.users u on u.id = a.user_id;
   ```
   El inicio de sesión y la lectura de resultados se prueban en la spec 002 (/admin).

## 5. Pasar la URL y la clave pública
1. **Project Settings → API Keys** (o el botón **Connect** de la parte superior).
2. Copia:
   - la **Project URL**: `https://<project-ref>.supabase.co`;
   - la clave **pública**: la **Publishable key** (`sb_publishable_…`) o, en la pestaña de claves antiguas, la **anon public** (empieza por `eyJ…`).
3. **Nunca** copies la `service_role` ni la **Secret key** (`sb_secret_…`).
4. Pásale al agente esos dos valores (o ponlos tú en `js/config.js`, en `SUPABASE_URL` y `SUPABASE_ANON_KEY`). Son públicos por diseño: la seguridad la dan RLS y `save_response`.
5. Comprobaciones (las ejecuta el agente):
   ```
   node --test                    # incluye la guarda que rechaza claves secretas
   node scripts/check-db.mjs      # prueba los permisos reales con la clave pública
   ```
   `check-db.mjs` debe terminar con "N/N checks passed". Comprueba que el registro está desactivado, que el acceso directo a las tablas se rechaza, que `save_response` crea y actualiza sin devolver datos, que ignora contadores antiguos y que rechaza IDs no válidos, datos con forma no válida, cambios de país o versión y cambios en filas terminadas. Si dice "table not found", repite el paso 2.

## 6. Borrar las filas de prueba antes del evento (RNF-11)
`check-db.mjs` crea filas con `content_version` que empieza por `dbcheck`, y las pruebas en el navegador crean filas con la versión de prueba del contenido (`2026-10-test-1`, `2026-10-test-2`). Antes del evento, en el **SQL Editor**:

1. Mira qué hay:
   ```sql
   select content_version, status, count(*) from public.responses group by 1, 2 order by 1, 2;
   ```
2. Borra solo las filas de `check-db.mjs`:
   ```sql
   delete from public.responses where content_version like 'dbcheck%';
   ```
3. Cuando lleguen los países reales y se suba `CONTENT.version` en `js/content.js`, borra todo lo que no sea de la versión real (cambia el valor):
   ```sql
   delete from public.responses where content_version <> '<versión real de js/content.js>';
   ```
   O, si todavía no ha respondido nadie de verdad, todo:
   ```sql
   delete from public.responses;
   ```
4. Repite la consulta del punto 1 para confirmar.

No vuelvas a ejecutar `check-db.mjs` después de esta limpieza salvo que borres de nuevo sus filas (punto 2).

## 7. Antes de la presentación
- Supabase pausa los proyectos gratuitos tras unos 7 días sin actividad. El día anterior abre el dashboard (si está en pausa, **Restore project**), ejecuta `node scripts/check-db.mjs` y, después, el paso 6.2.
- Si se configuró el MCP de Supabase, pásalo a solo lectura o quítalo cuando haya datos reales.

## Alternativa: aplicar el SQL con el MCP de Supabase
Si el usuario configura el MCP de Supabase limitado a este proyecto, el agente puede aplicar `001_survey.sql` con él en lugar del paso 2. Los pasos 3, 4 y 5 siguen siendo manuales.
