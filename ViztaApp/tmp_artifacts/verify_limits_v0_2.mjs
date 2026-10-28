import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const outputPath = "/Users/pj/Desktop/Pulse_Journal/ViztaApp/outputs/limits_security_billing_v0_2/Pulzos_Limites_Seguridad_Billing_v0_2.xlsx";
const input = await FileBlob.load(outputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const limits = workbook.worksheets.getItem("Límites");
const ids = limits.getRange("A11:A53").values.flat();
const uniqueIds = new Set(ids);
if (ids.length !== 43 || uniqueIds.size !== 43 || ids[0] !== "LIM-001" || ids.at(-1) !== "LIM-043") {
  throw new Error(`Invalid limit IDs: rows=${ids.length}, unique=${uniqueIds.size}, first=${ids[0]}, last=${ids.at(-1)}`);
}

const contractCheck = await workbook.inspect({
  kind: "table",
  sheetId: "Contrato",
  range: "A22:G27",
  include: "values,formulas",
  tableMaxRows: 8,
  tableMaxCols: 7,
  maxChars: 8000,
});
console.log(contractCheck.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 300 },
  summary: "saved workbook formula error scan",
});
console.log(errors.ndjson);
console.log(`VERIFIED\t${ids.length}\t${uniqueIds.size}`);
