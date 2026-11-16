import { useQueryClient } from '@tanstack/react-query';
import { useEnVivo } from './enVivo';

/**
 * El feed y el Congreso, al día sin reabrir la app.
 *
 * Cuando el servidor escribe una tanda de noticias, una votación, un decreto o
 * un diputado nuevo, las consultas que leen esa tabla se marcan viejas: las que
 * están en pantalla se vuelven a pedir solas; las demás, al abrirse.
 *
 * Las tablas masivas no se escuchan (`trending_tweets`, `votos_diputado`,
 * `articulos`): se refrescan por su tabla madre (`trends`, `votaciones`,
 * `normas`). Las tablas tienen que estar en la publicación `supabase_realtime`
 * (migración `realtime_feed_y_congreso`).
 */

const empieza = (...prefijos) => (q) => typeof q.queryKey?.[0] === 'string' && prefijos.some((p) => q.queryKey[0].startsWith(p));

// El Congreso entero: todo lo que se lee de sus tablas y vistas.
const DEL_CONGRESO = empieza(
  'congreso', 'normas', 'norma-legal', 'resoluciones-veto', 'avisos-sesiones', 'enmienda', 'fichas-enmienda',
  'biblioteca-estados', 'leyes-de-base', 'documento-norma', 'buscador-legal', 'version-anterior',
);

export const GRUPOS = [
  { tablas: ['news_cards'], consultas: empieza('pulse-hot-topics', 'noticias-dia', 'dias-con-publicaciones', 'termometro') },
  { tablas: ['narrativa_diaria'], consultas: empieza('pulse-narrativa', 'termometro') },
  { tablas: ['trends'], consultas: empieza('pulse-trends', 'pulse-tweets') },
  { tablas: ['feed_data'], consultas: empieza('feeds-calles-clima', 'termometro') },
  // Los datasets propios: diputados («Congreso de Guatemala») y «Fechas claves».
  { tablas: ['dataset_rows'], consultas: empieza('congreso-diputados', 'fechas-claves') },
  {
    tablas: ['congreso_items', 'iniciativas', 'iniciativa_eventos', 'iniciativas_sin_numero', 'normas', 'reformas',
      'votaciones', 'pc_items', 'sesion_acta_oficial', 'sesion_avisos', 'pc_sesion_enmiendas'],
    consultas: DEL_CONGRESO,
  },
];

function useGrupo({ tablas, consultas }, cliente) {
  // El servidor escribe en tandas (una sesión, 30 tarjetas): se junta en un solo aviso.
  useEnVivo(tablas, () => cliente.invalidateQueries({ predicate: consultas }), { espera: 1500 });
}

/** Se monta una vez, donde vive el feed. */
export function useDatosEnVivo() {
  const cliente = useQueryClient();
  // Un llamado por grupo, siempre en el mismo orden.
  for (const g of GRUPOS) useGrupo(g, cliente); // eslint-disable-line react-hooks/rules-of-hooks
}
