import SwiftUI
import CoreText
import Security
import UniformTypeIdentifiers
#if canImport(UIKit)
import UIKit
#endif

/**
 Mandar un post a Vizta desde «Compartir».

 Esto corre dentro de Instagram o de X, no dentro de Vizta: es otro proceso, sin
 React Native y sin la sesión de la persona. Toma el enlace que le pasan, se lo
 manda al servidor con la llave de compartir que la app dejó en el llavero, y
 dice «Contenido enviado». Traer el post —bajarlo, transcribirlo— lo hace el
 servidor después, igual que cuando se pega el enlace en la app.

 Mientras tanto la hoja deja elegir lo que en la app se haría después: a qué
 carpeta va y si se analiza al llegar. Es la misma superficie de la app —el
 cristal lechoso, la serif de los titulares, las etiquetas en versalitas, el
 verde del orbe—, no una hoja del sistema.

 Los valores `Vizta…` del Info.plist los escribe el plugin (`plugins/compartir`).
 */

// MARK: - Diseño
// (Entre esta marca y «Fin del diseño» no hay red ni llavero: es lo que dibuja
// `docs/compartir/dibujar.swift` para ver la hoja sin compilar la app.)

enum Estado: Equatable {
  case enviando
  case enviado
  case fallo(String)
}

struct Carpeta: Identifiable, Equatable {
  let id: String
  let nombre: String
}

/// Los tokens de `src/components/theme.js`, tal cual.
enum Tema {
  static let titulo = Color(red: 0.110, green: 0.169, blue: 0.133)   // INK.title  #1C2B22
  static let cuerpo = Color(red: 0.353, green: 0.420, blue: 0.376)   // INK.body   #5A6B60
  static let meta = Color(red: 0.541, green: 0.588, blue: 0.553)     // INK.meta   #8A968D
  static let tenue = Color(red: 0.655, green: 0.690, blue: 0.651)    // INK.faint  #A7B0A6
  static let orbe = Color(red: 0.243, green: 0.420, blue: 0.298)     // el verde del orbe #3E6B4C
  static let indigo = Color(red: 0.294, green: 0.310, blue: 0.651)   // ACCENT.indigo.ink #4B4FA6
  static let rojo = Color(red: 0.725, green: 0.110, blue: 0.110)     // ACCENT.red.ink #B91C1C
  static let velo = Color.white.opacity(0.58)                         // GLASS.fill
  static let filo = Color.white.opacity(0.9)                          // GLASS.rim
  static let sombra = Color(red: 0.145, green: 0.200, blue: 0.165)   // CARD_SHADOW #25332A
  static let radio: CGFloat = 28
  static let margen: CGFloat = 22

  /// La serif editorial de los titulares. Si no cargó, la serif del sistema.
  static func serif(_ t: CGFloat) -> Font {
    Fuentes.hayInstrument ? .custom("InstrumentSerif-Regular", size: t) : .system(size: t, design: .serif)
  }
  /// Las etiquetas de sección de la app: chicas, pesadas, espaciadas.
  static let etiqueta = Font.system(size: 10, weight: .heavy)
}

enum Fuentes {
  static var hayInstrument = false
  /// La registra desde el paquete de la extensión; no depende del Info.plist.
  static func cargar(_ url: URL?) {
    guard let url else { return }
    CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
    hayInstrument = true
  }
}

func vibrar(_ fuerte: Bool = false) {
  #if canImport(UIKit)
  if fuerte { UINotificationFeedbackGenerator().notificationOccurred(.success) }
  else { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
  #endif
}

/// El cristal de `GlassCard`: el fondo desenfocado, el velo lechoso encima, el
/// filo blanco y una línea de luz en el canto de arriba.
struct Cristal: View {
  var radio: CGFloat = Tema.radio
  var body: some View {
    let forma = RoundedRectangle(cornerRadius: radio, style: .continuous)
    ZStack {
      forma.fill(.ultraThinMaterial)
      forma.fill(Tema.velo)
      forma.strokeBorder(Tema.filo, lineWidth: 1)
      forma.strokeBorder(
        LinearGradient(colors: [Color.white.opacity(0.95), Color.white.opacity(0)], startPoint: .top, endPoint: .center),
        lineWidth: 1.5
      )
    }
    .shadow(color: Tema.sombra.opacity(0.22), radius: 18, x: 0, y: 8)
  }
}

/// El hundido al presionar de toda la app: corto y seco.
struct Hundido: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .scaleEffect(configuration.isPressed ? 0.96 : 1)
      .opacity(configuration.isPressed ? 0.85 : 1)
      .animation(.easeOut(duration: 0.09), value: configuration.isPressed)
  }
}

