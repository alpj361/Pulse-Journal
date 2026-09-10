/**
 * Las fotos de una noticia.
 *
 * El generador manda dos campos que dicen casi lo mismo: `imagen` —una sola URL,
 * la de portada— e `imagenes` —todas, con el handle de quien la publicó y el
 * tweet de origen—. Leerlos por separado en cada pantalla es cómo se termina
 * mostrando una foto en la tarjeta y otra distinta arriba del modal, o dando
 * crédito equivocado. Acá se resuelven una vez y las dos vistas piden lo mismo.
 *
 * La de portada va primero aunque venga después en el array: es la que eligió el
 * generador para representar la nota, y es la que se ve en la tarjeta. Si el
 * modal la mostrara en otro orden, abrir la noticia cambiaría la foto que uno
 * venía mirando.
 */
export function fotosDe(card) {
  const porUrl = new Map();

  for (const it of Array.isArray(card?.imagenes) ? card.imagenes : []) {
    const url = it?.url;
    if (!url) continue;
    // `tipo` solo aparece cuando el generador lo sabe. Se descarta lo que dice
    // no ser imagen —un mp4 en un <Image> no falla: queda en blanco— pero no lo
    // que simplemente no lo aclara.
    if (it.tipo && it.tipo !== 'image') continue;
    if (porUrl.has(url)) continue;
    porUrl.set(url, { url, usuario: it.usuario || null, tweetId: it.tweet_id || null });
  }

  if (card?.imagen && !porUrl.has(card.imagen)) {
    porUrl.set(card.imagen, { url: card.imagen, usuario: null, tweetId: null });
  }

  const fotos = [...porUrl.values()];
  if (card?.imagen) {
    const i = fotos.findIndex((f) => f.url === card.imagen);
    if (i > 0) fotos.unshift(fotos.splice(i, 1)[0]);
  }
  return fotos;
}

/** Solo la de portada, que es lo único que necesita la tarjeta. */
export function portadaDe(card) {
  return fotosDe(card)[0] || null;
}

/** «@uno y @otro», sin repetir, para el crédito al pie de la galería. */
export function creditoDe(fotos) {
  const handles = [...new Set((fotos || []).map((f) => f.usuario).filter(Boolean))];
  if (!handles.length) return null;
  if (handles.length === 1) return `@${handles[0]}`;
  if (handles.length === 2) return `@${handles[0]} y @${handles[1]}`;
  return `@${handles[0]}, @${handles[1]} y ${handles.length - 2} más`;
}
