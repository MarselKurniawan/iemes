 import jsPDF from 'jspdf';
 import autoTable from 'jspdf-autotable';
 
 interface MaintenanceDetailForPdf {
   code: string;
   title: string;
   type: string;
   status: string;
   approval_status: string;
   target: string;
   description: string | null;
   start_date: string;
   end_date: string | null;
   total_cost: number;
   rejection_reason: string | null;
   approved_at: string | null;
  evidence_urls: string[] | null;
 }
 
 const typeLabels: Record<string, string> = {
   renovasi_lokasi: 'Renovasi Lokasi',
   perbaikan_aset: 'Perbaikan Aset',
 };
 
 const statusLabels: Record<string, string> = {
   pending: 'Pending',
   in_progress: 'Dalam Proses',
   completed: 'Selesai',
   cancelled: 'Dibatalkan',
 };
 
 const approvalLabels: Record<string, string> = {
   pending_approval: 'Menunggu Approval',
   approved: 'Disetujui',
   rejected: 'Ditolak',
 };
 
// Convert image URL to base64 for PDF embedding
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
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

export async function generateMaintenanceDetailPdf(item: MaintenanceDetailForPdf) {
   const doc = new jsPDF();
   const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
   
  // Modern header with gradient effect (simulated with rectangles)
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 50, 'F');
  
  // Accent line
  doc.setFillColor(59, 130, 246); // blue-500
  doc.rect(0, 50, pageWidth, 3, 'F');
   
  // SINERGI logo text
   doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
   doc.setFont('helvetica', 'bold');
  doc.text('SINERGI', margin, 28);
   
  // Tagline
  doc.setFontSize(9);
   doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Inventory Management System', margin, 38);
  
  // Document type badge on right
  doc.setFillColor(30, 64, 175); // blue-800
  const badgeText = 'MAINTENANCE REPORT';
  const badgeWidth = doc.getTextWidth(badgeText) + 16;
  doc.roundedRect(pageWidth - margin - badgeWidth, 18, badgeWidth, 20, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(badgeText, pageWidth - margin - badgeWidth + 8, 30);
   
  // Content area starts
  let currentY = 70;
  
  // Title section with code
   doc.setTextColor(30, 41, 59);
  doc.setFontSize(18);
   doc.setFont('helvetica', 'bold');
  doc.text(item.title, margin, currentY);
   
  currentY += 8;
  
  // Code badge
  doc.setFillColor(241, 245, 249); // slate-100
  const codeText = item.code;
  const codeWidth = doc.getTextWidth(codeText) + 12;
  doc.roundedRect(margin, currentY - 4, codeWidth, 14, 2, 2, 'F');
  doc.setFontSize(9);
   doc.setFont('helvetica', 'normal');
   doc.setTextColor(100, 116, 139);
  doc.text(codeText, margin + 6, currentY + 5);
  
  currentY += 20;
  
  // Divider line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  
  currentY += 15;
   
  // Info cards layout - 2 columns
  const colWidth = (pageWidth - margin * 2 - 10) / 2;
  const cardHeight = 35;
  
  // Card 1: Type
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(margin, currentY, colWidth, cardHeight, 3, 3, 'F');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TIPE', margin + 8, currentY + 12);
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text(typeLabels[item.type] || item.type, margin + 8, currentY + 25);
  
  // Card 2: Target
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin + colWidth + 10, currentY, colWidth, cardHeight, 3, 3, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('TARGET', margin + colWidth + 18, currentY + 12);
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text(item.target || '-', margin + colWidth + 18, currentY + 25);
  
  currentY += cardHeight + 10;
  
  // Card 3: Status with color coding
  const statusColor = item.status === 'completed' ? [34, 197, 94] : 
                      item.status === 'in_progress' ? [59, 130, 246] :
                      item.status === 'cancelled' ? [239, 68, 68] : [251, 191, 36];
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.roundedRect(margin, currentY, colWidth, cardHeight, 3, 3, 'F');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.text('STATUS', margin + 8, currentY + 12);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(statusLabels[item.status] || item.status, margin + 8, currentY + 25);
  
  // Card 4: Approval with color coding
  const approvalColor = item.approval_status === 'approved' ? [34, 197, 94] :
                        item.approval_status === 'rejected' ? [239, 68, 68] : [251, 191, 36];
  doc.setFillColor(approvalColor[0], approvalColor[1], approvalColor[2]);
  doc.roundedRect(margin + colWidth + 10, currentY, colWidth, cardHeight, 3, 3, 'F');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.text('APPROVAL', margin + colWidth + 18, currentY + 12);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(approvalLabels[item.approval_status] || item.approval_status, margin + colWidth + 18, currentY + 25);
  
  currentY += cardHeight + 15;
  
  // Details table
   const tableData = [
     ['Tanggal Mulai', new Date(item.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })],
     ['Tanggal Selesai', item.end_date ? new Date(item.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'],
     ['Total Biaya', `Rp ${item.total_cost.toLocaleString('id-ID')}`],
   ];
   
   if (item.description) {
     tableData.push(['Deskripsi', item.description]);
   }
   
   if (item.approved_at) {
     tableData.push(['Tanggal Approval', new Date(item.approved_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })]);
   }
   
   if (item.rejection_reason) {
     tableData.push(['Alasan Penolakan', item.rejection_reason]);
   }
   
   autoTable(doc, {
    startY: currentY,
     head: [],
     body: tableData,
     theme: 'plain',
     styles: {
      fontSize: 9,
      cellPadding: { top: 8, right: 12, bottom: 8, left: 12 },
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
     },
     columnStyles: {
       0: { 
         fontStyle: 'bold', 
        cellWidth: 50,
         textColor: [100, 116, 139],
        fillColor: [248, 250, 252],
       },
       1: { 
         cellWidth: 'auto',
         textColor: [30, 41, 59],
       },
     },
    didParseCell: (data) => {
      if (data.column.index === 0) {
        data.cell.styles.fillColor = [248, 250, 252];
      }
     },
   });
   
  // Get final Y position after table
  const finalY = (doc as any).lastAutoTable?.finalY || currentY + 60;
  currentY = finalY + 15;
  
  // Evidence photos section
  if (item.evidence_urls && item.evidence_urls.length > 0) {
    // Check if we need a new page
    if (currentY > pageHeight - 100) {
      doc.addPage();
      currentY = 30;
    }
    
    // Section title
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(margin, currentY, 80, 18, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('DOKUMENTASI EVIDENCE', margin + 8, currentY + 12);
    
    currentY += 28;
    
    // Load and add images
    const imageSize = 55;
    const imagesPerRow = 3;
    const imageGap = 8;
    
    for (let i = 0; i < item.evidence_urls.length; i++) {
      const base64 = await loadImageAsBase64(item.evidence_urls[i]);
      
      if (base64) {
        const col = i % imagesPerRow;
        const row = Math.floor(i / imagesPerRow);
        const x = margin + col * (imageSize + imageGap);
        const y = currentY + row * (imageSize + imageGap + 15);
        
        // Check if we need a new page
        if (y + imageSize > pageHeight - 30) {
          doc.addPage();
          currentY = 30;
        }
        
        // Image container with border
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.roundedRect(x, y, imageSize, imageSize, 3, 3, 'S');
        
        try {
          doc.addImage(base64, 'JPEG', x + 2, y + 2, imageSize - 4, imageSize - 4);
        } catch {
          // If image fails, show placeholder text
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text('Image', x + imageSize / 2, y + imageSize / 2, { align: 'center' });
        }
        
        // Image label
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(`Foto ${i + 1}`, x + imageSize / 2, y + imageSize + 8, { align: 'center' });
      }
    }
  }
  
  // Footer on last page
   doc.setFontSize(8);
   doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  
  // Footer line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
  
   doc.text(
     `Dicetak pada: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    margin,
    pageHeight - 12
   );
  doc.text('SINERGI - Inventory Management System', pageWidth - margin, pageHeight - 12, { align: 'right' });
   
   // Save
   doc.save(`maintenance-${item.code}.pdf`);
 }