struct Chip: View {
  let texto: String
  let elegido: Bool
  let alTocar: () -> Void
  var body: some View {
    Button(action: alTocar) {
      Text(texto)
        .font(.system(size: 13.5, weight: elegido ? .semibold : .regular))
        .foregroundColor(elegido ? Tema.indigo : Tema.cuerpo)
        .lineLimit(1)
        .fixedSize()
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Capsule().fill(elegido ? Tema.indigo.opacity(0.10) : Tema.titulo.opacity(0.05)))
        .overlay(Capsule().strokeBorder(elegido ? Tema.indigo.opacity(0.28) : Tema.titulo.opacity(0.07), lineWidth: 1))
    }
    .buttonStyle(Hundido())
  }
}

/// El interruptor, dibujado acá para que sea el mismo en todos lados.
struct Interruptor: View {
  let prendido: Bool
  let alTocar: () -> Void
  var body: some View {
    Button(action: alTocar) {
      Capsule()
        .fill(prendido ? Tema.indigo : Tema.titulo.opacity(0.14))
        .frame(width: 48, height: 29)
        .overlay(
          Circle().fill(Color.white)
            .shadow(color: Color.black.opacity(0.14), radius: 2, x: 0, y: 1)
            .padding(2.5)
            .offset(x: prendido ? 9.5 : -9.5)
        )
        .animation(.spring(response: 0.26, dampingFraction: 0.78), value: prendido)
    }
    .buttonStyle(.plain)
  }
}

/// El círculo que dice en qué va: girando, hecho, o con un problema.
struct Marca: View {
  let estado: Estado
  var body: some View {
    ZStack {
      switch estado {
      case .enviando:
        Circle().strokeBorder(Tema.titulo.opacity(0.10), lineWidth: 2.5)
        Giro()
      case .enviado:
        Circle().fill(Tema.orbe)
        Image(systemName: "checkmark").font(.system(size: 15, weight: .bold)).foregroundColor(.white)
      case .fallo:
        Circle().fill(Tema.rojo.opacity(0.09))
        Circle().strokeBorder(Tema.rojo.opacity(0.35), lineWidth: 1.5)
        Image(systemName: "exclamationmark").font(.system(size: 15, weight: .bold)).foregroundColor(Tema.rojo)
      }
    }
    .frame(width: 38, height: 38)
    .transition(.scale(scale: 0.6).combined(with: .opacity))
    .id(estado == .enviando ? 0 : estado == .enviado ? 1 : 2)
  }
}

struct Giro: View {
  @State private var vuelta = false
  var body: some View {
    Circle()
      .trim(from: 0.08, to: 0.62)
      .stroke(Tema.orbe, style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
      .rotationEffect(.degrees(vuelta ? 360 : 0))
      .animation(.linear(duration: 0.9).repeatForever(autoreverses: false), value: vuelta)
      .onAppear { vuelta = true }
  }
}

struct Hoja: View {
  let estado: Estado
  let detalle: String?
  let carpetas: [Carpeta]
  let carpetaElegida: String?
  let analizar: Bool
  /// De 0 a 1: cuánto falta para que se cierre sola. `nil` si ya no se cierra.
  let cuenta: Double?
  let alElegirCarpeta: (String?) -> Void
  let alCambiarAnalizar: () -> Void
  let cerrar: () -> Void

  @State private var arrastre: CGFloat = 0

