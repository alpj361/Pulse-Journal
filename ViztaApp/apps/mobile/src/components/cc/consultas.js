import { supabase } from '../../utils/supabase';

const PAGINA = 20;

const CC_COLS =
  'expediente,fecha,tipo_decision,titulo,resumen,source_url,materia,resultado,criterio_juridico,solicitante,autoridad';

export async function listarResoluciones({
  desde = 0,
  tamano = PAGINA,
  busqueda = '',
  tipo = '',
  fechaDesde = '',
  fechaHasta = '',
} = {}) {
  let consulta = supabase
    .from('pc_cc_sentencias_app_view')
    .select(CC_COLS)
    .order('fecha', { ascending: false, nullsFirst: false })
    .range(desde, desde + tamano - 1);

  if (tipo) consulta = consulta.eq('tipo_decision', tipo);
  if (fechaDesde) consulta = consulta.gte('fecha', fechaDesde);
  if (fechaHasta) consulta = consulta.lte('fecha', fechaHasta);

  const q = String(busqueda || '').trim();
  if (q) {
    const seguro = q.replace(/[,()]/g, ' ');
    consulta = consulta.or(
      `expediente.ilike.%${seguro}%,titulo.ilike.%${seguro}%,resumen.ilike.%${seguro}%`
    );
  }

  const { data, error } = await consulta;
  if (error) throw error;
  return data || [];
}

export const TAMANO_PAGINA = PAGINA;
