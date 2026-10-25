import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "/Users/pj/Desktop/Pulse_Journal/ViztaApp/outputs/limits_security_billing/Pulzos_Limites_Seguridad_Billing_v0_1.xlsx";
const outputDir = "/Users/pj/Desktop/Pulse_Journal/ViztaApp/outputs/limits_security_billing_v0_2";
const outputPath = `${outputDir}/Pulzos_Limites_Seguridad_Billing_v0_2.xlsx`;
const previewDir = `${outputDir}/previews`;

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const limits = workbook.worksheets.getItem("Límites");
const contract = workbook.worksheets.getItem("Contrato");
const implementation = workbook.worksheets.getItem("Implementación");

const headers = [
  "ID",
  "Área",
  "Nombre para el usuario",
  "Clave técnica",
  "Tipo de límite",
  "Propuesta",
  "Unidad",
  "Periodo",
  "¿Aplica al admin?",
  "Decisión",
  "Límite ajustado",
  "Notas y correcciones",
  "Resultado final",
  "Disponibilidad Gratis",
  "Canales",
  "Etapa",
  "Estado de medición",
  "Punto de control",
  "Visible en la app",
  "Vigente desde",
];

const rows = [
  ["LIM-001", "Organización", "Proyectos", "projects.total", "Cuota visible", 1, "proyecto", "Total", "No", "Aprobar", 1, "Un Proyecto puede contener varios Espacios. La cuota queda definida antes de publicar la función.", 1, "Futura", "Web, MCP", "Futura", "Inactivo", "Base de datos", "No", "Al activar Proyectos"],
  ["LIM-002", "Organización", "Espacios", "spaces.total", "Cuota visible", 5, "espacios", "Total", "No", "Aprobar", 5, "Los elementos sueltos del Codex no usan Memoria hasta asociarse a un Espacio.", 5, "Activa", "Móvil, web, MCP", "Lanzamiento móvil", "No instrumentado", "Base de datos", "Sí", "Plan Gratis v1"],
  ["LIM-003", "Codex", "Elementos del Codex", "codex.items.total", "Cuota visible", 1000, "elementos", "Total", "No", "Aprobar", 1000, "Incluye los tipos oficiales. Publicaciones y notas rápidas se miden aparte.", 1000, "Activa", "Móvil, web, MCP", "Lanzamiento móvil", "No instrumentado", "Base de datos", "Sí", "Plan Gratis v1"],
  ["LIM-004", "Codex", "Relaciones", "codex.relations.total", "Cuota visible", 5000, "relaciones", "Total", "No", "Aprobar", 5000, "Incluye relaciones manuales y relaciones sugeridas que el usuario acepte.", 5000, "Activa", "Móvil, web, MCP", "Lanzamiento móvil", "No instrumentado", "Base de datos", "Sí", "Plan Gratis v1"],
  ["LIM-005", "Codex", "Campos personalizados", "codex.custom_fields.total", "Cuota visible", 100, "campos", "Total", "No", "Aprobar", 100, "Los campos conservan clave, tipo, etiqueta y motivo.", 100, "Activa", "Móvil, web, MCP", "Lanzamiento móvil", "No instrumentado", "Base de datos", "Sí", "Plan Gratis v1"],
  ["LIM-006", "Codex", "Presets personales", "codex.presets.total", "Cuota visible", 25, "presets", "Total", "No", "Aprobar", 25, "Un elemento puede usar varios presets.", 25, "Activa", "Móvil, web, MCP", "Lanzamiento móvil", "No instrumentado", "Base de datos", "Sí", "Plan Gratis v1"],
  ["LIM-007", "Notas", "Notas rápidas", "snippets.storage_pool", "Incluida en cuota compartida", null, "MB", "Total", "No", "Reemplazar", "Incluida en almacenamiento", "El texto y los adjuntos de las notas consumen la bolsa general de almacenamiento. No existe una bolsa separada de 300 MB.", "Consume storage.bytes", "Activa", "Móvil, web", "Lanzamiento móvil", "No instrumentado", "Almacenamiento y backend", "Sí", "Plan Gratis v1"],
  ["LIM-008", "Publicaciones", "Publicaciones guardadas", "posts.total", "Disponibilidad", 0, "publicaciones", "Total", "No", "Cambiar", 0, "Las publicaciones no forman parte de los items oficiales y no están disponibles para cuentas Gratis.", "No disponible en Gratis", "Solo administrador", "Móvil, web", "Lanzamiento móvil", "Bloqueado por capacidad", "Base de datos y backend", "No", "Plan Gratis v1"],
  ["LIM-009", "Publicaciones", "Publicaciones importadas", "posts.imported", "Disponibilidad", 0, "publicaciones", "Mes", "No", "Cambiar", 0, "Incluye redes sociales y otras importaciones automáticas. No está disponible para cuentas Gratis.", "No disponible en Gratis", "Solo administrador", "Móvil, web, API", "Lanzamiento móvil", "Bloqueado por capacidad", "Backend", "No", "Plan Gratis v1"],
  ["LIM-010", "Datos", "Datasets", "datasets.total", "Cuota visible", 5, "datasets", "Total", "No", "Aprobar", 5, "Puede existir fuera de un Espacio o vincularse con uno. El límite queda definido aunque la vista móvil siga oculta.", 5, "Futura", "Móvil, web, MCP", "Futura", "Inactivo", "Base de datos", "No", "Al activar Datasets"],
  ["LIM-011", "Datos", "Filas de datasets", "datasets.rows.total", "Cuota visible", 25000, "filas", "Total", "No", "Aprobar", 25000, "Las filas vinculadas al Codex permanecen sincronizadas en ambas direcciones.", 25000, "Futura", "Móvil, web, MCP", "Futura", "Inactivo", "Base de datos", "No", "Al activar Datasets"],
  ["LIM-012", "Datos", "Columnas por dataset", "datasets.columns.per_dataset", "Protección técnica", 100, "columnas", "Por dataset", "Sí", "Aprobar", 100, "Evita hojas inmanejables y cargas accidentales.", 100, "Futura", "Móvil, web, MCP", "Futura", "Inactivo", "Base de datos", "No", "Al activar Datasets"],
  ["LIM-013", "Datos", "Archivo de importación", "datasets.import_bytes", "Protección técnica", 25, "MB", "Por archivo", "Sí", "Aprobar", 25, "Se valida el tipo real del archivo y su contenido.", 25, "Futura", "Móvil, web, MCP", "Futura", "Inactivo", "Backend y almacenamiento", "No", "Al activar Datasets"],
  ["LIM-014", "Archivos", "Almacenamiento compartido", "storage.bytes", "Cuota visible", 300, "MB", "Total", "No", "Cambiar", 300, "Una sola bolsa suma imágenes, documentos, audio, video y adjuntos de notas. Evita cuotas superpuestas.", 300, "Activa", "Móvil, web, MCP", "Lanzamiento móvil", "No instrumentado", "Almacenamiento y backend", "Sí", "Plan Gratis v1"],
  ["LIM-015", "Archivos", "Imagen individual", "storage.image_bytes", "Protección técnica", 10, "MB", "Por archivo", "Sí", "Aprobar", 10, "Se valida antes de optimizar. Las versiones optimizadas no duplican la cuota del original.", 10, "Activa", "Móvil, web, MCP", "Lanzamiento móvil", "No instrumentado", "Aplicación, backend y almacenamiento", "Solo al intervenir", "Plan Gratis v1"],
  ["LIM-016", "Archivos", "Documento individual", "storage.document_bytes", "Protección técnica", 40, "MB", "Por archivo", "Sí", "Revisar", 40, "La aplicación móvil admite actualmente hasta 40 MB. Se valida antes de OCR, extracción o indexación.", 40, "Activa", "Móvil, web, MCP", "Lanzamiento móvil", "No instrumentado", "Aplicación, backend y almacenamiento", "Solo al intervenir", "Plan Gratis v1"],
  ["LIM-017", "Audio", "Audio individual", "storage.audio_bytes", "Protección técnica", 40, "MB", "Por archivo", "Sí", "Cambiar", 40, "El audio importado consume la bolsa general. La transcripción no está disponible para cuentas Gratis.", 40, "Activa", "Móvil, web, MCP", "Lanzamiento móvil", "No instrumentado", "Aplicación, backend y almacenamiento", "Solo al intervenir", "Plan Gratis v1"],
  ["LIM-018", "Documentos", "Páginas con OCR", "documents.ocr_pages", "Cuota visible", 100, "páginas", "Mes", "No", "Aprobar", 100, "Se contará solamente el procesamiento completado. La función todavía no está publicada en móvil.", 100, "Futura", "Móvil, web, API", "Futura", "Inactivo", "Backend", "No", "Al activar OCR"],
  ["LIM-019", "Memoria", "Contenido disponible en Memoria", "memory.source_tokens", "Cuota visible", 500000, "tokens internos", "Total", "No", "Aprobar", 500000, "La interfaz lo muestra como porcentaje. Solo cuenta contenido asociado a un Espacio.", 500000, "Activa", "Móvil, web, MCP", "Lanzamiento móvil", "No instrumentado", "Backend", "Sí", "Plan Gratis v1"],
  ["LIM-020", "Memoria", "Contenido nuevo o modificado", "memory.embedding_tokens", "Cuota visible", 250000, "tokens internos", "Mes", "No", "Aprobar", 250000, "Solo se procesa contenido vinculado con un Espacio. El Codex Global no se indexa.", 250000, "Activa", "Móvil, web, MCP", "Lanzamiento móvil", "No instrumentado", "Backend", "Sí", "Plan Gratis v1"],
  ["LIM-021", "Memoria", "Búsquedas en Memoria", "memory.searches", "Cuota visible", 1000, "búsquedas", "Mes", "No", "Aprobar", 1000, "Incluye recuperación semántica e híbrida dentro de Espacios.", 1000, "Activa", "Móvil, web, MCP", "Lanzamiento móvil", "No instrumentado", "Backend", "Sí", "Plan Gratis v1"],
  ["LIM-022", "IA", "Uso de IA generativa", "ai.weighted_units", "Disponibilidad", 0, "acciones", "Mes", "No", "Eliminar cuota", 0, "La generación con IA no está disponible para cuentas Gratis. No se presenta como una cuota 0 de 0.", "No disponible en Gratis", "Solo administrador", "Móvil, web, API", "Lanzamiento móvil", "Bloqueado por capacidad", "Backend", "No", "Plan Gratis v1"],
  ["LIM-023", "Memoria", "Costo interno de Memoria", "memory.cost_microusd", "Costo interno", 0.01, "USD", "Mes", "No", "Cambiar", 0.01, "Techo interno para embeddings y recuperación. No incluye generación con IA y no se muestra al usuario.", 0.01, "Interna", "Backend", "Lanzamiento móvil", "No instrumentado", "Backend", "No", "Plan Gratis v1"],
  ["LIM-024", "Funciones avanzadas", "Uso de funciones avanzadas", "mcp.weighted_units", "Cuota visible", 150, "unidades", "Mes", "No", "Aprobar", 150, "Lecturas, escrituras, procesos masivos y servicios externos pueden tener pesos distintos.", 150, "Activa", "MCP", "Lanzamiento móvil", "No instrumentado", "Backend MCP", "Fuera de la app", "Plan Gratis v1"],
  ["LIM-025", "Funciones avanzadas", "Registros por operación masiva", "mcp.bulk_records", "Protección técnica", 100, "registros", "Por llamada", "Sí", "Aprobar", 100, "Una operación mayor debe dividirse y conservar idempotencia.", 100, "Activa", "MCP", "Lanzamiento móvil", "No instrumentado", "Backend MCP", "Solo al intervenir", "Plan Gratis v1"],
  ["LIM-026", "Fuentes", "Extracciones web o sociales", "extractions.total", "Disponibilidad", 0, "extracciones", "Mes", "No", "Cambiar", 0, "Descargar y procesar contenido externo no está disponible para cuentas Gratis.", "No disponible en Gratis", "Deshabilitada", "Móvil, web, MCP, API", "Lanzamiento móvil", "Bloqueado por capacidad", "Backend", "No", "Plan Gratis v1"],
  ["LIM-027", "Automatización", "Automatizaciones activas", "automations.active", "Disponibilidad", 0, "automatizaciones", "Total", "No", "Cambiar", 0, "Las automatizaciones no forman parte del Plan Gratis. Los recordatorios locales sin procesamiento externo se evalúan aparte.", "No disponible en Gratis", "Deshabilitada", "Web, MCP", "Futura", "Inactivo", "Backend", "No", "Al publicar Automatizaciones"],
  ["LIM-028", "Automatización", "Ejecuciones automáticas", "automations.runs", "Disponibilidad", 0, "ejecuciones", "Mes", "No", "Cambiar", 0, "Las ejecuciones automáticas no forman parte del Plan Gratis.", "No disponible en Gratis", "Deshabilitada", "Web, MCP", "Futura", "Inactivo", "Backend", "No", "Al publicar Automatizaciones"],
  ["LIM-029", "Portabilidad", "Exportaciones", "exports.total", "Cuota visible", 10, "exportaciones", "Mes", "No", "Mantener futura", 10, "La función todavía no está integrada. El límite no cuenta hasta que se publique.", 10, "Futura", "Móvil, web", "Futura", "Inactivo", "Backend", "No", "Al activar Exportaciones"],
  ["LIM-030", "Compartir", "Enlaces compartidos", "shares.active", "Cuota visible", 10, "enlaces", "Total", "No", "Mantener futura", 10, "La función todavía no está integrada. Cada enlace deberá poder revocarse y respetar la privacidad del recurso.", 10, "Futura", "Móvil, web", "Futura", "Inactivo", "Base de datos y backend", "No", "Al activar Compartir"],
  ["LIM-031", "Historial", "Papelera", "retention.trash_days", "Eliminado", null, "días", "No aplica", "No", "Eliminar", null, "No existe papelera en el alcance actual. La fila se conserva únicamente para documentar la decisión.", "No aplica", "Eliminada", "Ninguno", "No aplica", "Inactivo", "Ninguno", "No", "No aplica"],
  ["LIM-032", "Historial", "Versiones por documento", "retention.document_versions", "Cuota visible", 50, "versiones", "Por documento", "No", "Aprobar para futuro", 50, "El historial de revisiones todavía no está implementado. No debe mostrarse como una capacidad activa.", 50, "Futura", "Móvil, web", "Futura", "Inactivo", "Base de datos", "No", "Al activar Versiones"],
  ["LIM-033", "Mapas", "Búsquedas de lugares", "maps.searches", "Cuota visible", 100, "búsquedas", "Mes", "No", "Cambiar", 100, "Incluye geocodificación y asociación de puntos de interés. Ya pasa por el backend y puede medirse allí.", 100, "Activa", "Móvil, web, API", "Lanzamiento móvil", "No instrumentado", "Backend", "Sí", "Plan Gratis v1"],
  ["LIM-034", "Mapas", "Rutas calculadas", "maps.routes", "Cuota visible", 100, "rutas", "Mes", "No", "Cambiar", 100, "La app llama al proveedor directamente. La cuota por usuario podrá aplicarse cuando las rutas pasen por el backend.", 100, "Activa", "Móvil, web", "Lanzamiento móvil", "Modo observación", "Backend pendiente; hoy proveedor directo", "Sí", "Después del proxy de rutas"],
  ["LIM-035", "Mapas", "Vértices por polígono", "maps.polygon_vertices", "Protección técnica", 100, "vértices", "Por polígono", "Sí", "Cambiar", 100, "Los límites administrativos oficiales pueden conservar geometrías curadas por separado. La interfaz móvil puede tener un umbral menor para edición manual.", 100, "Activa", "Móvil, web, MCP", "Lanzamiento móvil", "No instrumentado", "Base de datos", "Solo al intervenir", "Plan Gratis v1"],
  ["LIM-036", "Espacios", "Elementos vinculados por Espacio", "spaces.items.per_space", "Protección técnica", 500, "elementos", "Por Espacio", "Sí", "Revisar", 500, "Evita que un solo Espacio concentre una cantidad inmanejable de referencias.", 500, "Activa", "Móvil, web, MCP", "Lanzamiento móvil", "No instrumentado", "Base de datos", "Solo al intervenir", "Plan Gratis v1"],
  ["LIM-037", "Espacios", "Bloques escritos por Espacio", "spaces.blocks.per_space", "Protección técnica", 10000, "bloques", "Por Espacio", "Sí", "Revisar", 10000, "Protege la edición de documentos extensos sin limitar el número de palabras de manera artificial.", 10000, "Activa", "Móvil, web, MCP", "Lanzamiento móvil", "No instrumentado", "Base de datos y backend", "Solo al intervenir", "Plan Gratis v1"],
  ["LIM-038", "Espacios", "Trazos del lienzo por Espacio", "spaces.canvas_paths.per_space", "Protección técnica", 1000, "trazos", "Por Espacio", "Sí", "Revisar", 1000, "Controla el tamaño del lienzo libre y el costo de sincronización.", 1000, "Activa", "Móvil, web", "Lanzamiento móvil", "No instrumentado", "Base de datos", "Solo al intervenir", "Plan Gratis v1"],
  ["LIM-039", "Espacios", "Tamaño del estado del Espacio", "spaces.state_bytes", "Protección técnica", 5, "MB", "Por Espacio", "Sí", "Revisar", 5, "Límite para el estado estructurado del editor. Los archivos se miden en storage.bytes.", 5, "Activa", "Móvil, web, MCP", "Lanzamiento móvil", "No instrumentado", "Base de datos y backend", "Solo al intervenir", "Plan Gratis v1"],
  ["LIM-040", "Espacios", "Archivos vinculados por Espacio", "spaces.files.per_space", "Protección técnica", 500, "archivos", "Por Espacio", "Sí", "Revisar", 500, "Los archivos consumen almacenamiento una sola vez aunque se vinculen a varios Espacios.", 500, "Activa", "Móvil, web, MCP", "Lanzamiento móvil", "No instrumentado", "Base de datos", "Solo al intervenir", "Plan Gratis v1"],
  ["LIM-041", "Memoria", "Conceptos semánticos por Espacio", "memory.concepts.per_space", "Protección técnica", 2000, "conceptos", "Por Espacio", "Sí", "Revisar", 2000, "Los conceptos son agrupaciones semánticas internas; no crean nuevos Espacios por sí solos.", 2000, "Futura", "Móvil, web, MCP", "Futura", "Inactivo", "Backend y base de datos", "No", "Al activar conceptos semánticos"],
  ["LIM-042", "Memoria", "Reindexaciones manuales", "memory.manual_reindexes", "Protección técnica", 10, "reindexaciones", "Día", "Sí", "Revisar", 10, "Evita reindexar repetidamente el mismo contenido. Las actualizaciones normales pueden procesarse por cola.", 10, "Futura", "Móvil, web, MCP", "Futura", "Inactivo", "Backend", "No", "Al activar reindexación manual"],
  ["LIM-043", "Audio", "Transcripción de audio", "media.transcription_minutes", "Disponibilidad", 0, "minutos", "Mes", "No", "Confirmar", 0, "La importación de audio sí está permitida. La transcripción y el análisis no están disponibles para cuentas Gratis.", "No disponible en Gratis", "Deshabilitada", "Móvil, web, MCP, API", "Lanzamiento móvil", "Bloqueado por capacidad", "Backend", "No", "Plan Gratis v1"],
];