  var body: some View {
    VStack(spacing: 0) {
      Spacer(minLength: 0)
      tarjeta
        .offset(y: max(0, arrastre))
        .gesture(
          DragGesture(minimumDistance: 8)
            .onChanged { arrastre = $0.translation.height }
            .onEnded { g in
              if g.translation.height > 110 || g.predictedEndTranslation.height > 260 { cerrar() }
              else { withAnimation(.spring(response: 0.34, dampingFraction: 0.8)) { arrastre = 0 } }
            }
        )
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(
      Color.black.opacity(0.22 * (1 - Double(min(max(arrastre, 0), 240)) / 320))
        .ignoresSafeArea()
        .onTapGesture { if estado != .enviando { cerrar() } }
    )
  }

  private var tarjeta: some View {
    VStack(alignment: .leading, spacing: 0) {
      // El tirador y la cabecera.
      Capsule().fill(Tema.titulo.opacity(0.14)).frame(width: 38, height: 4.5)
        .frame(maxWidth: .infinity).padding(.top, 10).padding(.bottom, 14)

      HStack {
        Text("Vizta").font(.system(size: 17, weight: .heavy)).foregroundColor(Tema.titulo)
        Spacer()
        Button(action: cerrar) {
          Image(systemName: "xmark").font(.system(size: 11, weight: .bold)).foregroundColor(Tema.meta)
            .frame(width: 30, height: 30)
            .background(Circle().fill(Tema.titulo.opacity(0.05)))
        }
        .buttonStyle(Hundido())
      }

      // Qué pasó, en la serif de los titulares.
      HStack(alignment: .center, spacing: 14) {
        Marca(estado: estado)
        VStack(alignment: .leading, spacing: 3) {
          Text(titulo)
            .font(Tema.serif(esFallo ? 23 : 29))
            .foregroundColor(Tema.titulo)
            .lineSpacing(1)
            .fixedSize(horizontal: false, vertical: true)
          if let detalle, !detalle.isEmpty {
            Text(detalle).font(.system(size: 12.5)).foregroundColor(Tema.meta).lineLimit(1).truncationMode(.middle)
          }
        }
      }
      .padding(.top, 18)

      if estado == .enviado {
        opciones.transition(.opacity.combined(with: .offset(y: 10)))
      }

      boton.padding(.top, 22)
    }
    .padding(.horizontal, Tema.margen)
    .padding(.bottom, 20)
    .background(Cristal())
    .padding(.horizontal, 10)
    .padding(.bottom, 10)
    .animation(.spring(response: 0.42, dampingFraction: 0.82), value: estado)
    .animation(.spring(response: 0.3, dampingFraction: 0.85), value: carpetaElegida)
  }

  /// Lo que en la app se haría después de traerlo, a un toque.
  private var opciones: some View {
    VStack(alignment: .leading, spacing: 0) {
      if !carpetas.isEmpty {
        Text("CARPETA").font(Tema.etiqueta).tracking(1).foregroundColor(Tema.tenue)
          .padding(.top, 24).padding(.bottom, 10)
        ScrollView(.horizontal, showsIndicators: false) {
          HStack(spacing: 7) {
            Chip(texto: "Sin carpeta", elegido: carpetaElegida == nil) { alElegirCarpeta(nil) }
            ForEach(carpetas) { c in
              Chip(texto: c.nombre, elegido: carpetaElegida == c.id) { alElegirCarpeta(c.id) }
            }
          }
          .padding(.horizontal, Tema.margen)
        }
        .padding(.horizontal, -Tema.margen)
      }

      HStack(spacing: 12) {
        VStack(alignment: .leading, spacing: 2) {
          Text("Analizar al llegar").font(.system(size: 15, weight: .semibold)).foregroundColor(Tema.titulo)
          Text("Lo encontrás ya leído cuando abras Vizta.").font(.system(size: 12.5)).foregroundColor(Tema.meta)
        }
        Spacer(minLength: 8)
        Interruptor(prendido: analizar, alTocar: alCambiarAnalizar)
      }
      .padding(.top, 22)
    }
  }

  private var boton: some View {
    Button(action: cerrar) {
      ZStack {
        Capsule().fill(esFallo ? Tema.titulo.opacity(0.06) : Tema.orbe)
        // Se va llenando mientras corre el cierre automático; tocar algo lo frena.
        if let cuenta, estado == .enviado {
          GeometryReader { g in
            Capsule().fill(Color.white.opacity(0.16)).frame(width: g.size.width * CGFloat(cuenta))
          }
          .clipShape(Capsule())
        }
        Text(estado == .enviando ? "Enviando…" : esFallo ? "Cerrar" : "Listo")
          .font(.system(size: 16, weight: .semibold))
          .foregroundColor(esFallo ? Tema.titulo : .white)
      }
      .frame(height: 52)
      .opacity(estado == .enviando ? 0.55 : 1)
    }
    .buttonStyle(Hundido())
    .disabled(estado == .enviando)
  }

  private var esFallo: Bool { if case .fallo = estado { return true } else { return false } }

  private var titulo: String {
    switch estado {
    case .enviando: return "Enviando a tus posts"
    case .enviado: return "Contenido enviado"
    case .fallo(let motivo): return motivo
    }
  }
}

// MARK: - Fin del diseño

#if canImport(UIKit)

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

// MARK: - El servidor

struct Servidor {
  let base: String
  let llave: String

