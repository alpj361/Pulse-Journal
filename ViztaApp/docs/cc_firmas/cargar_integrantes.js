// Carga integrantes.json en private.pc_cc_integrantes, de a 500, por la función
// pc_cc_integrantes_cargar. Corre dentro del contenedor de ExtractorW, que ya
// tiene la conexión con permisos de servidor.
const fs = require('fs');
const supabase = require('/app/server/utils/supabase');
(async () => {
  const filas = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  let total = 0;
  for (let i = 0; i < filas.length; i += 500) {
    const { data, error } = await supabase.rpc('pc_cc_integrantes_cargar', { p_filas: filas.slice(i, i + 500) });
    if (error) { console.error('falló el lote', i, error.message); process.exit(1); }
    total += data;
  }
  console.log('cargadas', total);
})();
