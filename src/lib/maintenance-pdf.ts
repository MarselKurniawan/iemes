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
 
 export function generateMaintenanceDetailPdf(item: MaintenanceDetailForPdf) {
   const doc = new jsPDF();
   const pageWidth = doc.internal.pageSize.getWidth();
   
   // Header with SINERGI branding
   doc.setFillColor(30, 41, 59); // slate-800
   doc.rect(0, 0, pageWidth, 40, 'F');
   
   doc.setTextColor(255, 255, 255);
   doc.setFontSize(28);
   doc.setFont('helvetica', 'bold');
   doc.text('SINERGI', 14, 22);
   
   doc.setFontSize(10);
   doc.setFont('helvetica', 'normal');
   doc.text('Inventory Management System', 14, 32);
   
   // Document title
   doc.setTextColor(30, 41, 59);
   doc.setFontSize(16);
   doc.setFont('helvetica', 'bold');
   doc.text('Detail Maintenance', 14, 55);
   
   // Maintenance code badge
   doc.setFontSize(11);
   doc.setFont('helvetica', 'normal');
   doc.setTextColor(100, 116, 139);
   doc.text(`Kode: ${item.code}`, 14, 63);
   
   // Main content table
   const tableData = [
     ['Judul', item.title],
     ['Tipe', typeLabels[item.type] || item.type],
     ['Target', item.target || '-'],
     ['Status', statusLabels[item.status] || item.status],
     ['Approval', approvalLabels[item.approval_status] || item.approval_status],
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
     startY: 70,
     head: [],
     body: tableData,
     theme: 'plain',
     styles: {
       fontSize: 10,
       cellPadding: 6,
     },
     columnStyles: {
       0: { 
         fontStyle: 'bold', 
         cellWidth: 45,
         textColor: [100, 116, 139],
       },
       1: { 
         cellWidth: 'auto',
         textColor: [30, 41, 59],
       },
     },
     alternateRowStyles: {
       fillColor: [248, 250, 252], // slate-50
     },
   });
   
   // Footer
   const pageHeight = doc.internal.pageSize.getHeight();
   doc.setFontSize(8);
   doc.setTextColor(148, 163, 184);
   doc.text(
     `Dicetak pada: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
     14,
     pageHeight - 10
   );
   doc.text('SINERGI - Inventory Management System', pageWidth - 14, pageHeight - 10, { align: 'right' });
   
   // Save
   doc.save(`maintenance-${item.code}.pdf`);
 }