  static func deLaApp() -> Servidor? {
    guard let base = Bundle.main.infoDictionary?["ViztaServidor"] as? String, let llave = leerLlave() else { return nil }
    return Servidor(base: base, llave: llave)
  }

  private func pedir(_ metodo: String, _ ruta: String, _ cuerpo: [String: Any]? = nil) async throws -> (Int, [String: Any]) {
    guard let url = URL(string: "\(base)/api/agregar-post/\(ruta)") else { throw URLError(.badURL) }
    var p = URLRequest(url: url, timeoutInterval: 20)
    p.httpMethod = metodo
    p.setValue("application/json", forHTTPHeaderField: "Content-Type")
    p.setValue("Bearer \(llave)", forHTTPHeaderField: "Authorization")
    if let cuerpo { p.httpBody = try? JSONSerialization.data(withJSONObject: cuerpo) }
    let (datos, respuesta) = try await URLSession.shared.data(for: p)
    let json = (try? JSONSerialization.jsonObject(with: datos) as? [String: Any]) ?? [:]
    return ((respuesta as? HTTPURLResponse)?.statusCode ?? 0, json)
  }

  /// Manda el enlace. Devuelve el id del post que quedó trayéndose, o el motivo.
  func enviar(_ url: URL) async -> Result<String, Falla> {
    do {
      let (codigo, json) = try await pedir("POST", "compartido", ["url": url.absoluteString])
      if (200..<300).contains(codigo), let id = (json["post"] as? [String: Any])?["id"] as? String { return .success(id) }
      // El servidor ya contesta con una frase para la persona; se muestra esa.
      if let mensaje = json["message"] as? String, !mensaje.isEmpty { return .failure(Falla(mensaje)) }
      return .failure(Falla(codigo == 402 ? "No podés agregar posts por ahora." : "No se pudo enviar. Probá de nuevo."))
    } catch {
      return .failure(Falla("Sin conexión. Probá de nuevo."))
    }
  }

  /// Las carpetas de la persona y si ya analiza todo al llegar.
  func opciones() async -> ([Carpeta], Bool) {
    guard let (codigo, json) = try? await pedir("GET", "compartido/opciones"), codigo == 200 else { return ([], false) }
    let carpetas = (json["carpetas"] as? [[String: Any]] ?? []).compactMap { c -> Carpeta? in
      guard let id = c["id"] as? String, let nombre = c["name"] as? String else { return nil }
      return Carpeta(id: id, nombre: nombre)
    }
    return (carpetas, json["analizar"] as? Bool ?? false)
  }

  func elegir(_ postId: String, _ cambios: [String: Any]) async {
    _ = try? await pedir("PATCH", "compartido/\(postId)", cambios)
  }
}

struct Falla: Error {
  let mensaje: String
  init(_ m: String) { mensaje = m }
}

// MARK: - El estado de la hoja

@MainActor
final class Modelo: ObservableObject {
  @Published var estado: Estado = .enviando
  @Published var detalle: String?
  @Published var carpetas: [Carpeta] = []
  @Published var carpetaElegida: String?
  @Published var analizar = false
  @Published var cuenta: Double? = nil

