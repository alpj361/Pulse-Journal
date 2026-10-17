# Quién integró el tribunal en cada resolución de la CC

La lista sale de las firmas al pie de cada sentencia (PDF oficial de jurisprudencia.cc.gob.gt).

1. `leer_firmas.py <carpeta>`: baja cada PDF, lee las dos últimas páginas, guarda las firmas en `firmas.jsonl` y borra el PDF. Reanuda si se corta. `lista.tsv` = `slug<TAB>ruta del PDF`.
2. `armar_integrantes.py <carpeta> 0`: separa magistrados (contra la lista conocida), la Secretaría General (última firma) y lo que no se reconoce; escribe `integrantes.json`.
3. `cargar_integrantes.js integrantes.json`: dentro del contenedor de ExtractorW, carga por `pc_cc_integrantes_cargar` (solo service_role).

Base: `private.pc_cc_integrantes` (migraciones `pc_cc_integrantes` y `pc_cc_integrantes_cargar`, 2026-10-14). `pc_obs_leer('resolucion')` devuelve `integrantes`.
Pendiente: correrlo cada noche para las resoluciones nuevas (refresco del Manager).
