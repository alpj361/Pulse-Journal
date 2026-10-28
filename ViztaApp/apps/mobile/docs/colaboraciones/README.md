# Colaboraciones: diseño y plan

Propuesta de diseño de Colaboradores (agentes y, cuando se prenda, personas) para la app móvil.
Lienzo vivo: https://claude.ai/artifact/DHCcBRQ97WZgg12m8ej2AB (privado; Pablo lo comparte).
Copia de las pantallas en `pantallas/` (un `.dc.html` por pantalla; `canvas.json` dice el orden y la fila de cada una).

| Fila | Pantallas |
|---|---|
| La lista | Main (los chats), Notificaciones (avisos), Estados (cargando, vacía solo agentes con aviso, vacía agentes y colegas, fuera de la beta, apagado, error) |
| El chat | Chat (bloques), Adjuntar, Conversacion (grupo y cifrado), Artifact |
| Agentes | Items (su Codex y sus espacios), Panel (permisos), CrearAgente (hoy «Conectar un agente»), Actividad (30 días), Deshacer |
| Compartir y aprobar | Comun (compartido), Compartir, Bandeja (solicitudes), Solicitud (unir campo por campo), Conflicto (cambió mientras tanto) |

# Colaboraciones en la app: diseño v2 para STA-259 (Claude Code, 21-oct-2026)
Lienzo: https://claude.ai/artifact/DHCcBRQ97WZgg12m8ej2AB (privado: Pablo lo comparte). Solo diseño: sin merge, sin backend, sin OpenUI.

## Qué se agregó respecto a la v1 (17 pantallas en 4 filas)
La lista
1. Los chats: filtro todos/agentes/personas; cada fila con último mensaje, «N por aprobar», qué puede hacer (o «conexión antigua · puede todo»), «te responde cuando se conecte» si el agente tiene cola, candado si el chat está cifrado; grupos; campana con no leídas; «sumar un agente» y «nuevo grupo».
2. Avisos (nuevo): notificaciones con no leídas y «marcar todo leído»; cada aviso lleva a su pantalla.
3. Estados (nuevo): cargando, vacía, no disponible (fuera de la beta = solo_beta; apagado un rato = colab_apagado) y error.
El chat
4. Chat: bloques de texto, tarjeta de ítem, votación (dataRef), artifact_ref, código, acción con botones (estado respondido) y el indicador de pendiente del agente. Pestañas: Chat · Su Codex · Compartido.
5. Adjuntar (nuevo): de mi Codex, noticia, del feed (news card), fragmento (snippet), código y artifact, con buscador.
6. Grupo y cifrado (nuevo): integrantes y el interruptor de cifrado de extremo a extremo con los tres estados: con agente (no se puede), prendido (candado) y todavía no disponible.
7. Abrir un artifact (nuevo): vista segura, versión, autor, fuentes, «proponer un cambio» y «compartir». Lo que la app no sabe mostrar (bloque openui) sale como «Esto se ve en una versión nueva de la app».
Agentes
8. Su Codex: «notas e ítems» / «sus espacios» (datasets y proyectos); aviso de lo que antes guardaba en tu Codex (visible_humano), marcado como suyo.
9. Permisos: leer, crear, editar, borrar («sin editar, sus cambios te llegan para aprobar»); «desde dónde trabaja» (conexiones, con «conexión antigua · puede todo»); créditos; quitar el acceso.
10. Sumar un agente (nuevo): nombre; nace con leer + crear; responde a vos.
11. Actividad (nuevo): 30 días, filtro por quién, qué hizo (leyó, creó, cambió, borró) y desde qué conexión.
12. Deshacer (nuevo): elegir la sesión o toda la conexión, lista de lo que se borra (solo lo creado) y confirmación.
Compartir y aprobar
13. Compartido: «te compartió» / «le compartiste», con qué puede hacer cada uno («edita directo» o «propone cambios»).
14. Compartir algo (nuevo): leer, sumarle cosas, cambiar, borrar, y si sus cambios «te llegan para aprobar» o «quedan directo» (editar_directo); dejar de compartir.
15. Solicitudes (nuevo): «Te piden» / «Pediste», cuánto falta para que venza, vencidas aparte; los tipos merge_item, merge_investigacion, compartir y permiso.
16. Unir campo por campo: antes y después por campo, con casillas, «aprobar 2 cambios» y «rechazar todo».
17. Cambió mientras tanto (nuevo): el 409 conflicto_version; la propuesta sigue guardada, «verla con la versión nueva» o «pedirle que la vuelva a proponer».

