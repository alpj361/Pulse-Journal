import SwiftUI
import CoreText
import Security
import UniformTypeIdentifiers
#if canImport(UIKit)
import UIKit
import LinkPresentation
#endif

/**
 Mandar un post a Vizta, o guardar cualquier enlace en la biblioteca, desde
 «Compartir».

 Esto corre dentro de Instagram, de X o del navegador, no dentro de Vizta: es
 otro proceso, sin React Native y sin la sesión de la persona. Toma el enlace
 que le pasan y se lo manda al servidor con la llave de compartir que la app
 dejó en el llavero:

 - Un post de Instagram o de X va a Posts. Traerlo —bajarlo, transcribirlo— lo
   hace el servidor después, igual que cuando se pega el enlace en la app. La
   hoja deja elegir la carpeta, si se analiza al llegar y, si el post habla de
   una película, un libro o un videojuego, guardarlo además en la biblioteca.
 - Cualquier otro enlace (un artículo, un paper, una lista) se guarda en la
   biblioteca como Bookmark (STA-299), y la hoja deja elegir su tipo.

 Arriba se ve lo compartido como en Mensajes: su imagen, su título y el sitio. Es la misma superficie de la app —el
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

/// A dónde va lo compartido: un post de Instagram o de X entra a Posts (y se
/// puede guardar además en la biblioteca); cualquier otro enlace, a la
/// biblioteca como Bookmark.
enum Destino: Equatable {
  case posts
  case biblioteca
}

/// Lo que se compartió, como se ve: la imagen de la página, su título y el sitio.
struct Vista {
  var titulo: String?
  var sitio: String
  var imagen: Image?
}

/// Los tipos de Bookmark que se ofrecen en la hoja. `clave` es el tipo del
/// contrato (`bookmark.kind`); «Paper» es un artículo con la etiqueta `paper`.
struct TipoGuardado: Identifiable, Equatable {
  let id: String
  let nombre: String
  let simbolo: String
  let clave: String
  var etiquetas: [String] = []

  static let todos: [TipoGuardado] = [
    TipoGuardado(id: "film", nombre: "Película", simbolo: "film", clave: "film"),
    TipoGuardado(id: "series", nombre: "Serie", simbolo: "tv", clave: "series"),
    TipoGuardado(id: "book", nombre: "Libro", simbolo: "book.closed", clave: "book"),
    TipoGuardado(id: "article", nombre: "Artículo", simbolo: "doc.text", clave: "article"),
    TipoGuardado(id: "paper", nombre: "Paper", simbolo: "graduationcap", clave: "article", etiquetas: ["paper"]),
    TipoGuardado(id: "list", nombre: "Lista", simbolo: "list.bullet", clave: "list"),
    TipoGuardado(id: "game", nombre: "Videojuego", simbolo: "gamecontroller", clave: "game"),
    TipoGuardado(id: "video", nombre: "Video", simbolo: "play.rectangle", clave: "video"),
    TipoGuardado(id: "podcast", nombre: "Podcast", simbolo: "mic", clave: "podcast"),
    TipoGuardado(id: "music", nombre: "Música", simbolo: "music.note", clave: "music"),
    TipoGuardado(id: "website", nombre: "Enlace", simbolo: "link", clave: "website"),
  ]

  /// Un enlace suele ser algo para leer: esos tipos van primero. Un post suele
  /// hablar de una obra: película, serie, libro.
  static func orden(_ destino: Destino) -> [TipoGuardado] {
    guard destino == .biblioteca else { return todos }
    let primero = ["article", "paper", "list", "website"]
    return todos.filter { primero.contains($0.id) }.sorted { primero.firstIndex(of: $0.id)! < primero.firstIndex(of: $1.id)! }
      + todos.filter { !primero.contains($0.id) }
  }
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

/// Para dibujar la hoja quieta (`docs/compartir/dibujar.swift`): sin esto, lo
/// que entra con una animación saldría en la imagen antes de haber entrado.
enum Movimiento {
  static var activo = true
}

/**
 Una carpeta chica. Al elegirla, una hoja se asoma por arriba: es el post
 entrando ahí. La hoja está siempre, detrás de la tapa; elegir la carpeta la
 sube con un resorte que rebota un poco, como papel.
 */
struct IconoCarpeta: View {
  let abierta: Bool
  let color: Color

