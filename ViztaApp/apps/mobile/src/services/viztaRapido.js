import { supabase } from '../utils/supabase';
import { EXTRACTORW_URL } from '../utils/servicios';

/**
 * Vizta, preguntado desde la nota.
 *
 * Habla con `/api/vizta-rapido` de ExtractorW, que es el modelo de OpenRouter
 * con el MCP en la mano y nada más — sin clasificador ni planificador. La clave
 * de OpenRouter vive allá: acá solo viaja el token de Supabase, y las
 * herramientas corren como el usuario que preguntó.
 */

const BASE = `${EXTRACTORW_URL}/api/vizta-rapido`;

async function token() {
  const { data } = await supabase.auth.getSession();
  const jwt = data?.session?.access_token;
  if (!jwt) throw new Error('Sin sesión activa');
  return jwt;
}

/**
 * Los modelos que se pueden elegir.
 *
 * Ya vienen filtrados a los que soportan herramientas: sin eso el modelo
 * contestaría de memoria sin poder tocar el Codex, que es el punto entero.
 */
export async function listarModelos() {
  const res = await fetch(`${BASE}/modelos`, {
    headers: { Authorization: `Bearer ${await token()}` },
  });

  if (!res.ok) throw new Error('No se pudo traer la lista de modelos');

  const json = await res.json();
  return json.modelos || [];
}

/**
 * Un hilo nuevo.
 *
 * Es solo un identificador: la conversación vive en el servidor, que es el
 * único que puede guardar los resultados de las herramientas sin filtrarle a la
 * app el formato crudo del proveedor.
 */
export function nuevoHilo() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Preguntar.
 *
 * Devuelve `{ text, herramientas, ms }`. Puede tardar: si el modelo pide
 * herramientas, cada ronda es un viaje más. No hay streaming, así que quien
 * llama tiene que mostrar algo mientras espera.
 *
 * Con `hilo`, la pregunta continúa la conversación: el modelo ve lo anterior
 * —incluidos los datos que ya trajo del Codex— y puede filtrar sobre eso en vez
 * de volver a consultarlo. Sin `hilo`, cada pregunta arranca de cero.
 */
export async function consultar(pregunta, modelo, hilo = null) {
  const res = await fetch(`${BASE}/consulta`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await token()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: pregunta, model: modelo, hilo }),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.success) {
    // El servidor manda un mensaje legible y se guarda los detalles de
    // infraestructura para sus logs; se usa tal cual.
    throw new Error(json?.message || 'No se pudo completar la consulta');
  }

  return {
    text: json.text || '',
    herramientas: json.herramientas || [],
    ms: json.ms || 0,
    incompleta: !!json.incompleta,
  };
}
