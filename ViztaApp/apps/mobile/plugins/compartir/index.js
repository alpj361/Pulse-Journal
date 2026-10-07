/**
 * «Compartir» en iOS (STA-230): la extensión que deja mandar un post a Vizta
 * desde Instagram o X.
 *
 * La carpeta `ios/` se genera con `expo prebuild`, así que la extensión no se
 * puede agregar a mano en Xcode: se perdería en la próxima regeneración. Este
 * plugin la vuelve a armar cada vez:
 *
 *  1. copia `ShareViewController.swift` y escribe el Info.plist y los permisos
 *     de la extensión en `ios/ViztaCompartir/`;
 *  2. suma el target al proyecto y lo incrusta en la app;
 *  3. le da a la app y a la extensión el mismo grupo de llavero, que es por
 *     donde la app le pasa la llave de compartir (`src/utils/compartir.js`).
 *
 * La extensión no usa React Native ni CocoaPods: es Swift solo. Arranca al
 * instante y no corre riesgo con el tope de memoria que iOS les pone a las
 * extensiones.
 *
 * Opciones (en `app.json`): `equipo` (el Team ID de Apple) y `servidor`.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withEntitlementsPlist, withXcodeProject } = require('@expo/config-plugins');
const plist = require('@expo/plist').default;

const NOMBRE = 'ViztaCompartir';
const FUENTE = 'ShareViewController.swift';
// Tienen que coincidir con `src/utils/compartir.js`.
const SERVICIO_LLAVERO = 'vizta.compartir';
const CLAVE_LLAVERO = 'llave';
const sufijoDeGrupo = (bundleId) => `${bundleId}.compartido`;

function infoPlist({ nombre, version, build, grupo, servidor }) {
  return plist.build({
    CFBundleDevelopmentRegion: '$(DEVELOPMENT_LANGUAGE)',
    CFBundleDisplayName: nombre,
    CFBundleExecutable: '$(EXECUTABLE_NAME)',
    CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
    CFBundleInfoDictionaryVersion: '6.0',
    CFBundleName: '$(PRODUCT_NAME)',
    CFBundlePackageType: '$(PRODUCT_BUNDLE_PACKAGE_TYPE)',
    // Apple exige que la extensión lleve la misma versión que la app.
    CFBundleShortVersionString: version,
    CFBundleVersion: build,
    ViztaServidor: servidor,
    ViztaGrupoLlavero: grupo,
    ViztaServicioLlavero: SERVICIO_LLAVERO,
    ViztaClaveLlavero: CLAVE_LLAVERO,
    NSExtension: {
      NSExtensionPointIdentifier: 'com.apple.share-services',
      NSExtensionPrincipalClass: 'ShareViewController',
      NSExtensionAttributes: {
        // Solo aparece cuando lo compartido es un enlace (o texto, que es como
        // lo manda X). Con fotos o videos sueltos Vizta no se ofrece.
        NSExtensionActivationRule: {
          NSExtensionActivationSupportsWebURLWithMaxCount: 1,
          NSExtensionActivationSupportsText: true,
        },
      },
    },
  });
}

function conArchivos(config, { equipo, servidor }) {
  return withDangerousMod(config, [
    'ios',
    (c) => {
      const carpeta = path.join(c.modRequest.platformProjectRoot, NOMBRE);
      fs.mkdirSync(carpeta, { recursive: true });
      fs.copyFileSync(path.join(__dirname, FUENTE), path.join(carpeta, FUENTE));

      const bundleId = c.ios?.bundleIdentifier;
      const grupo = `${equipo}.${sufijoDeGrupo(bundleId)}`;
      fs.writeFileSync(
        path.join(carpeta, 'Info.plist'),
        infoPlist({
          nombre: c.name || 'Vizta',
          version: c.version || '1.0',
          build: String(c.ios?.buildNumber || '1'),
          grupo,
          servidor,
        })
      );
      fs.writeFileSync(
        path.join(carpeta, `${NOMBRE}.entitlements`),
        plist.build({ 'keychain-access-groups': [`$(AppIdentifierPrefix)${sufijoDeGrupo(bundleId)}`] })
      );
      return c;
    },
  ]);
}

/**
 * El llavero compartido, del lado de la app.
 *
 * El grupo propio de la app va **primero**: el primero de la lista es donde se
 * guarda lo nuevo por defecto, y ahí vive la sesión. Si el compartido quedara
 * primero, la sesión se empezaría a guardar donde la extensión puede leerla.
 */