  var body: some View {
    ZStack(alignment: .bottom) {
      // El fondo de la carpeta, con su pestaña.
      FormaCarpeta().fill(color.opacity(0.32))

      // La hoja.
      RoundedRectangle(cornerRadius: 1.6, style: .continuous)
        .fill(Color.white)
        .overlay(
          VStack(alignment: .leading, spacing: 1.8) {
            Capsule().fill(color.opacity(0.55)).frame(width: 6.5, height: 1.1)
            Capsule().fill(color.opacity(0.35)).frame(width: 4.5, height: 1.1)
          }
          .padding(.top, 2.6).padding(.leading, 2.2),
          alignment: .topLeading
        )
        .overlay(RoundedRectangle(cornerRadius: 1.6, style: .continuous).strokeBorder(color.opacity(0.28), lineWidth: 0.6))
        .frame(width: 12, height: 11)
        .rotationEffect(.degrees(abierta ? -7 : 0), anchor: .bottom)
        .offset(y: abierta ? -6.5 : -1)
        .opacity(abierta ? 1 : 0)

      // La tapa de adelante: tapa la hoja mientras está guardada.
      RoundedRectangle(cornerRadius: 2.4, style: .continuous)
        .fill(color.opacity(abierta ? 1 : 0.62))
        .frame(width: 17, height: 9.5)
    }
    .frame(width: 17, height: 17, alignment: .bottom)
    .animation(Movimiento.activo ? .spring(response: 0.34, dampingFraction: 0.52) : nil, value: abierta)
  }
}

struct FormaCarpeta: Shape {
  func path(in r: CGRect) -> Path {
    var p = Path()
    let alto: CGFloat = 13
    let y0 = r.maxY - alto
    // La pestaña a la izquierda y el cuerpo.
    p.addRoundedRect(in: CGRect(x: r.minX, y: y0, width: 8, height: 5), cornerSize: CGSize(width: 2, height: 2))
    p.addRoundedRect(in: CGRect(x: r.minX, y: y0 + 2.4, width: r.width, height: alto - 2.4), cornerSize: CGSize(width: 2.4, height: 2.4))
    return p
  }
}

