import { StyleSheet } from 'react-native';
import { ACCENT, INK, RADIUS, SERIF } from '../theme';

/**
 * Tokens y estilos de Congreso y CC.
 *
 * Pablo puede retocar el diseño desde acá: colores, espacios, tipografía y
 * radios viven en este archivo. Las pantallas solo aplican nombres.
 */
export const SECCION = {
  congreso: {
    tinta: '#2F4A7A',
    lavado: 'rgba(47,74,122,0.08)',
    borde: 'rgba(47,74,122,0.16)',
  },
  cc: {
    tinta: '#5C4033',
    lavado: 'rgba(92,64,51,0.08)',
    borde: 'rgba(92,64,51,0.16)',
  },
};

export const VOTO_COLOR = {
  a_favor: ACCENT.green,
  en_contra: ACCENT.red,
  ausente: ACCENT.amber,
  licencia: ACCENT.neutral,
};

export const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
  },
  cuerpo: {
    flex: 1,
  },
  encabezado: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  volver: {
    alignSelf: 'flex-start',
    marginLeft: -6,
    marginBottom: 10,
    padding: 6,
  },
  titulo: {
    fontSize: 40,
    fontWeight: '800',
    color: INK.title,
    letterSpacing: -1.2,
    lineHeight: 44,
  },
  bajada: {
    fontSize: 14,
    color: INK.meta,
    marginTop: 6,
    lineHeight: 20,
  },
  segmentos: {
    marginHorizontal: 24,
    marginBottom: 14,
  },
  lista: {
    paddingHorizontal: 24,
    paddingBottom: 96,
  },
  fila: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(28,43,34,0.09)',
  },
  filaUltima: {
    borderBottomWidth: 0,
  },
  filaMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  etiqueta: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  filaTitulo: {
    fontFamily: SERIF,
    fontSize: 19,
    color: INK.title,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  filaTituloSans: {
    fontSize: 15,
    fontWeight: '700',
    color: INK.title,
    lineHeight: 21,
  },
  filaCuerpo: {
    fontSize: 13,
    color: INK.body,
    lineHeight: 19,
    marginTop: 6,
  },
  filaPie: {
    fontSize: 12,
    color: INK.meta,
    marginTop: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipTexto: {
    fontSize: 11,
    fontWeight: '700',
  },
  chipsFila: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  buscador: {
    marginHorizontal: 24,
    marginBottom: 12,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(28,43,34,0.05)',
    paddingHorizontal: 14,
    fontSize: 15,
    color: INK.title,
  },
  filtros: {
    paddingHorizontal: 24,
    marginBottom: 8,
    gap: 10,
  },
  estadoCaja: {
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
  },
  estadoTexto: {
    fontSize: 14,
    color: INK.meta,
    textAlign: 'center',
    lineHeight: 21,
  },
  reintentar: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(28,43,34,0.16)',
  },
  reintentarTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: INK.body,
  },
  cargarMas: {
    marginTop: 18,
    marginBottom: 8,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cargarMasTexto: {
    fontSize: 14,
    fontWeight: '700',
    color: INK.title,
  },
  detalleCaja: {
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  detalleTitulo: {
    fontFamily: SERIF,
    fontSize: 24,
    color: INK.title,
    lineHeight: 30,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  timelinePunto: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  timelineLinea: {
    position: 'absolute',
    left: 3,
    top: 16,
    bottom: -14,
    width: 1,
  },
  conteos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  conteo: {
    minWidth: 72,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  conteoNumero: {
    fontSize: 16,
    fontWeight: '800',
  },
  conteoLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  enlace: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    minHeight: 44,
  },
  enlaceTexto: {
    fontSize: 14,
    fontWeight: '700',
  },
  enlaces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 24,
    marginBottom: 22,
  },
  enlaceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  enlaceChipTexto: {
    fontSize: 13,
    fontWeight: '700',
  },
});
