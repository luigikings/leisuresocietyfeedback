# Supabase — guía de configuración (specs 001 y 002)

Pasos manuales para dejar la base de datos lista. Los hace el usuario (tarea T7 de `specs/001-survey/tasks.md` y, para la cuenta del panel /admin, tarea T6 de `specs/002-admin/tasks.md`); el agente solo rellena `js/config.js` y ejecuta las comprobaciones.

Mientras no se hagan, la encuesta funciona en **modo local**: las respuestas se quedan en la cola del navegador y se ve el aviso "Saved offline – will sync".

## Modelo de seguridad (resumen)
- El público (clave anon/publishable) **no tiene ningún permiso sobre las tablas**. Solo puede ejecutar la función `save_response`, que crea o actualiza la fila del ID (UUID v4) que recibe y no devuelve nada. El ID es el secreto del participante.
- `save_response` valida la forma (preguntas 1-10, opción A/B/C, textos de 280 como máximo, país ISO alfa-2 o `OTHER`, versión, estado y contador), ignora los envíos con contador antiguo, no deja cambiar país ni versión y no deja tocar una fila terminada.
- RLS está activo y forzado en `responses` y `admins`. Solo leen las respuestas los usuarios autenticados que estén en `public.admins` (la cuenta compartida del panel /admin, paso 4).
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

## 4. Cuenta compartida del panel /admin (spec 002: RF-50, RF-52, RNF-1, RNF-2, RNF-13)
El panel `/admin/` tiene **una sola cuenta compartida**. En el formulario se entra con el usuario `admin`; por dentro, Supabase la identifica con un **correo interno** que no existe ni recibe correo: `admin@leisure-city.invalid`. Ese correo no es secreto (está en `js/config.js`, `ADMIN_LOGIN_EMAIL`); **el único secreto es la contraseña**.

Todo este paso lo hace **solo el responsable**, en el panel web de Supabase (proyecto `xbsrdugimqpgxmlwbpxo`), nunca desde `/admin`.

> **La contraseña no se escribe nunca** en el repositorio, en un issue, en un chat con agentes (ni con Claude), en un correo ni en una consulta del SQL Editor (el editor guarda el historial de consultas). Solo va en tu gestor de contraseñas y en el campo de contraseña del panel de Supabase. Ningún agente la ve ni la necesita (RNF-1).

### 4.1 Crear la cuenta
1. En tu gestor de contraseñas, genera una contraseña **al azar de 16 caracteres o más** (o una frase de 5 palabras al azar o más) y guárdala ahí (RNF-2). No la inventes tú.
2. En Supabase: **Authentication → Users → Add user → Create new user**.
3. Rellena:
   - **Email**: `admin@leisure-city.invalid`
   - **Password**: pega la contraseña del gestor.
   - **Auto Confirm User**: **marcado** (así no se envía ningún correo; el dominio no existe y no llegaría nada, RF-52).
4. Pulsa **Create user**. Debe aparecer en la lista de usuarios con ese correo.
5. **Si Supabase rechaza el correo** (por ejemplo, "invalid email" o un aviso sobre el dominio):
   1. Repite el punto 2 con el correo `admin@example.com` (también es un dominio reservado que no recibe correo).
   2. Avisa al agente de que el correo final es `admin@example.com` (**sin la contraseña**). Hay que cambiar `ADMIN_LOGIN_EMAIL` en `js/config.js` y anotarlo en la spec 002; si no, el formulario no podrá entrar.
   3. En todas las consultas de este paso 4, usa `admin@example.com` en lugar de `admin@leisure-city.invalid`.
6. Comprueba que el registro público sigue desactivado (paso 3): crear la cuenta a mano no lo reactiva, pero conviene mirarlo.

### 4.2 Añadirla a la lista de admins y comprobarlo
La cuenta se busca por su correo, así que su identificador interno (UUID) no se copia en ningún sitio (RNF-3). En **SQL Editor → New query**, pega y pulsa **Run**:
```sql
insert into public.admins (user_id, label)
select id, 'Shared admin' from auth.users where email = 'admin@leisure-city.invalid'
on conflict (user_id) do nothing;
```
Debe decir "Success. No rows returned". Después comprueba:
```sql
select a.label, u.email, u.email_confirmed_at is not null as confirmed
from public.admins a join auth.users u on u.id = a.user_id;
```
Esperado: **1 fila**, `Shared admin | admin@leisure-city.invalid | true`.
- Si sale **0 filas**: el correo de la consulta no coincide con el de la cuenta (revisa el punto 4.1.5).
- Si `confirmed` sale `false`: no se marcó "Auto Confirm User". Borra el usuario (Authentication → Users → la cuenta → **Delete user**) y vuelve a 4.1.
- Si salen más filas: hay admins antiguos de pruebas. Quedarse solo con la cuenta compartida:
  ```sql
  delete from public.admins
  where user_id not in (select id from auth.users where email = 'admin@leisure-city.invalid');
  ```

Comprobación final: abre `/admin/`, entra con usuario `admin` y la contraseña (pegada desde el gestor). Deben verse los resultados.

