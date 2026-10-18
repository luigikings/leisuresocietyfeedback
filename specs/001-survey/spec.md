# Spec 001 — Encuesta pública (Leisure City)

Estado: implementada (2026-10-17; cambio 'animaciones y ciudad' implementado)

> Nota de cierre: la creación de los 4 admins (parte de RF-66) queda aplazada a la spec 002 por decisión del usuario. La lista de admins y la política de lectura ya existen.

## Historial de cambios
- 2026-10-16 — Implementada y validada (VEREDICTO: APROBADO).
- 2026-10-16 — Cambio de requisitos: ciudad en vista cenital tipo mapa, con edificios de relleno además de los 10 sitios de ocio; durante las preguntas solo se encienden los 10 sitios y, con los 10 encendidos, se enciende la ciudad entera, integrado en el final. Petición del usuario: "el tema de la ciudad la idea es que fuera estilo mapa desde arriba, salgan varios edificios ademas de los 10 de las preguntas y se vayan encendiendo solo los 10 edificios y cuando se encienden todos los edificios se enciende la ciudad entera". Añadidos RF-69 a RF-79 (dudas resueltas por el usuario: ver "Dudas abiertas"); modificados RF-53, RF-54, RNF-2, RNF-4 y RNF-7; nuevas definiciones, casos límite y criterios. La spec vuelve a "aprobada".
- 2026-10-16 — El usuario aprueba el cambio (RF-69 a RF-79 y los RF/RNF modificados). Pendiente de implementar (plan §14, tareas T11-T15).
- 2026-10-16 — Se amplía el cambio (aún sin implementar) con intro, banderas, textos y estilo. Petición del usuario: "el tema de las banderas vamos a hacerlo mejor que salga solo la bandera en cuadrado no en lista y sin buscador y pon por ahora solo 6 paises, la intro me gustaria que tenga una animacion constante, por cierto falta la parte de abajo en la intro te vuelvo a mandar la imagen de referencia ademas el texto debe ser el mismo y la misma tabla... hay otros texto a cambiar "Society of Leisure" cambialo a "Leisure for Society" en la intro nesecito que el texto sea "Thank you for being part of our first event! We hope you enjoyed it as much as we did" y mas abajo haya otro texto que diga "Do you want to help us with our new assignment?" y el boton en vez de decir "start" diga "Give feedback" y a lo mejor mejoraria un poco el diseño del texto parece demasiado "quien quiere ser millonario"". Modificados RF-3, RF-4, RF-5, RF-7, RF-8, RF-9, RF-10, RF-11, RF-17, RF-53, RF-54, RNF-2, RNF-4, RNF-5 y RNF-7; eliminados RF-12, RF-13 y RF-14; añadidos RF-80 a RF-97 y el Anexo B (descripción de la imagen de referencia de la intro). Superadas las decisiones aprobadas 6 y 9. Dudas resueltas por el usuario: encaje de la intro, opción (a) (RF-88); los 6 países de prueba aprobados (RF-3). Pendiente de aprobación del usuario.
- 2026-10-16 — El usuario aprueba el cambio completo (ciudad cenital RF-69 a RF-79; intro, banderas, textos y estilo RF-80 a RF-97; RF y RNF modificados; RF-12 a RF-14 eliminados). Pendiente de implementar (plan §14, tareas T11-T19).
- 2026-10-17 — Cambio implementado y validado (tareas T11-T19, VEREDICTO: APROBADO). Durante T19 el usuario decidió mostrar el aviso sin conexión dentro de la página (plan §14.11). La creación de los admins sigue aplazada a la spec 002.
- 2026-10-17 — Cambio de requisitos (animaciones y ciudad). Petición del usuario: "la web nesecita mas animación... me gustaria que la parte de la intro tenga una animacion de entrada con las luces, las personas, el texto y el boton, todo, y que despues lo que es el fondo tenga como una animacion continua... que no para, despues tambien una animacion entre pregunta y pregunta a lo mejor un fade in y fade out para que le de mas fluidez y no sea tan tosco, me gustaria tambien que la ciudad sea mejor, esta muy feo los diseños y me gustaria que cuando se encienden pongan el nombre de lo que se enciende justo debajo para mas o menos saber que edificio es... y por ultimo la ciudad cuando se hace grande me gustaria lo mismo mas animaciones, el mapa no tiene que ser infinito eso no me gusto dejalo como esta pero agrega animaciones en bucles para ver que la ciudad esta viva cuando todos los edificios ya estan encendidos". Modificados RF-7, RF-8, RF-54, RF-56, RF-69, RF-71, RF-74, RF-77, RF-79, RF-87, RNF-2, RNF-4 y RNF-7; añadidos RF-98 a RF-118 y RNF-12; ningún RF eliminado; nuevas definiciones, casos límite y criterios. Superadas en parte la decisión aprobada 7 y las dudas resueltas 3, 4 y 5. Pendiente de aprobación del usuario.
- 2026-10-17 — El usuario aprueba el cambio (RF-98 a RF-118, RNF-12 y los RF/RNF modificados) junto con las 4 decisiones del planner (dudas 14 a 17, ahora resueltas). La spec vuelve a "aprobada". Pendiente de implementar (plan §15, tareas T20-T28).
- 2026-10-17 — Cambio 'animaciones y ciudad' implementado y validado (tareas T20-T28, VEREDICTO: APROBADO). La spec vuelve a "implementada". La creación de los admins sigue aplazada a la spec 002.

## Contexto y objetivo
El proyecto universitario "Events and Leisure" necesita recoger la opinión del público sobre la sociedad del ocio y las diferencias culturales durante y después de su presentación (28/10/2026). El público entra con el móvil por un QR, ve una intro que recuerda el primer evento ("Leisure in Jeopardy") y le invita a dar su opinión, elige su país tocando su bandera y responde 10 preguntas cortas. Cada respuesta enciende uno de los 10 sitios de ocio de una ciudad nocturna vista desde arriba como un mapa, rodeados de edificios de relleno que no corresponden a preguntas; con los 10 encendidos se enciende la ciudad entera dentro de una animación final de cierre. Así la encuesta resulta corta y divertida, y los estudiantes obtienen datos que pueden segmentar por país. Las respuestas se guardan en cuanto se dan para no perder a quien abandona a medias ni a quien pierde la conexión. Esta spec cubre solo la parte pública. El panel /admin es la spec 002.

## Usuarios
- **Participante**: asistente a la presentación (o persona invitada después) que abre la encuesta desde el móvil escaneando un QR. Anónimo, sin cuenta.
- **Estudiantes del equipo** (indirectamente): sustituyen los países de prueba por los reales, borran las filas de prueba antes del evento y leen los datos (la lectura se hace en la spec 002).

## Historias de usuario
- HU-1. Como participante, quiero una intro animada que recree el plató del primer evento ("Leisure in Jeopardy"), me agradezca haber participado y me invite a dar mi opinión, para entender de qué va y animarme a empezar. *(Modificada 2026-10-16.)*
- HU-2. Como participante, quiero elegir mi país tocando su bandera en una cuadrícula corta, sin escribir ni buscar, para que mis respuestas cuenten en mi grupo cultural. *(Modificada 2026-10-16.)*
- HU-3. Como participante, quiero responder cada pregunta con un solo toque y escribir solo cuando haga falta o me apetezca, para opinar rápido.
- HU-4. Como participante, quiero ver cómo se enciende la ciudad con cada respuesta para saber cuánto me queda y tener ganas de terminar.
- HU-5. Como participante, quiero poder volver atrás (con el botón o con el gesto/botón atrás del móvil) para corregir una respuesta sin perder nada.
- HU-6. Como participante, quiero un final vistoso que me confirme que he terminado.
- HU-7. Como estudiante del equipo, quiero que cada respuesta quede guardada al momento, aunque el participante no termine o falle la red, para no perder datos.
- HU-8. Como estudiante del equipo, quiero cambiar los países (y en el futuro las preguntas) editando solo los datos de contenido, sin tocar la lógica ni la interfaz.

## Definiciones
- **Participante**: un navegador concreto en un dispositivo concreto. Se identifica con un ID aleatorio que se genera en ese navegador y se conserva en él.
- **Fila del participante**: el único registro en la base de datos de un participante (campos en RF-37).
- **Sitio de ocio**: cada uno de los 10 edificios o lugares dibujados en la ciudad nocturna. Cada uno tiene un identificador fijo y está asociado a una pregunta.
- **Vista cenital**: la ciudad dibujada como un mapa visto desde arriba, con calles y manzanas, en lugar de un perfil de edificios visto de frente.
- **Edificio de relleno**: edificio de la ciudad que no es un sitio de ocio ni está asociado a ninguna pregunta. Solo sirve de decorado.
- **Encendido / apagado**: estado visual de un sitio de ocio, un edificio de relleno o una calle con luces activas o sin ellas.
- **Encendido total**: paso de la ciudad a "ciudad entera encendida".
- **Ciudad entera encendida**: los 10 sitios de ocio, todos los edificios de relleno y las calles encendidos a la vez.
- **Plató de la intro**: el dibujo animado que recrea el primer evento, descrito en el Anexo B (cartel, tablero, cartel "On air", haces de luz y concursantes tras sus atriles). Es decorado: no contiene controles. *(Añadida 2026-10-16.)*
- **Casilla de país**: elemento cuadrado y pulsable del selector de país que muestra solo la bandera de un país (o el icono de globo de "Other"), sin nombre visible. *(Añadida 2026-10-16.)*
- **Estilo de la encuesta**: el aspecto de los textos y controles que acompañan al plató y a la ciudad (textos y botón de la intro, selector de país, preguntas, opciones, campos, botones y textos del final). No incluye el dibujo del plató ni el de la ciudad. *(Añadida 2026-10-16.)*
- **Datos de contenido**: la versión del contenido, la lista de países (código, nombre en inglés y bandera) y las 10 preguntas (identificador, enunciado, opciones y sitio de ocio asociado). Las preguntas son las reales (Anexo A); los países son de prueba.
- **Versión del contenido**: un texto que identifica unos datos de contenido concretos; cambia cada vez que cambian las preguntas o los países de forma que invalide respuestas anteriores.
- **Tipo de opción**:
  - *normal*: elegirla no abre ningún campo propio; se ofrece el campo opcional "Want to tell us why?".
  - *abierta obligatoria*: al elegirla aparece un campo de texto obligatorio.
  - *abierta opcional*: al elegirla aparece un campo de texto opcional.
