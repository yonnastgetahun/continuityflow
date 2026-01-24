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

export interface FieldEvidence {
  docType: 'invoice' | 'w9';
  pageNumber: number;
  snippet: string;
}

export interface ExtractedField {
  value: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: FieldEvidence;
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

const MIN_TEXT_DENSITY = 50;

interface ExtractionCandidate {
  value: string;
  pageNumber: number;
  snippet: string;
  labelMatchStrength: number; // 0-1: how well the label matches
  proximityScore: number; // 0-1: how close to keyword
  formatScore: number; // 0-1: how well it matches expected format
  uniquenessScore: number; // 0-1: how unique this match is
}

interface PatternConfig {
  pattern: RegExp;
  labelKeywords: string[];
  formatValidator?: (value: string) => number;
  labelMatchWeight?: number;
}

// Format validators return 0-1 score
const formatValidators = {
  date: (value: string): number => {
    // Check various date formats
    const datePatterns = [
      /^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}$/,
      /^[A-Za-z]+\s+\d{1,2},?\s+\d{4}$/,
      /^\d{4}-\d{2}-\d{2}$/,
    ];
    for (const pattern of datePatterns) {
      if (pattern.test(value)) return 1;
    }
    return 0.3;
  },
  
  currency: (value: string): number => {
    const cleaned = value.replace(/[$,\s]/g, '');
    if (/^\d+\.?\d{0,2}$/.test(cleaned)) return 1;
    if (/^\d+$/.test(cleaned)) return 0.8;
    return 0.2;
  },
  
  taxId: (value: string): number => {
    const cleaned = value.replace(/[-\s]/g, '');
    if (/^\d{9}$/.test(cleaned)) return 1;
    if (/^\d{2}-\d{7}$/.test(value)) return 1;
    return 0.3;
  },
  
  email: (value: string): number => {
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) return 1;
    return 0;
  },
  
  phone: (value: string): number => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 11) return 1;
    if (digits.length >= 7) return 0.6;
    return 0.2;
  },
  
  zip: (value: string): number => {
    if (/^\d{5}(-\d{4})?$/.test(value)) return 1;
    if (/^\d{5}$/.test(value)) return 1;
    return 0.3;
  },
  
  state: (value: string): number => {
    const states = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];
    return states.includes(value.toUpperCase()) ? 1 : 0.3;
  },
  
  invoiceNumber: (value: string): number => {
    if (/^[A-Za-z]{0,3}\d{3,}[A-Za-z0-9-]*$/.test(value)) return 1;
    if (/^\d+$/.test(value)) return 0.9;
    if (/^[A-Za-z0-9-]+$/.test(value)) return 0.7;
    return 0.4;
  },
};

function calculateLabelMatchStrength(text: string, keywords: string[], matchIndex: number): number {
  const searchWindow = text.substring(Math.max(0, matchIndex - 100), matchIndex).toLowerCase();
  
  let maxScore = 0;
  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    const keywordIndex = searchWindow.lastIndexOf(keywordLower);
    if (keywordIndex !== -1) {
      const distance = searchWindow.length - keywordIndex - keywordLower.length;
      const proximityScore = Math.max(0, 1 - distance / 50);
      maxScore = Math.max(maxScore, proximityScore);
    }
  }
  
  return maxScore;
}

function extractSnippet(text: string, matchIndex: number, matchLength: number): string {
  const snippetStart = Math.max(0, matchIndex - 30);
  const snippetEnd = Math.min(text.length, matchIndex + matchLength + 30);
  let snippet = text.substring(snippetStart, snippetEnd);
  
  if (snippetStart > 0) snippet = '...' + snippet;
  if (snippetEnd < text.length) snippet = snippet + '...';
  
  return snippet.replace(/\s+/g, ' ').trim();
}

