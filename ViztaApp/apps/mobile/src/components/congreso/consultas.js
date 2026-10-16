import { supabase } from '../../utils/supabase';

const PAGINA = 20;

const INICIATIVA_COLS =
  'numero,titulo,estado_actual,fecha_presentacion,ultimo_evento_tipo,ultimo_evento_fecha,eventos_timeline,ponentes,url_ficha,url_pdf';

const VOTACION_COLS =
  'id,fecha,sesion,legislatura,asunto,iniciativa_numero,decreto,resultado,a_favor,en_contra,ausentes,licencia,url_acta';

function lanzar(error) {
  throw error;
}

export async function listarIniciativas({ desde = 0, tamano = PAGINA } = {}) {
  const { data, error } = await supabase
    .from('iniciativas_app_view')
    .select(INICIATIVA_COLS)
    .order('fecha_presentacion', { ascending: false, nullsFirst: false })
    .order('numero', { ascending: false })
    .range(desde, desde + tamano - 1);
  if (error) lanzar(error);
  return data || [];
}

export async function listarIniciativasSinNumero() {
  const { data, error } = await supabase
    .from('iniciativas_sin_numero')
    .select('id,titulo,ponentes,fecha_presentacion,noticia_url,estado,numero_asignado')
    .is('numero_asignado', null)
    .order('fecha_presentacion', { ascending: false, nullsFirst: false })
    .limit(20);
  if (error) lanzar(error);
  return data || [];
}

export async function listarVotaciones({ desde = 0, tamano = PAGINA } = {}) {
  const { data, error } = await supabase
    .from('votaciones')
    .select(VOTACION_COLS)
    .order('fecha', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(desde, desde + tamano - 1);
  if (error) lanzar(error);
  return data || [];
}

export async function listarVotosDe(votacionId) {
  const { data, error } = await supabase
    .from('votos_diputado')
    .select('id,diputado,bloque,distrito,voto')
    .eq('votacion_id', votacionId)
    .order('diputado', { ascending: true });
  if (error) lanzar(error);
  return data || [];
}

export async function buscarDiputados(texto) {
  const q = String(texto || '').trim();
  let consulta = supabase
    .from('diputados')
    .select('id,nombre,bloque,distrito,activo')
    .eq('activo', true)
    .order('nombre', { ascending: true })
    .limit(40);
  if (q) consulta = consulta.ilike('nombre', `%${q}%`);
  const { data, error } = await consulta;
  if (error) lanzar(error);
  return data || [];
}

export async function votosDeDiputado(nombre) {
  const { data, error } = await supabase
    .from('votos_diputado')
    .select('id,voto,votacion_id,votaciones(fecha,sesion,asunto,resultado)')
    .ilike('diputado', nombre)
    .order('created_at', { ascending: false })
    .limit(12);
  if (error) lanzar(error);
  return data || [];
}

export const TAMANO_PAGINA = PAGINA;