- **Texto de la pregunta**: el único texto libre que se guarda por pregunta; procede del campo que esté visible para la opción elegida ("Want to tell us why?" o el campo propio de la opción abierta).
- **Pregunta respondida**: pregunta en la que el participante ha pulsado "Next" con una respuesta válida. Elegir una opción sin pulsar "Next" no la hace respondida.
- **Longitud de un texto**: número de puntos de código Unicode tras quitar los espacios en blanco del principio y del final. Es la misma medida en el navegador y en la base de datos.
- **Estado completo**: el contenido entero de la fila del participante tal como lo conoce el navegador en un momento dado (versión, país, las 10 respuestas con su texto y estado), junto con un contador de envío creciente.
- **Cola local**: el estado completo pendiente de confirmar, conservado en el dispositivo hasta que la base de datos lo acepta, lo ignora por antiguo o lo rechaza de forma definitiva.
- **Fallo pasajero**: sin conexión, tiempo de espera agotado (10 s) o error del servidor (5xx). **Rechazo definitivo**: cualquier otra respuesta de error de la base de datos (validación, ID no válido, país o versión distintos, fila ya terminada).
- **Operación de guardado**: la única vía de escritura del público en la base de datos; recibe el ID y el estado completo, y no devuelve datos de ninguna fila.
- **Admin**: usuario autenticado que figura en la lista cerrada de admins guardada en la base de datos (los 4 estudiantes).
- **Movimiento reducido**: la preferencia del sistema operativo del usuario de reducir las animaciones.
- **Entrada de la intro**: animación que se reproduce una sola vez al mostrarse la intro y hace aparecer de forma escalonada los elementos del plató, los textos y el botón. Después de ella solo queda el bucle de RF-8. *(Añadida 2026-10-17.)*
- **Transición de pantalla**: cambio animado entre dos pantallas de la encuesta (intro, selector, pregunta, final) o entre dos preguntas: un fundido de salida de lo que se va seguido de un fundido de entrada de lo que llega. *(Añadida 2026-10-17.)*
- **Mapa acotado**: la ciudad como un único mapa de tamaño fijo con un borde visible; fuera del borde no hay calles, manzanas ni edificios, solo fondo de noche liso. *(Añadida 2026-10-17.)*
- **Rótulo de sitio**: el nombre en inglés de un sitio de ocio escrito en el mapa justo debajo de su dibujo. *(Añadida 2026-10-17.)*
- **Llegada del final**: la animación de RF-53, que se reproduce una sola vez. **Estado final vivo**: lo que queda en pantalla después de la llegada (RF-54), con la ciudad animada en bucle (RF-114 a RF-117). *(Añadidas 2026-10-17.)*

## Requisitos funcionales

