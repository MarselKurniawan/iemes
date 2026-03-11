import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
}

export function generateBrandedReportPdf(options: ReportPdfOptions) {
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
  } = options;

  const doc = new jsPDF({ orientation });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // ── Header bar ──
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 38, 'F');

  // Accent line
  doc.setFillColor(59, 130, 246); // blue-500
  doc.rect(0, 38, pageWidth, 2.5, 'F');

  // Logo text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('SINERGI', margin, 20);

  // Tagline
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Inventory Management System', margin, 28);

  // Report type badge
  const badgeText = title.toUpperCase();
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  const badgeWidth = doc.getTextWidth(badgeText) + 14;
  doc.setFillColor(30, 64, 175); // blue-800
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

  // Meta info line
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);

  const metaParts: string[] = [];
  if (totalRows !== undefined) {
    metaParts.push(`Total: ${totalRows} data`);
  }
  if (selectedRows && selectedRows > 0) {
    metaParts.push(`Terpilih: ${selectedRows} data`);
  }
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

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 6;

  // ── Table ──
  autoTable(doc, {
    startY: currentY,
    head: [headers],
    body: body,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      textColor: [30, 41, 59],
      overflow: 'linebreak',
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
    columnStyles: buildColumnStyles(headers),
    didParseCell: (data) => {
      // Style cost/price columns with right alignment
      if (data.section === 'body') {
        const val = data.cell.raw;
        if (typeof val === 'string' && val.startsWith('Rp ')) {
          data.cell.styles.halign = 'right';
          data.cell.styles.fontStyle = 'bold';
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
