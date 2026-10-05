/**
 * Casos de muestra del análisis de posts.
 *
 * Son posts inventados —cuentas, textos y cifras— para ver cómo queda la ficha
 * en cada clase de post sin traer ni analizar nada: no salen del teléfono y no
 * cuestan. Cada uno tiene dos momentos, igual que un post de verdad:
 *
 *  · **traído**: lo que hay apenas llega (texto y transcripción).
 *  · **visto**: lo que se suma al tocar el ojo (`_muestra.alVer`).
 *
 * La forma es la misma que escribe el servidor en `details` (`analysis`,
 * `vistazo`, `clasificacion`): si acá se ve bien, con un post real se ve igual.
 * Solo se abren en desarrollo, desde el matraz de la hoja de Posts.
 */

const BASE_TIPOS = {
  opinion: 0.05, informacion: 0.05, aprendizaje: 0.05, hechos: 0.05,
  comedia: 0.03, narrativa: 0.04, baile_tendencia: 0.02, lista: 0.04,
};
const tipos = (o) => ({ probabilidades: { ...BASE_TIPOS, ...o } });

const m = (texto, tipo, extra = {}) => ({
  texto, tipo, pista: null, rol: 'central', material: null, en_texto: true, codex: null, candidatos: [], ...extra,
});
const ref = (texto, material, pista = null, identidad = null) => m(texto, 'Ref', { material, pista, identidad });
const h = (texto, verificable, cita = null, menciones = []) => ({
  texto, cita, cita_en_texto: !!cita, cifra: null, menciones, verificable,
});
const q = (valor, variable, hacia = null, periodo = null) => ({ valor, variable, hacia, periodo, cita: null, cita_en_texto: false });
const item = (texto, detalle = null, mencion = null) => ({ texto, detalle, mencion });

const VACIO = {
  version: 2, menciones: [], hechos: [], relaciones: [], temas: [], narrativa: '',
  listas: [], recetas: [], cantidades: [], aprender: null, analyzed_at: '2026-10-03T12:00:00.000Z',
};

function caso({ n, titulo, cuenta, texto = '', dicho = null, carrusel = false, alTraer, alVer = {}, vistazo = null, tiposAlVer = null }) {
  const clasificacion = tipos(alTraer);
  return {
    id: `muestra-${n}`,
    _muestra: {
      n,
      titulo,
      alVer: {
        analysis: { ...VACIO, ...alVer },
        vistazo,
        clasificacion: tiposAlVer ? tipos(tiposAlVer) : clasificacion,
      },
    },
    name: `@${cuenta} — ${texto.slice(0, 60)}`,
    description: texto,
    tags: carrusel ? ['carrusel'] : ['reel'],
    created_at: '2026-10-03T12:00:00.000Z',
    details: { author: cuenta, transcription: dicho, is_reel: !carrusel, clasificacion },
  };
}

