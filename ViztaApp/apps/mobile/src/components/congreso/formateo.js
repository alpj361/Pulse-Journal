import { titular } from '../feed/congreso';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function fechaCorta(valor) {
  if (!valor) return '';
  const texto = String(valor);
  const [anio, mes, dia] = texto.slice(0, 10).split('-').map(Number);
  if (!anio || !mes || !dia) return texto;
  return `${dia} ${MESES[mes - 1]} ${anio}`;
}

const ESTADOS = {
  presentada: 'Presentada',
  conocio_pleno: 'Conoció el pleno',
  en_comision: 'En comisión',
  dictamen: 'Dictamen',
  primer_debate: 'Primer debate',
  segundo_debate: 'Segundo debate',
  tercer_debate: 'Tercer debate',
  aprobada: 'Aprobada',
  no_aprobada: 'No aprobada',
  'presentada, sin número': 'Presentada, sin número',
  necesita_revision: 'Necesita revisión',
};

export function etiquetaEstado(valor) {
  if (!valor) return '';
  const clave = String(valor).trim();
  if (ESTADOS[clave]) return ESTADOS[clave];
  return clave.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

const VOTOS = {
  'A FAVOR': 'a_favor',
  'EN CONTRA': 'en_contra',
  AUSENTE: 'ausente',
  LICENCIA: 'licencia',
};

export function claveVoto(valor) {
  return VOTOS[String(valor || '').trim().toUpperCase()] || 'ausente';
}

export function etiquetaVoto(valor) {
  const mapa = {
    a_favor: 'A favor',
    en_contra: 'En contra',
    ausente: 'Ausente',
    licencia: 'Licencia',
  };
  return mapa[claveVoto(valor)] || String(valor || '');
}

export function etiquetaResultado(valor) {
  if (!valor) return '';
  if (valor === 'aprobada') return 'Aprobada';
  if (valor === 'no_aprobada') return 'No aprobada';
  return etiquetaEstado(valor);
}

export function etiquetaTipoCc(valor) {
  if (!valor) return '';
  const bajo = String(valor).toLowerCase();
  if (bajo === 'sentencia') return 'Sentencia';
  if (bajo === 'auto') return 'Auto';
  return String(valor);
}

export function tituloLimpio(valor) {
  return titular(valor || '');
}

export function anioActual() {
  return new Date().getFullYear();
}