function findAllCandidates(
  pages: ParsedPage[],
  docType: 'invoice' | 'w9',
  patterns: PatternConfig[]
): ExtractionCandidate[] {
  const candidates: ExtractionCandidate[] = [];
  const allMatches: string[] = [];
  
  // First pass: collect all matches for uniqueness scoring
  for (const page of pages) {
    for (const config of patterns) {
      const matches = page.text.matchAll(new RegExp(config.pattern, 'gi'));
      for (const match of matches) {
        if (match[1]) allMatches.push(match[1].trim());
      }
    }
  }
  
  // Second pass: extract candidates with scores
  for (const page of pages) {
    for (const config of patterns) {
      const regex = new RegExp(config.pattern, 'gi');
      let match;
      
      while ((match = regex.exec(page.text)) !== null) {
        if (!match[1]) continue;
        
        const value = match[1].trim();
        if (!value) continue;
        
        const matchIndex = match.index;
        
        // Calculate label match strength
        const labelMatchStrength = calculateLabelMatchStrength(
          page.text,
          config.labelKeywords,
          matchIndex
        );
        
        // Calculate format score
        const formatScore = config.formatValidator 
          ? config.formatValidator(value)
          : 0.5;
        
        // Calculate uniqueness (fewer occurrences = higher uniqueness)
        const occurrences = allMatches.filter(m => m === value).length;
        const uniquenessScore = 1 / Math.sqrt(occurrences);
        
        // Proximity score is factored into label match
        const proximityScore = labelMatchStrength > 0 ? 1 : 0.3;
        
        candidates.push({
          value,
          pageNumber: page.pageNumber,
          snippet: extractSnippet(page.text, matchIndex, match[0].length),
          labelMatchStrength,
          proximityScore,
          formatScore,
          uniquenessScore,
        });
      }
    }
  }
  
  return candidates;
}