function conLlavero(config) {
  return withEntitlementsPlist(config, (c) => {
    const bundleId = c.ios?.bundleIdentifier;
    const grupos = new Set(c.modResults['keychain-access-groups'] || []);
    const propios = [`$(AppIdentifierPrefix)${bundleId}`, `$(AppIdentifierPrefix)${sufijoDeGrupo(bundleId)}`];
    c.modResults['keychain-access-groups'] = [...propios, ...[...grupos].filter((g) => !propios.includes(g))];
    return c;
  });
}

function conTarget(config, { equipo }) {
  return withXcodeProject(config, (c) => {
    const proyecto = c.modResults;
    // Ya está: `prebuild` sin `--clean` vuelve a pasar por acá con el proyecto
    // de la vez anterior. La librería guarda el nombre a veces con comillas.
    const targets = proyecto.pbxNativeTargetSection();
    const yaEsta = Object.values(targets).some((t) => t && typeof t === 'object' && String(t.name).replace(/"/g, '') === NOMBRE);
    if (yaEsta) return c;

    const bundleId = `${c.ios?.bundleIdentifier}.compartir`;
    const objetos = proyecto.hash.project.objects;
    // La librería da por hecho que estas secciones existen.
    objetos.PBXTargetDependency = objetos.PBXTargetDependency || {};
    objetos.PBXContainerItemProxy = objetos.PBXContainerItemProxy || {};

    // El grupo con los archivos, colgado de la raíz del proyecto.
    const grupo = proyecto.addPbxGroup([FUENTE, 'Info.plist', `${NOMBRE}.entitlements`], NOMBRE, NOMBRE);
    const raiz = proyecto.getFirstProject().firstProject.mainGroup;
    proyecto.addToPbxGroup(grupo.uuid, raiz);

    // `app_extension` además la incrusta en la app y la vuelve dependencia.
    const target = proyecto.addTarget(NOMBRE, 'app_extension', NOMBRE, bundleId);
    proyecto.addBuildPhase([FUENTE], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
    proyecto.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
    proyecto.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);

    const configuraciones = proyecto.pbxXCBuildConfigurationSection();
    for (const clave of Object.keys(configuraciones)) {
      const ajustes = configuraciones[clave].buildSettings;
      if (!ajustes || ajustes.PRODUCT_NAME !== `"${NOMBRE}"`) continue;
      Object.assign(ajustes, {
        PRODUCT_BUNDLE_IDENTIFIER: `"${bundleId}"`,
        INFOPLIST_FILE: `${NOMBRE}/Info.plist`,
        CODE_SIGN_ENTITLEMENTS: `${NOMBRE}/${NOMBRE}.entitlements`,
        CODE_SIGN_STYLE: 'Automatic',
        DEVELOPMENT_TEAM: equipo,
        IPHONEOS_DEPLOYMENT_TARGET: '15.1',
        SWIFT_VERSION: '5.0',
        TARGETED_DEVICE_FAMILY: '"1"',
        GENERATE_INFOPLIST_FILE: 'NO',
        SKIP_INSTALL: 'YES',
        // Una extensión solo puede usar las APIs que Apple marca como seguras.
        APPLICATION_EXTENSION_API_ONLY: 'YES',
        LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
      });
    }
    return c;
  });
}

module.exports = function conCompartir(config, opciones = {}) {
  const equipo = opciones.equipo;
  const servidor = opciones.servidor || 'https://server.standatpd.com';
  if (!equipo) throw new Error('[compartir] Falta `equipo`: el Team ID de Apple');
  const o = { equipo, servidor };
  return conTarget(conArchivos(conLlavero(config), o), o);
};
