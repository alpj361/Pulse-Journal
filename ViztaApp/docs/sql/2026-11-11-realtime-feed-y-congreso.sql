-- Tiempo real del feed y del Congreso (aplicada 11-nov-2026, migración realtime_feed_y_congreso).
-- La app escucha estas tablas (apps/mobile/src/utils/datosEnVivo.js) y refresca lo que las lee.
-- Fuera a propósito, por volumen: trending_tweets, votos_diputado, articulos, codex_menciones_resueltas.
do $$
declare t text;
begin
  foreach t in array array['news_cards','narrativa_diaria','trends','feed_data','dataset_rows','congreso_items','iniciativas','iniciativa_eventos','iniciativas_sin_numero','normas','reformas','votaciones','pc_items','sesion_acta_oficial','sesion_avisos','pc_sesion_enmiendas']
  loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
