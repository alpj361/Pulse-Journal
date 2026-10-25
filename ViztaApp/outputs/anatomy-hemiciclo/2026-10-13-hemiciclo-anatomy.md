# 2026-10-13 · Hemiciclo del Congreso con la skill Anatomy

## Qué se pidió
PJ instaló la skill Anatomy y pidió un hemiciclo del Congreso de Guatemala para revisar cómo queda.

## Qué se hizo
Una figura isométrica interactiva (HTML autónomo, sin dependencias) en dos temas:

- `ViztaApp/outputs/anatomy-hemiciclo/hemiciclo-light.html`
- `ViztaApp/outputs/anatomy-hemiciclo/hemiciclo.html`
- Fuente: `build.mjs` (geometría y página) y `data.mjs` (diputados). Se regenera con `node build.mjs` y `node build.mjs --light`.

La maqueta: base en D, seis gradas, 160 curules (escritorio, silla, micrófono) en cuatro sectores con tres pasillos, antepecho con puerta, estrado de la Junta Directiva con nueve puestos, tribuna, mesa de taquígrafos, consola técnica, tablero con contador y dos lámparas, y una regla de 160 marcas con cursor y pines en 81 y 107.

Comportamiento: al pasar por una curul se enciende su bloque y abajo sale el nombre del diputado; un clic suma el bloque; el cursor, el tablero y el texto llevan la cuenta contra 81 (mayoría absoluta) y 107 (dos tercios). Hay botones por bloque, teclado (flechas, Espacio, Escape) y un recorrido automático en reposo.

## Datos
Observatorio del Congreso de Poder Ciudadano, leído de la base de Pulzos (`get_pc_observatorio('congreso', seccion 'diputados')`), última lectura 2026-10-12: 160 diputados vigentes en 17 bloques. Vamos 38, Independientes 38 (23 llegaron por Semilla), UNE 22, Cabal 18, Valor 10, Viva 8, Todos 6, CREO 3, Bien 3, VOS 3, Unionista 2, Elefante 2, Azul 2, Victoria 2, Cambio 1, Nosotros 1, Winaq-URNG 1.

El orden de las curules es el del observatorio (por bloque), como en un gráfico parlamentario. No es la curul física de cada diputado.

## Qué se probó
- Capturas en escritorio, teléfono (390 px), tema claro y oscuro, y acercamientos a 4×.
- Revisión de líneas de la skill (`scripts/lines.mjs`): 0 extremos sueltos en ambos temas, en reposo y con bloques elegidos.
- Pasar, clic, teclado y movimiento reducido, con Chrome sin ventana. Consola limpia.

## Qué falta o queda abierto
- No se corrió la auditoría geométrica de la skill (`kit/audit.mjs`): la figura no tiene tuberías ni cables, que es para lo que existe. El orden de pintado se revisó a ojo en las capturas.
- No se probó en un teléfono real.
- Decisión de PJ: dejarla en un solo tono (como pide la skill) o darle color por bloque.
- No se publicó en la galería de Anatomy ni se hizo commit (`outputs/` está sin seguimiento en ViztaApp).
