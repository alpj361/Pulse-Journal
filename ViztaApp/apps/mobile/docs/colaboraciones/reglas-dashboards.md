# Reglas para los dashboards de los agentes

Esto va en la descripción de `colab_dashboard_crear` / `colab_dashboard_actualizar`, para que cualquier agente sepa hacerlo sin preguntar. Es la primera versión: se afina con los que vayan saliendo.

## Qué es

Un dashboard explica un tema con datos, imágenes y movimiento, en un solo archivo HTML que se abre en el teléfono. No es un informe en PDF: se toca, se filtra y se juega con los datos.

## Lo técnico (no se negocia)

1. **Un solo archivo HTML.** Los datos van adentro. No hay red: `fetch`, XHR y WebSocket están bloqueados.
2. **Librerías solo de** `cdn.jsdelivr.net`, `cdnjs.cloudflare.com` o `unpkg.com`, siempre con versión fija. Sugeridas: Chart.js o ECharts para gráficos, D3 si hace falta algo a medida, Leaflet para mapas, GSAP o Motion One para animación.
3. **Imágenes solo por `https://`** (o `data:`). Usá las que ya tienen las fuentes: fotos de los actores, logos de las entidades, capturas de las notas. Siempre con `alt`, y si la imagen no carga, que quede un recuadro con las iniciales en vez de un hueco.
4. **Hasta 500 KB.** Nada de formularios que envíen, iframes, ventanas emergentes, `localStorage` ni cookies.

## Se ve en el teléfono primero

5. **Ancho de 360 a 430 px, sin scroll horizontal.** Las tablas anchas se vuelven tarjetas o se desplazan dentro de su caja.
6. **Todo se pliega.** Arriba va lo esencial (título, una línea de qué muestra y el dato principal). Cada sección se abre y se cierra (`<details>` o acordeón), y arranca abierta solo la primera.
7. **Se toca, no hay hover.** Los botones y controles miden al menos 44 px de alto. Lo que en la computadora sería un tooltip acá es un toque que muestra el valor.
8. **Letra del sistema, mínimo 14 px.** Usá los colores de Vizta: `var(--pulzos-tinta)`, `--pulzos-cuerpo`, `--pulzos-meta`, `--pulzos-fondo`, `--pulzos-verde`, `--pulzos-ladrillo`, `--pulzos-borde` y `--pulzos-lavado`. Las tarjetas van con `class="pulzos-tarjeta"`. Un color de acento propio está bien si el tema lo pide; los colores del sistema no van como fondo de todo.

## Con estilo

9. **Que cuente una historia.** Primero lo que importa, después el detalle. Un título que diga algo («Las denuncias por campaña anticipada se triplicaron en tres meses»), no uno genérico («Dashboard de denuncias»).
10. **Actores y entidades con cara.** Cada persona o institución va en una tarjeta con foto o logo, nombre, cargo o rol y una línea de por qué aparece. Si hay relaciones (quién nombró a quién, quién pertenece a qué partido), mostralas: red, línea de tiempo o grupos.
11. **Gráficos que expliquen.** Elegí el gráfico por lo que se quiere decir: barras para comparar, línea para el tiempo, mapa para el territorio, red para relaciones. Siempre con la unidad y la fecha de corte, y con una frase debajo que diga qué se ve.
12. **Movimiento para entender, no para adornar.** Animá la entrada de los datos, las transiciones al filtrar y los pasos de un proceso («así llegó el caso a la CC»). Duración corta (200–600 ms). Respetá `prefers-reduced-motion`: si está pedido, todo aparece sin animación.
13. **Creativo, pero legible.** Se vale una portada con imagen, números grandes, ilustración o una línea de tiempo que se recorre con el dedo. No se vale texto sobre fotos sin contraste, ni más de tres tipos de gráfico en una misma pantalla.

## Los datos se pueden tocar (al estilo Tableau)

14. **Los datos van en un solo objeto, con su esquema:**
    ```js
    const DATOS = {
      campos: [
        { clave: 'mes', nombre: 'Mes', tipo: 'fecha' },
        { clave: 'denuncias', nombre: 'Denuncias', tipo: 'numero', unidad: 'casos' },
        { clave: 'partido', nombre: 'Partido', tipo: 'categoria' },
      ],
      filas: [ { mes: '2026-07', denuncias: 40, partido: 'Vamos' }, … ],
    };
    ```
    Los gráficos se dibujan a partir de `DATOS`, no con números escritos a mano en cada gráfico.
15. **Cada gráfico tiene un botón «ajustar»** que abre un panel con:
    - qué va en el eje X y qué en el eje Y (elegidos de `campos`);
    - cómo se agrupa (suma, promedio, conteo) y por qué color se separa;
    - el tipo de gráfico (barras, línea, torta, puntos), entre los que tengan sentido;
    - filtros por categoría, por rango de fecha y por rango de números.

    Al cambiar algo, el gráfico se redibuja al momento, con animación.
16. **Pestaña «Datos»:** la tabla de `DATOS` ordenable, donde cada celda se puede editar. Al editar una cantidad, todo el dashboard se recalcula. Un botón «volver a los datos originales» deshace los cambios.
17. **Los cambios no se guardan.** Por ahora viven mientras el dashboard está abierto, y se dice en el panel: «Estos cambios son para explorar; no cambian las fuentes».

## Fuentes y honestidad

18. **Pie con «Fuentes»:** medio, fecha y enlace de cada una. Las mismas van en el parámetro `fuentes` al crearlo.
19. **Nada inventado.** Si un dato es estimado o incompleto, se dice al lado («estimado», «sin datos de agosto»). Las cifras llevan su fecha de corte.
20. **Español de Guatemala, con voseo y sin jerga técnica.**

## Ejemplo mínimo

```html
<h1>Las denuncias por campaña anticipada se triplicaron</h1>
<p class="pulzos-meta">TSE · julio a octubre de 2026</p>
<div class="pulzos-tarjeta">
  <button id="ajustar">ajustar</button>
  <canvas id="g"></canvas>
  <p>En octubre el TSE acumuló 235 denuncias, frente a 40 en julio.</p>
</div>
<details><summary>Datos</summary><table id="tabla"></table></details>
<footer><h3>Fuentes</h3><p>Emisoras Unidas, 22 oct 2026 — https://emisorasunidas.com/…</p></footer>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<script>
  const DATOS = {
    campos: [{ clave: 'mes', nombre: 'Mes', tipo: 'fecha' }, { clave: 'n', nombre: 'Denuncias', tipo: 'numero', unidad: 'casos' }],
    filas: [{ mes: 'jul', n: 40 }, { mes: 'ago', n: 61 }, { mes: 'sep', n: 98 }, { mes: 'oct', n: 235 }],
  };
  const verde = getComputedStyle(document.documentElement).getPropertyValue('--pulzos-verde');
  new Chart(g, {
    type: 'bar',
    data: { labels: DATOS.filas.map((f) => f.mes), datasets: [{ data: DATOS.filas.map((f) => f.n), backgroundColor: verde }] },
    options: { plugins: { legend: { display: false } } },
  });
</script>
```

## Lo que todavía no se puede (para cuando haga falta)

- **Guardar lo que la persona cambió** o pedirle al agente que lo vuelva una versión nueva. Hace falta un puente con la app.
- **Tocar un actor y abrir su ficha del Codex.** Por ahora, que lleven `data-vizta-item="<id>"`: cuando haya puente, la app lo va a usar.
- **Datos que se actualizan solos.** Por ahora el agente actualiza el dashboard y eso crea una versión nueva.
