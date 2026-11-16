// AsyncStorage no tiene módulo nativo en Jest: se usa el mock oficial.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// El loader de Vizta dibuja con Skia, que Jest no carga; en las pruebas no dibuja nada.
jest.mock('./src/components/MorphingInfinity', () => () => null);
