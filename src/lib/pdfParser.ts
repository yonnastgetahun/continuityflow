import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js`;

export interface ParsedPage {
  pageNumber: number;
  text: string;
}

export interface ParsedDocument {
  docType: 'invoice' | 'w9';
  fullText: string;
  pages: ParsedPage[];
  isScanned: boolean;
  fileName: string;
}

const MIN_TEXT_DENSITY = 50; // Minimum characters to consider as text-based PDF

export async function parsePDF(
  file: File,
  docType: 'invoice' | 'w9'
): Promise<ParsedDocument> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const pages: ParsedPage[] = [];
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      pages.push({
        pageNumber: pageNum,
        text: pageText,
      });
      
      fullText += (pageNum > 1 ? '\n\n' : '') + pageText;
    }

    // Determine if this is a scanned document
    const totalChars = fullText.replace(/\s/g, '').length;
    const charsPerPage = totalChars / pdf.numPages;
    const isScanned = charsPerPage < MIN_TEXT_DENSITY;

    return {
      docType,
      fullText: fullText.trim(),
      pages,
      isScanned,
      fileName: file.name,
    };
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error(`Failed to parse ${docType.toUpperCase()} PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function extractFieldsFromText(
  invoiceDoc: ParsedDocument,
  w9Doc?: ParsedDocument
): ExtractedFields {
  const invoiceText = invoiceDoc.fullText;
  const w9Text = w9Doc?.fullText || '';

  // Extract vendor info (prefer W9 if available)
  const vendorSource = w9Text || invoiceText;
  
  return {
    vendor: {
      name: extractPattern(vendorSource, [
        /(?:Name|Business Name|Company)[:\s]*([A-Za-z0-9\s&.,'-]+)/i,
        /^([A-Z][A-Za-z0-9\s&.,'-]+(?:Inc\.?|LLC|Corp\.?|Company|Co\.?))/m,
      ], 'high', w9Text ? 'W9 document' : 'Invoice header'),
      
      address: extractPattern(vendorSource, [
        /(?:Address|Street)[:\s]*([0-9]+[A-Za-z0-9\s.,#-]+)/i,
        /(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way)[.,]?)/i,
      ], 'medium', 'Address field'),
      
      city: extractPattern(vendorSource, [
        /(?:City)[:\s]*([A-Za-z\s]+)/i,
        /([A-Za-z\s]+),\s*[A-Z]{2}\s*\d{5}/,
      ], 'medium', 'Address section'),
      
      state: extractPattern(vendorSource, [
        /(?:State)[:\s]*([A-Z]{2})/i,
        /[A-Za-z\s]+,\s*([A-Z]{2})\s*\d{5}/,
      ], 'high', 'Address section'),
      
      zip: extractPattern(vendorSource, [
        /(?:ZIP|Zip Code|Postal)[:\s]*(\d{5}(?:-\d{4})?)/i,
        /[A-Z]{2}\s*(\d{5}(?:-\d{4})?)/,
      ], 'high', 'Address section'),
      
      taxId: extractPattern(w9Text || invoiceText, [
        /(?:TIN|Tax ID|EIN|SSN)[:\s#]*(\d{2}-?\d{7})/i,
        /(\d{2}-\d{7})/,
      ], w9Text ? 'high' : 'low', w9Text ? 'W9 TIN field' : 'Invoice (unverified)'),
      
      email: extractPattern(vendorSource, [
        /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
      ], 'medium', 'Contact section'),
      
      phone: extractPattern(vendorSource, [
        /(?:Phone|Tel|Telephone)[:\s]*([(\d)\s.-]+\d{4})/i,
        /(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/,
      ], 'low', 'Contact section'),
    },
    invoice: {
      invoiceNumber: extractPattern(invoiceText, [
        /(?:Invoice|Inv)[#:\s]*([A-Za-z0-9-]+)/i,
        /(?:Number|No\.?)[#:\s]*([A-Za-z0-9-]+)/i,
      ], 'high', 'Invoice header'),
      
      invoiceDate: extractPattern(invoiceText, [
        /(?:Invoice Date|Date)[:\s]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
        /(?:Date)[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
      ], 'high', 'Invoice date field'),
      
      dueDate: extractPattern(invoiceText, [
        /(?:Due Date|Payment Due|Due)[:\s]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
        /(?:Due)[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
      ], 'medium', 'Due date field'),
      
      subtotal: extractPattern(invoiceText, [
        /(?:Subtotal|Sub-total|Sub Total)[:\s$]*([0-9,]+\.?\d*)/i,
      ], 'high', 'Subtotal line'),
      
      tax: extractPattern(invoiceText, [
        /(?:Tax|Sales Tax|VAT)[:\s$]*([0-9,]+\.?\d*)/i,
      ], 'medium', 'Tax line'),
      
      total: extractPattern(invoiceText, [
        /(?:Total|Amount Due|Balance Due|Grand Total)[:\s$]*([0-9,]+\.?\d*)/i,
        /\$\s*([0-9,]+\.\d{2})\s*$/m,
      ], 'high', 'Total amount'),
    },
  };
}

interface ExtractedField {
  value: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string;
}

export interface ExtractedFields {
  vendor: {
    name: ExtractedField;
    address: ExtractedField;
    city: ExtractedField;
    state: ExtractedField;
    zip: ExtractedField;
    taxId: ExtractedField;
    email: ExtractedField;
    phone: ExtractedField;
  };
  invoice: {
    invoiceNumber: ExtractedField;
    invoiceDate: ExtractedField;
    dueDate: ExtractedField;
    subtotal: ExtractedField;
    tax: ExtractedField;
    total: ExtractedField;
  };
}

function extractPattern(
  text: string,
  patterns: RegExp[],
  defaultConfidence: 'high' | 'medium' | 'low',
  evidence: string
): ExtractedField {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return {
        value: match[1].trim(),
        confidence: defaultConfidence,
        evidence,
      };
    }
  }
  
  return {
    value: '',
    confidence: 'low',
    evidence: 'Not found in document',
  };
}
