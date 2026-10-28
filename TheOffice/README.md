# The Office

Prototipo web de escritorio que representa la actividad de agentes externos dentro de una oficina RPG lateral en pixel art.

Los personajes usan los spritesheets MIT de [Pixel Agents](https://github.com/pixel-agents-hq/pixel-agents), adaptados a los estados de The Office. Caminar, escribir y leer cambian de frame sin incorporar el runtime ni los hooks del proyecto externo. La atribución completa está en `THIRD_PARTY_NOTICES.md`.

## Ejecutar

En macOS, haz doble clic en `Start The Office.command`. También puede iniciarse desde Terminal:

```bash
npm install
npm start
```

La aplicación queda disponible únicamente en `127.0.0.1`. No abras `index.html` mediante `file://`: los navegadores bloquean los módulos de Vite desde ese origen.

## Modelo de funcionamiento

| Personaje | Actividad observada | Fuente local |
|---|---|---|
| Leo · Data Analyst | OpenAI Codex | `~/.codex/sessions` |
| Maya · Product & Design | Claude Code | `~/.claude/projects` |

El edificio tiene tres plantas activas:

| Planta | Equipo | Señal |
|---|---|---|
| 03 | Director · Operations Manager | Estado consolidado del manager |
| 02 | Clasificador · Legal · Reality · Media | Artefactos y cadencia de NewsCron en el VPS |
| 01 | Product & Design · Data Analyst | Sesiones locales de Claude Code y Codex |

Los workers del VPS no se muestran como “trabajando” solo porque exista un proceso. El observador mide el artefacto que dejaron: fecha del último resultado, cumplimiento de cadencia y ausencia de señales. Media agrega las señales de cards, perfiles, tweets, narrativa y feeds. Legal aparece pausado mientras permanezca el bloqueo externo documentado.

The Office es un observador. No inicia, detiene ni controla Codex o Claude Code. El servidor inspecciona automáticamente los registros locales de sesión que ambas herramientas ya generan y convierte únicamente su estructura reciente en estados visuales.

Cuando existe actividad externa reciente, el personaje cambia de estado y se desplaza a la zona correspondiente. Cuando no existe actividad, la oficina mantiene una vida simulada local: caminar, descansar y visitar el café. Esas rutinas no ejecutan modelos ni consumen tokens.

No requiere instalar, confiar o activar hooks. Basta con mantener The Office abierto mientras Codex o Claude Code trabajan dentro de `/Users/pj/Desktop/Pulse_Journal` o uno de sus subproyectos.

`Start The Office.command` abre una conexión SSH compartida con persistencia de 12 horas para consultar únicamente metadatos de archivos conocidos del VPS. La lectura se almacena en memoria durante 60 segundos. Si el VPS no responde, la interfaz conserva la última lectura confirmada y la marca como tal.

## Privacidad del observador

El adaptador `observer/session-observer.mjs` lee solamente el tramo final del registro activo, clasifica su estructura y descarta el contenido después de cada lectura. La API solo expone metadatos visuales acotados:

- proveedor y tipo estructural de actividad;
- estado y fase visual;
- nombre de la herramienta;
- nombre base del workspace;
- fecha de la señal.

The Office no duplica los registros, prompts, respuestas ni resultados en su carpeta `runtime/`.

El adaptador `observer/vps-observer.mjs` usa rutas fijas y comandos de solo lectura (`stat`). No transmite el contenido de logs, historiales, variables de entorno ni credenciales al frontend.

## Estados visuales

- Razonamiento reciente → pensando.
- Bash, ejecución o shell → ejecutando comandos.
- Edit, Write o apply patch → editando archivos.
- Herramientas web → investigando.
- Mensaje final → terminado.
- Registro sin cambios durante 10 minutos → vida simulada.

## Verificación

```bash
npm run build
node tests/bridge_smoke.mjs
node tests/vps_observer_smoke.mjs
python3 tests/visual_smoke.py
```

`bridge_smoke.mjs` crea registros sintéticos de Codex y Claude Code, comprueba la clasificación sin hooks y verifica que no se filtren prompts, comandos o secretos. `vps_observer_smoke.mjs` valida señales curadas y estados por cadencia. `visual_smoke.py` revisa las tres plantas con Playwright.
