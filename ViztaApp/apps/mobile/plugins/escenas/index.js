/**
 * Escenas en iOS (UIScene).
 *
 * iOS 27 cierra al arrancar cualquier app compilada con su SDK que no use
 * escenas (`_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`). La
 * plantilla de Expo SDK 54 crea la ventana en el AppDelegate, a la antigua.
 *
 * Este plugin deja la carpeta `ios/` como la necesita iOS 27, y lo vuelve a
 * hacer en cada `expo prebuild`:
 *  1. declara la escena en Info.plist (`UIApplicationSceneManifest`);
 *  2. saca la creación de la ventana del AppDelegate y guarda sus opciones de
 *     arranque, que la escena necesita;
 *  3. suma `SceneDelegate.swift` al proyecto.
 */
const fs = require('fs');
const path = require('path');
const {
  IOSConfig,
  withAppDelegate,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
} = require('@expo/config-plugins');

const ARCHIVO = 'SceneDelegate.swift';

function conManifiesto(config) {
  return withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      // Una sola ventana: en el iPhone no hay otra forma de usar Vizta.
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return c;
  });
}

function conAppDelegate(config) {
  return withAppDelegate(config, (c) => {
    if (c.modResults.language !== 'swift') {
      throw new Error('[escenas] Se esperaba un AppDelegate en Swift');
    }
    let s = c.modResults.contents;
    if (s.includes('opcionesDeArranque')) return c;

    const propiedad = '  var reactNativeFactory: RCTReactNativeFactory?\n';
    const ventana = /\n#if os\(iOS\) \|\| os\(tvOS\)\n    window = UIWindow\(frame: UIScreen\.main\.bounds\)\n    factory\.startReactNative\(\n      withModuleName: "main",\n      in: window,\n      launchOptions: launchOptions\)\n#endif\n/;
    if (!s.includes(propiedad) || !ventana.test(s)) {
      throw new Error('[escenas] El AppDelegate cambió: revisar el plugin de escenas');
    }

    s = s.replace(
      propiedad,
      propiedad +
        '  // Las guarda para la escena: con escenas, la ventana se crea después,\n' +
        '  // en `SceneDelegate`, y React Native arranca ahí con estas opciones.\n' +
        '  var opcionesDeArranque: [UIApplication.LaunchOptionsKey: Any]?\n'
    );
    s = s.replace(
      ventana,
      '\n    // La ventana ya no se crea acá: la crea la escena (`SceneDelegate`),\n' +
        '    // que es lo que exige iOS 27.\n' +
        '    opcionesDeArranque = launchOptions\n'
    );
    c.modResults.contents = s;
    return c;
  });
}

function conArchivo(config) {
  return withDangerousMod(config, [
    'ios',
    (c) => {
      const destino = path.join(c.modRequest.platformProjectRoot, c.modRequest.projectName, ARCHIVO);
      fs.copyFileSync(path.join(__dirname, ARCHIVO), destino);
      return c;
    },
  ]);
}

function conProyecto(config) {
  return withXcodeProject(config, (c) => {
    const proyecto = c.modResults;
    const nombre = c.modRequest.projectName;
    const ruta = `${nombre}/${ARCHIVO}`;
    if (!proyecto.hasFile(ruta)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: ruta,
        groupName: nombre,
        project: proyecto,
      });
    }
    return c;
  });
}

module.exports = function conEscenas(config) {
  return conProyecto(conArchivo(conAppDelegate(conManifiesto(config))));
};
