import { jsPDF } from 'jspdf';

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

  // PO Number and Date
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`PO Number: ${data.poNumber}`, margin, y);
  doc.text(`Date: ${data.poDate}`, pageWidth - margin, y, { align: 'right' });
  y += 15;

  // Divider line
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;

  // Vendor Section
  doc.setFont('helvetica', 'bold');
  doc.text('VENDOR:', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  if (data.vendorName) {
    doc.text(data.vendorName, margin, y);
    y += 6;
  }
  if (data.vendorAddress) {
    const addressLines = doc.splitTextToSize(data.vendorAddress, 80);
    doc.text(addressLines, margin, y);
    y += addressLines.length * 6;
  }
  y += 10;

  // Ship To / Bill To
  const colWidth = (pageWidth - margin * 2) / 2;
  const shipBillY = y;

  // Ship To
  doc.setFont('helvetica', 'bold');
  doc.text('SHIP TO:', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  if (data.shipTo) {
    const shipLines = doc.splitTextToSize(data.shipTo, colWidth - 10);
    doc.text(shipLines, margin, y);
  }

  // Bill To
  y = shipBillY;
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO:', margin + colWidth, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  if (data.billTo) {
    const billLines = doc.splitTextToSize(data.billTo, colWidth - 10);
    doc.text(billLines, margin + colWidth, y);
  }

  y = shipBillY + 40;

  // Divider line
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;

  // Totals Section
  const totalsX = pageWidth - margin - 60;
  
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', totalsX, y);
  doc.text(`$${formatCurrency(data.subtotal)}`, pageWidth - margin, y, { align: 'right' });
  y += 8;

  doc.text('Tax:', totalsX, y);
  doc.text(`$${formatCurrency(data.tax)}`, pageWidth - margin, y, { align: 'right' });
  y += 8;

  doc.setLineWidth(0.3);
  doc.line(totalsX, y, pageWidth - margin, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', totalsX, y);
  doc.setFontSize(14);
  doc.text(`$${formatCurrency(data.total)}`, pageWidth - margin, y, { align: 'right' });
  y += 20;

  // Notes Section
  if (data.notes) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTES:', margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    const notesLines = doc.splitTextToSize(data.notes, pageWidth - margin * 2);
    doc.text(notesLines, margin, y);
  }

  return doc;
}

function formatCurrency(value: string): string {
  const num = parseFloat(value) || 0;
  return num.toFixed(2);
}

export function downloadPoPdf(data: POData): void {
  const doc = generatePoPdf(data);
  doc.save(`${data.poNumber}.pdf`);
}
