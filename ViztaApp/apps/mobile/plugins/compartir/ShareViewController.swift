import SwiftUI
import UIKit
import Security
import UniformTypeIdentifiers

/**
 Mandar un post a Vizta desde «Compartir».

 Esto corre dentro de Instagram o de X, no dentro de Vizta: es otro proceso, sin
 React Native y sin la sesión de la persona. Hace una sola cosa: toma el enlace
 que le pasan, se lo manda al servidor con la llave de compartir que la app dejó
 en el llavero, y dice «contenido enviado». Traer el post —bajarlo, transcribirlo—
 lo hace el servidor después, igual que cuando se pega el enlace en la app.

 Los valores `Vizta…` del Info.plist los escribe el plugin (`plugins/compartir`).
 */

// MARK: - Qué puede pasar

enum Estado: Equatable {
  case enviando
  case enviado
  case fallo(String)
}

// MARK: - El llavero

/// La llave que guardó la app con expo-secure-store. Expo le agrega `:no-auth`
/// al nombre del servicio; se prueban las dos formas por si eso cambia.
func leerLlave() -> String? {
  let info = Bundle.main.infoDictionary ?? [:]
  guard let grupo = info["ViztaGrupoLlavero"] as? String,
        let servicio = info["ViztaServicioLlavero"] as? String,
        let clave = info["ViztaClaveLlavero"] as? String else { return nil }

  for nombre in ["\(servicio):no-auth", servicio] {
    let consulta: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: nombre,
      kSecAttrAccount as String: Data(clave.utf8),
      kSecAttrAccessGroup as String: grupo,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var salida: CFTypeRef?
    if SecItemCopyMatching(consulta as CFDictionary, &salida) == errSecSuccess,
       let datos = salida as? Data,
       let texto = String(data: datos, encoding: .utf8),
       !texto.isEmpty {
      return texto
    }
  }
  return nil
}

// MARK: - El enlace

/// Los mismos enlaces que acepta la app: un post o un reel de Instagram, o un
/// tweet. Un perfil o una historia no son un post.
func esPost(_ url: URL) -> Bool {
  let s = url.absoluteString
  let patrones = [
    #"instagram\.com/(?:[^/]+/)?(?:p|reel|reels|tv)/[\w-]+"#,
    #"(?:x|twitter)\.com/[^/]+/status/\d+"#,
  ]
  return patrones.contains { s.range(of: $0, options: [.regularExpression, .caseInsensitive]) != nil }
}

/// El enlace de lo que se compartió. Instagram manda una URL; X a veces manda
/// texto con la URL adentro.
func enlaceCompartido(_ contexto: NSExtensionContext?) async -> URL? {
  let adjuntos = (contexto?.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }

  for a in adjuntos where a.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
    if let url = try? await a.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL { return url }
  }
  for a in adjuntos where a.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
    guard let texto = try? await a.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String,
          let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) else { continue }
    let rango = NSRange(texto.startIndex..., in: texto)
    if let url = detector.matches(in: texto, range: rango).compactMap({ $0.url }).first { return url }
  }
  return nil
}

// MARK: - El envío

func enviar(_ url: URL) async -> Estado {
  guard esPost(url) else { return .fallo("Ese enlace no es un post de Instagram ni de X.") }
  guard let llave = leerLlave() else { return .fallo("Abrí Vizta una vez para conectar tu cuenta.") }
  guard let servidor = Bundle.main.infoDictionary?["ViztaServidor"] as? String,
        let destino = URL(string: "\(servidor)/api/agregar-post/compartido") else {
    return .fallo("No se pudo enviar. Probá de nuevo.")
  }

  var pedido = URLRequest(url: destino, timeoutInterval: 20)
  pedido.httpMethod = "POST"
  pedido.setValue("application/json", forHTTPHeaderField: "Content-Type")
  pedido.setValue("Bearer \(llave)", forHTTPHeaderField: "Authorization")
  pedido.httpBody = try? JSONSerialization.data(withJSONObject: ["url": url.absoluteString])

  do {
    let (datos, respuesta) = try await URLSession.shared.data(for: pedido)
    let codigo = (respuesta as? HTTPURLResponse)?.statusCode ?? 0
    if (200..<300).contains(codigo) { return .enviado }
    // El servidor ya contesta con una frase para la persona; se muestra esa.
    let json = try? JSONSerialization.jsonObject(with: datos) as? [String: Any]
    if let mensaje = json?["message"] as? String, !mensaje.isEmpty { return .fallo(mensaje) }
    return .fallo(codigo == 402 ? "No podés agregar posts por ahora." : "No se pudo enviar. Probá de nuevo.")
  } catch {
    return .fallo("Sin conexión. Probá de nuevo.")
  }
}