## Dudas de contrato para Vizta Dev
1. Merge parcial: ¿se puede aprobar solo algunos campos de la propuesta (mandar a /merge un subconjunto de `campos`)? El diseño lo asume. Si no, se cambia a todo o nada.
2. Vencimiento: ¿la solicitud trae `vence_at` o se calcula como created_at + 30 días? ¿Las vencidas siguen en GET con estado `vencida`?
3. GET /api/colaboradores: ¿trae último mensaje, número de pendientes, si el agente tiene cola pendiente y si es conexión antigua? La fila los necesita sin pedir cada chat.
4. Humanos: ¿cómo se suma una persona (invitación por correo o usuario)? No hay endpoint en el handoff. El diseño solo tiene «nuevo grupo».
5. Grupos: ¿endpoints para sumar o sacar integrantes, y para salir del grupo?
6. Deshacer: ¿el preview devuelve la lista de ítems (id, título, tipo) y el total? ¿Hay deshacer del deshacer? El diseño no promete que se pueda volver atrás.
7. Actividad: ¿cada entrada trae un nombre legible de la conexión («Claude, en la compu de Pablo», «ChatGPT») y la sesión, para agrupar?
8. Notificaciones: ¿qué tipos existen y qué trae cada uno para armar el texto y saber a qué pantalla llevar?
9. Cola del agente: ¿hay un campo que diga «pendiente de respuesta» por conversación (de cola_agente_chat) para mostrarlo en la lista y en el chat?
10. Espacios del agente: datasets y proyectos se llaman «espacios» en el diseño, pero en la app «Espacios» ya es otra cosa (spaces + lienzo). ¿Cómo los llamamos para no confundir?
11. Artifacts HTML: ¿el render seguro es WebView sin JS con el CSS de Pulzos inyectado por la app, o el backend entrega el HTML ya saneado?
12. Créditos por agente: ¿hay endpoint con lo gastado por semana?
13. Cifrado: ¿qué pasa con los chats cifrados en un dispositivo nuevo (las llaves son por dispositivo)? El diseño no lo cubre todavía.

# Colaboraciones: revisión del backend y plan para cablear (21-oct-2026)
Claude Code. Para Pablo (y Vizta Dev para los huecos).

## Estado del backend (ExtractorW 9258bd2e, en el VPS)
- Encendido en modo beta: COLAB_BACKEND no está definido → «beta» (alfa, beta y admin entran; el resto, 403 solo_beta). Para apagarlo: COLAB_BACKEND=0. Para abrirlo a todos: COLAB_BACKEND=1.
- Humanos apagados: COLAB_HUMANOS=0. AGENT_OIDC_RLS=1.
- Todas las rutas responden 401 sin sesión (existen): /api/colaboradores, /api/colaboraciones/{conversaciones, artifacts, solicitudes, compartidos, notificaciones}, /api/mcp/actividad.
- Tablas en la base: action_events, artifacts, codex_colaborador_hilos, codex_colaborador_mensajes, codex_colaboradores, cola_agente_chat, compartidos, conversaciones, mensajes, notificaciones, solicitudes_colaboracion.
- Datos hoy: 0 agentes, 0 colaboradores, 0 ítems de agente. Para probar mañana hace falta crear un agente con la sesión de Pablo.

## Abrir cosas de otra cuenta
- Ítems del Codex de un colaborador: GET /api/colaboradores/:id/items (misma forma que /api/codex/items). Existe.
- Un ítem suelto de otra cuenta: no hay ruta de detalle. Con un agente debería abrir con la ficha que ya existe (ItemDetailSheet), porque el ítem es del humano; con humanos, la base lo bloquea → falta ruta o regla.
- Artifacts: GET /api/colaboraciones/artifacts/:id existe; no hay listado (GET /artifacts).
- «Traer a mi Codex» / guardar algo de otro en lo tuyo: no existe. Queda puesto en la app (botón y función) para conectarlo cuando esté.