struct Chip: View {
  let texto: String
  let elegido: Bool
  /// `false` en «Sin carpeta»: no hay carpeta que dibujar.
  var conCarpeta = true
  /// Un símbolo en lugar de la carpeta (los tipos de la biblioteca).
  var simbolo: String? = nil
  let alTocar: () -> Void
  var body: some View {
    Button(action: alTocar) {
      HStack(spacing: 7) {
        if let simbolo {
          Image(systemName: simbolo)
            .font(.system(size: 12.5, weight: .semibold))
            .foregroundColor(elegido ? Tema.indigo : Tema.meta)
            .frame(width: 17)
        } else if conCarpeta {
          IconoCarpeta(abierta: elegido, color: elegido ? Tema.indigo : Tema.meta)
        }
        Text(texto)
          .font(.system(size: 13.5, weight: elegido ? .semibold : .regular))
          .foregroundColor(elegido ? Tema.indigo : Tema.cuerpo)
          .lineLimit(1)
          .fixedSize()
      }
      .padding(.leading, conCarpeta || simbolo != nil ? 11 : 14)
      .padding(.trailing, 14)
      // Alto fijo: la hoja se asoma por encima de la carpeta sin mover la pastilla.
      .frame(height: 36)
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

/**
 El loader de Vizta (`MorphingInfinity`): un anillo que se pliega en infinito y
 vuelve, mientras un trazo lo recorre. Los mismos dos ciclos con períodos que no
 son múltiplos —2,4 s el pliegue, 1,7 s el trazo—, así que no se vuelve un
 bucle reconocible.
 */
struct AnilloInfinito: Shape {
  /// 0 = anillo, 1 = infinito (lemniscata de Gerono).
  var pliegue: Double

  func path(in r: CGRect) -> Path {
    let lado = min(r.width, r.height)
    let radio = lado / 2 - lado * 0.11
    let n = 96
    var p = Path()
    for i in 0..<n {
      let t = Double(i) / Double(n) * .pi * 2
      let x = r.midX + CGFloat(cos(t)) * radio
      let y = r.midY + CGFloat(sin(t) * (1 - pliegue) + sin(t) * cos(t) * pliegue) * radio
      if i == 0 { p.move(to: CGPoint(x: x, y: y)) } else { p.addLine(to: CGPoint(x: x, y: y)) }
    }
    p.closeSubpath()
    return p
  }
}

struct Cargando: View {
  var lado: CGFloat = 38
  var color: Color = Tema.titulo

  private static func suave(_ t: Double) -> Double { t * t * (3 - 2 * t) }

  var body: some View {
    TimelineView(.animation) { linea in
      // Quieto (al dibujarlo a una imagen) se muestra a medio plegar.
      let ms = Movimiento.activo ? linea.date.timeIntervalSinceReferenceDate * 1000 : 760
      // Coseno y no rampa: se demora en el anillo y en el infinito.
      let f = ms.truncatingRemainder(dividingBy: 2400) / 2400
      let pliegue = (1 - cos(f * .pi * 2)) / 2
      // El trazo se dibuja en la primera mitad y se borra en la segunda.
      let g = ms.truncatingRemainder(dividingBy: 1700) / 1700
      let desde = g < 0.5 ? 0 : Self.suave((g - 0.5) * 2)
      let hasta = g < 0.5 ? Self.suave(g * 2) : 1
      let estilo = StrokeStyle(lineWidth: max(2, lado * 0.055), lineCap: .round, lineJoin: .round)
      ZStack {
        // La pista, siempre visible: sin ella, cuando el trazo termina de
        // borrarse no quedaría nada y parecería colgado.
        AnilloInfinito(pliegue: pliegue).stroke(color.opacity(0.18), style: estilo)
        AnilloInfinito(pliegue: pliegue).trim(from: desde, to: hasta).stroke(color, style: estilo)
      }
    }
    .frame(width: lado, height: lado)
  }
}

struct FormaCheque: Shape {
  func path(in r: CGRect) -> Path {
    var p = Path()
    p.move(to: CGPoint(x: r.minX + r.width * 0.29, y: r.minY + r.height * 0.53))
    p.addLine(to: CGPoint(x: r.minX + r.width * 0.44, y: r.minY + r.height * 0.67))
    p.addLine(to: CGPoint(x: r.minX + r.width * 0.72, y: r.minY + r.height * 0.36))
    return p
  }
}

/**
 El cheque de «enviado». Llega en tres tiempos: el círculo verde salta desde
 chico con un rebote, el cheque se dibuja de un trazo, y una onda sale del
 círculo y se pierde. Es la confirmación; tiene que sentirse, no solo verse.
 */
struct Cheque: View {
  var lado: CGFloat = 38
  @State private var llego = !Movimiento.activo

  var body: some View {
    ZStack {
      Circle()
        .strokeBorder(Tema.orbe.opacity(llego ? 0 : 0.5), lineWidth: 2)
        .scaleEffect(llego ? 1.9 : 1)
        .animation(Movimiento.activo ? .easeOut(duration: 0.7).delay(0.12) : nil, value: llego)
      Circle()
        .fill(Tema.orbe)
        .scaleEffect(llego ? 1 : 0.3)
        .animation(Movimiento.activo ? .spring(response: 0.38, dampingFraction: 0.5) : nil, value: llego)
      FormaCheque()
        .trim(from: 0, to: llego ? 1 : 0)
        .stroke(Color.white, style: StrokeStyle(lineWidth: 2.6, lineCap: .round, lineJoin: .round))
        .animation(Movimiento.activo ? .easeOut(duration: 0.3).delay(0.16) : nil, value: llego)
    }
    .frame(width: lado, height: lado)
    .onAppear { llego = true }
  }
}

/// El círculo que dice en qué va: cargando, hecho, o con un problema.
struct Marca: View {
  let estado: Estado
  var body: some View {
    ZStack {
      switch estado {
      case .enviando:
        Cargando()
      case .enviado:
        Cheque()
      case .fallo:
        Circle().fill(Tema.rojo.opacity(0.09))
        Circle().strokeBorder(Tema.rojo.opacity(0.35), lineWidth: 1.5)
        Image(systemName: "exclamationmark").font(.system(size: 15, weight: .bold)).foregroundColor(Tema.rojo)
      }
    }
    .frame(width: 38, height: 38)
    .id(estado == .enviando ? 0 : estado == .enviado ? 1 : 2)
  }
}

struct Hoja: View {
  let estado: Estado
  let destino: Destino
  let vista: Vista?
  let carpetas: [Carpeta]
  let carpetaElegida: String?
  let analizar: Bool
  /// El tipo con que quedó en la biblioteca (`TipoGuardado.id`), si quedó.
  let tipoElegido: String?
  /// Una línea corta cuando guardar en la biblioteca no salió.
  let aviso: String?
  /// De 0 a 1: cuánto falta para que se cierre sola. `nil` si ya no se cierra.
  let cuenta: Double?
  let alElegirCarpeta: (String?) -> Void
  let alCambiarAnalizar: () -> Void
  let alElegirTipo: (TipoGuardado) -> Void
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
        Text(titulo)
          .font(Tema.serif(esFallo ? 23 : 29))
          .foregroundColor(Tema.titulo)
          .lineSpacing(1)
          .fixedSize(horizontal: false, vertical: true)
      }
      .padding(.top, 18)

      if let vista { tarjetaVista(vista).padding(.top, 16) }

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
    .animation(.spring(response: 0.3, dampingFraction: 0.85), value: tipoElegido)
  }

  /// Lo compartido, como se ve: su imagen, su título y el sitio. Sin la URL cruda.
  private func tarjetaVista(_ v: Vista) -> some View {
    HStack(spacing: 12) {
      ZStack {
        RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Tema.titulo.opacity(0.06))
        if let imagen = v.imagen {
          imagen.resizable().scaledToFill()
        } else {
          Image(systemName: destino == .posts ? "play.rectangle" : "link")
            .font(.system(size: 16, weight: .semibold)).foregroundColor(Tema.tenue)
        }
      }
      .frame(width: 52, height: 52)
      .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

      VStack(alignment: .leading, spacing: 3) {
        if let t = v.titulo, !t.isEmpty {
          Text(t).font(.system(size: 14, weight: .semibold)).foregroundColor(Tema.titulo).lineLimit(2)
        }
        Text(v.sitio).font(.system(size: 12.5)).foregroundColor(Tema.meta).lineLimit(1)
      }
      Spacer(minLength: 0)
    }
    .padding(10)
    .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.white.opacity(0.5)))
    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Tema.titulo.opacity(0.06), lineWidth: 1))
  }

  private func etiqueta(_ texto: String) -> some View {
    Text(texto).font(Tema.etiqueta).tracking(1).foregroundColor(Tema.tenue)
      .padding(.top, 22).padding(.bottom, 10)
  }

  private func fila<C: View>(@ViewBuilder _ contenido: () -> C) -> some View {
    ScrollView(.horizontal, showsIndicators: false) {
      HStack(spacing: 7) { contenido() }
        .padding(.horizontal, Tema.margen)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    .padding(.horizontal, -Tema.margen)
  }

  /// Lo que en la app se haría después, a un toque.
  private var opciones: some View {
    VStack(alignment: .leading, spacing: 0) {
      if destino == .posts {
        if !carpetas.isEmpty {
          etiqueta("CARPETA")
          fila {
            Chip(texto: "Sin carpeta", elegido: carpetaElegida == nil, conCarpeta: false) { alElegirCarpeta(nil) }
            ForEach(carpetas) { c in
              Chip(texto: c.nombre, elegido: carpetaElegida == c.id) { alElegirCarpeta(c.id) }
            }
          }
        }

        HStack(spacing: 12) {
          Text("Analizar al llegar").font(.system(size: 15, weight: .semibold)).foregroundColor(Tema.titulo)
          Spacer(minLength: 8)
          Interruptor(prendido: analizar, alTocar: alCambiarAnalizar)
        }
        .padding(.top, 20)
      }

      etiqueta(destino == .posts ? "GUARDAR TAMBIÉN EN LA BIBLIOTECA" : "TIPO")
      fila {
        ForEach(TipoGuardado.orden(destino)) { t in
          Chip(texto: t.nombre, elegido: tipoElegido == t.id, simbolo: t.simbolo) { alElegirTipo(t) }
        }
      }

      if let aviso {
        Text(aviso).font(.system(size: 12.5)).foregroundColor(Tema.rojo).padding(.top, 8)
      }
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
        Text(estado == .enviando ? (destino == .posts ? "Enviando…" : "Guardando…") : esFallo ? "Cerrar" : "Listo")
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
    switch (estado, destino) {
    case (.enviando, .posts): return "Enviando a Posts"
    case (.enviado, .posts): return "Enviado a Posts"
    case (.enviando, .biblioteca): return "Guardando en la biblioteca"
    case (.enviado, .biblioteca): return "Guardado en la biblioteca"
    case (.fallo(let motivo), _): return motivo
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
/// tweet. Un perfil o una historia no son un post: van a la biblioteca.
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
    if let url = try? await a.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL, url.scheme?.hasPrefix("http") == true { return url }
  }
  for a in adjuntos where a.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
    guard let texto = try? await a.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String,
          let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) else { continue }
    let rango = NSRange(texto.startIndex..., in: texto)
    if let url = detector.matches(in: texto, range: rango).compactMap({ $0.url }).first(where: { $0.scheme?.hasPrefix("http") == true }) { return url }
  }
  return nil
}

