import { Image } from 'react-native';

/**
 * Los íconos del Observatorio de la CC.
 *
 * Cada archivo se llama como el código que guarda la base (`LABORAL`,
 * `AMPARO_DENEGADO`, `NOMBRE_RESERVADO`…), así que el dato elige su ícono sin
 * tabla de traducción. Un código sin ícono no dibuja nada.
 */
const ICONO = {
  administrativo: require('../../../assets/stickers/cc/administrativo.png'),
  ambiental: require('../../../assets/stickers/cc/ambiental.png'),
  amparo_denegado: require('../../../assets/stickers/cc/amparo_denegado.png'),
  amparo_otorgado: require('../../../assets/stickers/cc/amparo_otorgado.png'),
  amparo_otorgado_parcialmente: require('../../../assets/stickers/cc/amparo_otorgado_parcialmente.png'),
  amparo_unica_instancia: require('../../../assets/stickers/cc/amparo_unica_instancia.png'),
  apelacion_amparo: require('../../../assets/stickers/cc/apelacion_amparo.png'),
  aprobado_y_suspendido: require('../../../assets/stickers/cc/aprobado_y_suspendido.png'),
  autoridad: require('../../../assets/stickers/cc/autoridad.png'),
  civil: require('../../../assets/stickers/cc/civil.png'),
  con_lugar: require('../../../assets/stickers/cc/con_lugar.png'),
  con_lugar_parcial: require('../../../assets/stickers/cc/con_lugar_parcial.png'),
  constitucional: require('../../../assets/stickers/cc/constitucional.png'),
  declara_sin_materia: require('../../../assets/stickers/cc/declara_sin_materia.png'),
  decretada: require('../../../assets/stickers/cc/decretada.png'),
  derechos_humanos: require('../../../assets/stickers/cc/derechos_humanos.png'),
  diputado: require('../../../assets/stickers/cc/diputado.png'),
  disciplinario: require('../../../assets/stickers/cc/disciplinario.png'),
  electoral: require('../../../assets/stickers/cc/electoral.png'),
  familia: require('../../../assets/stickers/cc/familia.png'),
  fiscal: require('../../../assets/stickers/cc/fiscal.png'),
  inconst_caso_concreto: require('../../../assets/stickers/cc/inconst_caso_concreto.png'),
  inconst_general: require('../../../assets/stickers/cc/inconst_general.png'),
  institucion: require('../../../assets/stickers/cc/institucion.png'),
  laboral: require('../../../assets/stickers/cc/laboral.png'),
  magistrado: require('../../../assets/stickers/cc/magistrado.png'),
  mercantil: require('../../../assets/stickers/cc/mercantil.png'),
  migratorio: require('../../../assets/stickers/cc/migratorio.png'),
  municipal: require('../../../assets/stickers/cc/municipal.png'),
  ninez_y_adolescencia: require('../../../assets/stickers/cc/ninez_y_adolescencia.png'),
  no_decretada: require('../../../assets/stickers/cc/no_decretada.png'),
  no_otorgado: require('../../../assets/stickers/cc/no_otorgado.png'),
  nombre_reservado: require('../../../assets/stickers/cc/nombre_reservado.png'),
  notarial_y_registral: require('../../../assets/stickers/cc/notarial_y_registral.png'),
  opinion_consultiva: require('../../../assets/stickers/cc/opinion_consultiva.png'),
  otorgado: require('../../../assets/stickers/cc/otorgado.png'),
  penal: require('../../../assets/stickers/cc/penal.png'),
  persona: require('../../../assets/stickers/cc/persona.png'),
  procesal_civil: require('../../../assets/stickers/cc/procesal_civil.png'),
  procesal_constitucional: require('../../../assets/stickers/cc/procesal_constitucional.png'),
  procesal_laboral: require('../../../assets/stickers/cc/procesal_laboral.png'),
  procesal_penal: require('../../../assets/stickers/cc/procesal_penal.png'),
  proyecto_en_discusion: require('../../../assets/stickers/cc/proyecto_en_discusion.png'),
  reconducido: require('../../../assets/stickers/cc/reconducido.png'),
  seguridad_social: require('../../../assets/stickers/cc/seguridad_social.png'),
  sin_lugar: require('../../../assets/stickers/cc/sin_lugar.png'),
  sin_materia: require('../../../assets/stickers/cc/sin_materia.png'),
  tributario: require('../../../assets/stickers/cc/tributario.png'),
  universitario_o_educativo: require('../../../assets/stickers/cc/universitario_o_educativo.png'),
  vigente: require('../../../assets/stickers/cc/vigente.png'),
};

export default function IconoCC({ codigo, size = 32, style }) {
  const fuente = ICONO[String(codigo || '').toLowerCase()];
  if (!fuente) return null;
  return <Image source={fuente} style={[{ width: size, height: size }, style]} resizeMode="contain" accessible={false} />;
}