## Plan para mañana: cablear con lo que ya existe
- Lista y chat: pantalla nueva Colaboradores (pestaña) con GET /api/colaboradores; chat con /conversaciones y /mensajes; bloques de texto, ítem, código, artifact_ref y votación (reusa la tarjeta de votación del Congreso).
- Su Codex: reusa la tarjeta de ítem del Codex (CodexItem) y la ficha (ItemDetailSheet).
- Permisos: PATCH /api/codex-colaboradores/:id; sumar agente: POST /colaboraciones/agentes.
- Compartir, solicitudes, merge por campo, conflicto (409), deshacer, actividad, avisos: sus rutas, una por pantalla.
- Humanos: todo cableado igual, detrás de un interruptor de la app que lee si el backend los permite (hoy apagado). Cuando se prenda COLAB_HUMANOS, aparece «invitar a un colega» y la vacía de «agentes y colegas».
- El aviso «Pronto vas a poder colaborar también con colegas y amigos» se guarda cerrado en el teléfono.

## Huecos para Vizta Dev (pasados por Reason)
1. itemsDeColaborador hace repo.list('codex_items') sin filtro y filtra en memoria; lo mismo con codex_colaboradores. Supabase devuelve como mucho 1000 filas, así que con más ítems se cortaría. Filtrar en la consulta.
2. No hay GET /api/colaboraciones/artifacts (listado), solo por id.
3. No hay detalle de un ítem de otra cuenta (para humanos).
4. No hay «traer a mi Codex» (copiar un ítem ajeno al tuyo).
5. Humanos: falta la forma de invitar (correo o usuario).

# Fase 1 cableada (24-oct-2026)
Claude Code, rama feature/congreso-planes-uso. Código en `src/components/colaboradores/`.

## Qué hay
- Entrada: ícono de personas en el encabezado del feed, al lado del globo y la tuerca. Solo con rol alfa, beta o admin (`puedeColaborar`). Abre `ColaboradoresSheet`, un Modal como el del mapa, con navegación interna lista → chat → permisos.
- La lista (pantallas 1 y 3): filas con último mensaje, «N por aprobar» y qué puede hacer; estados cargando, vacía (solo agentes), fuera de la beta (`solo_beta`), apagado (`colab_apagado`) y error con «probar de nuevo». El aviso «Pronto vas a poder colaborar también con colegas y amigos» se cierra con la cruz y queda anotado (`PISTA.COLAB_COLEGAS`). El filtro todos/agentes/personas y la vacía «agentes y colegas» aparecen cuando `humanosHabilitados()` sea true.
- Conectar un agente (reemplaza a la pantalla 10, 24-oct): la app no crea agentes. Muestra los clientes que se pueden conectar (ChatGPT, Claude, Hermes, Gemini, Cursor, Codex u otro), y para el elegido tres pasos: agregar el conector `https://mcp.standatpd.com/mcp`, entrar con la cuenta de Vizta y pedirle al agente que se cree su cuenta con `agent_account_create` (texto copiable, con el nombre). La hoja mira cada 4 s y, cuando aparece el agente nuevo, abre sus permisos. Logos de @lobehub/icons-static-svg (MIT) copiados en `logos.js`.
- Chat (4): texto, adjunto de ítem (abre la ficha en Su Codex), código, artifact_ref (título, versión y fuentes; todavía no se abre). Votación, línea de tiempo, tablero, openui y lo cifrado no se muestran ni se anuncian hasta que existan (`SE_VEN` en logica.js); un mensaje que solo trae eso no aparece. «Te responde cuando se conecte» si lo último es tuyo y el otro es un agente. Mira mensajes nuevos cada 8 s; carga los anteriores al subir.
- Su Codex (8): ítems del agente; los que antes guardaba en el tuyo dicen «ya lo tenés». La ficha es de solo lectura (no reusa ItemDetailSheet: esa ficha edita `wiki_items`/universo directo y saltaría la aprobación).
- Permisos (9): leer, crear, editar, borrar; se guardan al tocar y vuelven atrás si falla. «Quitarle el acceso» con confirmación.

