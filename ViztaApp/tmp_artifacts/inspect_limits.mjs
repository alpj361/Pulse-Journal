import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "/Users/pj/Desktop/Pulse_Journal/ViztaApp/outputs/limits_security_billing/Pulzos_Limites_Seguridad_Billing_v0_1.xlsx";
const previewDir = "/Users/pj/Desktop/Pulse_Journal/ViztaApp/tmp_artifacts/previews";

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const summary = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 12000,
  tableMaxRows: 12,
  tableMaxCols: 18,
  tableMaxCellChars: 120,
});
console.log(summary.ndjson);

for (const sheet of workbook.worksheets.items) {
  console.log(`SHEET\t${sheet.name}\tTABLES\t${sheet.tables.items.map((table) => `${table.name}:${table.getRange().address}`).join(",")}`);
}

const limitsStyle = await workbook.inspect({
  kind: "computedStyle",
  sheetId: "Límites",
  range: "A10:M15",
  maxChars: 12000,
});
console.log(limitsStyle.ndjson);

await fs.mkdir(previewDir, { recursive: true });
for (const sheet of workbook.worksheets.items) {
  const used = sheet.getUsedRange();
  if (!used) continue;
  const preview = await workbook.render({
    sheetName: sheet.name,
    autoCrop: "all",
    scale: 1,
    format: "png",
  });
  const safeName = sheet.name.replace(/[^a-z0-9_-]+/gi, "_");
  await fs.writeFile(`${previewDir}/${safeName}.png`, new Uint8Array(await preview.arrayBuffer()));
  console.log(`PREVIEW\t${sheet.name}\t${previewDir}/${safeName}.png`);
}
