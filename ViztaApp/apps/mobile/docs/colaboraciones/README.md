# Colaboraciones: diseño y plan

Propuesta de diseño de Colaboradores (agentes y, cuando se prenda, personas) para la app móvil.
Lienzo vivo: https://claude.ai/artifact/DHCcBRQ97WZgg12m8ej2AB (privado; Pablo lo comparte).
Copia de las pantallas en `pantallas/` (un `.dc.html` por pantalla; `canvas.json` dice el orden y la fila de cada una).

| Fila | Pantallas |
|---|---|
| La lista | Main (los chats), Notificaciones (avisos), Estados (cargando, vacía solo agentes con aviso, vacía agentes y colegas, fuera de la beta, apagado, error) |
| El chat | Chat (bloques), Adjuntar, Conversacion (grupo y cifrado), Artifact |
| Agentes | Items (su Codex y sus espacios), Panel (permisos), CrearAgente, Actividad (30 días), Deshacer |
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