## Lo que no entró y por qué
- Campana de avisos, «nuevo grupo», pestaña Compartido, adjuntar, «unir con la tuya», «tener en común», «traer a mi Codex»: son fase 2 o el backend no lo tiene.
- En Permisos: «desde dónde trabaja», «N por aprobar» y créditos de la semana. No hay de dónde leerlos por agente.
- «Sus espacios» en Su Codex: no hay ruta para listar los datasets de un agente desde la cuenta humana.

## Huecos nuevos para Vizta Dev
6. `GET /conversaciones` no trae participantes: la app no puede saber cuál es el chat de un agente si todavía no tiene mensajes. Hoy usa `ultimo_mensaje.conversacion_id` y, si no hay, el chat que el teléfono ya abrió; el chat nace con el primer mensaje.
7. `ultimo_mensaje` no trae `autor_tipo`: la lista no puede mostrar «Te responde cuando se conecte».
8. Los botones del diseño (acción con estado respondido) solo pueden venir dentro de un bloque `openui`; no hay bloque de acción simple.
9. Votación por `dataRef`: falta definir a qué apunta (¿dataset con qué columnas?) para reusar la tarjeta del Congreso.
10. La app manda el texto en `cuerpo` además del bloque `text`, porque la lista y el aviso leen `cuerpo`.

# Fase 2 cableada (24-oct-2026)
- Por aprobar (15): «Te piden» con lo pendiente y lo vencido aparte; «Pediste» solo aparece si pediste algo. Entra desde la fila «N cosas por aprobar» de la lista, desde el chip de cada agente y desde sus permisos (filtrada a ese agente). Pedir permiso o acceso se decide ahí mismo.
- La propuesta (16 y 17): antes tachado y después en verde, por campo, siempre contra la versión de ahora (`/merge/preview`). Las etiquetas se ven una por una (quedan, se suman, se van). Se aprueba o se rechaza entera: el backend aplica el parche completo, así que no hay casillas por campo. Si la nota cambió (`conflicto`), no se puede aprobar: «pedirle que la vuelva a proponer» abre el chat con el pedido escrito, o «rechazar».
- Avisos (2): campana con los no leídos; HOY, ESTA SEMANA, ANTES; cada aviso queda leído al tocarlo y lleva a su chat o a su propuesta. «marcar todo leído». El texto lo arma la app (el backend guarda «Hay una solicitud de merge_item»). Los avisos de «compartido» no se muestran hasta que exista esa pantalla.

## Huecos nuevos para Vizta Dev
11. El MCP no tiene acción para que el agente proponga un cambio (crear una solicitud `merge_item` como el agente). Las de colaboración son `agent_account_create`, `colab_chat_*`, `colab_action_events` y `colab_deshacer*`. Sin eso, un agente conectado por MCP nunca llega a «por aprobar». Probado el 24-oct con «Morrow»: conectar funcionó de punta a punta; solicitudes y avisos en 0.
12. Aprobar por campo (duda 1) sigue sin existir: `/aprobar` aplica el parche entero.
13. Los avisos guardan texto de sistema («Solicitud de colaboración», «Hay una solicitud de merge_item»). Sirve para la app porque arma el suyo, pero el push al teléfono sale con ese texto.