### 4.3 Cambiar la contraseña
"Send password recovery" **no sirve**: el correo no existe y no llegaría nada. Y **no** cambies la contraseña con una consulta SQL: quedaría escrita en el historial del SQL Editor.
1. Genera una contraseña nueva en el gestor (como en 4.1.1).
2. En **Authentication → Users**, abre la cuenta. Si el panel ofrece cambiar o restablecer la contraseña directamente (sin correo), pega ahí la nueva y guarda.
3. Si el panel no lo ofrece, **vuelve a crear la cuenta**:
   1. Authentication → Users → la cuenta → **Delete user**. Al borrarla se borra también su fila de `public.admins` y sus sesiones (en cascada).
   2. Repite 4.1 (puntos 2 a 4) con la contraseña nueva y 4.2 (el `insert` y la comprobación).
4. Si el cambio es por una contraseña filtrada, no lo hagas así a secas: sigue el 4.5.
5. Pasa la contraseña nueva a los demás estudiantes en persona o por un canal privado (nunca en el repo ni en un chat con agentes).

### 4.4 Prueba de "sin acceso" (RF-12): quitar la cuenta de admins y volver a ponerla
Sirve para comprobar que, si la cuenta deja de ser admin, el panel se cierra y no enseña datos.
1. Entra en `/admin/` con la cuenta (para tener una sesión abierta).
2. En el SQL Editor, quítala de la lista de admins:
   ```sql
   delete from public.admins
   where user_id = (select id from auth.users where email = 'admin@leisure-city.invalid');
   ```
3. En `/admin/`, pulsa **Refresh** (o recarga la página, o vuelve a entrar). Esperado: el formulario de entrada con el mensaje **"This account has no access to the results."** y ningún dato en pantalla.
4. Vuelve a añadirla repitiendo el `insert` y la comprobación de 4.2 (1 fila, `confirmed = true`).
5. Entra otra vez en `/admin/`: deben verse los resultados.

**No dejes la cuenta fuera de admins**: sin la fila, nadie puede ver los resultados.

### 4.5 Contraseña filtrada o sospecha de acceso ajeno (propuesta 25)
Cambiar solo la contraseña **no basta**: no está garantizado que cierre las sesiones ya abiertas, y en el plan gratuito la sesión recordada no caduca sola. Hazlo en este orden, desde el panel de Supabase:
1. **Quitar la cuenta de admins** (corta las lecturas al momento): la consulta del 4.4.2.
2. **Revocar todas las sesiones de la cuenta** (borra sus tokens de renovación y sus sesiones), en el SQL Editor:
   ```sql
   delete from auth.refresh_tokens
   where user_id::text = (select id::text from auth.users where email = 'admin@leisure-city.invalid');

   delete from auth.sessions
   where user_id = (select id from auth.users where email = 'admin@leisure-city.invalid');
   ```
   Comprueba que no queda nada (las dos cuentas deben dar 0):
   ```sql
   select
     (select count(*) from auth.sessions
       where user_id = (select id from auth.users where email = 'admin@leisure-city.invalid')) as sessions,
     (select count(*) from auth.refresh_tokens
       where user_id::text = (select id::text from auth.users where email = 'admin@leisure-city.invalid')) as refresh_tokens;
   ```
   Notas:
   - En el esquema de Supabase Auth, `auth.sessions.user_id` es `uuid` y `auth.refresh_tokens.user_id` es texto (`varchar(255)`); por eso la segunda tabla compara como texto (`::text`), que funciona aunque el tipo cambie en una versión futura. Comprobado en las migraciones públicas de Supabase Auth, no en este proyecto: si una consulta da un error de columna o de tipo, **para** y avisa al agente (sin la contraseña) en lugar de improvisar.
   - Si la ficha del usuario en el panel ofrece cerrar todas sus sesiones ("sign out" / "log out of all sessions"), también vale, pero comprueba después con la última consulta que salen 0 y 0.
   - Alternativa sin SQL: borrar el usuario (Delete user) también borra sus sesiones en cascada; en ese caso, en el punto 3 se vuelve a crear con 4.1.
3. **Cambiar la contraseña** (4.3, con una contraseña nueva del gestor).
4. **Esperar el tiempo de vida del token de acceso** antes de volver a añadir la cuenta a admins: **1 hora** por defecto (3600 s; en el panel aparece como "JWT expiry" o "Access token expiry", en la configuración de JWT o de sesiones de Authentication). Si se cambió ese valor, espera lo que diga. Así ningún token anterior puede volver a leer cuando la cuenta vuelva a ser admin.
5. **Volver a añadirla a admins**: el `insert` y la comprobación de 4.2.
6. **Comunicar la contraseña nueva** a los demás estudiantes en persona o por un canal privado.

Prueba (validación de la spec 002, T10): con la sesión abierta en dos navegadores, haz los pasos 1 y 2; en el otro navegador, al pulsar **Refresh** o reabrir `/admin/`, ya no deben verse datos (mensaje de sesión caducada o "This account has no access to the results.").

### 4.6 Recordatorios
- El registro público sigue desactivado (paso 3, RF-52): la cuenta solo se crea a mano.
- El correo interno no es secreto; la contraseña sí. No la pegues en el repo, en un issue, en el SQL Editor ni en un chat con agentes (RNF-1).
- En un ordenador ajeno, pulsa **Log out** en `/admin/` al terminar: la sesión recordada no caduca sola.
- `node scripts/check-db.mjs` sigue comprobando con la clave pública que el público no puede leer nada (RF-50).

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
