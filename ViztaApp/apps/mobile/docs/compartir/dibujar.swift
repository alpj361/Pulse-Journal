// Dibuja la hoja de compartir en sus estados, con el mismo código de la
// extensión, para verla sin compilar la app:
//
//   cd apps/mobile && swift docs/compartir/dibujar.swift
//
// Toma lo que hay entre «MARK: - Diseño» y «MARK: - Fin del diseño» de
// plugins/compartir/ShareViewController.swift. El fondo es un relleno: en el
// teléfono, detrás se ve la app desde la que se comparte.
import Foundation

let fuente = try! String(contentsOfFile: "plugins/compartir/ShareViewController.swift", encoding: .utf8)
let ini = fuente.range(of: "// MARK: - Diseño")!.lowerBound
let fin = fuente.range(of: "// MARK: - Fin del diseño")!.lowerBound
let cabeza = "import SwiftUI\nimport CoreText\nimport AppKit\n\n"
let cola = """

struct SinDeslizar<C: View>: View {
  let c: C
  init(@ViewBuilder _ c: () -> C) { self.c = c() }
  var body: some View { Color.clear.frame(height: 36).overlay(c.fixedSize(), alignment: .leading).clipped() }
}

struct Fondo: View {
  var body: some View {
    ZStack {
      LinearGradient(colors: [Color(red: 0.20, green: 0.18, blue: 0.22), Color(red: 0.36, green: 0.26, blue: 0.30)], startPoint: .top, endPoint: .bottom)
      Circle().fill(Color(red: 0.85, green: 0.45, blue: 0.35).opacity(0.55)).frame(width: 300).offset(x: -90, y: 250).blur(radius: 60)
      Circle().fill(Color(red: 0.35, green: 0.55, blue: 0.80).opacity(0.5)).frame(width: 260).offset(x: 120, y: 330).blur(radius: 70)
    }
  }
}

@MainActor func guardar(_ nombre: String, _ hoja: Hoja) {
  let r = ImageRenderer(content: ZStack { Fondo(); hoja }.frame(width: 402, height: 874))
  r.scale = 2
  guard let img = r.nsImage, let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff), let png = rep.representation(using: .png, properties: [:]) else { return }
  try? png.write(to: URL(fileURLWithPath: "docs/compartir/" + nombre + ".png"))
  print("ok", nombre)
}

@MainActor func todo() {
  Fuentes.cargar(URL(fileURLWithPath: "assets/fonts/InstrumentSerif-Regular.ttf"))
  Movimiento.activo = false
  let carpetas = [Carpeta(id: "1", nombre: "Muni Guate"), Carpeta(id: "2", nombre: "OJ Sistema"), Carpeta(id: "3", nombre: "Contexto Int")]
  let reel = Vista(titulo: "Oppenheimer: lo que la película no cuenta del Proyecto Manhattan", sitio: "instagram.com", imagen: nil)
  let articulo = Vista(titulo: "La reforma a la Ley de Contrataciones, artículo por artículo", sitio: "prensalibre.com", imagen: nil)
  func hoja(_ e: Estado, _ d: Destino = .posts, v: Vista? = reel, c: [Carpeta] = [], elegida: String? = nil, analizar: Bool = false, tipo: String? = nil, aviso: String? = nil, cuenta: Double? = nil) -> Hoja {
    Hoja(estado: e, destino: d, vista: v, carpetas: c, carpetaElegida: elegida, analizar: analizar, tipoElegido: tipo, aviso: aviso, cuenta: cuenta,
         alElegirCarpeta: { _ in }, alCambiarAnalizar: {}, alElegirTipo: { _ in }, cerrar: {})
  }
  guardar("1-enviando", hoja(.enviando))
  guardar("2-enviado", hoja(.enviado, c: carpetas, cuenta: 0.35))
  guardar("3-eligiendo", hoja(.enviado, c: carpetas, elegida: "1", analizar: true, tipo: "film"))
  guardar("4-enlace", hoja(.enviado, .biblioteca, v: articulo, cuenta: 0.6))
  guardar("5-enlace-tipo", hoja(.enviado, .biblioteca, v: articulo, tipo: "article"))
  guardar("6-sin-cuenta", hoja(.fallo("La cuenta se conecta al abrir Vizta una vez."), v: nil))
}
MainActor.assumeIsolated { todo() }
"""
let salida = FileManager.default.temporaryDirectory.appendingPathComponent("vizta_hoja.swift")
// Al dibujar a una imagen, lo que va dentro de un ScrollView sale en blanco:
// acá las filas de chips se dibujan quietas, recortadas al ancho de la hoja
// (sin recortar, la fila estira la hoja entera y sale corrida).
let diseno = String(fuente[ini..<fin]).replacingOccurrences(of: "ScrollView(.horizontal, showsIndicators: false) {", with: "SinDeslizar {")
try! (cabeza + diseno + cola).write(to: salida, atomically: true, encoding: .utf8)
let p = Process()
p.executableURL = URL(fileURLWithPath: "/usr/bin/swift")
p.arguments = [salida.path]
try! p.run()
p.waitUntilExit()