function selectBestCandidate(
  candidates: ExtractionCandidate[],
  docType: 'invoice' | 'w9'
): { value: string; confidence: 'high' | 'medium' | 'low'; evidence: FieldEvidence } {
  if (candidates.length === 0) {
    return {
      value: '',
      confidence: 'low',
      evidence: { docType, pageNumber: 0, snippet: 'Not found in document' },
    };
  }
  
  // Score each candidate
  const scoredCandidates = candidates.map(c => {
    const score = 
      c.labelMatchStrength * 0.35 +
      c.formatScore * 0.30 +
      c.uniquenessScore * 0.20 +
      c.proximityScore * 0.15;
    return { ...c, totalScore: score };
  });
  
  // Sort by score descending
  scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);
  
  const best = scoredCandidates[0];
  
  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low';
  if (best.totalScore >= 0.7) {
    confidence = 'high';
  } else if (best.totalScore >= 0.4) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }
  
  return {
    value: best.value,
    confidence,
    evidence: {
      docType,
      pageNumber: best.pageNumber,
      snippet: best.snippet,
    },
  };
}

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
  const invoicePages = invoiceDoc.pages;
  const w9Pages = w9Doc?.pages || [];
  const vendorPages = w9Pages.length > 0 ? w9Pages : invoicePages;
  const vendorDocType = w9Doc ? 'w9' : 'invoice';

  return {
    vendor: {
      name: extractField(vendorPages, vendorDocType, [
        {
          pattern: /(?:Name|Business Name|Company|Legal Name)[:\s]*([A-Za-z0-9\s&.,'-]{2,50})/i,
          labelKeywords: ['name', 'business name', 'company', 'legal name'],
        },
        {
          pattern: /^([A-Z][A-Za-z0-9\s&.,'-]+(?:Inc\.?|LLC|Corp\.?|Company|Co\.?))/m,
          labelKeywords: ['inc', 'llc', 'corp', 'company'],
        },
      ]),
      
      address: extractField(vendorPages, vendorDocType, [
        {
          pattern: /(?:Address|Street)[:\s]*(\d+[A-Za-z0-9\s.,#-]{5,60})/i,
          labelKeywords: ['address', 'street', 'location'],
        },
        {
          pattern: /(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way)[.,]?)/i,
          labelKeywords: ['st', 'ave', 'rd', 'blvd', 'dr'],
        },
      ]),
      
      city: extractField(vendorPages, vendorDocType, [
        {
          pattern: /(?:City)[:\s]*([A-Za-z\s]{2,30})/i,
          labelKeywords: ['city'],
        },
        {
          pattern: /([A-Za-z\s]{2,25}),\s*[A-Z]{2}\s*\d{5}/,
          labelKeywords: [],
        },
      ]),
      
      state: extractField(vendorPages, vendorDocType, [
        {
          pattern: /(?:State)[:\s]*([A-Z]{2})/i,
          labelKeywords: ['state'],
          formatValidator: formatValidators.state,
        },
        {
          pattern: /[A-Za-z\s]+,\s*([A-Z]{2})\s*\d{5}/,
          labelKeywords: [],
          formatValidator: formatValidators.state,
        },
      ]),
      
      zip: extractField(vendorPages, vendorDocType, [
        {
          pattern: /(?:ZIP|Zip Code|Postal)[:\s]*(\d{5}(?:-\d{4})?)/i,
          labelKeywords: ['zip', 'postal', 'zipcode'],
          formatValidator: formatValidators.zip,
        },
        {
          pattern: /[A-Z]{2}\s*(\d{5}(?:-\d{4})?)/,
          labelKeywords: [],
          formatValidator: formatValidators.zip,
        },
      ]),
      
      taxId: extractField(
        w9Pages.length > 0 ? w9Pages : invoicePages,
        w9Doc ? 'w9' : 'invoice',
        [
          {
            pattern: /(?:TIN|Tax ID|EIN|SSN|Taxpayer)[:\s#]*(\d{2}-?\d{7})/i,
            labelKeywords: ['tin', 'tax id', 'ein', 'ssn', 'taxpayer'],
            formatValidator: formatValidators.taxId,
          },
          {
            pattern: /(\d{2}-\d{7})/,
            labelKeywords: [],
            formatValidator: formatValidators.taxId,
          },
        ]
      ),
      
      email: extractField(vendorPages, vendorDocType, [
        {
          pattern: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
          labelKeywords: ['email', 'e-mail', 'contact'],
          formatValidator: formatValidators.email,
        },
      ]),
      
      phone: extractField(vendorPages, vendorDocType, [
        {
          pattern: /(?:Phone|Tel|Telephone|Fax)[:\s]*([(\d)\s.-]+\d{4})/i,
          labelKeywords: ['phone', 'tel', 'telephone', 'fax', 'call'],
          formatValidator: formatValidators.phone,
        },
        {
          pattern: /(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/,
          labelKeywords: [],
          formatValidator: formatValidators.phone,
        },
      ]),
    },
    
    invoice: {
      invoiceNumber: extractField(invoicePages, 'invoice', [
        {
          pattern: /(?:Invoice|Inv)[#:\s]*([A-Za-z0-9-]+)/i,
          labelKeywords: ['invoice', 'inv', 'invoice number', 'invoice #'],
          formatValidator: formatValidators.invoiceNumber,
        },
        {
          pattern: /(?:Number|No\.?)[#:\s]*([A-Za-z0-9-]+)/i,
          labelKeywords: ['number', 'no'],
          formatValidator: formatValidators.invoiceNumber,
        },
      ]),
      
      invoiceDate: extractField(invoicePages, 'invoice', [
        {
          pattern: /(?:Invoice Date|Date)[:\s]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
          labelKeywords: ['invoice date', 'date', 'issued'],
          formatValidator: formatValidators.date,
        },
        {
          pattern: /(?:Date)[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
          labelKeywords: ['date'],
          formatValidator: formatValidators.date,
        },
      ]),
      
      dueDate: extractField(invoicePages, 'invoice', [
        {
          pattern: /(?:Due Date|Payment Due|Due)[:\s]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})/i,
          labelKeywords: ['due date', 'payment due', 'due', 'pay by'],
          formatValidator: formatValidators.date,
        },
        {
          pattern: /(?:Due)[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
          labelKeywords: ['due'],
          formatValidator: formatValidators.date,
        },
      ]),
      
      subtotal: extractField(invoicePages, 'invoice', [
        {
          pattern: /(?:Subtotal|Sub-total|Sub Total)[:\s$]*([0-9,]+\.?\d*)/i,
          labelKeywords: ['subtotal', 'sub-total', 'sub total'],
          formatValidator: formatValidators.currency,
        },
      ]),
      
      tax: extractField(invoicePages, 'invoice', [
        {
          pattern: /(?:Tax|Sales Tax|VAT)[:\s$]*([0-9,]+\.?\d*)/i,
          labelKeywords: ['tax', 'sales tax', 'vat', 'gst'],
          formatValidator: formatValidators.currency,
        },
      ]),
      
      total: extractField(invoicePages, 'invoice', [
        {
          pattern: /(?:Total|Amount Due|Balance Due|Grand Total)[:\s$]*([0-9,]+\.?\d*)/i,
          labelKeywords: ['total', 'amount due', 'balance due', 'grand total', 'total due'],
          formatValidator: formatValidators.currency,
        },
        {
          pattern: /\$\s*([0-9,]+\.\d{2})\s*$/m,
          labelKeywords: ['$'],
          formatValidator: formatValidators.currency,
        },
      ]),
    },
  };
}

function extractField(
  pages: ParsedPage[],
  docType: 'invoice' | 'w9',
  patterns: PatternConfig[]
): ExtractedField {
  const candidates = findAllCandidates(pages, docType, patterns);
  return selectBestCandidate(candidates, docType);
}