  private var servidor: Servidor?
  private var postId: String?
  private var reloj: Timer?
  var alTerminar: () -> Void = {}

  func empezar(_ contexto: NSExtensionContext?) async {
    guard let url = await enlaceCompartido(contexto) else { return fallar("No hay ningún enlace para enviar.") }
    // Lo que se está mandando, sin el rastreo que agrega la red al compartir.
    detalle = (url.host ?? "") + url.path
    guard esPost(url) else { return fallar("Ese enlace no es un post de Instagram ni de X.") }
    guard let servidor = Servidor.deLaApp() else { return fallar("Abrí Vizta una vez para conectar tu cuenta.") }
    self.servidor = servidor

    // Las opciones se piden a la par: cuando el envío confirma, ya están.
    async let opciones = servidor.opciones()
    switch await servidor.enviar(url) {
    case .failure(let f):
      fallar(f.mensaje)
    case .success(let id):
      postId = id
      let (carpetas, analiza) = await opciones
      self.carpetas = carpetas
      self.analizar = analiza
      estado = .enviado
      vibrar(true)
      contar()
    }
  }

  private func fallar(_ motivo: String) { estado = .fallo(motivo) }

  /// Se cierra sola a los cuatro segundos, salvo que se toque algo: si la
  /// persona está eligiendo, la hoja espera a que diga «Listo».
  private func contar() {
    let total = 4.0
    let inicio = Date()
    cuenta = 0
    reloj = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { [weak self] t in
      Task { @MainActor in
        guard let self, self.cuenta != nil else { t.invalidate(); return }
        let p = Date().timeIntervalSince(inicio) / total
        self.cuenta = min(1, p)
        if p >= 1 { t.invalidate(); self.alTerminar() }
      }
    }
  }

  private func quedarse() {
    reloj?.invalidate()
    cuenta = nil
  }

  func elegirCarpeta(_ id: String?) {
    quedarse()
    guard id != carpetaElegida else { return }
    vibrar()
    carpetaElegida = id
    guard let postId, let servidor else { return }
    Task { await servidor.elegir(postId, ["carpeta": id ?? NSNull()]) }
  }

  func cambiarAnalizar() {
    quedarse()
    vibrar()
    analizar.toggle()
    guard let postId, let servidor else { return }
    let valor = analizar
    Task { await servidor.elegir(postId, ["analizar": valor]) }
  }
}

struct Raiz: View {
  @ObservedObject var modelo: Modelo
  @State private var arriba = false

  var body: some View {
    Hoja(
      estado: modelo.estado,
      detalle: modelo.detalle,
      carpetas: modelo.carpetas,
      carpetaElegida: modelo.carpetaElegida,
      analizar: modelo.analizar,
      cuenta: modelo.cuenta,
      alElegirCarpeta: { modelo.elegirCarpeta($0) },
      alCambiarAnalizar: { modelo.cambiarAnalizar() },
      cerrar: { modelo.alTerminar() }
    )
    // Entra desde abajo con el resorte de las entradas de la app.
    .offset(y: arriba ? 0 : 420)
    .opacity(arriba ? 1 : 0)
    .onAppear { withAnimation(.spring(response: 0.46, dampingFraction: 0.84)) { arriba = true } }
  }
}

// MARK: - El controlador

@objc(ShareViewController)
final class ShareViewController: UIViewController {
  private let modelo = Modelo()

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .clear
    Fuentes.cargar(Bundle.main.url(forResource: "InstrumentSerif-Regular", withExtension: "ttf"))

    modelo.alTerminar = { [weak self] in
      self?.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }

    let anfitrion = UIHostingController(rootView: Raiz(modelo: modelo))
    anfitrion.view.backgroundColor = .clear
    addChild(anfitrion)
    anfitrion.view.frame = view.bounds
    anfitrion.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    view.addSubview(anfitrion.view)
    anfitrion.didMove(toParent: self)

    Task { await modelo.empezar(extensionContext) }
  }
}

#endif