### Datos de contenido
- RF-1: EL SISTEMA obtiene la versión del contenido, los países y las 10 preguntas de un único origen de datos de contenido, separado de la lógica y de la interfaz.
- RF-2: EL SISTEMA incluye como preguntas las 10 del Anexo A, con sus textos literales, sus opciones, el tipo de cada opción y el sitio de ocio de cada una.
- RF-3: EL SISTEMA incluye, por ahora, exactamente 6 países de prueba, en este orden: Netherlands (NL), Germany (DE), Italy (IT), Poland (PL), Japan (JP) y Nigeria (NG), cada uno con su código ISO 3166-1 alfa-2, su nombre en inglés y su bandera. *(Modificado 2026-10-16: antes, entre 5 y 20 países. Se eligen 6 de los 10 anteriores cuyas banderas se distinguen entre sí sin nombre; se descartan Ireland, Côte d'Ivoire, France y Belgium por parecerse a Italy, Netherlands o Germany.)*
- RF-4: SI los datos de contenido incumplen alguna de estas reglas, ENTONCES un test automático falla e indica la regla incumplida: versión no vacía; exactamente 10 preguntas; identificadores de pregunta únicos; enunciados no vacíos; 2 o 3 opciones por pregunta con letras A, B (y C) en ese orden; etiquetas de opción no vacías; tipo de opción válido (normal, abierta obligatoria, abierta opcional); un sitio de ocio por pregunta, distinto en cada una y existente entre los 10 sitios de la ciudad; entre 6 y 11 países (con "Other", 12 casillas como máximo); códigos de país únicos y con formato ISO alfa-2; ningún país con el código reservado de "Other"; cada país con nombre y bandera. *(Modificado 2026-10-16: antes, entre 5 y 20 países.)*

### Intro
- RF-5: CUANDO un participante sin país elegido abre la encuesta, EL SISTEMA muestra la intro descrita en RF-80. *(Modificado 2026-10-16: antes, plató de 3 a 5 s con botón "Start".)*
- RF-6: EL SISTEMA no usa logos, sintonías ni música de programas de televisión reales.
- RF-7: EL SISTEMA muestra el botón "Give feedback" visible y pulsable desde el primer momento de la intro, también mientras dura la entrada de la intro (RF-100). *(Modificado 2026-10-16: antes, "Start". Modificado 2026-10-17: se precisa que también durante la entrada.)*
- RF-8: MIENTRAS se muestra la intro, ha terminado la entrada de la intro y el movimiento reducido no está activado, EL SISTEMA anima el plató en un bucle continuo, sin pausa ni fotograma final, con movimiento al menos en los haces de luz y en las luces del cartel. *(Modificado 2026-10-16: antes, la animación terminaba y se quedaba quieta en su último fotograma. Modificado 2026-10-17: el bucle sigue a la entrada de la intro.)*
- RF-9: CUANDO el participante pulsa "Give feedback", EL SISTEMA muestra el selector de país, en cualquier momento del bucle de la animación. *(Modificado 2026-10-16: antes, "Start".)*
- RF-80: EL SISTEMA muestra en la intro, de arriba abajo: el plató completo del Anexo B, el texto de RF-81, el texto de RF-82 y el botón "Give feedback". *(Añadido 2026-10-16.)*
- RF-81: EL SISTEMA muestra en la intro el texto literal "Thank you for being part of our first event! We hope you enjoyed it as much as we did". *(Añadido 2026-10-16.)*
- RF-82: EL SISTEMA muestra debajo del texto de RF-81 el texto literal "Do you want to help us with our new assignment?". *(Añadido 2026-10-16.)*
- RF-83: EL SISTEMA dibuja el plató con todos los elementos del Anexo B, en su misma disposición: riel con 4 focos, cartel "Leisure in" / "Jeopardy" con 4 bombillas, tablero, haces de luz, postes, cartel "On air", borde dorado del escenario y los 3 grupos de concursantes tras sus atriles. *(Añadido 2026-10-16.)*
- RF-84: EL SISTEMA muestra en el tablero del plató exactamente 5 columnas con las cabeceras "Well-being", "Community", "Economy", "Culture & identity" y "Access & inclusion", y 3 filas con los valores 100, 200 y 300, con las casillas Community-200 y Culture & identity-300 vacías (sin número, en color oscuro) y las 13 restantes con su valor. *(Añadido 2026-10-16.)*
- RF-85: EL SISTEMA muestra bajo el escenario 3 atriles, de izquierda a derecha "Group 1" con el marcador 300, "Group 2" con 500 y "Group 3" con 200, cada uno con un pulsador rojo y con 3 concursantes detrás. *(Añadido 2026-10-16.)*
- RF-86: EL SISTEMA no produce en la animación de la intro más de 3 destellos por segundo. *(Añadido 2026-10-16.)*
- RF-87: MIENTRAS el movimiento reducido esté activado, EL SISTEMA muestra el plató completo, los textos y el botón de la intro de forma estática y visibles desde el primer momento, sin entrada animada, sin bucle y sin movimiento. *(Añadido 2026-10-16. Modificado 2026-10-17: también sin entrada animada.)*
- RF-88: EL SISTEMA muestra el plató completo, los textos de RF-81 y RF-82 y el botón "Give feedback" sin scroll horizontal entre 320 y 430 px de ancho y sin scroll vertical en pantallas de al menos 568 px de alto, reduciendo el plató de forma proporcional si hace falta; en pantallas más bajas permite scroll vertical. *(Añadido 2026-10-16. Opción (a) confirmada por el usuario.)*
- RF-98: CUANDO se muestra la intro y el movimiento reducido no está activado, EL SISTEMA reproduce una sola vez la entrada de la intro, que hace aparecer los elementos escalonados en este orden: riel con los 4 focos y sus haces de luz; cartel "Leisure in" / "Jeopardy" con sus bombillas; tablero; postes y cartel "On air"; borde y suelo del escenario; concursantes y atriles de los 3 grupos; texto de RF-81; texto de RF-82; y por último el realce del botón "Give feedback" (RF-100). La entrada completa dura 2 s como máximo. *(Añadido 2026-10-17.)*
- RF-99: CUANDO un elemento del plató termina su entrada, EL SISTEMA continúa su animación de bucle de RF-8 desde la posición, el tamaño y la opacidad en que quedó, sin saltos visibles. *(Añadido 2026-10-17.)*
- RF-100: MIENTRAS dura la entrada de la intro, EL SISTEMA muestra el botón "Give feedback" con opacidad completa, en su posición final y pulsable; su parte de la entrada es un realce (brillo o pulso) de 600 ms como máximo al final de la secuencia, que no lo oculta ni lo mueve. *(Añadido 2026-10-17. Decisión del planner para conciliar la entrada con RF-7: ver "Dudas abiertas", punto 14.)*
- RF-101: SI el participante pulsa "Give feedback" antes de que termine la entrada de la intro, ENTONCES EL SISTEMA pasa al selector de país al momento (RF-9), sin esperar a que la entrada termine. *(Añadido 2026-10-17.)*
- RF-102: MIENTRAS dura la entrada de la intro, EL SISTEMA reserva el sitio final de cada elemento, de modo que ningún elemento desplaza a otro al aparecer, no aparece scroll horizontal y se cumple el encaje de RF-88. *(Añadido 2026-10-17.)*

### Selector de país
- RF-10: EL SISTEMA muestra los países como una cuadrícula de casillas de país cuadradas (mismo ancho que alto), en el orden de los datos de contenido, donde la bandera rellena toda la casilla, centrada y recortada por los lados si no es cuadrada, sin nombre visible. *(Modificado 2026-10-16: antes, lista con bandera y nombre en orden alfabético.)*
- RF-11: EL SISTEMA muestra la opción "Other" como última casilla de la cuadrícula, del mismo tamaño que las demás, con un icono de globo en lugar de bandera y sin texto visible. *(Modificado 2026-10-16: antes, al final de la lista con icono neutro, también durante la búsqueda.)*
- RF-12: Eliminado (cambio 2026-10-16). *(Era el filtrado por el texto del buscador.)*
- RF-13: Eliminado (cambio 2026-10-16). *(Era la búsqueda vacía que muestra todos los países.)*
- RF-14: Eliminado (cambio 2026-10-16). *(Era el mensaje "No countries found".)*
- RF-15: CUANDO el participante elige un país o "Other", EL SISTEMA guarda su código (o el código reservado de "Other") en la fila del participante y muestra la ciudad nocturna con los 10 sitios apagados y la pregunta 1.
- RF-16: EL SISTEMA no ofrece en la interfaz ninguna forma de cambiar el país una vez elegido.
- RF-89: EL SISTEMA da a cada casilla de país como nombre accesible el nombre en inglés del país, y a la de "Other" el nombre "Other". *(Añadido 2026-10-16.)*
- RF-90: EL SISTEMA no muestra en el selector de país ningún buscador, campo de texto ni lista con nombres. *(Añadido 2026-10-16.)*
- RF-91: EL SISTEMA muestra el título del selector y todas las casillas (hasta 12) sin scroll vertical a 375×667 px y a 320×568 px, con casillas de al menos 64×64 px. *(Añadido 2026-10-16.)*

### Preguntas
- RF-17: EL SISTEMA muestra cada pregunta en una sola pantalla con: "Question n of 10", el enunciado, sus 2 o 3 opciones etiquetadas A, B y C con el estilo de la encuesta (RF-92 a RF-97), el botón "Next" y, de la pregunta 2 en adelante, el botón "Back". *(Modificado 2026-10-16: se quitan las "casillas azules con la letra dorada".)*
- RF-18: MIENTRAS se muestra la pregunta 1, EL SISTEMA no muestra el botón "Back".
- RF-19: CUANDO el participante toca una opción, EL SISTEMA la marca como elegida y desmarca cualquier otra de esa pregunta (una sola respuesta por pregunta, también en Q3).
- RF-20: MIENTRAS la opción elegida sea de tipo normal, EL SISTEMA muestra el campo opcional "Want to tell us why?".
- RF-21: MIENTRAS la opción elegida sea abierta obligatoria, EL SISTEMA muestra su campo de texto propio, marcado como obligatorio, y no muestra "Want to tell us why?".
- RF-22: MIENTRAS la opción elegida sea abierta opcional, EL SISTEMA muestra su campo de texto propio, marcado como opcional, y no muestra "Want to tell us why?".
- RF-23: MIENTRAS no haya opción elegida, o la opción elegida sea abierta obligatoria y su texto tenga longitud 0, EL SISTEMA mantiene desactivado el botón "Next".
- RF-24: EL SISTEMA limita cualquier campo de texto a una longitud de 280 y muestra cuántos caracteres quedan.
- RF-25: SI el participante pega un texto de más de 280 caracteres, ENTONCES EL SISTEMA lo recorta a los primeros 280 y el contador muestra 0.
- RF-26: CUANDO el participante cambia de opción dentro de una pregunta, EL SISTEMA conserva el texto ya escrito y lo muestra en el campo que corresponda a la nueva opción.
- RF-27: CUANDO el participante pulsa "Next" con una respuesta válida, EL SISTEMA marca la pregunta como respondida, guarda el estado completo, enciende el sitio de ocio asociado y muestra la pregunta siguiente.
- RF-28: EL SISTEMA guarda un texto de longitud 0 como "sin texto" y los demás textos sin los espacios del principio y del final.
- RF-29: EL SISTEMA muestra encendidos exactamente los sitios de ocio de las preguntas respondidas y apagados los demás.
- RF-30: CUANDO el participante pulsa "Back" en la pregunta n (n > 1), EL SISTEMA muestra la pregunta n-1 con la opción y el texto que tenía.
- RF-31: CUANDO el participante sale de una pregunta con "Back" sin pulsar "Next", EL SISTEMA conserva en el dispositivo la opción y el texto en curso de esa pregunta y los vuelve a mostrar al regresar a ella, sin marcarla como respondida si no lo estaba.
- RF-32: CUANDO el participante cambia una respuesta ya dada y pulsa "Next", EL SISTEMA sustituye en la misma fila la opción y el texto anteriores de esa pregunta, y el sitio de ocio sigue encendido.
- RF-33: CUANDO el participante usa el gesto o botón atrás del navegador o del sistema en las preguntas 2 a 10, EL SISTEMA se comporta igual que el botón "Back".
- RF-34: CUANDO el participante usa el gesto o botón atrás del navegador o del sistema en la intro, el selector de país, la pregunta 1 o la pantalla final, EL SISTEMA no cambia a otra pantalla de la encuesta y conserva todo el progreso.
- RF-35: EL SISTEMA no muestra ninguna confirmación del tipo "Is that your final answer?".
- RF-36: CUANDO el participante pulsa "Next" en la pregunta 10 con una respuesta válida, EL SISTEMA marca la fila como terminada, guarda el estado completo y muestra la animación final.

### Estilo de la encuesta (cambio 2026-10-16)
El plató de la intro conserva la estética de concurso del Anexo B (recrea el primer evento). Lo que cambia es el estilo de los textos y controles que lo acompañan y del resto de pantallas, para que acompañen a la ciudad iluminada de noche y no parezcan un concurso de televisión. La concreción visual (colores exactos, tipografía, efectos) se fija en el plan.
- RF-92: EL SISTEMA aplica el estilo de la encuesta, igual en todas las pantallas, a los textos y el botón de la intro, al selector de país, a las preguntas con sus opciones, campos y botones, y a los textos del final.
- RF-93: EL SISTEMA no usa en el estilo de la encuesta casillas azules con letra dorada, formas hexagonales o con puntas, degradados metálicos (dorados o plateados), marcos dorados ni texto con contorno o sombra dorada.
- RF-94: EL SISTEMA toma los colores del estilo de la encuesta de la paleta de la ciudad nocturna: fondos y superficies en azules noche oscuros, un acento de luz cálida (como las ventanas encendidas) y, como máximo, un segundo acento de neón de los usados en la ciudad.
- RF-95: EL SISTEMA usa en el estilo de la encuesta una tipografía sin remates y escribe los títulos, enunciados, opciones y botones en mayúsculas y minúsculas normales, sin pasarlos enteros a mayúsculas.
- RF-96: MIENTRAS una opción está elegida, EL SISTEMA la muestra "encendida" con el acento de luz cálida (borde y halo de luz) y con una marca distinta del color, como un icono de selección.
- RF-97: EL SISTEMA muestra el botón "Give feedback" y los botones "Next" y "Back" con el estilo de la encuesta, distinto del dibujo del plató.

### Transiciones entre pantallas y preguntas (cambio 2026-10-17)
- RF-103: CUANDO la encuesta pasa de una pantalla a otra (intro → selector, selector → pregunta 1, pregunta 10 → final) o de una pregunta a otra (con "Next", "Back" o el atrás del sistema) y el movimiento reducido no está activado, EL SISTEMA hace una transición de pantalla solo de opacidad: fundido de salida de 150 ms como máximo y fundido de entrada de 250 ms como máximo (400 ms en total como máximo).
- RF-104: MIENTRAS se pasa de una pregunta a otra, EL SISTEMA aplica la transición solo a la parte de la pregunta (contador, enunciado, opciones, campos y botones) y mantiene la ciudad visible, sin fundirse ni moverse.
- RF-105: CUANDO el participante pulsa "Next" con una respuesta válida, EL SISTEMA guarda el estado completo y enciende el sitio de ocio asociado en ese mismo momento, antes de empezar el fundido de salida (RF-27, RF-36).
- RF-106: MIENTRAS dura una transición de pantalla, EL SISTEMA ignora las pulsaciones en opciones, campos de texto, casillas de país y botones ("Give feedback", "Next", "Back") y el gesto o botón atrás del sistema, sin perder progreso, de modo que cada acción produce como máximo un cambio de pantalla o de pregunta.
- RF-107: CUANDO la encuesta se abre o se recarga, EL SISTEMA muestra la primera pantalla sin transición de pantalla: la intro con su entrada (RF-98), y la pregunta de la reanudación o el estado final vivo directamente (RF-51, RF-56).
- RF-108: MIENTRAS el movimiento reducido esté activado, EL SISTEMA hace las transiciones de pantalla con un único fundido de opacidad de 200 ms como máximo o con un cambio directo, cumpliendo también RF-104 a RF-106.

### Datos guardados (requieren aprobación del usuario al aprobar esta spec)
- RF-37: EL SISTEMA guarda por participante solo: ID, versión del contenido, código de país (o el reservado de "Other"), para cada pregunta de 1 a 10 la letra de la opción elegida (A, B o C) y su texto, el estado (en curso / terminada), el último contador de envío aceptado y las fechas de creación y última actualización.
- RF-38: EL SISTEMA no guarda en la tabla de respuestas ningún dato personal (nombre, correo, IP, ubicación ni identificador del dispositivo).
- RF-39: EL SISTEMA pone las fechas de creación y última actualización con el reloj del servidor, nunca con el del navegador.
- RF-40: EL SISTEMA no guarda en la base de datos los enunciados ni las etiquetas de las preguntas; solo viven en los datos de contenido.

### Guardado progresivo
- RF-41: CUANDO un participante abre la encuesta por primera vez en un navegador, EL SISTEMA genera un ID con un generador criptográfico, de al menos 122 bits aleatorios y formato UUID v4, y lo conserva en ese navegador.
- RF-42: EL SISTEMA guarda todos los datos de un participante en una sola fila identificada por su ID: la crea con el primer guardado (al elegir país) y la actualiza en cada guardado posterior.
- RF-43: EL SISTEMA envía en cada guardado el estado completo de la fila, país incluido, con un contador de envío mayor que el de cualquier envío anterior de ese participante.
- RF-44: SI un guardado sufre un fallo pasajero, ENTONCES EL SISTEMA conserva el estado completo en la cola local y deja seguir al participante sin bloquearlo.
- RF-45: MIENTRAS la cola local tenga un estado pendiente, EL SISTEMA reintenta enviarlo con esperas que empiezan en 1 s, se duplican en cada fallo pasajero y no pasan de 30 s; además lo reintenta al volver la conexión y cada vez que se abre la encuesta en ese navegador.
- RF-46: CUANDO se genera un estado completo nuevo y hay otro pendiente en la cola local, EL SISTEMA sustituye el pendiente por el nuevo.
- RF-47: CUANDO la base de datos acepta un envío o lo ignora por antiguo, EL SISTEMA lo da por confirmado y lo quita de la cola local.
- RF-48: SI la base de datos rechaza un envío de forma definitiva, ENTONCES EL SISTEMA lo quita de la cola local sin reintentarlo, escribe un aviso en la consola y sigue enviando los estados posteriores.
- RF-49: MIENTRAS haya un estado pendiente en la cola local tras un fallo pasajero, EL SISTEMA muestra un aviso discreto y no bloqueante "Saved offline – will sync" que no tapa las opciones ni los botones.
- RF-50: CUANDO la cola local queda vacía, EL SISTEMA oculta el aviso "Saved offline – will sync".
- RF-51: CUANDO un participante sin terminar recarga o vuelve a abrir la encuesta en el mismo navegador con la misma versión del contenido, EL SISTEMA recupera su progreso desde el dispositivo y continúa en la primera pregunta sin responder, con los sitios ya respondidos encendidos y sin intro.
- RF-52: SI el navegador guarda progreso o un estado terminado de una versión del contenido distinta de la actual, ENTONCES EL SISTEMA lo descarta, genera un ID nuevo y empieza desde la intro (fila nueva).

### Ciudad nocturna en vista cenital (cambio 2026-10-16)
- RF-69: EL SISTEMA dibuja la ciudad nocturna en vista cenital como planta 2D tipo mapa vista desde arriba, con calles y manzanas, sin perspectiva (ni fachadas ni puntos de fuga) y sin cielo, luna ni estrellas, con el volumen sugerido solo por tejados y sombras (RF-109). *(Modificado 2026-10-17: antes, "planta 2D pura, sin volumen". La concreción visual se fija en el plan.)*
- RF-70: EL SISTEMA muestra en la ciudad, además de los 10 sitios de ocio, un número fijo de edificios de relleno entre 15 y 25.
- RF-71: EL SISTEMA dibuja cada sitio de ocio con una forma o icono visto desde arriba que lo distingue de los otros 9 sitios y de los edificios de relleno, y muestra su rótulo de sitio solo mientras está encendido (RF-112, RF-113). *(Modificado 2026-10-17: antes, "sin etiqueta de texto visible".)*
- RF-72: MIENTRAS no estén encendidos los 10 sitios de ocio, EL SISTEMA mantiene apagados todos los edificios de relleno y las calles.
- RF-73: CUANDO quedan encendidos los 10 sitios de ocio, EL SISTEMA realiza el encendido total como primer paso de la animación final: la ola de luz de RF-53 recorre la ciudad y enciende a su paso los edificios de relleno y las calles.
- RF-74: EL SISTEMA completa el encendido total y toda la animación final de RF-53 en 8 s como máximo en conjunto, contados desde que el participante pulsa "Next" en la pregunta 10, con la transición de pantalla de RF-103 incluida en ese tiempo. *(Modificado 2026-10-17: se incluye la transición.)*
- RF-75: EL SISTEMA da a la ciudad una alternativa textual para lectores de pantalla que indica cuántos de los 10 sitios de ocio están encendidos y el nombre en inglés de cada sitio encendido; los edificios de relleno y las calles no se anuncian.
- RF-76: EL SISTEMA muestra la ciudad entera, sin desplazamiento ni zoom, entre 320 y 430 px de ancho, sin scroll horizontal y sin tapar el enunciado, las opciones, los campos de texto ni los botones de la pregunta.
- RF-78: MIENTRAS se muestra una pregunta, EL SISTEMA limita el alto de la ciudad al 40 % del alto de la pantalla como máximo, medido a 375×667 px.
- RF-79: MIENTRAS se muestra la pantalla final, EL SISTEMA muestra el mapa acotado entero, sin zoom ni recorte, centrado en horizontal, al menos tan grande como durante las preguntas y tan grande como quepa con un margen mínimo de 8 px hasta los bordes de la pantalla y sin solaparse en el estado final con las banderas ni con los textos, y rellena el resto de la pantalla con fondo de noche liso, sin calles, manzanas ni edificios alrededor. *(Modificado 2026-10-17: antes, "a pantalla completa", con calles y manzanas rodeando el mapa.)*
- RF-77: MIENTRAS el movimiento reducido esté activado, EL SISTEMA muestra el encendido de cada sitio de ocio, la aparición de su rótulo y el encendido total solo con fundidos de opacidad de 200 ms como máximo, sin desplazamientos ni olas de luz (ver RNF-2). *(Modificado 2026-10-17: se añade el rótulo.)*
- RF-109: EL SISTEMA dibuja los tejados de los edificios de relleno y de los sitios de ocio con al menos dos tonos que sugieran volumen (faldones, cornisas o relieve) y una sombra suave proyectada sobre el suelo, con la misma dirección de sombra en toda la ciudad. *(Añadido 2026-10-17.)*
- RF-110: EL SISTEMA incluye en la ciudad, además de calles, manzanas, edificios y sitios de ocio: al menos 12 árboles, al menos 2 zonas verdes distintas del sitio Park y al menos una masa de agua (río, canal o estanque), sin que se superpongan a edificios, sitios ni calles salvo en puentes. *(Añadido 2026-10-17.)*
- RF-111: EL SISTEMA dibuja la ciudad como un mapa acotado con un borde visible, igual en las preguntas y en el final, y no dibuja nada de la ciudad (calles, manzanas, edificios, coches) fuera de ese borde. *(Añadido 2026-10-17.)*
- RF-112: CUANDO un sitio de ocio se enciende, EL SISTEMA muestra su rótulo de sitio, con el mismo nombre en inglés de RF-75, justo debajo de su dibujo, con un fundido de entrada de 400 ms como máximo, y lo deja visible mientras el sitio siga encendido, también en el final y al reanudar (en la reanudación aparece sin fundido). *(Añadido 2026-10-17.)*
- RF-113: EL SISTEMA dibuja los rótulos de sitio en una o dos líneas, con letra de al menos 8 px de alto a 320 px de ancho y contraste de al menos 4.5:1 con lo que tienen detrás, dentro del borde del mapa y sin solaparse entre sí ni con el dibujo de otro sitio de ocio, entre 320 y 430 px de ancho y con los 10 encendidos. *(Añadido 2026-10-17.)*

### Final
- RF-53: CUANDO empieza la animación final, EL SISTEMA muestra en este orden, en 8 s como máximo: una ola de luz que recorre la ciudad y la deja entera encendida (RF-73), coches circulando por las calles de la vista cenital y confeti; después las banderas de los países de los datos de contenido (sin "Other") giran, se juntan con un destello y aparecen los textos "Leisure for Society" y "Thank you". *(Modificado 2026-10-16: la ola de luz realiza el encendido total; coches por las calles del mapa; "Society of Leisure" pasa a "Leisure for Society".)*
- RF-54: CUANDO termina la llegada del final, EL SISTEMA deja en pantalla el estado final vivo: la ciudad entera encendida (10 sitios de ocio con sus rótulos, edificios de relleno y calles) con los bucles de RF-114 a RF-117, y las banderas juntas y los textos "Leisure for Society" y "Thank you" quietos. *(Modificado 2026-10-16: se precisa qué es "la ciudad entera"; "Society of Leisure" pasa a "Leisure for Society". Modificado 2026-10-17: el "estado último fijo" pasa a ser el estado final vivo, con la ciudad animada en bucle.)*
- RF-55: EL SISTEMA no muestra en la pantalla final ninguna foto del equipo ni botón para volver a responder.
- RF-56: CUANDO un participante cuyo navegador consta como terminado, con la versión del contenido actual, vuelve a abrir la encuesta, EL SISTEMA muestra directamente el estado final vivo (RF-54), sin intro, sin preguntas y sin repetir la llegada del final. *(Modificado 2026-10-17: antes, "el estado último".)*
- RF-114: MIENTRAS se muestra el estado final vivo y el movimiento reducido no está activado, EL SISTEMA hace circular sin parar al menos 3 coches por las calles del mapa, siempre sobre las calles, sin atravesar edificios, sitios, árboles ni agua (salvo por puentes) y sin salir del borde del mapa; los coches de la llegada (RF-53) siguen circulando sin detenerse. *(Añadido 2026-10-17.)*
- RF-115: MIENTRAS se muestra el estado final vivo y el movimiento reducido no está activado, EL SISTEMA hace variar en bucle suave el brillo de parte de las ventanas y de las farolas, con cada subida o bajada de brillo de 1 s como mínimo y sin que ninguna llegue a apagarse del todo. *(Añadido 2026-10-17.)*
- RF-116: MIENTRAS se muestra el estado final vivo y el movimiento reducido no está activado, EL SISTEMA anima en bucle al menos el agua (reflejos u ondas en movimiento) y las luces de al menos 3 sitios de ocio (p. ej. focos del estadio, noria de la feria, luces de la discoteca). *(Añadido 2026-10-17.)*
- RF-117: MIENTRAS se muestra el estado final vivo, EL SISTEMA mantiene los bucles de RF-114 a RF-116 sin pausa ni fotograma final, sin más de 3 destellos por segundo y sin mover ni tapar las banderas, los textos ni los rótulos de sitio. *(Añadido 2026-10-17.)*
- RF-118: MIENTRAS el movimiento reducido esté activado, EL SISTEMA muestra el estado final vivo de forma estática: ciudad entera encendida con sus rótulos, coches quietos, banderas juntas y textos, sin bucles (RNF-2). *(Añadido 2026-10-17.)*

### Operación de guardado y permisos (requieren aprobación del usuario al aprobar esta spec)
- RF-57: EL SISTEMA mantiene siempre activa la seguridad a nivel de fila en la tabla de respuestas.
- RF-58: EL SISTEMA no concede al público (sin sesión de admin) ningún permiso directo de lectura, inserción, actualización ni borrado sobre la tabla de respuestas.
- RF-59: EL SISTEMA permite al público escribir solo mediante la operación de guardado, que crea o actualiza únicamente la fila del ID recibido; el ID actúa como secreto del participante.
- RF-60: EL SISTEMA no devuelve al público, a través de la operación de guardado, ningún dato de ninguna fila (tampoco de la propia).
- RF-61: SI la operación de guardado recibe un ID que no tiene formato UUID v4, ENTONCES EL SISTEMA lo rechaza sin crear ni modificar filas.
- RF-62: SI la operación de guardado recibe datos con forma no válida (número de pregunta fuera de 1-10, letra distinta de A, B o C, texto de longitud mayor que 280, país vacío o con formato distinto de ISO alfa-2 o el código reservado de "Other", versión vacía, estado desconocido o contador no positivo), ENTONCES EL SISTEMA lo rechaza sin guardar nada.
- RF-63: SI la operación de guardado recibe un contador menor o igual que el guardado en la fila, ENTONCES EL SISTEMA ignora el envío sin modificar la fila y sin devolver error.
- RF-64: SI la operación de guardado recibe, para una fila existente, un país o una versión distintos de los guardados, ENTONCES EL SISTEMA lo rechaza sin modificar la fila.
- RF-65: SI la operación de guardado recibe un envío para una fila ya terminada, ENTONCES EL SISTEMA lo ignora (contador antiguo) o lo rechaza (contador nuevo) sin modificar la fila, de modo que una fila terminada nunca vuelve a "en curso" ni cambia.
- RF-66: EL SISTEMA permite leer la tabla de respuestas únicamente a los admins (usuarios autenticados que figuran en la lista cerrada de admins).
- RF-67: EL SISTEMA mantiene desactivado el registro público de usuarios.
- RF-68: EL SISTEMA solo usa en el navegador la clave pública (anon) de la base de datos y nunca la clave de servicio (service_role).

### Riesgos asumidos (aprobados por el usuario)
- Quien conozca el ID de un participante podría sobrescribir su fila mientras no esté terminada. Se mitiga porque el ID es largo y aleatorio (RF-41) y no se muestra en la interfaz ni se puede leer con la clave pública (RF-58, RF-60).
- Cualquiera con la clave pública podría crear muchas filas falsas con IDs válidos a través de la operación de guardado. Se acepta para este evento; los admins pueden revisarlas o borrarlas a mano.

## Requisitos no funcionales
- RNF-1 Plataforma: diseño mobile-first de referencia a 375 px en vertical. Todo el flujo se puede usar entre 320 px y 430 px de ancho sin scroll horizontal, con zonas táctiles de al menos 44×44 px. En horizontal y en escritorio funciona (contenido centrado, con scroll vertical si hace falta), aunque no esté optimizado.
- RNF-2 Movimiento reducido: con movimiento reducido activado, no hay desplazamientos, giros, bucles ni confeti. La intro muestra el plató completo estático y sin entrada animada (RF-87); el encendido de los sitios, la aparición de sus rótulos, el encendido total de la ciudad y las transiciones de pantalla y de pregunta usan solo fundidos de opacidad de 200 ms como máximo o un cambio directo (RF-77, RF-108); y la pantalla final se muestra directamente en el estado final vivo pero estático, sin bucles (RF-118). El flujo y los textos son los mismos. *(Modificado 2026-10-16: se añade el encendido total; la intro pasa a ser estática en lugar de "último fotograma". Modificado 2026-10-17: se añaden la entrada de la intro, las transiciones, los rótulos y los bucles del final.)*
- RNF-3 Idioma: todos los textos de la interfaz en inglés.
- RNF-4 Accesibilidad:
  - Las opciones, los campos de texto, las casillas de país y los botones se pueden usar con teclado y lector de pantalla, con etiquetas accesibles, y el lector anuncia la opción elegida.
  - Al cambiar de pantalla o de pregunta, el foco pasa al título de la nueva pantalla en cuanto empieza su fundido de entrada (RF-103). *(Modificado 2026-10-17.)*
  - El aviso "Saved offline – will sync" se anuncia de forma no intrusiva.
  - Cada casilla de país se anuncia con el nombre del país o "Other" (RF-89); las banderas del final llevan como texto alternativo el nombre del país. *(Modificado 2026-10-16.)*
  - La ciudad tiene la alternativa textual de RF-75; los elementos puramente decorativos (edificios de relleno, calles, coches, confeti) quedan ocultos al lector de pantalla. *(Añadido 2026-10-16.)*
  - Los rótulos de sitio no se anuncian por separado: sus nombres ya están en la alternativa textual de RF-75, así que el lector no los lee dos veces. Los árboles, zonas verdes, agua y bucles del final son decorativos y quedan ocultos al lector. *(Añadido 2026-10-17.)*
  - El plató de la intro es decorativo: el lector de pantalla anuncia el título "Leisure in Jeopardy", los textos de RF-81 y RF-82 y el botón "Give feedback", y no lee las casillas del tablero, los marcadores ni el cartel "On air". *(Añadido 2026-10-16.)*
  - Contraste mínimo de 4.5:1 para el texto y de 3:1 para los bordes de las opciones, las casillas de país y los controles.
- RNF-5 Rendimiento: el botón "Give feedback" se puede pulsar en menos de 3 s con el perfil "Fast 4G" de Chrome DevTools, la caché desactivada y la vista de 375 px. La única dependencia externa es el cliente oficial de la base de datos (aprobado), cargado con una versión fija. *(Modificado 2026-10-16: antes, "Start".)*
- RNF-6 Banderas: las banderas son imágenes vectoriales servidas por el propio sitio, sin servicios externos de imágenes.
- RNF-7 Calidad: la lógica (validación de los datos de contenido, lista de casillas de país con "Other" al final, navegación Back/Next y atrás del sistema, reglas de "Next" y de los campos de texto, longitud y recorte de textos, sitios encendidos, cuándo corresponde el encendido total de la ciudad, estado completo y contador, cola local, clasificación de fallos y esperas, versión del contenido y reanudación, sitios con rótulo visible, orden y duración máxima de la entrada de la intro, duraciones de las transiciones, bloqueo de acciones durante una transición y línea de tiempo de la llegada del final dentro de 8 s con la transición incluida) tiene tests automáticos con el comando de tests del proyecto, en verde. *(Modificado 2026-10-16: se quita el filtrado y orden alfabético de países. Modificado 2026-10-17: se añaden rótulos, entrada, transiciones y bloqueo.)*
- RNF-8 Arranque local: el proyecto se puede servir en local con un único comando documentado, sin instalar dependencias nuevas. La estructura de carpetas y el comando concreto se fijan en el plan de esta spec y se trasladan a AGENTS.md.
- RNF-9 Consola: el flujo completo no deja errores en la consola del navegador. Se excluyen los errores de red que el navegador escribe por su cuenta cuando no hay conexión o falla una petición, y los avisos intencionados de RF-48.
- RNF-10 Contenido sustituible: cambiar los países o las preguntas solo exige editar los datos de contenido (y subir la versión), y los tests de RF-4 confirman que el formato es válido.
- RNF-11 Mantenimiento: hay un paso manual documentado para borrar las filas de prueba de la base de datos antes del evento.
- RNF-12 Fluidez de las animaciones: con la entrada de la intro, los bucles de la intro y del final y las transiciones en marcha, la grabación de rendimiento de Chrome DevTools a 375 px, sin limitación de CPU, no muestra tareas del hilo principal de más de 50 ms mientras se repiten los bucles, y los bucles no añaden dependencias externas. *(Añadido 2026-10-17.)*

## Casos límite
- **Sin conexión desde el principio**: se puede completar toda la encuesta; el último estado completo queda en la cola local, se ve el aviso offline y se envía cuando vuelve la red (en esa sesión o en una visita posterior).
- **Red intermitente, envíos desordenados o repetidos**: la base de datos ignora los envíos con contador menor o igual (RF-63), así que la fila acaba con el último estado y nunca falta el país, porque va en cada envío (RF-43).
- **Termina sin conexión**: se muestra igualmente la pantalla final y el estado "terminada" se envía cuando vuelva la red.
- **Rechazo definitivo de un envío** (p. ej. un texto alterado de más de 280): se descarta, se avisa en consola y el siguiente estado se envía con normalidad (RF-48).
- **Cierra el navegador con cambios pendientes**: se reintentan al volver a abrir la encuesta en ese navegador. Si nunca vuelve, esos cambios se pierden (limitación aceptada).
- **Almacenamiento local no disponible** (modo privado restrictivo o bloqueado): la encuesta funciona igual con un ID solo para esa sesión; no se garantiza reanudar ni evitar duplicados.
- **Borra los datos del navegador, u otro navegador o dispositivo**: cuenta como participante nuevo (no se puede evitar sin pedir datos personales; limitación aceptada).
- **Dos pestañas a la vez**: comparten ID y fila; gana el envío con mayor contador; nunca se crea una segunda fila. Si una pestaña ya terminó, la otra no puede reabrir la fila (RF-65).
- **Filas a medias**: las de quien abandona se quedan "en curso" y se conservan.
- **Recarga en el selector de país, antes de elegir**: se vuelve a mostrar la intro (aún no hay país guardado).
- **Pregunta 1**: no tiene "Back" y el atrás del sistema no cambia de pantalla; el país no se puede cambiar, ni desde la interfaz ni en la base de datos (RF-16, RF-64).
- **Opción abierta obligatoria con solo espacios**: longitud 0, así que "Next" sigue desactivado.
- **Cambio de opción abierta a normal con texto escrito**: el texto se conserva y pasa al campo "Want to tell us why?" (RF-26).
- **Textos con emojis, saltos de línea o HTML**: los emojis cuentan por puntos de código; todo se guarda como texto plano y nunca se interpreta como HTML.
- **ID manipulado o inventado**: si no tiene formato UUID v4 se rechaza (RF-61); si es un UUID v4 válido de nadie, crea una fila nueva (riesgo asumido).
- **Cambio de países (nueva versión del contenido) con participantes a medias o terminados**: su navegador empieza de cero con una fila nueva (RF-52); las filas antiguas conservan su versión. El paso de 10 a 6 países de prueba (RF-3) es uno de estos cambios.
- **Base de datos en pausa** (plan gratuito tras ~7 días sin uso): se comporta como un fallo pasajero (cola local, reintentos y aviso); hay que reactivarla antes de la presentación.
- **Base de datos aún sin crear o sin configurar**: la encuesta funciona con la cola local y no muestra errores bloqueantes.
- **Ciudad: cambio de una respuesta ya dada** (cambio 2026-10-16): el sitio sigue encendido (RF-32) y los edificios de relleno y las calles siguen apagados mientras falte algún sitio (RF-72).
- **Ciudad: reanudación a medias**: se ven encendidos solo los sitios de las preguntas respondidas; relleno y calles apagados (RF-51, RF-72).
- **Ciudad: reapertura con la fila terminada**: se ve directamente el estado final vivo, con la ciudad entera encendida, sus rótulos y los bucles, sin repetir el encendido total ni la llegada del final (RF-54, RF-56). *(Modificado 2026-10-17.)*
- **Ciudad: 9 sitios encendidos al volver con "Back" a una pregunta anterior**: no hay encendido total; solo llega con los 10 (la pregunta 10 respondida termina la encuesta, RF-36).
- **Ciudad a 320 px**: sin scroll horizontal, con los 10 sitios distinguibles entre sí y, con los 10 encendidos, sus 10 rótulos legibles y sin solaparse (RF-71, RF-76, RF-113). *(Modificado 2026-10-17.)*
- **Movimiento reducido en el final**: la ciudad entera encendida aparece directamente en el estado final vivo, estático y sin bucles (RNF-2, RF-77, RF-118). *(Modificado 2026-10-17.)*
- **Doble toque en "Next"** (cambio 2026-10-17): el primer toque guarda, enciende el sitio y empieza la transición; el segundo cae durante la transición y se ignora, así que no se salta ninguna pregunta ni se guarda dos veces (RF-105, RF-106).
- **Toque en "Back" o atrás del sistema justo después de "Next"**: si llega durante la transición se ignora; la respuesta ya está guardada y el participante puede volver con "Back" cuando aparezca la nueva pregunta (RF-106).
- **Toque en una opción de la pregunta que se está yendo**: se ignora; no cambia la respuesta ya guardada (RF-106).
- **Sin conexión durante una transición**: no afecta; el guardado se lanzó antes del fundido y sigue las reglas de la cola local (RF-44, RF-105).
- **"Give feedback" durante la entrada de la intro**: se pasa al selector al momento, con su transición; el resto de la entrada no se reproduce (RF-101, RF-103).
- **Intro en pestaña en segundo plano durante la entrada**: la entrada puede quedar en pausa; al volver termina y sigue el bucle, y el botón ha sido pulsable todo el tiempo (RF-7, RF-99).
- **Reanudación a mitad de encuesta**: la pregunta aparece sin transición y los rótulos de los sitios ya encendidos aparecen sin fundido (RF-107, RF-112).
- **Cambio de una respuesta ya dada**: el sitio y su rótulo siguen visibles; el rótulo no vuelve a aparecer con fundido (RF-32, RF-112).
- **Pregunta 10 → final**: el fundido de salida de la pregunta cuenta dentro de los 8 s de la llegada del final (RF-74).
- **Final en pestaña en segundo plano**: los bucles pueden pausarse mientras no se ven; al volver siguen animándose sin saltar al principio de la llegada.
- **Final en pantalla baja o en horizontal**: el mapa se reduce de forma proporcional para no solaparse con las banderas ni con los textos, sin recortarse (RF-79); en horizontal funciona aunque no esté optimizado (RNF-1).
- **Coches cerca del borde del mapa**: nunca se dibujan fuera del borde; si una calle llega al borde, el coche se oculta o da la vuelta dentro del mapa (RF-111, RF-114).
- **Intro: pulsar "Give feedback" en mitad del bucle** (cambio 2026-10-16): se pasa al selector al momento, sin esperar a que acabe ninguna vuelta (RF-7, RF-9).
- **Intro con movimiento reducido**: plató completo estático, mismos textos y mismo botón (RF-87).
- **Intro en pantalla de menos de 568 px de alto**: se permite scroll vertical; el botón sigue accesible (RF-88).
- **Intro en pestaña en segundo plano**: el bucle puede pausarse mientras no se ve; al volver sigue animándose.
- **Bandera no cuadrada**: rellena la casilla centrada y se recorta por los lados; la casilla sigue siendo cuadrada (RF-10).
- **Banderas parecidas en la lista real de países**: como no hay nombre visible, dos banderas muy parecidas (p. ej. Italy, Ireland y Côte d'Ivoire) pueden confundirse; los estudiantes deben tenerlo en cuenta al elegir la lista real (limitación aceptada por la decisión de no mostrar nombres).
- **Toque accidental en una casilla de país**: se elige ese país y no se puede cambiar (RF-15, RF-16); igual que con la lista anterior.

## Fuera de alcance
- Panel /admin, login de estudiantes, estadísticas y exportación a CSV (spec 002). En esta spec solo se comprueba que el público no puede leer ni escribir directamente la tabla; el login de admin se prueba en la 002.
- Lista de países real (se sustituirá en los datos de contenido cuando llegue, subiendo la versión).
- Buscador de países y nombres visibles en el selector (eliminados en el cambio 2026-10-16).
- Varios idiomas en la interfaz.
- Sonido o música.
- Evitar duplicados entre navegadores o dispositivos distintos del mismo participante.
- Editar respuestas después de terminar.
- Protección contra el abuso masivo de la operación de guardado (riesgo asumido).
- Generar el QR (se hace aparte con la URL pública).
- SEO: la constitución no lo exige y la encuesta se comparte por QR.
- Ciudad en perspectiva, isométrica o 3D, y mapa infinito o con calles fuera del borde (cambio 2026-10-17: el usuario quiere el mapa acotado).
- Desplazar, hacer zoom o explorar el mapa con el dedo.
- Animaciones de transición con desplazamientos o giros entre preguntas (solo fundidos).

## Criterios de finalización
- Todos los RF de lógica tienen un test con el comando de tests del proyecto en verde, y los de interfaz están comprobados en el navegador.
- Demo en Chrome DevTools a 375 px y a 320 px: intro → país → 10 preguntas (con un Back, un atrás del sistema, un cambio de respuesta, una opción abierta obligatoria y una abierta opcional) → final, sin errores en consola (RNF-9), también con movimiento reducido.
- Prueba sin conexión: responder varias preguntas offline, ver el aviso, recuperar la red y comprobar en la base de datos que hay una sola fila con el estado final, el país y el último contador.
- Comprobación de la base de datos con la clave anon:
  - el acceso directo a la tabla (leer, insertar, actualizar, borrar) se rechaza (RF-58);
  - la operación de guardado crea y actualiza la fila de su ID y no devuelve datos (RF-59, RF-60);
  - rechaza IDs no válidos, datos con forma no válida, cambios de país o versión y cambios en filas terminadas (RF-61, RF-62, RF-64, RF-65);
  - ignora los contadores antiguos (RF-63).
- Comprobado que el registro público está desactivado y que la lista de admins existe (RF-66, RF-67). La lectura por un admin autenticado se prueba en la spec 002.
- Al recargar tras terminar se muestra directamente el estado último de la pantalla final; al recargar a mitad se reanuda.
- Cambio 2026-10-16 (ciudad cenital): comprobado en Chrome DevTools a 375 px y a 320 px que la ciudad se ve desde arriba con calles, manzanas y edificios de relleno; que cada respuesta enciende solo su sitio; que relleno y calles siguen apagados hasta los 10; que el encendido total y la animación final caben en 8 s; que con movimiento reducido solo hay fundidos; y que el lector de pantalla anuncia los sitios encendidos; que en las preguntas la ciudad no pasa del 40 % del alto a 375×667 px y en el final ~~ocupa la pantalla completa~~ cumple RF-79 en su versión del cambio 2026-10-17 (RF-69 a RF-79). Tests en verde de la lógica del encendido total.
- Cambio 2026-10-16 (intro, banderas, textos y estilo): comprobado en Chrome DevTools a 375×667 px y a 320×568 px que:
  - la intro reproduce el Anexo B completo (tablero con sus cabeceras, valores y 2 casillas vacías; "On air"; 3 atriles con 300/500/200), con los dos textos literales y el botón "Give feedback" en ese orden, se anima en bucle sin parar y cumple el encaje de RF-88 (RF-80 a RF-88);
  - con movimiento reducido el plató está estático (RF-87);
  - el selector muestra 7 casillas cuadradas (6 banderas + globo "Other"), sin buscador ni nombres visibles, sin scroll vertical, y el lector anuncia el nombre de cada país (RF-10, RF-11, RF-89 a RF-91);
  - el final dice "Leisure for Society" y "Thank you" (RF-53, RF-54);
  - revisión visual de RF-92 a RF-97 punto por punto (sin casillas azules con letra dorada, sin formas con puntas ni degradados metálicos ni marcos dorados, paleta de la ciudad, sin texto entero en mayúsculas, opción elegida "encendida" con marca además del color) y contraste de RNF-4.
  - Tests en verde de RF-4 con los nuevos límites (6 a 11 países) y de la lista de casillas con "Other" al final.
- Cambio 2026-10-17 (animaciones y ciudad): comprobado en Chrome DevTools a 375×667 px y a 320×568 px que:
  - la intro hace la entrada escalonada en el orden de RF-98 en 2 s como máximo, sin saltos al pasar al bucle, sin scroll horizontal y con "Give feedback" visible y pulsable desde el primer momento (pulsarlo a mitad de la entrada lleva al selector) (RF-7, RF-8, RF-98 a RF-102);
  - cada cambio de pantalla y de pregunta hace fundido de salida y de entrada dentro de los límites de RF-103, la ciudad no se funde entre preguntas, y un doble toque en "Next" avanza una sola pregunta y guarda una sola vez (RF-103 a RF-107);
  - la ciudad tiene tejados con dos tonos y sombra en la misma dirección, al menos 12 árboles, 2 zonas verdes además de Park y agua, y un borde visible sin nada fuera (RF-69, RF-109 a RF-111);
  - cada sitio muestra su rótulo al encenderse, y con los 10 encendidos los rótulos no se solapan, miden al menos 8 px a 320 px y tienen contraste 4.5:1 (RF-71, RF-112, RF-113);
  - en el final el mapa acotado entero se ve centrado, al menos tan grande como en las preguntas, con fondo liso alrededor y sin solaparse con banderas ni textos; tras la llegada (≤ 8 s desde "Next", con la transición) los coches, ventanas, farolas, agua y luces de al menos 3 sitios siguen en bucle sin parar, sin más de 3 destellos/s, también al recargar (RF-54, RF-56, RF-74, RF-79, RF-114 a RF-117);
  - con movimiento reducido: intro sin entrada ni bucle, transiciones de 200 ms como máximo o directas, rótulos con fundido de 200 ms como máximo y final estático (RF-77, RF-87, RF-108, RF-118, RNF-2);
  - el lector de pantalla no lee los rótulos dos veces (RNF-4) y la grabación de rendimiento cumple RNF-12.
  - Tests en verde de la lógica nueva de RNF-7.
- Paso manual para borrar las filas de prueba documentado (RNF-11).
- MEMORY.md actualizado, y AGENTS.md actualizado con la estructura de carpetas, el comando de arranque y el modelo de seguridad real. Ahora AGENTS.md dice que el público "inserta/actualiza su fila" directamente; debe decir que escribe solo mediante la operación de guardado, con el ID como secreto.

## Decisiones aprobadas
Valores tomados para cerrar los puntos de la revisión QA, aprobados por el usuario junto con la spec.
1. Etiqueta de las opciones abiertas obligatorias Q2-A y Q5-A: "Tell us…" (ver Anexo A).
2. Las etiquetas "[open question]" y "[open answer]" del texto original no se muestran: son marcas de tipo de opción.
3. "Respondida" significa haber pulsado "Next" con una respuesta válida; solo entonces se enciende el sitio y se guarda en la base de datos (RF-27).
4. Back y el atrás del sistema conservan en el dispositivo la selección en curso de la pregunta que se deja (RF-31).
5. Al cambiar de opción se conserva el texto escrito y pasa al campo que corresponda (RF-26).
6. ~~La intro se queda quieta en su último fotograma, sin bucle (RF-8).~~ Superada (cambio 2026-10-16): la intro se anima en bucle continuo y, con movimiento reducido, es estática (RF-8, RF-87).
7. La animación final dura 8 s como máximo, no incluye "Other" entre las banderas y ~~termina en un estado último fijo~~ (superado en el cambio 2026-10-17: termina en el estado final vivo, con la ciudad en bucle y banderas y textos quietos) (RF-53, RF-54, RF-117).
8. La longitud de los textos se cuenta en puntos de código Unicode tras recortar los espacios, igual en el navegador y en la base de datos; lo que se pega de más se recorta (RF-24, RF-25, RF-28).
9. ~~Búsqueda: se recortan los espacios, no distingue mayúsculas ni tildes, y una búsqueda vacía muestra todo (RF-12, RF-13). Orden alfabético por nombre en inglés, sin distinguir tildes, con "Other" al final (RF-10, RF-11).~~ Superada (cambio 2026-10-16): sin buscador; cuadrícula de banderas en el orden de los datos de contenido con "Other" al final (RF-10, RF-11, RF-90).
10. Países con código ISO 3166-1 alfa-2; "Other" usa un código reservado distinto de cualquier ISO (RF-3, RF-15).
11. Reintentos: esperas de 1 s que se duplican hasta un máximo de 30 s, tiempo de espera de 10 s por envío, y reintento al recuperar la conexión y al abrir la encuesta (RF-45).
12. La cola local guarda solo el último estado completo pendiente (RF-46).
13. Fechas de creación y actualización con el reloj del servidor (RF-39).
14. La IP no se guarda en la tabla de respuestas. Los registros técnicos propios del proveedor quedan fuera de nuestro control (RF-38).
15. RNF-9 excluye los errores de red que escribe el propio navegador y los avisos intencionados de rechazos definitivos.
16. Rendimiento medido con el perfil "Fast 4G" de Chrome DevTools, caché desactivada, a 375 px (RNF-5).
17. Movimiento reducido: solo fundidos de opacidad de 200 ms como máximo, con intro estática y final mostrado directamente en su estado último (RNF-2).
18. Accesibilidad: foco al título de cada pantalla, aviso offline anunciado de forma no intrusiva, contraste de 4.5:1 en texto y de 3:1 en controles (RNF-4).
19. Anchura soportada de 320 a 430 px; horizontal y escritorio funcionales pero no optimizados (RNF-1).
20. Banderas vectoriales servidas por el propio sitio (RNF-6).
21. Sitios de ocio, en orden de pregunta: Q1 park, Q2 concert hall, Q3 museum, Q4 theatre, Q5 cinema, Q6 fairground, Q7 town square, Q8 food market, Q9 nightclub, Q10 stadium (Anexo A).
22. Una fila terminada no admite más cambios; los envíos posteriores se ignoran o se rechazan (RF-65).

## Dudas abiertas
Resuelta: Q6-B se corrige a "It felt like a regular gathering" (errata del original "I felt like a regular gathering", decisión del usuario).

Resueltas por el usuario las del cambio de la ciudad cenital (2026-10-16):
1. Edificios de relleno: número fijo entre 15 y 25 (RF-70).
2. Encendido total: lo hace la ola de luz de RF-53 como primer paso de la animación final, dentro de los 8 s (RF-53, RF-73, RF-74).
3. ~~Sin etiqueta de texto visible en los sitios: solo forma o icono propio; el nombre, solo para el lector de pantalla (RF-71, RF-75).~~ Superada (cambio 2026-10-17): cada sitio encendido muestra su rótulo debajo (RF-71, RF-112, RF-113).
4. Ciudad entera, sin desplazamiento ni zoom: como máximo el 40 % del alto en las preguntas (medido a 375×667 px) y ~~a pantalla completa en el final~~ (superado en el cambio 2026-10-17: en el final, mapa acotado más grande y centrado con fondo liso alrededor) (RF-76, RF-78, RF-79).
5. ~~Planta 2D pura tipo mapa; se quitan cielo, luna y estrellas (RF-69).~~ Superada en parte (cambio 2026-10-17): sigue siendo planta vista desde arriba sin cielo, luna ni estrellas, pero con volumen sugerido por tejados y sombras (RF-69, RF-109).

Resueltas por el usuario las de la ampliación (intro, banderas, textos y estilo, 2026-10-16):
6. Selector: cuadrícula de banderas cuadradas, sin lista, sin buscador y sin nombre visible; nombre solo para el lector de pantalla; 6 países de prueba más "Other" con icono de globo (RF-3, RF-10, RF-11, RF-89, RF-90).
7. Intro con animación constante en bucle; estática con movimiento reducido; "Give feedback" pulsable desde el principio (RF-7, RF-8, RF-87).
8. Intro que recrea la imagen de referencia completa, con la misma tabla y la parte de abajo (Anexo B; RF-83 a RF-85).
9. Textos de la intro y botón "Give feedback" (RF-81, RF-82, RF-7); "Leisure for Society" en el final (RF-53, RF-54).
10. Estilo de textos y controles acorde a la ciudad de noche, no de concurso; el plató mantiene su estética; concreción visual en el plan (RF-92 a RF-97).

11. Los 6 países de prueba son Netherlands, Germany, Italy, Poland, Japan y Nigeria, porque sus banderas se distinguen sin nombre (RF-3). Propuesta del planner aprobada por el usuario.
12. Límite de países: entre 6 y 11, para que con "Other" quepan como máximo 12 casillas sin scroll (RF-4, RF-91).
13. Encaje vertical de la intro (RF-88): opción (a). Sin scroll vertical en pantallas de al menos 568 px de alto; el plató se reduce de forma proporcional y los dos textos y el botón "Give feedback" quedan siempre a la vista. Los rótulos pequeños del tablero pueden quedar poco legibles, pero son decorativos. Descartadas: (b) plató a todo el ancho con scroll vertical y (c) botón fijo abajo.

Decisiones del usuario en el cambio de animaciones y ciudad (2026-10-17):
- Intro con entrada animada de todos los elementos y después el bucle continuo actual; con movimiento reducido, todo visible al momento y estático (RF-8, RF-87, RF-98 a RF-102).
- Fundidos de salida y de entrada entre preguntas y pantallas, sin retrasar el guardado ni permitir dobles pulsaciones (RF-103 a RF-108).
- Ciudad en planta vista desde arriba con más detalle: tejados con volumen, sombras, árboles, parques y agua (RF-69, RF-109, RF-110).
- Nombre en inglés bajo cada sitio al encenderse, con fundido, y que se queda (RF-71, RF-112, RF-113).
- Final con el mismo mapa acotado, más grande y centrado, con fondo liso alrededor y bucles vivos tras el encendido total; estático con movimiento reducido (RF-54, RF-56, RF-79, RF-111, RF-114 a RF-118).

Propuestas por el planner a partir de esas decisiones y aprobadas por el usuario el 2026-10-17 (resueltas):
14. Botón "Give feedback" durante la entrada (RF-100): visible con opacidad completa y pulsable desde el primer instante; su "entrada" es un realce de ≤ 600 ms al final de la secuencia. Descartadas: (b) que el botón aparezca el primero, porque rompe el orden pedido (luces → personas → texto → botón); (c) botón pulsable mientras aún es invisible o semitransparente, porque se podría tocar sin verlo.
15. Límites numéricos propuestos: entrada de la intro ≤ 2 s (RF-98); transición ≤ 150 ms de salida + ≤ 250 ms de entrada (RF-103); rótulo ≥ 8 px a 320 px con fundido ≤ 400 ms (RF-112, RF-113); al menos 12 árboles, 2 zonas verdes y 1 masa de agua (RF-110); al menos 3 coches en bucle (RF-114); cambios de brillo de ≥ 1 s (RF-115).
16. Durante una transición se ignoran todas las pulsaciones y el atrás del sistema (RF-106), en lugar de encolarlas, para que nunca se salte una pregunta.
17. En el final, banderas y textos quedan quietos y solo la ciudad se anima en bucle, para que "Leisure for Society" y "Thank you" sigan legibles (RF-117).

No quedan dudas abiertas.

## Anexo A — Preguntas (contenido real, textos literales de la interfaz)
Tipos: N = normal (con "Want to tell us why?" opcional), AO = abierta obligatoria (campo propio obligatorio), AP = abierta opcional (campo propio opcional). Sitio de ocio: decisión aprobada 21.

| # | Enunciado | Opciones (letra: etiqueta [tipo]) | Sitio |
|---|---|---|---|
| Q1 | Was there a moment when you stopped thinking about work, study or daily worries? What caused it? | A: I stopped thinking and felt truly in the moment. [N] · B: I couldn't fully detach. [N] | park |
| Q2 | Which part of the event made you feel most at ease or most energized? | A: Tell us… [AO] · B: Nothing really had that effect on me. [N] | concert hall |
| Q3 | Did the event feel meaningful to you? In what way? | A: The theme [N] · B: The people [N] · C: A message [N] | museum |
| Q4 | Did the event reach you in a way that other leisure activities don't? | A: It was different than I'm used to. [N] · B: It didn't reach me differently. [N] | theatre |
| Q5 | Which moment will you remember or tell others about? | A: Tell us… [AO] · B: I won't remember this event. [N] | cinema |
| Q6 | Did the atmosphere, location and set-up create a world of its own, or did it feel like just a gathering? | A: The set-up helped create its own atmosphere [N] · B: It felt like a regular gathering [N] | fairground |
| Q7 | Do you think events like this matter for society, for example for social cohesion, wellbeing or local community? | A: Social cohesion/wellbeing/local community [N] · B: They don't matter [N] | town square |
| Q8 | Did you notice sustainability choices (food, materials, waste)? Did they affect how you felt about the event? | A: I was happy to see them [N] · B: I didn't notice or there were no sustainability choices [N] | food market |
| Q9 | Was the flow clear and the atmosphere consistent? Did anything feel out of place? | A: Nothing felt out of place [N] · B: Something was a bit messy [AP] | nightclub |
| Q10 | Did anything practical (sound, queues, signage, timing) bother you during the event? | A: They didn't bother me at all [N] · B: Something bothered me [AP] | stadium |

## Anexo B — Plató de la intro (descripción de la imagen de referencia)
Imagen de referencia aportada por el usuario el 2026-10-16 (la ruta original era temporal; esta descripción la sustituye). Ilustración plana (sin degradados ni texturas), vertical, de proporción aproximada 3:4 (ancho:alto). Las posiciones se dan en porcentaje del ancho (x) y del alto (y) de la imagen, desde arriba a la izquierda. Todos los textos usan una tipografía sin remates, en negrita.

**Fondo y riel de focos**
- Pared del plató en azul medio (aprox. #2B3990), ocupando toda la imagen.
- Arriba (y 0-3 %), una barra horizontal azul marino muy oscuro (aprox. #0D1440) de x 10 % a 90 %: el riel.
- Colgados del riel, 4 focos circulares amarillo pálido (aprox. #FFE9A8), equiespaciados en x ≈ 19 %, 39 %, 58 %, 78 %, a y ≈ 4 %.
- De cada foco baja un haz de luz tenue (trapecio que se ensancha hacia abajo, blanco con poca opacidad) que pasa por detrás del cartel y del tablero.

**Cartel del título** (x 18-82 %, y 7-19 %)
- Rectángulo con esquinas redondeadas, relleno azul marino oscuro (aprox. #111A4A) y borde ámbar/dorado (aprox. #FFB400) de grosor medio.
- 4 bombillas circulares ámbar, una cerca de cada esquina interior.
- Texto centrado en dos líneas: "Leisure in" en blanco, tamaño medio; debajo "Jeopardy" en ámbar (aprox. #FFB400), aproximadamente el doble de grande.

**Tablero** (x 12-87 %, y 22-54 %)
- Panel azul marino oscuro con esquinas redondeadas.
- Cuadrícula de 5 columnas × 4 filas de casillas rectangulares con esquinas ligeramente redondeadas y separación pequeña y uniforme.
- Fila 1 (cabeceras): casillas ámbar (aprox. #FFB400) con texto azul marino oscuro, centrado: "Well-being", "Community", "Economy", "Culture & identity" (en dos líneas: "Culture &" / "identity"), "Access & inclusion" (en dos líneas: "Access &" / "inclusion").
- Filas 2, 3 y 4: casillas azul real (aprox. #3549C8) con el valor en ámbar, grande: fila 2 "100" en las 5 columnas; fila 3 "200" en todas salvo Community, cuya casilla está vacía; fila 4 "300" en todas salvo Culture & identity, cuya casilla está vacía.
- Las casillas vacías son azul casi negro (aprox. #0B1035), sin texto, del mismo tamaño que las demás (representan preguntas ya jugadas).

**Zona entre el tablero y el escenario** (y 54-68 %)
- Haces de luz en forma de triángulos alargados claros y semitransparentes que suben desde el borde del escenario hacia el tablero y se cruzan entre sí.
- Dos postes verticales finos azul casi negro, uno a cada lado (x ≈ 11 % y 88 %), desde y ≈ 60 % hasta el borde del escenario.
- Cartel "On air": rectángulo pequeño rojo (aprox. #D93025) con esquinas redondeadas y el texto "On air" en blanco, a la derecha (x ≈ 80-89 %, y ≈ 57-60 %).

**Escenario**
- Línea horizontal ámbar gruesa que cruza todo el ancho a y ≈ 68-69 %: el borde del escenario.
- Debajo, suelo azul marino muy oscuro (aprox. #161C45) hasta abajo, con una gran elipse algo más clara en el centro (foco proyectado en el suelo) que ocupa casi todo el ancho entre y ≈ 72 % y 93 %.

**Concursantes y atriles** (3 grupos iguales, centrados en x ≈ 21 %, 50 % y 78 %)
- Cada grupo tiene 3 concursantes estilizados: cabeza circular y torso como un rectángulo con la parte de arriba redondeada (hombros), sin rasgos ni brazos. El del centro está más alto (detrás) y los de los lados delante, solapándose un poco.
- Tonos de piel variados (claro, medio y oscuro) repartidos entre los grupos.
- Colores de los torsos: Group 1 naranja (aprox. #F2A33A), rojo coral (aprox. #E8604C) en el centro y rosa frambuesa (aprox. #D4507A); Group 2 turquesa (aprox. #3DB8C8), verde (aprox. #1E9E70) en el centro y verde claro (aprox. #7CC86E); Group 3 lila (aprox. #B07FE0), morado (aprox. #7B5BD0) en el centro y azul lavanda (aprox. #5B70D8).
- Delante de cada grupo, un atril rectangular azul real (aprox. #3B4FD6), de y ≈ 79 % a 94 %, con una franja ámbar arriba.
- En cada atril, de arriba abajo: el texto "Group 1", "Group 2" o "Group 3" en blanco; un marcador rectangular azul marino oscuro con borde ámbar y la puntuación en ámbar, grande ("300", "500" y "200" respectivamente); y un pulsador circular rojo (aprox. #D93025) centrado en la parte baja.

**Lo que no lleva**: ni presentador, ni logos, ni marcas de programas reales, ni texto adicional. En la encuesta, el plató no incluye los textos de RF-81 y RF-82 ni el botón: van debajo del plató (RF-80).
