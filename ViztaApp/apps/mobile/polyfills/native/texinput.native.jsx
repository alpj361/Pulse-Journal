import React from 'react';

/**
 * `TextInput` con un color de placeholder por defecto.
 *
 * `metro.config.js` intercepta la resolución **interna** de React Native
 * —`./Libraries/Components/TextInput/TextInput`— y la manda acá, así que este
 * archivo se carga como parte del arranque de RN, no después.
 *
 * **Por eso el `require` va adentro del render y no arriba.** Importar el
 * módulo real en el cuerpo del archivo obligaba a resolverlo mientras RN
 * todavía se estaba inicializando, y esa cadena toca el bridge: la app moría
 * antes de pintar con «Property 'MessageQueue' doesn't exist», un error que no
 * nombra ni este archivo ni el import que lo causa. Pidiéndolo al primer
 * render, el runtime ya existe y la cadena resuelve bien.
 *
 * Se memoiza en una variable de módulo: `require` ya cachea, pero saltarse la
 * llamada en cada render evita el costo de resolución repetida en listas
 * largas.
 */

let RNTextInput = null;

const TextInput = React.forwardRef((props, ref) => {
  if (!RNTextInput) {
    // La ruta absoluta a propósito: el alias de Metro es sobre el especificador
    // relativo, así que pedirlo así no vuelve a caer en este mismo archivo.
    RNTextInput = require('react-native/Libraries/Components/TextInput/TextInput').default;
  }

  return (
    <RNTextInput ref={ref} placeholderTextColor={props.placeholderTextColor || 'black'} {...props} />
  );
});

TextInput.displayName = 'TextInput';

export default TextInput;