/// El sitio, sin «www.»: «instagram.com», «nytimes.com».
func sitioDe(_ url: URL) -> String {
  let host = url.host ?? url.absoluteString
  return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
}

/// El título y la imagen de la página, con LinkPresentation (lo mismo que usa
/// iOS para las vistas previas de Mensajes). Si tarda o no hay, sigue sin eso.
func metadatos(_ url: URL) async -> (String?, UIImage?) {
  let proveedor = LPMetadataProvider()
  proveedor.timeout = 4
  guard let m = try? await proveedor.startFetchingMetadata(for: url) else { return (nil, nil) }
  let fuente = m.imageProvider ?? m.iconProvider
  let imagen: UIImage? = await withCheckedContinuation { c in
    guard let fuente, fuente.canLoadObject(ofClass: UIImage.self) else { return c.resume(returning: nil) }
    fuente.loadObject(ofClass: UIImage.self) { obj, _ in c.resume(returning: obj as? UIImage) }
  }
  return (m.title, imagen)
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

  /// La frase del servidor si la trae; si no, una genérica.
  private func falla(_ codigo: Int, _ json: [String: Any], _ generica: String) -> Falla {
    if let mensaje = json["message"] as? String, !mensaje.isEmpty { return Falla(mensaje) }
    return Falla(codigo == 402 ? "El plan actual no permite agregar más posts por ahora." : generica)
  }

  /// Manda el enlace a Posts. Devuelve el id del post que quedó trayéndose, o el motivo.
  func enviar(_ url: URL) async -> Result<String, Falla> {
    do {
      let (codigo, json) = try await pedir("POST", "compartido", ["url": url.absoluteString])
      if (200..<300).contains(codigo), let id = (json["post"] as? [String: Any])?["id"] as? String { return .success(id) }
      return .failure(falla(codigo, json, "No se pudo enviar. Se puede intentar de nuevo."))
    } catch {
      return .failure(Falla("Sin conexión. Se puede intentar de nuevo."))
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

  /// Un Bookmark en la biblioteca. Devuelve su id y su revisión.
  func guardar(_ cuerpo: [String: Any]) async -> Result<(String, Int), Falla> {
    do {
      let (codigo, json) = try await pedir("POST", "compartido/bookmark", cuerpo)
      if (200..<300).contains(codigo), let b = json["bookmark"] as? [String: Any], let id = b["id"] as? String {
        return .success((id, b["revision"] as? Int ?? 1))
      }
      return .failure(falla(codigo, json, "No se pudo guardar en la biblioteca."))
    } catch {
      return .failure(Falla("Sin conexión. Se puede intentar de nuevo."))
    }
  }

  /// Cambia el tipo de un Bookmark ya guardado. Devuelve la revisión nueva.
  func cambiarTipo(_ id: String, _ cuerpo: [String: Any]) async -> Result<Int, Falla> {
    do {
      let (codigo, json) = try await pedir("PATCH", "compartido/bookmark/\(id)", cuerpo)
      if (200..<300).contains(codigo), let b = json["bookmark"] as? [String: Any] { return .success(b["revision"] as? Int ?? 1) }
      return .failure(falla(codigo, json, "No se pudo cambiar el tipo."))
    } catch {
      return .failure(Falla("Sin conexión. Se puede intentar de nuevo."))
    }
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
  @Published var destino: Destino = .posts
  @Published var vista: Vista?
  @Published var carpetas: [Carpeta] = []
  @Published var carpetaElegida: String?
  @Published var analizar = false
  @Published var tipoElegido: String?
  @Published var aviso: String?
  @Published var cuenta: Double? = nil

  private var servidor: Servidor?
  private var url: URL?
  private var postId: String?
  /// El Bookmark de esta hoja: su id y la revisión con que se cambia.
  private var guardado: (id: String, revision: Int)?
  /// Una clave por hoja: si el envío se repite, el servidor reutiliza el mismo.
  private let clave = "compartir-\(UUID().uuidString)"
  private var reloj: Timer?
  var alTerminar: () -> Void = {}

  func empezar(_ contexto: NSExtensionContext?) async {
    guard let url = await enlaceCompartido(contexto) else { return fallar("No hay ningún enlace para guardar.") }
    self.url = url
    destino = esPost(url) ? .posts : .biblioteca
    vista = Vista(titulo: nil, sitio: sitioDe(url), imagen: nil)
    guard let servidor = Servidor.deLaApp() else { return fallar("La cuenta se conecta al abrir Vizta una vez.") }
    self.servidor = servidor

    // La vista previa llega cuando llega; no frena el envío de un post.
    let previa = Task { () -> String? in
      let (titulo, imagen) = await metadatos(url)
      vista = Vista(titulo: titulo, sitio: sitioDe(url), imagen: imagen.map { Image(uiImage: $0) })
      return titulo
    }

    if destino == .posts {
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
        listo()
      }
    } else {
      // El Bookmark lleva el título de la página como nombre: se espera a la
      // vista previa (como mucho, lo que tarda LinkPresentation).
      let titulo = await previa.value
      switch await servidor.guardar(["url": url.absoluteString, "name": titulo ?? nombreDe(url), "idempotency_key": clave]) {
      case .failure(let f):
        fallar(f.mensaje)
      case .success(let (id, revision)):
        guardado = (id, revision)
        listo()
      }
    }
  }

  private func nombreDe(_ url: URL) -> String { sitioDe(url) + url.path }

  private func listo() {
    estado = .enviado
    vibrar(true)
    contar()
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

  /// Elegir un tipo: si todavía no hay Bookmark (un post), lo crea apuntando al
  /// post; si ya hay, le cambia el tipo. Si no sale, vuelve a como estaba.
  func elegirTipo(_ t: TipoGuardado) {
    quedarse()
    guard t.id != tipoElegido, let servidor, let url else { return }
    vibrar()
    let antes = tipoElegido
    let eraPaper = TipoGuardado.todos.first { $0.id == antes }?.etiquetas.isEmpty == false
    tipoElegido = t.id
    aviso = nil
    Task {
      let salio: Bool
      if let g = guardado {
        var cuerpo: [String: Any] = ["kind": t.clave, "expected_revision": g.revision]
        if !t.etiquetas.isEmpty || eraPaper { cuerpo["tags"] = t.etiquetas }
        switch await servidor.cambiarTipo(g.id, cuerpo) {
        case .success(let r): guardado = (g.id, r); salio = true
        case .failure(let f): aviso = f.mensaje; salio = false
        }
      } else {
        var cuerpo: [String: Any] = ["url": url.absoluteString, "name": vista?.titulo ?? nombreDe(url), "kind": t.clave, "idempotency_key": clave]
        if let postId { cuerpo["post_id"] = postId }
        if !t.etiquetas.isEmpty { cuerpo["tags"] = t.etiquetas }
        switch await servidor.guardar(cuerpo) {
        case .success(let (id, r)): guardado = (id, r); salio = true
        case .failure(let f): aviso = f.mensaje; salio = false
        }
      }
      if !salio { tipoElegido = antes }
    }
  }
}

struct Raiz: View {
  @ObservedObject var modelo: Modelo
  @State private var arriba = false

  var body: some View {
    Hoja(
      estado: modelo.estado,
      destino: modelo.destino,
      vista: modelo.vista,
      carpetas: modelo.carpetas,
      carpetaElegida: modelo.carpetaElegida,
      analizar: modelo.analizar,
      tipoElegido: modelo.tipoElegido,
      aviso: modelo.aviso,
      cuenta: modelo.cuenta,
      alElegirCarpeta: { modelo.elegirCarpeta($0) },
      alCambiarAnalizar: { modelo.cambiarAnalizar() },
      alElegirTipo: { modelo.elegirTipo($0) },
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