// MARK: - La hoja

private let papel = Color(red: 0.992, green: 0.988, blue: 0.969)   // #FDFCF7
private let tinta = Color(red: 0.110, green: 0.169, blue: 0.133)   // #1C2B22
private let tenue = Color(red: 0.110, green: 0.169, blue: 0.133).opacity(0.38)
private let mono = "Menlo"

struct Hoja: View {
  let estado: Estado
  let detalle: String?
  let cerrar: () -> Void

  var body: some View {
    VStack(spacing: 0) {
      Spacer(minLength: 0)
      VStack(alignment: .leading, spacing: 14) {
        Text("vizta")
          .font(.custom(mono, size: 12))
          .foregroundColor(tenue)

        HStack(spacing: 12) {
          marca
          Text(titulo)
            .font(.custom(mono, size: 16))
            .foregroundColor(tinta)
            .fixedSize(horizontal: false, vertical: true)
        }

        if let detalle, !detalle.isEmpty {
          Text(detalle)
            .font(.custom(mono, size: 12))
            .foregroundColor(tenue)
            .lineLimit(1)
            .truncationMode(.middle)
        }

        if case .fallo = estado {
          Button(action: cerrar) {
            Text("cerrar")
              .font(.custom(mono, size: 13))
              .foregroundColor(tinta)
              .padding(.horizontal, 16)
              .padding(.vertical, 9)
              .overlay(Capsule().stroke(tinta.opacity(0.14), lineWidth: 1))
          }
          .padding(.top, 2)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 26)
      .padding(.top, 24)
      .padding(.bottom, 30)
      .background(papel)
      .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
      .padding(.horizontal, 10)
      .padding(.bottom, 10)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.black.opacity(0.28).ignoresSafeArea().onTapGesture { if estado != .enviando { cerrar() } })
    .animation(.easeOut(duration: 0.2), value: estado)
  }

  private var titulo: String {
    switch estado {
    case .enviando: return "enviando…"
    case .enviado: return "contenido enviado"
    case .fallo(let motivo): return motivo
    }
  }

  @ViewBuilder private var marca: some View {
    switch estado {
    case .enviando:
      ProgressView().tint(tinta)
    case .enviado:
      Image(systemName: "checkmark")
        .font(.system(size: 13, weight: .bold))
        .foregroundColor(papel)
        .frame(width: 24, height: 24)
        .background(Circle().fill(tinta))
    case .fallo:
      Image(systemName: "exclamationmark")
        .font(.system(size: 13, weight: .bold))
        .foregroundColor(Color(red: 0.725, green: 0.110, blue: 0.110))
        .frame(width: 24, height: 24)
        .overlay(Circle().stroke(Color(red: 0.725, green: 0.110, blue: 0.110).opacity(0.5), lineWidth: 1.5))
    }
  }
}

final class Modelo: ObservableObject {
  @Published var estado: Estado = .enviando
  @Published var detalle: String?
}

struct Raiz: View {
  @ObservedObject var modelo: Modelo
  let cerrar: () -> Void
  var body: some View { Hoja(estado: modelo.estado, detalle: modelo.detalle, cerrar: cerrar) }
}

// MARK: - El controlador

@objc(ShareViewController)
final class ShareViewController: UIViewController {
  private let modelo = Modelo()

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .clear

    let anfitrion = UIHostingController(rootView: Raiz(modelo: modelo, cerrar: { [weak self] in self?.terminar() }))
    anfitrion.view.backgroundColor = .clear
    addChild(anfitrion)
    anfitrion.view.frame = view.bounds
    anfitrion.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    view.addSubview(anfitrion.view)
    anfitrion.didMove(toParent: self)

    Task { @MainActor in
      guard let url = await enlaceCompartido(extensionContext) else {
        modelo.estado = .fallo("No hay ningún enlace para enviar.")
        return
      }
      // Lo que se está mandando, sin el rastreo que agrega la red al compartir.
      modelo.detalle = (url.host ?? "") + url.path
      let resultado = await enviar(url)
      modelo.estado = resultado
      if resultado == .enviado {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        // Se cierra sola: la persona sigue donde estaba.
        try? await Task.sleep(nanoseconds: 1_300_000_000)
        terminar()
      }
    }
  }

  private func terminar() {
    extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
  }
}
