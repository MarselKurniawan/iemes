import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PhotoItem {
  label: string;
  urls: string[];
}

interface ReportPdfOptions {
  title: string;
  subtitle?: string;
  headers: string[];
  body: (string | number)[][];
  orientation?: 'landscape' | 'portrait';
  fileName: string;
  dateRange?: { from?: string; to?: string };
  totalRows?: number;
  selectedRows?: number;
  photos?: PhotoItem[];
  onProgress?: (message: string) => void;
}

async function loadImageAsBase64(url: string, timeoutMs = 5000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Pre-load all photos in parallel so the PDF render is fast */
async function preloadAllPhotos(photos: PhotoItem[]): Promise<Map<string, string | null>> {
  const cache = new Map<string, string | null>();
  const uniqueUrls = new Set<string>();
  for (const item of photos) {
    for (const url of item.urls) uniqueUrls.add(url);
  }
  const entries = await Promise.all(
    Array.from(uniqueUrls).map(async (url) => {
      const data = await loadImageAsBase64(url);
      return [url, data] as const;
    })
  );
  for (const [url, data] of entries) cache.set(url, data);
  return cache;
}

export async function generateBrandedReportPdf(options: ReportPdfOptions) {
  const {
    title,
    subtitle,
    headers,
    body,
    orientation = 'landscape',
    fileName,
    dateRange,
    totalRows,
    selectedRows,
    photos,
    onProgress,
  } = options;

  onProgress?.('Menyiapkan dokumen...');

  const doc = new jsPDF({ orientation });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // ── Header bar ──
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 38, 'F');

  doc.setFillColor(59, 130, 246);
  doc.rect(0, 38, pageWidth, 2.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('SINERGI', margin, 20);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Inventory Management System', margin, 28);

  const badgeText = title.toUpperCase();
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  const badgeWidth = doc.getTextWidth(badgeText) + 14;
  doc.setFillColor(30, 64, 175);
  doc.roundedRect(pageWidth - margin - badgeWidth, 12, badgeWidth, 16, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(badgeText, pageWidth - margin - badgeWidth + 7, 22);

  // ── Title section ──
  let currentY = 50;

  if (subtitle) {
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(subtitle, margin, currentY);
    currentY += 8;
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);

  const metaParts: string[] = [];
  if (totalRows !== undefined) metaParts.push(`Total: ${totalRows} data`);
  if (selectedRows && selectedRows > 0) metaParts.push(`Terpilih: ${selectedRows} data`);
  if (dateRange?.from || dateRange?.to) {
    const from = dateRange.from ? formatDateId(dateRange.from) : '...';
    const to = dateRange.to ? formatDateId(dateRange.to) : '...';
    metaParts.push(`Periode: ${from} — ${to}`);
  }
  metaParts.push(`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`);

  if (metaParts.length > 0) {
    doc.text(metaParts.join('   |   '), margin, currentY);
    currentY += 4;
  }

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 6;

  // ── Preload photos (embedded in main table) ──
  const hasPhotos = !!(photos && photos.some(p => p.urls.length > 0));
  let photoCache = new Map<string, string | null>();
  let photoByKode = new Map<string, string[]>();

  if (hasPhotos) {
    const totalPhotos = photos!.reduce((s, p) => s + p.urls.length, 0);
    onProgress?.(`Mengunduh ${totalPhotos} foto...`);
    photoCache = await preloadAllPhotos(photos!);
    // Map by "kode" (prefix before " — ") for row matching
    for (const p of photos!) {
      const kode = p.label.split(' — ')[0].trim();
      photoByKode.set(kode, p.urls);
    }
    onProgress?.('Merender tabel...');
  }

  // Detect the "Kode" column index (fallback to 1)
  const kodeColIdx = headers.findIndex(h => h.toLowerCase() === 'kode');
  const kodeIdx = kodeColIdx >= 0 ? kodeColIdx : 1;

  // Extend headers/body with Foto column when photos exist
  const finalHeaders = hasPhotos ? [...headers, 'Foto'] : headers;
  const finalBody = hasPhotos ? body.map(r => [...r, '']) : body;
  const fotoColIndex = finalHeaders.length - 1;

  // Photo cell layout
  const imgSize = 16;
  const imgGap = 2;
  const imagesPerRow = 3;
  const cellPad = 2;
  const fotoColWidth = imagesPerRow * imgSize + (imagesPerRow - 1) * imgGap + cellPad * 2;

  // ── Table ──
  autoTable(doc, {
    startY: currentY,
    head: [finalHeaders],
    body: finalBody,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      textColor: [30, 41, 59],
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      ...buildColumnStyles(finalHeaders),
      ...(hasPhotos ? { [fotoColIndex]: { cellWidth: fotoColWidth, cellPadding: cellPad } } : {}),
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const val = data.cell.raw;
        if (typeof val === 'string' && val.startsWith('Rp ')) {
          data.cell.styles.halign = 'right';
          data.cell.styles.fontStyle = 'bold';
        }
        if (hasPhotos && data.column.index === fotoColIndex) {
          const kode = String(finalBody[data.row.index]?.[kodeIdx] ?? '').trim();
          const urls = photoByKode.get(kode) ?? [];
          if (urls.length > 0) {
            const rows = Math.ceil(urls.length / imagesPerRow);
            data.cell.styles.minCellHeight = rows * imgSize + (rows - 1) * imgGap + cellPad * 2;
          }
        }
      }
    },
    didDrawCell: (data) => {
      if (!hasPhotos || data.section !== 'body' || data.column.index !== fotoColIndex) return;
      const kode = String(finalBody[data.row.index]?.[kodeIdx] ?? '').trim();
      const urls = photoByKode.get(kode) ?? [];
      if (urls.length === 0) return;
      const startX = data.cell.x + cellPad;
      const startY = data.cell.y + cellPad;
      for (let i = 0; i < urls.length; i++) {
        const col = i % imagesPerRow;
        const row = Math.floor(i / imagesPerRow);
        const x = startX + col * (imgSize + imgGap);
        const y = startY + row * (imgSize + imgGap);
        const base64 = photoCache.get(urls[i]) ?? null;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, imgSize, imgSize, 1, 1, 'S');
        if (base64) {
          try {
            doc.addImage(base64, 'JPEG', x + 0.4, y + 0.4, imgSize - 0.8, imgSize - 0.8);
          } catch {
            doc.setFontSize(5);
            doc.setTextColor(148, 163, 184);
            doc.text('Err', x + imgSize / 2, y + imgSize / 2, { align: 'center' });
          }
        } else {
          doc.setFontSize(5);
          doc.setTextColor(148, 163, 184);
          doc.text('N/A', x + imgSize / 2, y + imgSize / 2, { align: 'center' });
        }
      }
    },
    margin: { left: margin, right: margin },
  });


  // ── Footer on every page ──
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);

    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text('SINERGI — Inventory Management System', margin, pageHeight - 10);
    doc.text(`Halaman ${i} / ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  onProgress?.('Menyimpan file PDF...');
  doc.save(`${fileName}.pdf`);
}

function buildColumnStyles(headers: string[]): Record<number, any> {
  const styles: Record<number, any> = {};
  headers.forEach((h, i) => {
    const lower = h.toLowerCase();
    if (lower === 'no') {
      styles[i] = { cellWidth: 10, halign: 'center' };
    } else if (lower === 'kode') {
      styles[i] = { cellWidth: 28, fontStyle: 'bold', fontSize: 6.5 };
    } else if (lower.includes('harga') || lower.includes('biaya')) {
      styles[i] = { cellWidth: 28, halign: 'right' };
    } else if (lower === 'status' || lower === 'kondisi' || lower === 'approval') {
      styles[i] = { cellWidth: 22 };
    } else if (lower === 'tipe' || lower === 'kategori') {
      styles[i] = { cellWidth: 30 };
    }
  });
  return styles;
}

export function formatDateId(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatCurrency(value: number | null | undefined): string {
  if (!value && value !== 0) return '-';
  return `Rp ${value.toLocaleString('id-ID')}`;
}