# Ajustes de diseño y fase 2b (25-oct-2026)
Sobre ExtractorW `c123a1b5` (PR #55, v4.6.2: listado mixto, ítem por id, copiar).
- Su Codex (8): mezcla documentos y fichas del universo (Actor, Entidad, Source → «fuente», Evento, Historia, Snippet → «fragmento», Documento…), con un filtro por los tipos que hay y un ícono y lavado por tipo. La ficha pide el ítem completo (`GET /colaboradores/:id/items/:itemId`): lee el contenido en markdown (sin repetir el título), los campos de la ficha que son texto (Confiabilidad, Tipo de fuente, URL…) y el enlace. Un documento sin archivo (`storage_path: null`) se lee por su contenido; no se busca en Storage. «traer a mi Codex» copia el ítem (`POST /colaboraciones/codex/items/:id/copiar`); lo que ya está en tu Codex dice «en tu Codex». Probado con los 28 ítems de Morrow.
- Chat en vivo: canal `colab-chat-<id>` sobre `mensajes` (INSERT) y `conversaciones` (UPDATE); lo que llega entra con animación. Si el agente abre el chat primero, se engancha por `conversacion_participantes`. La consulta cada 30 s queda de respaldo. Las tres tablas están en `supabase_realtime`.
- Abrir un artifact (7): el HTML (ya saneado por el servidor) se muestra en un WebView sin JavaScript, con los tokens `--pulzos-*` que define la app; los enlaces se abren afuera. Abajo, sus fuentes. Visualización y preset muestran título y fuentes.
- Adjuntar (5): de mi Codex (búsqueda por título, varios a la vez), fragmento y código. Noticia, del feed y artifact quedan para cuando haya de dónde listarlos.
- Pantalla 10 del lienzo (`CrearAgente.dc.html`) rehecha como «Conectar un agente», igual a la app.

## Sobre los bloques del chat
El contrato `openui.v1` tiene `text`, `attachment`, `code`, `artifact_ref`, `votacion`/`timeline`/`tablero` (con `dataRef`) y `openui`. No existen `item_ref`, `data_ref` ni `action` como tipos: un ítem va como `attachment` con `tipo: item` (tarjeta tocable que abre la ficha), el artifact como `artifact_ref` (tarjeta que abre la pantalla 7) y los botones solo pueden venir dentro de `openui`. Votación, línea de tiempo, tablero y `openui` siguen sin dibujarse (no se anuncian) hasta definir a qué datos apunta `dataRef` y qué librería OpenUI se registra en `ui_libraries`.

## Su Codex sin «ya lo tenés» ni «traer a mi Codex» (25-oct, PJ)
Lo que guarda un agente queda con `user_id` del humano y sale en su Codex (la pestaña lee por `user_id`; la RLS deja ver lo de los agentes propios). Así, «ya lo tenés» salía en todo y «traer» no separaba nada. Se quitaron hasta que el agente tenga su Codex aparte. Los 28 ítems de Morrow tienen `visible_humano = true` por un backfill posterior a su creación (el código lo pone en `false`).

Dirección acordada: el agente se trata como un colaborador humano. Cada uno con su Codex; si los dos tienen el mismo actor (p. ej. Bernardo Arévalo), se proponen uniones (merge) y vos decidís. Pendiente de diseñar.

## Separación de Codex y merge por campo (25-oct, ExtractorW PR #56 `c906cf07`)
- Los 28 de Morrow con `visible_humano = false`: ya no salen en el Codex de Pablo; siguen en Su Codex.
- Su Codex: `ya_en_mi_codex` → «ya lo tenés» / «en tu Codex»; `coincidencia_humano_id` → «se parece a uno tuyo» y, en vez de traer (duplicado), «pedirle que lo una al tuyo»: abre el chat con el pedido escrito para `colab_merge_proponer`. Lo demás: «traer a mi Codex». Probado con «Poder Ciudadano» (Entidad, homónima en el Codex de Pablo).
- Propuesta: casilla por campo; con todo marcado `/aprobar` va con `{}`, si no con `{ campos }` usando las claves de `parche.campos` (`claveParaAprobar`). Lee `payload.antes`/`despues`/`cambios` sin pedir la vista previa; `details` se compara clave por clave. Sin probar con una propuesta real: todavía no hay ninguna.

# Lo que sigue el agente (25-oct)
Los monitoreos, pero del agente y en palabras de la app: «Sigue». Pestaña en el chat del agente (aparece solo si `GET /colaboradores/:id/seguimientos` existe; con 404 no se muestra), con un punto rojo si hay algo nuevo. Cada tema: lo nuevo, lo importante, cuándo miró, en pausa. Al abrirlo: lo que encontró (fuente, fecha, título, extracto), se abre en su fuente, «importa» / «no es», filtro todo/nuevo/importante, «pausar»/«seguir». Avisos tipo `seguimiento` llevan a la pestaña. Webhooks no se muestran: son para el agente.

Estado del backend (revisado): `monitors` + `monitor_hallazgos` existen pero son del humano (`owner_user_id`), solo por la tool MCP `monitors`, sin ruta HTTP; detección 1 vez al día (03:30 UTC). Contrato pedido a Vizta Dev por Reason: dueño agente, rutas `/colaboradores/:id/seguimientos…`, aviso agrupado, detección más seguida y sin duplicados. Pendiente: qué pasa con los 4 temas actuales (de Pablo o de Morrow).

## Avisos de lo que sigue un agente (25-oct, PJ)

**Lo que ve y hace la persona:**
- **En cada tema:** una fila con la campana, «Mira a las 9:30 pm» y un interruptor para prender o apagar los avisos. Si el backend devuelve `horas`, la fila abre «Cuándo mira» para elegir hasta 4 horas al día (hora de Guatemala). Si no las devuelve, solo muestra el texto. Al prender los avisos se pide el permiso del teléfono; si están apagados en Ajustes, sale un aviso para abrirlos.
- **Condiciones:** «avisame si pasa X» o «si sube de intensidad» se le pide al agente en el chat y él lo configura por MCP. La app no tiene controles para eso.
- **En la ficha del agente:** solo aparece «Le avisamos» cuando el agente se conectó a sus avisos (`avisos-agente` con `conectado: true`). Tiene tres interruptores: cuando encuentra algo, cuando le escribís y cuando respondés lo que pidió. Abajo va «dejar de avisarle». Si el agente no está conectado, no aparece nada.
- **Toque en el aviso del teléfono:** un push con `type: 'colaboracion'` abre Colaboraciones en Avisos.

**Lo que se quitó (PJ):** el texto «Cómo se entera / Cuando lo abrís» y la tarjeta «¿Querés que lo mire?», que copiaba un pedido para pegar en ChatGPT, Claude o Gemini. Por hoy, a los agentes que no se despiertan solos se les pide en su app, sin ayuda de Vizta.

**Backend (Vizta Dev, STA-262 parte 2):** wake agrupado por tema y barrido, con push; `horas` y `proxima_revision_at`, con cron cada 15 minutos; `agente_avisos` por agente, con `colab_avisos_conectar`, `_estado` y `_desconectar` (HMAC `x-vizta-*`); `colab_pendientes`; enriquecimiento por `tweet_id`; un umbral más alto para `strong`; y deduplicación de la misma nota en varios medios.

## Perfil del agente: tareas, fuentes y espacios (25-oct, PJ)

Son lo principal del agente, no ajustes. En el encabezado del chat hay una **carpeta** al lado del ícono de ajustes, y abre su **perfil**: avatar, nombre, «haciendo ahora» y dos puertas grandes con ícono, **Tareas** y **Fuentes**. Cada una abre su propia pantalla (`Ficha.jsx`). El ícono de ajustes del chat queda para los permisos, «Le avisamos» y quitar el acceso. Cada puerta aparece solo si su GET responde.

- **Tareas:** «haciendo ahora» sobre verde claro, lo pendiente y lo pausado. Al tocar una tarea se puede marcar hecha, pausar o borrar. Al final hay un campo «pedirle una tarea», y las terminadas se ven con «ver las hechas».
- **Fuentes:** filtros todas, sin calificar, confiables y no confiables. Cada fuente lleva un ícono por tipo (medio, red, oficial, cuenta automática o web) y los botones «confiable» y «no confiable». Tienen que ser medios y cuentas reales (Soy502, Canal Antigua, @CanalAntigua), no categorías; eso lo arregla Vizta Dev.
- **Espacios (en «Su Codex», no en el perfil):** arriba de Su Codex, sus Espacios en una fila de carátulas chicas que se corre con el dedo (el carrusel grande del Codex ocupaba media pantalla). Al tocar uno se entra (`EspacioAgente.jsx`): carátula, descripción, historia («leer todo»), lo que recuerda (si se mantiene apretado un recuerdo, sale «olvidar») y lo que guardó ordenado por tipo, con actores primero. Cada cosa se abre en su ficha. El contenido por tipo usa `GET /colaboradores/:id/espacios/:eid`; si responde 404, solo se ven la historia y los recuerdos.

## Fichas en Su Codex (27-oct, PJ)

Cada cosa abre la ficha que le toca, no todas la misma:
- **Actores, entidades, eventos, territorios…:** la ficha del Codex (`ItemDetailSheet`) en modo `soloLectura`, sin lápiz, sin «Más campos» y sin Ajustes. Abajo lleva una barra (`pie`) con «traer a mi Codex» o «pedirle que lo una al tuyo». Los campos (Profesión, Cargo, Afiliación…) salen de `details`; si el agente no los llenó, la ficha queda vacía. Que los llene es trabajo del backend: le pasa el catálogo de campos y le avisa qué falta.
- **Fuentes (tipo Source):** su propia ficha. Muestra el medio (dominio) y la fecha de publicación, «abrir la fuente», las notas, los datos (confiabilidad «5 de 5», tipo, verificación) y «dónde aparece» (`apariciones`, cuando el backend las mande).
- **Documentos y fragmentos:** un lector con formato (markdown).
- **Fuentes del perfil (por medio):** al tocar Canal Antigua o Soy502 se abre su pantalla, con «confiable / no confiable», «dónde aparece» y «lo que encontró» (`GET /colaboradores/:id/fuentes/:clave`).

**Elegir un espacio en Su Codex (27-oct, PJ):** tocar una carátula elige ese espacio: queda marcado y los demás se apagan. La lista pasa a «Lo de este espacio», con los filtros por tipo recontados. Otro toque lo suelta, y «entrar al espacio ›» abre su pantalla. Lo que recuerda en cada espacio entra en la lista como tipo **memoria** (ícono de cerebro); al abrirlo se lee y tiene «que lo olvide». Para filtrar los ítems hace falta `item_ids` (y `items_fuera`) en `GET /espacios`; mientras no lleguen, al elegir un espacio se ven solo sus memorias.

## Autorizar un agente desde el teléfono (27-oct, PJ)

Cuando ChatGPT o Claude abren «Authorize», el servidor deja una solicitud pendiente con un código corto (`/oauth/authorize`, PR #64 de ExtractorW). La app la responde:
- **Pantalla `AutorizarConexion`:** logo y nombre del cliente, el código para comparar, permisos (Leer y Crear prendidos; Editar y Borrar apagados) y los botones autorizar / rechazar. Al responder dice «quedó conectado. Volvé a ChatGPT»; la página del navegador sigue consultando y vuelve sola al cliente.
- **Llega por enlace:** `com.standatpd.vizta://mcp-authorize?req=…&code=…`. Lo escucha `AbrirAutorizacion` en `app/_layout.jsx`, porque el enrutador no lo tomaba solo, y abre la ruta `app/mcp-authorize.jsx`. `app.json` declara `"scheme": "com.standatpd.vizta"`, el mismo que ya está en Info.plist, así que no hace falta recompilar.
- **O por tarjeta:** mientras la lista de Colaboradores o «Conectar un agente» están abiertos, la app consulta `GET /api/mcp/solicitudes-oauth` cada 4 s y muestra «ChatGPT quiere conectarse · ABCD-1234 · revisar». Sirve cuando se conecta desde la computadora.
- **Del lado del servidor (Vizta Dev):** el enlace de la página tiene que usar `com.standatpd.vizta://` (hoy dice `vizta://`, que no abre nada), y en el teléfono la página tiene que abrir la app sola.

## Dashboards de los agentes (27-oct, PJ)

Es un tipo de ítem solo para agentes: un artifact `dashboard`, o sea un HTML interactivo (gráficos, filtros, pestañas). En Su Codex aparece con ícono de tablero y se abre en el visor de `Artifact.jsx` en pantalla completa.

Corre encerrado. Tiene JavaScript con una CSP que solo deja cargar librerías de jsdelivr, cdnjs y unpkg, y bloquea toda red (`connect-src 'none'`): los datos van dentro del HTML. No hay puente con la app ni almacenamiento, y los enlaces se abren afuera. La app le inyecta los tokens `--pulzos-*`.

Las reglas para el agente (mobile primero, español con voseo, fuentes al pie) y las herramientas MCP (`colab_dashboard_crear`, `_actualizar`, `_listar`) las implementa Vizta Dev. El HTML estático (`tipo: 'html'`, sin JS) sigue como estaba.
