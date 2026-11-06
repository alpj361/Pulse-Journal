// AsyncStorage no tiene módulo nativo en Jest: se usa el mock oficial.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
