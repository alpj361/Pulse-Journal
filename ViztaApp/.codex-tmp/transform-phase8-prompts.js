const fs = require('fs');
const path = 'server/services/agents/vizta/prompts.js';
let source = fs.readFileSync(path, 'utf8');
const oldTypes = `Tipos oficiales del Universo Investigativo y cuándo usar cada uno:
- **Actor** → persona física: político, funcionario, empresario, periodista, candidato
- **Entidad** → institución, organización, empresa, partido político, bancada, ONG
- **Territorio** → lugar geográfico: país, departamento, municipio, región
- **Evento** → suceso puntual: elección, votación, marcha, audiencia, captura
- **Historia** → narrativa, análisis, crónica, reporte de investigación largo
- **Objeto** → cosa física: documento, expediente, arma, bien inmueble
- **Artefacto** → creación digital: video, audio, imagen, publicación
- **Post** → contenido de redes sociales: tweet, post de FB, story
- **Snippet** → fragmento corto de texto, cita textual, extracto (solo vía create_note)`;
const newTypes = `Items oficiales del Universo Investigativo y cuándo usar cada uno:
- **Actor** → persona real o actor colectivo investigable. Un **Perfil** es Actor con is_profile=true y representa un tipo de persona, no un individuo real.
- **Entidad** → institución, organización, empresa, partido político, bancada, ONG
- **Territorio** → lugar geográfico del usuario; su geo define frontier, area, location o route
- **Evento** → suceso puntual: elección, votación, marcha, audiencia, captura
- **Historia** → narrativa, análisis, crónica, reporte de investigación largo
- **Objeto** → cosa física: documento, expediente, arma, bien inmueble
- **Artefacto** → creación digital: video, audio, imagen, herramienta
- **Source** → fuente citable: persona, link, archivo, libro, documento, dataset, entrevista o publicación. Es item oficial, pero usa acciones y flujo visual propios.

Contenido auxiliar persistido — conserva "tipo", pero NO forma parte de los items oficiales:
- **Post** → contenido de redes sociales: tweet, post de FB, story
- **Snippet** → fragmento corto de texto, cita textual, extracto (solo vía create_note)`;
if (!source.includes(oldTypes)) throw new Error('No se encontró bloque de tipos en prompt');
source = source.replace(oldTypes, newTypes);

const anchor = `### CUÁNDO USAR EL TOOL "mapa" (mapa investigativo):`;
const simulation = `### CUÁNDO USAR EL TOOL "simular" (recurso persistente):

- Usa operation=crear para escenarios del tipo "qué pasaría si", reacciones de grupos, propagación narrativa o exploración de necesidades.
- Puede mezclar Actores reales, Perfiles (Actor con is_profile=true), personas sintéticas y Sources del usuario.
- crear devuelve sim_id, turn_token y el lote actual. Para actuar, envía exactamente una acción por persona y reenvía ese turn_token.
- Continúa hasta completar. Entonces usa reporte, redacta separando resultados de inferencias y persiste el texto con guardar_analisis.
- estado es lectura: no avanza turnos. listar/obtener recuperan simulaciones guardadas. Los snapshots preservan el contexto aun si el Codex cambia.

`;
if (!source.includes(anchor)) throw new Error('No se encontró anchor mapa');
source = source.replace(anchor, simulation + anchor);
fs.writeFileSync(path, source);
