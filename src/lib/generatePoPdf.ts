import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface POData {
  poNumber: string;
  poDate: string;
  vendorName: string;
  vendorAddress: string;
  shipTo: string;
  billTo: string;
  subtotal: string;
  tax: string;
  total: string;
  notes: string;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return (num || 0).toFixed(2);
}

export function generatePoPdf(data: POData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // Header
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('PURCHASE ORDER', pageWidth / 2, y, { align: 'center' });
  y += 15;

  // PO Number and Date in a box
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y - 5, pageWidth - margin * 2, 15, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`PO #: ${data.poNumber}`, margin + 5, y + 5);
  doc.text(`Date: ${data.poDate}`, pageWidth - margin - 5, y + 5, { align: 'right' });
  y += 20;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Three column layout: Vendor | Ship To | Bill To
  const colWidth = (pageWidth - margin * 2) / 3;
  const startY = y;

  // Vendor Column
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('VENDOR', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  if (data.vendorName) {
    doc.setFont('helvetica', 'bold');
    doc.text(data.vendorName, margin, y);
    doc.setFont('helvetica', 'normal');
    y += 5;
  }
  if (data.vendorAddress) {
    const lines = doc.splitTextToSize(data.vendorAddress, colWidth - 10);
    doc.text(lines, margin, y);
  }

  // Ship To Column
  y = startY;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('SHIP TO', margin + colWidth, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  if (data.shipTo) {
    const lines = doc.splitTextToSize(data.shipTo, colWidth - 10);
    doc.text(lines, margin + colWidth, y);
  }

  // Bill To Column
  y = startY;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('BILL TO', margin + colWidth * 2, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  if (data.billTo) {
    const lines = doc.splitTextToSize(data.billTo, colWidth - 10);
    doc.text(lines, margin + colWidth * 2, y);
  }

  y = startY + 35;

  // Line items table (if available)
  if (data.lineItems && data.lineItems.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Description', 'Qty', 'Unit Price', 'Total']],
      body: data.lineItems.map(item => [
        item.description,
        item.quantity.toString(),
        `$${formatCurrency(item.unitPrice)}`,
        `$${formatCurrency(item.total)}`
      ]),
      margin: { left: margin, right: margin },
      headStyles: { 
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'center', cellWidth: 25 },
        2: { halign: 'right', cellWidth: 35 },
        3: { halign: 'right', cellWidth: 35 }
      }
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  } else {
    // Simple divider if no line items
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 15;
  }

  // Totals Section - right aligned
  const totalsX = pageWidth - margin - 80;
  const valuesX = pageWidth - margin;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Subtotal
  doc.text('Subtotal:', totalsX, y);
  doc.text(`$${formatCurrency(data.subtotal)}`, valuesX, y, { align: 'right' });
  y += 7;

  // Tax
  doc.text('Tax:', totalsX, y);
  doc.text(`$${formatCurrency(data.tax)}`, valuesX, y, { align: 'right' });
  y += 7;

  // Total line
  doc.setDrawColor(200, 200, 200);
  doc.line(totalsX, y, valuesX, y);
  y += 7;

  // Total
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL:', totalsX, y);
  doc.text(`$${formatCurrency(data.total)}`, valuesX, y, { align: 'right' });
  y += 20;

  // Notes Section
  if (data.notes) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('NOTES', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const notesLines = doc.splitTextToSize(data.notes, pageWidth - margin * 2);
    doc.text(notesLines, margin, y);
  }

  return doc;
}

export function downloadPoPdf(data: POData): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const doc = generatePoPdf(data);
      
      // Generate filename: PO_<number>_<vendor>.pdf
      const vendorSlug = data.vendorName 
        ? `_${data.vendorName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20)}`
        : '';
      const filename = `PO_${data.poNumber}${vendorSlug}.pdf`;
      
      // Get blob and trigger download via anchor
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}