export const CASOS = [
  caso({
    n: 1, titulo: 'Política a cámara que anuncia algo', cuenta: 'Marta Recinos',
    texto: 'Les cuento cómo van las tres rutas nuevas del transporte.',
    dicho: 'Hoy quiero contarles el avance de las tres rutas nuevas. La ruta norte ya tiene 12 kilómetros terminados y empieza a operar en marzo. La ruta sur va al 60 por ciento. Y la ruta de Villa Canales arranca obras el próximo mes, con una inversión de 240 millones de quetzales del Ministerio de Comunicaciones.',
    alTraer: { informacion: 0.96, hechos: 0.97, lista: 0.8 },
    alVer: {
      narrativa: 'Anuncio institucional: informa el avance de tres obras de transporte, con fechas y montos, sin confrontar a nadie.',
      menciones: [m('Villa Canales', 'Territorio'), m('Ministerio de Comunicaciones', 'Entidad', { rol: 'de_paso' })],
      hechos: [
        h('La ruta norte tiene 12 kilómetros terminados y empieza a operar en marzo.', 0.97, 'La ruta norte ya tiene 12 kilómetros terminados y empieza a operar en marzo'),
        h('La ruta de Villa Canales arranca obras el próximo mes.', 0.93, 'la ruta de Villa Canales arranca obras el próximo mes', ['Villa Canales']),
      ],
      cantidades: [
        q('12', 'kilómetros terminados', 'ruta norte'),
        q('60%', 'avance de obra', 'ruta sur'),
        q('Q240 millones', 'inversión', 'ruta de Villa Canales'),
      ],
      listas: [{ titulo: 'Rutas nuevas', items: [item('Ruta norte', 'opera desde marzo'), item('Ruta sur', 'va al 60 por ciento'), item('Ruta de Villa Canales', 'arranca obras el próximo mes', 'Villa Canales')] }],
      temas: ['transporte público', 'obra pública'],
    },
    vistazo: { que_se_ve: 'Una mujer habla a cámara en una oficina, con una bandera detrás.', personas: 1 },
  }),

  caso({
    n: 2, titulo: 'Opinión a cámara', cuenta: 'Diego Paredes',
    texto: 'Lo que nadie dice del aumento al pasaje.',
    dicho: 'A mí me parece una burla. Suben el pasaje y el servicio sigue igual de malo. El Concejo Municipal aprobó el aumento el martes sin escuchar a nadie. Lo justo sería congelar la tarifa hasta que mejoren las unidades.',
    alTraer: { opinion: 0.97, hechos: 0.71, informacion: 0.34 },
    alVer: {
      narrativa: 'Crítica directa al aumento del pasaje: lo presenta como una decisión tomada a espaldas de la gente y pide congelar la tarifa.',
      menciones: [m('Concejo Municipal', 'Entidad')],
      hechos: [
        h('El Concejo Municipal aprobó el aumento al pasaje el martes.', 0.94, 'El Concejo Municipal aprobó el aumento el martes', ['Concejo Municipal']),
        h('El servicio sigue igual de malo después del aumento.', 0.38),
      ],
      temas: ['transporte', 'tarifas'],
    },
    vistazo: { que_se_ve: 'Un hombre habla a cámara desde la calle, con buses pasando detrás.', personas: 1 },
  }),

  caso({
    n: 3, titulo: 'A cámara en otro idioma', cuenta: 'Lena Hartmann',
    texto: 'Warum die Mieten in Berlin weiter steigen.',
    dicho: 'Die Mieten in Berlin sind in fünf Jahren um 40 Prozent gestiegen. Der Senat hat den Mietendeckel versprochen und nicht geliefert.',
    alTraer: { opinion: 0.81, hechos: 0.92, informacion: 0.55 },
    alVer: {
      narrativa: 'Reclamo por el alza de los alquileres en Berlín: responsabiliza al gobierno de la ciudad por no cumplir el tope prometido.',
      menciones: [m('Berlin', 'Territorio'), m('Senat', 'Entidad', { pista: 'gobierno de la ciudad de Berlín' }), m('Alemania', 'Territorio', { en_texto: false, pista: 'país donde ocurre' })],
      hechos: [h('Los alquileres en Berlín subieron 40 por ciento en cinco años.', 0.96, 'Die Mieten in Berlin sind in fünf Jahren um 40 Prozent gestiegen', ['Berlin'])],
      cantidades: [q('40%', 'aumento de alquileres', 'Berlín', 'en cinco años')],
      temas: ['vivienda', 'alquileres'],
    },
    vistazo: { que_se_ve: 'Una mujer habla a cámara en un apartamento.', personas: 1 },
  }),

  caso({
    n: 4, titulo: 'Entrevista o podcast de dos', cuenta: 'Sin Filtro Podcast',
    texto: 'Hablamos con la economista Carla Ruiz sobre remesas.',
    dicho: '¿Cuánto pesan las remesas hoy? Mirá, las remesas ya son casi el 20 por ciento del PIB. Eso es más que todas las exportaciones juntas. ¿Y eso es bueno? Es un salvavidas, pero también una dependencia. En mi libro La economía que se fue lo explico con calma.',
    alTraer: { informacion: 0.74, hechos: 0.9, aprendizaje: 0.41, opinion: 0.52 },
    alVer: {
      narrativa: 'Conversación explicativa: la invitada dimensiona el peso de las remesas y advierte sobre la dependencia que generan.',
      menciones: [m('Carla Ruiz', 'Actor', { pista: 'economista, invitada' }), ref('La economía que se fue', 'book', 'libro de Carla Ruiz')],
      hechos: [h('Las remesas equivalen a casi el 20 por ciento del PIB.', 0.95, 'las remesas ya son casi el 20 por ciento del PIB', ['Carla Ruiz'])],
      cantidades: [q('20%', 'remesas', 'PIB')],
      aprender: {
        idea: 'Por qué las remesas sostienen la economía y a la vez la vuelven dependiente.',
        puntos: [
          'Las remesas ya equivalen a casi una quinta parte de todo lo que produce el país.',
          'Entra más dinero por remesas que por todas las exportaciones juntas.',
          'Sostienen el consumo de las familias, pero dependen de la economía de otro país.',
        ],
        contexto: 'La mayor parte de las remesas llega de personas que trabajan en Estados Unidos, así que una crisis o un cambio de política migratoria allá se siente de inmediato acá.',
        conceptos: [
          { termino: 'remesas', explicacion: 'El dinero que mandan a sus familias las personas que trabajan en otro país.' },
          { termino: 'PIB', explicacion: 'El valor de todo lo que un país produce en un año. Sirve para comparar el tamaño de una cosa contra el de la economía entera.' },
        ],
        pasos: [],
      },
      temas: ['remesas', 'economía'],
    },
    vistazo: { que_se_ve: 'Dos personas sentadas frente a micrófonos en un estudio; una pregunta y la otra responde.', personas: 2 },
  }),

  caso({
    n: 5, titulo: 'Noticia con voz en off sobre imágenes', cuenta: 'Noticiero Central',
    texto: 'Deslizamiento en la aldea El Carmen deja 40 familias evacuadas.',
    dicho: 'Las lluvias de anoche provocaron un deslizamiento en la aldea El Carmen. Conred reporta 40 familias evacuadas y tres viviendas destruidas. No hay personas fallecidas.',
    alTraer: { informacion: 0.98, hechos: 0.97 },
    alVer: {
      narrativa: 'Nota informativa de emergencia, sin valoración: qué pasó, dónde y cuántos afectados.',
      menciones: [m('El Carmen', 'Territorio', { pista: 'aldea' }), m('Conred', 'Entidad', { rol: 'de_paso' })],
      hechos: [
        h('Un deslizamiento afectó la aldea El Carmen tras las lluvias.', 0.95, 'Las lluvias de anoche provocaron un deslizamiento en la aldea El Carmen', ['El Carmen']),
        h('Conred reporta 40 familias evacuadas y tres viviendas destruidas.', 0.97, 'Conred reporta 40 familias evacuadas y tres viviendas destruidas', ['Conred']),
      ],
      cantidades: [q('40', 'familias evacuadas', 'aldea El Carmen'), q('3', 'viviendas destruidas', 'aldea El Carmen')],
      temas: ['emergencia', 'lluvias'],
    },
    vistazo: { que_se_ve: 'Tomas aéreas de una ladera con casas cubiertas de lodo y brigadas trabajando.', personas: 6, texto_en_pantalla: 'ÚLTIMA HORA · El Carmen, San Marcos' },
  }),

  caso({
    n: 6, titulo: 'Medio que da cifras y cita fuente', cuenta: 'Datos Abiertos',
    texto: 'La canasta básica subió otra vez, según el INE.',
    dicho: 'Según el INE, la canasta básica costó 3,850 quetzales en septiembre, 210 más que hace un año. El salario mínimo es de 3,400.',
    alTraer: { informacion: 0.97, hechos: 0.98 },
    alVer: {
      narrativa: 'Dato duro con fuente: compara el costo de la canasta con el salario mínimo y deja que el contraste hable.',
      menciones: [m('INE', 'Source', { pista: 'Instituto Nacional de Estadística', rol: 'de_paso' })],
      hechos: [h('La canasta básica costó 3,850 quetzales en septiembre, según el INE.', 0.98, 'la canasta básica costó 3,850 quetzales en septiembre', ['INE'])],
      cantidades: [
        q('Q3,850', 'canasta básica', null, 'septiembre'),
        q('Q210', 'aumento', 'canasta básica', 'en un año'),
        q('Q3,400', 'salario mínimo', null, 'al mes'),
      ],
      temas: ['costo de vida'],
    },
    vistazo: { que_se_ve: 'Una gráfica de barras animada con el precio de la canasta básica mes a mes.', personas: 0, texto_en_pantalla: 'Canasta básica: Q3,850 · Fuente: INE' },
  }),

  caso({
    n: 7, titulo: 'Escena de película', cuenta: 'cinefilos.gt',
    texto: 'Esta escena me rompe cada vez 💔',
    dicho: 'No quiero que te vayas. Lo sé, mi amor. Pero puedes decirlo. Solo tienes que decir la verdad.',
    alTraer: { narrativa: 0.92, opinion: 0.31 },
    tiposAlVer: { narrativa: 0.95 },
    alVer: {
      narrativa: 'Comparte una escena por lo que le provoca; el diálogo es de la película, no de la cuenta.',
      temas: ['cine'],
    },
    vistazo: {
      que_se_ve: 'Un niño abraza a su madre en una cama de hospital; imagen de película, con barras negras arriba y abajo.',
      personas: 2, obra: 'pelicula', audio_propio: false,
      obra_identificada: { titulo: 'Un monstruo viene a verme', clase: 'pelicula', anio: '2016', relacion: 'escena' },
    },
  }),

  caso({
    n: 8, titulo: 'Comedia con audio de película', cuenta: 'la.chilera',
    texto: 'Yo cuando el jefe pregunta quién va a quedarse el viernes 😭',
    dicho: 'Todo es increíble, todo es mejor cuando formas parte de un equipo.',
    alTraer: { comedia: 0.63, baile_tendencia: 0.48 },
    tiposAlVer: { comedia: 0.84, baile_tendencia: 0.41 },
    alVer: {
      narrativa: 'Chiste de oficina: usa un audio conocido para burlarse de las horas extra.',
      temas: ['humor', 'trabajo'],
    },
    vistazo: {
      que_se_ve: 'Una mujer en una oficina mueve los labios sobre el audio y sonríe forzado a cámara.',
      personas: 1, audio_propio: false, texto_en_pantalla: 'Yo cuando el jefe pregunta quién se queda el viernes',
      obra_identificada: { titulo: 'La gran aventura LEGO', clase: 'pelicula', anio: '2014', relacion: 'audio' },
    },
  }),

  caso({
    n: 9, titulo: 'Baile con canción', cuenta: 'andrea.baila',
    texto: 'Tenía que hacerlo 💃 #trend',
    dicho: null,
    alTraer: { baile_tendencia: 0.96 },
    alVer: { narrativa: 'Participa en un baile que está circulando; no dice nada más.', temas: ['baile'] },
    vistazo: { que_se_ve: 'Una mujer baila una coreografía en la sala de su casa.', personas: 1, audio_propio: false },
  }),

  caso({
    n: 10, titulo: 'Música y frases en pantalla', cuenta: 'frases.para.pensar',
    texto: '🌿',
    dicho: null,
    alTraer: { opinion: 0.35 },
    tiposAlVer: { opinion: 0.78, lista: 0.52 },
    alVer: {
      narrativa: 'Mensaje motivacional: propone soltar lo que no depende de uno.',
      listas: [{ titulo: 'Lo que no te toca cargar', items: [item('Lo que piensan de vos'), item('Lo que ya pasó'), item('Lo que otros deciden')] }],
      temas: ['motivación'],
    },
    vistazo: {
      que_se_ve: 'Un atardecer en la playa con frases que van apareciendo una por una.',
      personas: 0, texto_en_pantalla: 'No te toca cargar: lo que piensan de vos, lo que ya pasó, lo que otros deciden.',
    },
  }),

  caso({
    n: 11, titulo: 'Video sin audio ni texto', cuenta: 'rodri_fotos',
    texto: '',
    dicho: null,
    alTraer: { narrativa: 0.2 },
    tiposAlVer: { narrativa: 0.36 },
    alVer: { narrativa: 'Un paisaje, sin mensaje.' },
    vistazo: { que_se_ve: 'Una toma fija del volcán de Fuego echando humo al amanecer.', personas: 0 },
  }),

  caso({
    n: 12, titulo: 'Reseña de un restaurante', cuenta: 'comer.en.guate',
    texto: 'El mejor ramen de la zona 4, sin discusión.',
    dicho: 'Vine a Kodama, en la zona 4, y el tonkotsu es de otro nivel. El plato cuesta 85 quetzales y alcanza para dos. Pidan también las gyozas.',
    alTraer: { opinion: 0.88, informacion: 0.42 },
    alVer: {
      narrativa: 'Recomendación entusiasta de un lugar para comer, con precio y qué pedir.',
      menciones: [
        ref('Kodama', 'place', 'restaurante en la zona 4', { fuente: 'apple_maps', titulo: 'Kodama Ramen' }),
        ref('tonkotsu', 'food', 'ramen de caldo de cerdo'),
        ref('gyozas', 'food'),
      ],
      cantidades: [q('Q85', 'tonkotsu', 'Kodama')],
      temas: ['comida', 'restaurantes'],
    },
    vistazo: { que_se_ve: 'Un tazón de ramen humeante y después la fachada del local.', personas: 1, texto_en_pantalla: 'KODAMA · 4 Grados Norte' },
  }),

  caso({
    n: 13, titulo: 'Lista de lugares', cuenta: 'ruta.chapina',
    texto: '5 lugares en Antigua que no son el Arco.',
    dicho: 'Cinco lugares en Antigua que casi nadie visita. Uno, el Cerro de la Cruz al amanecer. Dos, el convento de Capuchinas. Tres, Caoba Farms para desayunar. Cuatro, el mercado de artesanías. Y cinco, la finca Filadelfia para el tour de café.',
    alTraer: { lista: 0.98, informacion: 0.4 },
    alVer: {
      narrativa: 'Guía corta de viaje: cinco paradas fuera del recorrido típico.',
      menciones: [
        m('Antigua', 'Territorio'),
        ref('Cerro de la Cruz', 'place', 'mirador', { fuente: 'apple_maps', titulo: 'Cerro de la Cruz' }),
        ref('Capuchinas', 'place', 'convento', { fuente: 'apple_maps', titulo: 'Convento de Capuchinas' }),
        ref('Caoba Farms', 'place', 'restaurante y huerto', { fuente: 'apple_maps', titulo: 'Caoba Farms' }),
        ref('finca Filadelfia', 'place', 'finca de café'),
      ],
      listas: [{
        titulo: 'Lugares en Antigua',
        items: [
          item('Cerro de la Cruz', 'al amanecer', 'Cerro de la Cruz'),
          item('Convento de Capuchinas', null, 'Capuchinas'),
          item('Caoba Farms', 'para desayunar', 'Caoba Farms'),
          item('Mercado de artesanías'),
          item('Finca Filadelfia', 'tour de café', 'finca Filadelfia'),
        ],
      }],
      temas: ['viajes', 'Antigua'],
    },
    vistazo: { que_se_ve: 'Tomas rápidas de calles empedradas, un mirador y un patio con arcos.', personas: 1, texto_en_pantalla: '1. Cerro de la Cruz  2. Capuchinas  3. Caoba Farms' },
  }),

  caso({
    n: 14, titulo: 'Receta', cuenta: 'cocina.con.tita',
    texto: 'Guacamole en cinco minutos 🥑',
    dicho: 'Hoy te enseño a hacer un guacamole en cinco minutos. Necesitas tres aguacates maduros, medio tomate picado, un cuarto de cebolla, el jugo de dos limones, cilantro y sal. Primero machacas los aguacates. Después agregas la cebolla, el tomate y el cilantro. Al final el limón y la sal.',
    alTraer: { aprendizaje: 0.95, lista: 0.44 },
    alVer: {
      narrativa: 'Receta rápida, paso a paso, sin relleno.',
      recetas: [{
        titulo: 'Guacamole',
        ingredientes: ['3 aguacates maduros', 'medio tomate picado', 'un cuarto de cebolla', 'el jugo de dos limones', 'cilantro', 'sal'],
        pasos: ['Machacar los aguacates con un tenedor.', 'Agregar la cebolla, el tomate y el cilantro.', 'Poner el limón y la sal, y mezclar.'],
      }],
      temas: ['cocina'],
    },
    vistazo: { que_se_ve: 'Unas manos machacan aguacate en un tazón sobre una mesa de madera.', personas: 1 },
  }),

  caso({
    n: 15, titulo: 'Lista de herramientas', cuenta: 'productivo.hoy',
    texto: '5 herramientas de IA que uso todos los días.',
    dicho: 'Cinco herramientas que uso a diario. Notion, para organizar proyectos. Claude, para escribir y revisar textos largos. Perplexity, para buscar con fuentes. ElevenLabs, para generar voces. Y CapCut, para editar videos.',
    alTraer: { lista: 0.97, aprendizaje: 0.62 },
    alVer: {
      narrativa: 'Recomendación práctica: cinco herramientas y para qué sirve cada una.',
      menciones: [ref('Notion', 'tool'), ref('Claude', 'tool'), ref('Perplexity', 'tool'), ref('ElevenLabs', 'tool'), ref('CapCut', 'tool')],
      listas: [{
        titulo: 'Herramientas de IA',
        items: [
          item('Notion', 'organizar proyectos', 'Notion'),
          item('Claude', 'escribir y revisar textos largos', 'Claude'),
          item('Perplexity', 'buscar con fuentes', 'Perplexity'),
          item('ElevenLabs', 'generar voces', 'ElevenLabs'),
          item('CapCut', 'editar videos', 'CapCut'),
        ],
      }],
      temas: ['productividad', 'inteligencia artificial'],
    },
    vistazo: { que_se_ve: 'Una persona frente a su computadora; van apareciendo los logos de cada aplicación.', personas: 1 },
  }),

  caso({
    n: 16, titulo: 'Recomendación de libros', cuenta: 'leo.de.noche',
    texto: 'Tres libros que me cambiaron el año.',
    dicho: 'Tres libros que me cambiaron el año. Hábitos atómicos, de James Clear. El infinito en un junco, de Irene Vallejo. Y Sapiens, de Yuval Noah Harari.',
    alTraer: { lista: 0.93, opinion: 0.71 },
    alVer: {
      narrativa: 'Recomendación personal de lecturas, sin reseñarlas.',
      menciones: [
        ref('Hábitos atómicos', 'book', 'libro de James Clear', { fuente: 'openlibrary', titulo: 'Hábitos atómicos', anio: '2018' }),
        ref('El infinito en un junco', 'book', 'libro de Irene Vallejo', { fuente: 'openlibrary', titulo: 'El infinito en un junco', anio: '2019' }),
        ref('Sapiens', 'book', 'libro de Yuval Noah Harari', { fuente: 'openlibrary', titulo: 'Sapiens', anio: '2011' }),
      ],
      listas: [{ titulo: 'Libros', items: [item('Hábitos atómicos', 'James Clear', 'Hábitos atómicos'), item('El infinito en un junco', 'Irene Vallejo', 'El infinito en un junco'), item('Sapiens', 'Yuval Noah Harari', 'Sapiens')] }],
      temas: ['lectura'],
    },
    vistazo: { que_se_ve: 'Una persona muestra tres portadas de libros, una por una.', personas: 1 },
  }),

  caso({
    n: 17, titulo: 'Videojuego', cuenta: 'pixel.gt',
    texto: 'Este jefe me tomó tres horas 😤',
    dicho: 'Miren esto, tercera fase y todavía le queda media vida. Este juego no perdona.',
    alTraer: { narrativa: 0.44, opinion: 0.4 },
    tiposAlVer: { narrativa: 0.5, opinion: 0.42 },
    alVer: {
      narrativa: 'Comparte una partida difícil; el nombre del juego solo se sabe por lo que se ve.',
      menciones: [ref('Hollow Knight', 'game', 'videojuego', null)].map((x) => ({ ...x, en_texto: false })),
      temas: ['videojuegos'],
    },
    vistazo: { que_se_ve: 'Una partida de un juego de plataformas en 2D: un personaje pequeño pelea contra un jefe.', personas: 0, texto_en_pantalla: 'HOLLOW KNIGHT' },
  }),

  caso({
    n: 18, titulo: 'Tutorial con pantalla grabada', cuenta: 'excel.facil',
    texto: 'Cómo hacer una tabla dinámica en 30 segundos.',
    dicho: 'Seleccionás tus datos, vas a Insertar y elegís Tabla dinámica. Arrastrás la categoría a filas y el monto a valores. Y listo, ya tenés el resumen.',
    alTraer: { aprendizaje: 0.98, lista: 0.47 },
    alVer: {
      narrativa: 'Tutorial directo: tres pasos para resumir datos.',
      menciones: [ref('Excel', 'tool', 'hoja de cálculo')].map((x) => ({ ...x, en_texto: false })),
      aprender: {
        idea: 'Cómo resumir una tabla de datos sin escribir fórmulas.',
        conceptos: [{ termino: 'tabla dinámica', explicacion: 'Una herramienta que agrupa y suma tus datos por categoría con solo arrastrar columnas, sin fórmulas.' }],
        pasos: ['Seleccionar los datos.', 'Ir a Insertar y elegir Tabla dinámica.', 'Arrastrar la categoría a filas y el monto a valores.'],
      },
      temas: ['hojas de cálculo'],
    },
    vistazo: { que_se_ve: 'La pantalla de una hoja de cálculo; el cursor abre el menú Insertar.', personas: 0, texto_en_pantalla: 'Insertar › Tabla dinámica' },
  }),

  caso({
    n: 19, titulo: 'Carrusel de láminas con texto', cuenta: 'Justicia Clara', carrusel: true,
    texto: '¿Cómo se elige a los magistrados? Deslizá 👉',
    alTraer: { aprendizaje: 0.7, informacion: 0.55 },
    tiposAlVer: { aprendizaje: 0.91, hechos: 0.88, lista: 0.74 },
    alVer: {
      narrativa: 'Explicación en láminas del proceso de elección de magistrados, con una crítica al final.',
      menciones: [m('Congreso', 'Entidad', { en_texto: false }), m('comisiones de postulación', 'Historia', { en_texto: false })],
      hechos: [h('El Congreso elige a los magistrados cada cinco años.', 0.96), h('Las comisiones de postulación arman la lista de candidatos.', 0.9)],
      cantidades: [q('5', 'años', 'renovación de las cortes'), q('13', 'magistrados', 'Corte Suprema')],
      aprender: {
        idea: 'Quién elige a los magistrados y en qué pasos.',
        puntos: ['A los magistrados no los elige la gente: los elige el Congreso.', 'El Congreso solo puede votar por quienes están en la lista de la comisión.', 'Todas las cortes se renuevan al mismo tiempo, cada cinco años.'],
        conceptos: [{ termino: 'comisión de postulación', explicacion: 'Un grupo de decanos, abogados y jueces que revisa a los aspirantes y le manda una lista al Congreso.' }],
        pasos: ['Se convoca a los aspirantes.', 'La comisión de postulación arma la lista.', 'El Congreso vota.'],
      },
      temas: ['justicia'],
    },
    vistazo: { que_se_ve: 'Seis láminas con texto grande sobre fondo azul.', personas: 0, texto_en_pantalla: '1. Se convoca a los aspirantes. 2. La comisión de postulación arma la lista. 3. El Congreso vota. Las cortes se renuevan cada 5 años.' },
  }),

  caso({
    n: 20, titulo: 'Carrusel de fotos sin texto', cuenta: 'vale.mtz', carrusel: true,
    texto: 'Semuc 🌊',
    alTraer: { narrativa: 0.3 },
    tiposAlVer: { narrativa: 0.41 },
    alVer: {
      narrativa: 'Fotos de un viaje; lo único que dice es dónde.',
      menciones: [ref('Semuc', 'place', 'Semuc Champey', { fuente: 'apple_maps', titulo: 'Semuc Champey' })],
      temas: ['viajes'],
    },
    vistazo: { que_se_ve: 'Cuatro fotos: pozas de agua turquesa entre la selva, y dos personas nadando.', personas: 2 },
  }),

  caso({
    n: 21, titulo: 'Imagen única tipo meme', cuenta: 'memes.chapines', carrusel: true,
    texto: 'jajaja 😂',
    alTraer: { comedia: 0.72 },
    tiposAlVer: { comedia: 0.93 },
    alVer: { narrativa: 'Un chiste sobre el tráfico.', temas: ['humor'] },
    vistazo: { que_se_ve: 'Una foto de una fila de carros con un texto encima.', personas: 0, texto_en_pantalla: 'Yo saliendo a las 5 para llegar a las 8' },
  }),

  caso({
    n: 22, titulo: 'Tendencia de cultura pop', cuenta: 'mamis.modernas',
    texto: 'Las mamás también podemos 😎 #trend',
    dicho: null,
    alTraer: { baile_tendencia: 0.9, comedia: 0.38 },
    tiposAlVer: { baile_tendencia: 0.95, comedia: 0.46 },
    alVer: { narrativa: 'Se suma a una tendencia que mezcla escenas familiares con una canción hecha con IA.', temas: ['tendencias', 'maternidad'] },
    vistazo: { que_se_ve: 'Tres mujeres hacen el mismo gesto frente a la cámara, con cortes al ritmo de la música.', personas: 3, audio_propio: false, texto_en_pantalla: 'POV: sos la mamá divertida' },
  }),

  caso({
    n: 23, titulo: 'Finanzas o post con números', cuenta: 'Edgar Solís',
    texto: 'Nuevo impuesto a inmuebles: ¿cuánto vas a pagar?',
    dicho: 'Con la reforma, una casa de 500 mil quetzales paga 9 por millar, o sea 4,500 quetzales al año. Los inmuebles de menos de 70 mil quetzales no pagan. Y si la vendés en 700 mil, la ganancia de 200 mil paga 10 por ciento de impuesto sobre la renta.',
    alTraer: { informacion: 0.94, hechos: 0.97, aprendizaje: 0.88 },
    alVer: {
      narrativa: 'Explicación con ejemplos de cuánto se paga con la reforma; informa más que opina.',
      menciones: [m('impuesto sobre la renta', 'Historia', { rol: 'de_paso' })],
      hechos: [h('Los inmuebles de menos de 70 mil quetzales no pagan el impuesto.', 0.95, 'Los inmuebles de menos de 70 mil quetzales no pagan')],
      cantidades: [
        q('9‰', 'tasa del impuesto', 'inmuebles de más de 70 mil quetzales', 'al año'),
        q('Q4,500', 'impuesto', 'casa de Q500 mil', 'al año'),
        q('Q70 mil', 'valor desde el que se paga'),
        q('Q200 mil', 'ganancia', 'venta de una casa'),
        q('10%', 'impuesto', 'ganancia de la venta'),
      ],
      aprender: {
        idea: 'Cómo se calcula el impuesto de una casa y qué pasa al venderla.',
        puntos: [
          'El impuesto se cobra sobre el valor del inmueble: 9 quetzales por cada mil.',
          'Una casa de 500 mil quetzales paga 4,500 al año.',
          'Los inmuebles de menos de 70 mil quetzales no pagan.',
          'Al vender, se paga 10 por ciento sobre la ganancia, no sobre el precio.',
        ],
        contexto: 'El impuesto a los inmuebles lo cobran las municipalidades y es una de sus principales fuentes de ingresos propios. El impuesto sobre la ganancia al vender es aparte y va al gobierno central.',
        conceptos: [
          { termino: 'por millar', explicacion: 'Cuánto se paga por cada mil. Nueve por millar es 9 quetzales por cada 1,000 del valor.' },
          { termino: 'ganancia de capital', explicacion: 'La diferencia entre lo que pagaste por algo y el precio al que lo vendés.' },
        ],
        pasos: [],
      },
      temas: ['impuestos', 'vivienda'],
    },
    vistazo: { que_se_ve: 'Un hombre habla a cámara con una pizarra detrás.', personas: 1 },
  }),

  caso({
    n: 24, titulo: 'Contenido educativo', cuenta: 'Historia en corto',
    texto: '¿Qué fue la Revolución de 1944?',
    dicho: 'En octubre de 1944 un movimiento de estudiantes, maestros y militares jóvenes derrocó a Federico Ponce Vaides. Empezaron diez años que se conocen como la primavera democrática, con el Código de Trabajo y el seguro social.',
    alTraer: { aprendizaje: 0.94, hechos: 0.93, informacion: 0.5 },
    alVer: {
      narrativa: 'Clase breve de historia: qué pasó, quiénes y qué dejó.',
      menciones: [m('Federico Ponce Vaides', 'Actor'), m('Revolución de 1944', 'Evento', { en_texto: false }), m('Código de Trabajo', 'Objeto')],
      hechos: [h('En octubre de 1944 fue derrocado Federico Ponce Vaides.', 0.97, 'derrocó a Federico Ponce Vaides', ['Federico Ponce Vaides'])],
      cantidades: [q('10', 'años', 'primavera democrática', '1944 a 1954')],
      aprender: {
        idea: 'Qué fue la Revolución de 1944 y por qué se la recuerda.',
        puntos: [
          'En octubre de 1944, estudiantes, maestros y militares jóvenes sacaron del poder a Federico Ponce Vaides.',
          'Con eso empezaron diez años de gobiernos electos, conocidos como la primavera democrática.',
          'De ese período salieron el Código de Trabajo y el seguro social.',
        ],
        contexto: 'Ponce Vaides había quedado en el poder tras la renuncia de Jorge Ubico, que gobernó catorce años. Los dos gobiernos que siguieron fueron los de Juan José Arévalo y Jacobo Árbenz; el período terminó en 1954 con el derrocamiento de Árbenz.',
        preguntas: ['¿Qué cambió el Código de Trabajo para quienes trabajaban en fincas?', '¿Por qué terminó la primavera democrática?'],
        conceptos: [
          { termino: 'primavera democrática', explicacion: 'Los diez años, de 1944 a 1954, en que Guatemala tuvo gobiernos electos y reformas sociales.' },
          { termino: 'seguro social', explicacion: 'Un sistema en el que trabajadores y patronos aportan para cubrir salud y jubilación.' },
        ],
        pasos: [],
      },
      temas: ['historia de Guatemala'],
    },
    vistazo: { que_se_ve: 'Fotografías antiguas en blanco y negro de una plaza llena de gente.', personas: 0 },
  }),
];
