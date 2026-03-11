import * as XLSX from 'xlsx';

interface ExcelReportOptions {
  title: string;
  subtitle?: string;
  headers: string[];
  body: (string | number)[][];
  sheetName: string;
  fileName: string;
}

export function generateBrandedExcel(options: ExcelReportOptions) {
  const { title, subtitle, headers, body, sheetName, fileName } = options;

  // Build rows: title row, subtitle, blank, header, data
  const wsData: (string | number)[][] = [];

  // Title
  wsData.push([title]);
  if (subtitle) wsData.push([subtitle]);
  wsData.push([`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`]);
  wsData.push([]); // blank row
  wsData.push(headers);

  // Data rows
  body.forEach(row => wsData.push(row));

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths based on header + data content
  const colWidths = headers.map((h, i) => {
    let maxLen = h.length;
    body.forEach(row => {
      const cellVal = String(row[i] ?? '');
      if (cellVal.length > maxLen) maxLen = cellVal.length;
    });
    return { wch: Math.min(Math.max(maxLen + 2, 10), 45) };
  });
  ws['!cols'] = colWidths;

  // Merge title row across all columns
  const lastCol = headers.length - 1;
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
  ];
  if (subtitle) {
    ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } });
    ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: lastCol } });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