limits.getRange("A3").values = [["Revisa Decisión, Límite ajustado y Notas. Las funciones futuras quedan definidas pero no consumen cuota hasta que se activen."]];
limits.getRange("A6:B6").values = [["Métricas", "Por revisar"]];
limits.getRange("A7").formulas = [["=COUNTA(A11:A53)"]];
limits.getRange("B7").formulas = [["=COUNTIF(J11:J53,\"Pendiente\")+COUNTIF(J11:J53,\"Revisar\")+COUNTIF(J11:J53,\"Confirmar\")"]];
limits.getRange("A10:T10").values = [headers];
limits.getRange("A11:T53").values = rows;

limits.getRange("A10:T10").format = {
  fill: "#1F5B45",
  font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" },
  borders: { preset: "inside", style: "thin", color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
};
limits.getRange("A11:T53").format.font = { name: "Arial", size: 10 };
limits.getRange("A11:T53").format.verticalAlignment = "center";
limits.getRange("A11:T53").format.borders = {
  bottom: { style: "thin", color: "#D9DDD7" },
};
limits.getRange("C11:C53").format.wrapText = true;
limits.getRange("L11:L53").format.wrapText = true;
limits.getRange("N11:T53").format.wrapText = true;
limits.getRange("J11:L53").format.fill = "#FFF2CC";
limits.getRange("N11:P53").format.fill = "#EEF4F1";
limits.getRange("Q11:R53").format.fill = "#F2F2F2";
limits.getRange("S11:T53").format.fill = "#F7F9F7";
limits.getRange("F11:F53").format.numberFormat = "#,##0.##";
limits.getRange("K11:K53").format.numberFormat = "#,##0.##";
limits.getRange("M11:M53").format.numberFormat = "#,##0.##";
limits.getRange("A10:T10").format.rowHeight = 32;
limits.getRange("A11:T53").format.rowHeight = 42;

const widths = {
  A: 11, B: 16, C: 25, D: 27, E: 24, F: 12, G: 16, H: 15, I: 17, J: 18,
  K: 22, L: 46, M: 23, N: 22, O: 22, P: 20, Q: 22, R: 32, S: 18, T: 25,
};
for (const [column, width] of Object.entries(widths)) {
  limits.getRange(`${column}:${column}`).format.columnWidth = width;
}

limits.getRange("J11:J53").dataValidation = {
  rule: { type: "list", values: ["Aprobar", "Cambiar", "Reemplazar", "Eliminar", "Revisar", "Confirmar", "Mantener futura", "Aprobar para futuro", "Eliminar cuota", "Pendiente"] },
};
limits.getRange("N11:N53").dataValidation = {
  rule: { type: "list", values: ["Activa", "Futura", "Deshabilitada", "Solo administrador", "Eliminada", "Interna"] },
};
limits.getRange("Q11:Q53").dataValidation = {
  rule: { type: "list", values: ["Aplicado", "No instrumentado", "Modo observación", "Inactivo", "Bloqueado por capacidad"] },
};
limits.getRange("S11:S53").dataValidation = {
  rule: { type: "list", values: ["Sí", "No", "Solo al intervenir", "Fuera de la app"] },
};

const contractAdditions = [
  ["Disponibilidad por función", "Cada función declara si está activa, futura, deshabilitada o reservada al administrador.", "Una cuota futura no consume ni bloquea hasta que se active la función.", "Acordado", null, null, "Producto y backend"],
  ["Canales", "Los límites pertenecen a la cuenta y pueden aplicarse en móvil, web, MCP y API.", "Cambiar de interfaz no reinicia ni evita la cuota.", "Acordado", null, null, "Backend"],
  ["Autoridad", "La interfaz informa; la base de datos y el backend autorizan.", "Las escrituras directas a Supabase no pueden omitir la validación de cuotas.", "Acordado", null, null, "Backend"],
  ["Almacenamiento", "Imágenes, documentos, audio, video y adjuntos comparten una sola bolsa.", "No se suman bolsas independientes por cada tipo de contenido.", "Acordado", null, null, "Backend"],
  ["Activación futura", "Las claves se definen antes de publicar la función.", "Al lanzar una función se cambia su disponibilidad sin rediseñar el contrato.", "Acordado", null, null, "Producto y backend"],
  ["Estado de medición", "Cada métrica declara si está aplicada, en observación, no instrumentada o inactiva.", "La app no presenta como aplicado un límite que el backend todavía no puede medir.", "Acordado", null, null, "Backend"],
];
contract.getRange("A22:G27").values = contractAdditions;
contract.getRange("A22:G27").format.font = { name: "Arial", size: 10 };
contract.getRange("A22:G27").format.borders = { bottom: { style: "thin", color: "#D9DDD7" } };
contract.getRange("A22:G27").format.verticalAlignment = "center";
contract.getRange("A22:C27").format.wrapText = true;
contract.getRange("D22:D27").format.fill = "#E2F0D9";
contract.getRange("A22:G27").format.rowHeight = 40;

const phases = [
  ["Fase", "Objetivo", "Trabajo principal", "Salida", "Criterio de cierre", "Estado", "Correcciones", "Notas"],
  ["0. Catálogo de capacidades", "Separar disponibilidad, cuota y canal.", "Registrar feature_key, canales, etapa, medición y punto de control.", "Catálogo versionado de capacidades.", "Toda función tiene estado y fecha de vigencia.", "Pendiente", null, null],
  ["1. Seguridad", "Cerrar rutas de abuso antes de ampliar acceso.", "RLS, funciones privilegiadas, OAuth MCP, buckets, carga y frecuencia.", "Superficie de acceso endurecida.", "Hallazgos críticos resueltos o con excepción documentada.", "Pendiente", null, null],
  ["2. Contrato", "Definir una sola fuente de verdad.", "Crear Plan Gratis, claves canónicas, periodos, reglas del admin y compatibilidad.", "Contrato versionado.", "Todas las métricas tienen unidad, periodo, disponibilidad y comportamiento.", "Pendiente", null, null],
  ["3. Medición", "Registrar consumo real sin bloquear.", "Contadores atómicos, eventos, costo interno e idempotencia en API, MCP y workers.", "Panel interno de consumo.", "IA, Memoria, archivos, mapas y MCP producen eventos conciliables.", "Pendiente", null, null],
  ["4. Observación", "Calibrar con datos reales.", "Operar entre 14 y 30 días en modo observación y medir percentiles y costos.", "Informe de calibración.", "Límites revisados con consumo medido.", "Pendiente", null, null],
  ["5. Avisos", "Preparar al usuario antes del bloqueo.", "Avisos al 70 %, 90 % y 100 %, resumen de uso y acciones disponibles.", "Experiencia de cuotas visible.", "Mensajes explican recurso, periodo y siguiente acción.", "Pendiente", null, null],
  ["6. Aplicación", "Activar el Plan Gratis por capacidad.", "Reservar, confirmar o liberar consumo y aplicar límites por recurso.", "Cuotas activas.", "La lectura y portabilidad permanecen disponibles al agotarse una cuota.", "Pendiente", null, null],
];
implementation.getRange("A6:H13").values = phases;
implementation.getRange("A6:H6").format = {
  fill: "#1F5B45",
  font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" },
  borders: { preset: "inside", style: "thin", color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
};
implementation.getRange("A7:H13").format.font = { name: "Arial", size: 10 };
implementation.getRange("A7:H13").format.wrapText = true;
implementation.getRange("A7:H13").format.borders = { bottom: { style: "thin", color: "#D9DDD7" } };
implementation.getRange("F7:F13").format.fill = "#FFF2CC";
implementation.getRange("F7:F13").dataValidation = { rule: { type: "list", values: ["Pendiente", "En curso", "Acordado", "Completo"] } };
implementation.getRange("A7:H13").format.rowHeight = 45;

const components = [
  ["Componente", "Cambio propuesto", "Datos", "Regla de acceso", "Migración", "Notas"],
  ["plans", "Mantener límites versionados por plan.", "plan_key, version, limits, active_from", "Lectura autenticada; escritura administrativa.", "Crear Free v1.", "Las claves técnicas permanecen canónicas."],
  ["plan_features", "Agregar catálogo de disponibilidad por función.", "feature_key, availability, channels, release_stage, effective_from", "Lectura autenticada; escritura administrativa.", "Registrar las funciones activas y futuras.", "Permite publicar nuevas funciones sin rehacer billing."],
  ["profiles", "Agregar plan_key y excepciones controladas.", "plan_key, entitlement_overrides", "El usuario puede leer su plan; no cambiarlo.", "Todos comienzan en free.", "role=admin concede exención comercial."],
  ["usage_counters", "Registrar contadores por ventana.", "user_id, metric_key, window, used, reserved", "Cambios solo mediante RPC de servicio.", "Comienza en cero.", "Actualización atómica para evitar carreras."],
  ["usage_logs", "Reformar el registro heredado como libro de eventos.", "request_id, metric_key, quantity, cost, source, result", "Resumen seguro para el usuario; detalle administrativo.", "Conservar histórico útil.", "Retirar parámetros sensibles innecesarios."],
  ["storage_reservations", "Reservar espacio antes de subir y confirmar bytes reales.", "user_id, upload_id, reserved_bytes, actual_bytes, status", "RPC autenticada; liquidación desde backend o webhook.", "Conciliar objetos existentes una vez.", "Evita que las cargas directas eludan la cuota."],
  ["credits", "Mantener compatibilidad temporal y retirar después.", "Valor heredado sin autoridad sobre cuotas.", "Solo lectura mientras exista.", "No convertir a dinero.", "Eliminar cuando API y front dejen de depender de él."],
];
implementation.getRange("A15:F22").values = components;
implementation.getRange("A15:F15").format = {
  fill: "#1F5B45",
  font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" },
  borders: { preset: "inside", style: "thin", color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
};
implementation.getRange("A16:F22").format.font = { name: "Arial", size: 10 };
implementation.getRange("A16:F22").format.wrapText = true;
implementation.getRange("A16:F22").format.borders = { bottom: { style: "thin", color: "#D9DDD7" } };
implementation.getRange("A16:F22").format.rowHeight = 48;

workbook.recalculate();

const keyCheck = await workbook.inspect({
  kind: "table",
  sheetId: "Límites",
  range: "A6:T53",
  include: "values,formulas",
  tableMaxRows: 60,
  tableMaxCols: 20,
  tableMaxCellChars: 90,
  maxChars: 30000,
});
console.log(keyCheck.ndjson);

const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log(formulaErrors.ndjson);

await fs.mkdir(previewDir, { recursive: true });
for (const sheetName of ["Límites", "Contrato", "Implementación"]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  const safeName = sheetName.replace(/[^a-z0-9_-]+/gi, "_");
  await fs.writeFile(`${previewDir}/${safeName}.png`, new Uint8Array(await preview.arrayBuffer()));
}

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(`OUTPUT\t${outputPath}`);
