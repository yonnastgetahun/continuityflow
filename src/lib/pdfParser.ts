import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure PDF.js worker using bundled version (no CDN)
// Vite will emit this worker as an asset and provide a URL string.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export interface ParsedPage {
  pageNumber: number;
  text: string;
  lineCount: number;
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
  lineIndex: number; // Line position in document (for position-based scoring)
  labelMatchStrength: number; // 0-1: how well the label matches
  proximityScore: number; // 0-1: how close to keyword
  formatScore: number; // 0-1: how well it matches expected format
  uniquenessScore: number; // 0-1: how unique this match is
  positionScore: number; // 0-1: position-based scoring (top/bottom preference)
}

interface PatternConfig {
  pattern: RegExp;
  labelKeywords: string[];
  formatValidator?: (value: string) => number;
  labelMatchWeight?: number;
  preferPosition?: 'top' | 'bottom'; // Position preference for this field
  excludePatterns?: RegExp[]; // Patterns to exclude from matches
}

interface PdfTextItem {
  str?: string;
}

// Placeholder/label patterns to exclude from vendor name extraction
const VENDOR_EXCLUDE_PATTERNS = [
  /customer\s*name/i,
  /bill\s*to/i,
  /ship\s*to/i,
  /street/i,
  /postcode/i,
  /country/i,
  /city/i,
  /state/i,
  /zip/i,
  /phone/i,
  /email/i,
  /date/i,
  /invoice/i,
  /total/i,
  /amount/i,
  /payment/i,
];

// Format validators return 0-1 score
const formatValidators = {
  date: (value: string): number => {
    // Check various date formats
    const datePatterns = [
      /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/, // MM/DD/YYYY, DD-MM-YYYY
      /^[A-Za-z]+\s+\d{1,2},?\s+\d{4}$/, // Nov 26, 2016
      /^\d{4}-\d{2}-\d{2}$/, // 2016-11-26 (ISO)
      /^[A-Za-z]+\s+\d{1,2}(st|nd|rd|th)?,?\s+\d{4}$/i, // November 26th, 2016
    ];
    for (const pattern of datePatterns) {
      if (pattern.test(value.trim())) return 1;
    }
    // Partial match if it contains date-like components
    if (/\d{1,4}[/.-]\d{1,2}/.test(value)) return 0.5;
    return 0.2;
  },
  
  currency: (value: string): number => {
    // Allow currency symbols and codes
    const cleaned = value.replace(/[$€£¥,\s]|USD|EUR|GBP/gi, '').trim();
    if (/^\d+\.?\d{0,2}$/.test(cleaned)) return 1;
    if (/^\d+$/.test(cleaned)) return 0.9;
    if (/^\d{1,3}(,\d{3})*(\.\d{2})?$/.test(cleaned)) return 1; // 1,234.56
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
    // Common invoice number formats
    if (/^INV[-#]?\d+$/i.test(value)) return 1;
    if (/^[A-Za-z]{0,3}[-#]?\d{3,}[A-Za-z0-9-]*$/.test(value)) return 1;
    if (/^\d{4,}$/.test(value)) return 0.9;
    if (/^[A-Za-z0-9-]+$/.test(value) && value.length >= 3) return 0.7;
    return 0.4;
  },
  
  companyName: (value: string): number => {
    // Boost score for company indicators
    const companyIndicators = /\b(Inc\.?|LLC|Ltd\.?|Corp\.?|Company|Co\.?|Corporation|Incorporated|Limited|Pty|GmbH|S\.?A\.?|PLC)\b/i;
    if (companyIndicators.test(value)) return 1;
    // Reasonable length company name
    if (value.length >= 3 && value.length <= 60 && /^[A-Z]/.test(value)) return 0.7;
    return 0.4;
  },
};

function calculateLabelMatchStrength(text: string, keywords: string[], matchIndex: number): number {
  // Search in a window before the match
  const searchWindow = text.substring(Math.max(0, matchIndex - 100), matchIndex).toLowerCase();
  
  let maxScore = 0;
  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    const keywordIndex = searchWindow.lastIndexOf(keywordLower);
    if (keywordIndex !== -1) {
      const distance = searchWindow.length - keywordIndex - keywordLower.length;
      // Closer = higher score, with bonus for very close proximity (same line)
      const proximityScore = Math.max(0, 1 - distance / 50);
      // Bonus for exact label matches like "Invoice Number:"
      const exactLabelBonus = searchWindow.includes(keywordLower + ':') ? 0.2 : 0;
      maxScore = Math.max(maxScore, Math.min(1, proximityScore + exactLabelBonus));
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

function getLineIndex(text: string, matchIndex: number): number {
  const textBefore = text.substring(0, matchIndex);
  return textBefore.split(/\n/).length;
}

function findAllCandidates(
  pages: ParsedPage[],
  docType: 'invoice' | 'w9',
  patterns: PatternConfig[],
  totalLines?: number
): ExtractionCandidate[] {
  const candidates: ExtractionCandidate[] = [];
  const allMatches: string[] = [];
  
  // Calculate total lines for position scoring
  const computedTotalLines = totalLines || pages.reduce((sum, p) => sum + p.lineCount, 0);
  
  // First pass: collect all matches for uniqueness scoring
  for (const page of pages) {
    for (const config of patterns) {
      const matches = page.text.matchAll(new RegExp(config.pattern, 'gi'));
      for (const match of matches) {
        if (match[1]) allMatches.push(match[1].trim());
      }
    }
  }
  
  // Track cumulative lines for position scoring
  let cumulativeLines = 0;
  
  // Second pass: extract candidates with scores
  for (const page of pages) {
    for (const config of patterns) {
      const regex = new RegExp(config.pattern, 'gi');
      let match;
      
      while ((match = regex.exec(page.text)) !== null) {
        if (!match[1]) continue;
        
        const value = match[1].trim();
        if (!value) continue;
        
        // Check exclusion patterns
        if (config.excludePatterns) {
          const matchContext = page.text.substring(
            Math.max(0, match.index - 50),
            Math.min(page.text.length, match.index + match[0].length + 50)
          );
          const isExcluded = config.excludePatterns.some(p => p.test(matchContext));
          if (isExcluded) continue;
        }
        
        const matchIndex = match.index;
        const lineIndex = cumulativeLines + getLineIndex(page.text, matchIndex);
        
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
        
        // Position score based on preference
        let positionScore = 0.5;
        if (config.preferPosition === 'top' && computedTotalLines > 0) {
          // Higher score for earlier lines (first 15 lines get max score)
          positionScore = Math.max(0, 1 - (lineIndex / 15));
        } else if (config.preferPosition === 'bottom' && computedTotalLines > 0) {
          // Higher score for later lines
          positionScore = Math.min(1, lineIndex / computedTotalLines);
        }
        
        candidates.push({
          value,
          pageNumber: page.pageNumber,
          snippet: extractSnippet(page.text, matchIndex, match[0].length),
          lineIndex,
          labelMatchStrength,
          proximityScore,
          formatScore,
          uniquenessScore,
          positionScore,
        });
      }
    }
    cumulativeLines += page.lineCount;
  }
  
  return candidates;
}

function selectBestCandidate(
  candidates: ExtractionCandidate[],
  docType: 'invoice' | 'w9',
  usePositionScore: boolean = false
): { value: string; confidence: 'high' | 'medium' | 'low'; evidence: FieldEvidence } {
  if (candidates.length === 0) {
    return {
      value: '',
      confidence: 'low',
      evidence: { docType, pageNumber: 0, snippet: 'Not found in document' },
    };
  }
  
  // Score each candidate with adjusted weights
  const scoredCandidates = candidates.map(c => {
    let score: number;
    if (usePositionScore) {
      score = 
        c.labelMatchStrength * 0.30 +
        c.formatScore * 0.25 +
        c.positionScore * 0.25 +
        c.uniquenessScore * 0.10 +
        c.proximityScore * 0.10;
    } else {
      score = 
        c.labelMatchStrength * 0.40 +
        c.formatScore * 0.30 +
        c.uniquenessScore * 0.15 +
        c.proximityScore * 0.15;
    }
    return { ...c, totalScore: score };
  });
  
  // Sort by score descending
  scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);
  
  const best = scoredCandidates[0];
  
  // Determine confidence level based on combined scoring
  let confidence: 'high' | 'medium' | 'low';
  
  // High confidence: strong label match + valid format
  if (best.labelMatchStrength >= 0.6 && best.formatScore >= 0.8) {
    confidence = 'high';
  } else if (best.totalScore >= 0.65) {
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

// Extract vendor name from top of document
function extractVendorName(
  pages: ParsedPage[],
  docType: 'invoice' | 'w9'
): ExtractedField {
  const candidates: ExtractionCandidate[] = [];
  
  // Focus on first page, first 15 lines
  const firstPage = pages[0];
  if (!firstPage) {
    return {
      value: '',
      confidence: 'low',
      evidence: { docType, pageNumber: 0, snippet: 'No text found' },
    };
  }
  
  const lines = firstPage.text.split(/(?:\s{2,}|\n)/);
  const topLines = lines.slice(0, 15);
  
  for (let i = 0; i < topLines.length; i++) {
    const line = topLines[i].trim();
    if (!line || line.length < 2) continue;
    
    // Skip lines that look like labels/headers
    const isExcluded = VENDOR_EXCLUDE_PATTERNS.some(p => p.test(line));
    if (isExcluded) continue;
    
    // Skip lines that are just numbers or dates
    if (/^\d+$/.test(line) || /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(line)) continue;
    
    // Score the line
    const hasCompanyIndicator = /\b(Inc\.?|LLC|Ltd\.?|Corp\.?|Company|Co\.?|Corporation|Incorporated|Limited|Pty|GmbH|S\.?A\.?|PLC)\b/i.test(line);
    const isBeforeInvoice = i < topLines.findIndex(l => /invoice/i.test(l)) || !topLines.some(l => /invoice/i.test(l));
    
    const formatScore = formatValidators.companyName(line);
    const positionScore = Math.max(0, 1 - (i / 15)); // Earlier = better
    const labelMatchStrength = hasCompanyIndicator ? 0.8 : (isBeforeInvoice && i < 5 ? 0.5 : 0.3);
    
    candidates.push({
      value: line,
      pageNumber: 1,
      snippet: line,
      lineIndex: i,
      labelMatchStrength,
      proximityScore: 0.5,
      formatScore,
      uniquenessScore: 0.8,
      positionScore,
    });
  }
  
  // Also try pattern-based extraction
  const patternCandidates = findAllCandidates(
    [{ ...firstPage, lineCount: topLines.length }],
    docType,
    [
      {
        pattern: /(?:Name|Business Name|Company|Legal Name)[:\s]*([A-Za-z0-9\s&.,'-]{2,50})/i,
        labelKeywords: ['name', 'business name', 'company', 'legal name'],
        formatValidator: formatValidators.companyName,
        preferPosition: 'top',
      },
      {
        pattern: /^([A-Z][A-Za-z0-9\s&.,'-]+(?:Inc\.?|LLC|Corp\.?|Company|Co\.?|Ltd\.?|Pty))\b/m,
        labelKeywords: [],
        formatValidator: formatValidators.companyName,
        preferPosition: 'top',
      },
    ],
    topLines.length
  );
  
  const allCandidates = [...candidates, ...patternCandidates];
  return selectBestCandidate(allCandidates, docType, true);
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
        .map((item) => (item as PdfTextItem).str ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Estimate line count from text length and spacing
      const lineCount = Math.max(1, Math.ceil(pageText.length / 80));
      
      pages.push({
        pageNumber: pageNum,
        text: pageText,
        lineCount,
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

  // Calculate total lines for position-based scoring
  const totalInvoiceLines = invoicePages.reduce((sum, p) => sum + p.lineCount, 0);

  return {
    vendor: {
      name: extractVendorName(vendorPages, vendorDocType),
      
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
            pattern: /(?:TIN|Tax ID|EIN|SSN|Taxpayer|Federal Tax)[:\s#]*(\d{2}-?\d{7})/i,
            labelKeywords: ['tin', 'tax id', 'ein', 'ssn', 'taxpayer', 'federal tax'],
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
      // Invoice Number - prefer label-proximate patterns
      invoiceNumber: extractField(invoicePages, 'invoice', [
        {
          pattern: /(?:Invoice\s*(?:Number|#|No\.?))[:\s]*([A-Za-z0-9-]+)/i,
          labelKeywords: ['invoice number', 'invoice #', 'invoice no', 'inv #', 'inv no'],
          formatValidator: formatValidators.invoiceNumber,
        },
        {
          pattern: /(?:Invoice)[#:\s]*([A-Za-z0-9-]{3,20})/i,
          labelKeywords: ['invoice'],
          formatValidator: formatValidators.invoiceNumber,
        },
        {
          pattern: /(?:Number|No\.?)[#:\s]*([A-Za-z0-9-]+)/i,
          labelKeywords: ['number', 'no'],
          formatValidator: formatValidators.invoiceNumber,
        },
      ]),
      
      // Invoice Date - parse multiple formats
      invoiceDate: extractField(invoicePages, 'invoice', [
        {
          pattern: /(?:Invoice\s*Date|Date\s*of\s*Invoice)[:\s]*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i,
          labelKeywords: ['invoice date', 'date of invoice'],
          formatValidator: formatValidators.date,
        },
        {
          pattern: /(?:Invoice\s*Date|Date)[:\s]*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
          labelKeywords: ['invoice date', 'date'],
          formatValidator: formatValidators.date,
        },
        {
          pattern: /(?:Date)[:\s]*(\d{4}-\d{2}-\d{2})/i,
          labelKeywords: ['date'],
          formatValidator: formatValidators.date,
        },
        {
          pattern: /(?:Date)[:\s]*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i,
          labelKeywords: ['date', 'issued'],
          formatValidator: formatValidators.date,
        },
      ]),
      
      dueDate: extractField(invoicePages, 'invoice', [
        {
          pattern: /(?:Due\s*Date|Payment\s*Due|Due\s*By)[:\s]*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i,
          labelKeywords: ['due date', 'payment due', 'due by', 'pay by'],
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
          pattern: /(?:Tax|Sales Tax|VAT|GST)[:\s$]*([0-9,]+\.?\d*)/i,
          labelKeywords: ['tax', 'sales tax', 'vat', 'gst'],
          formatValidator: formatValidators.currency,
        },
      ]),
      
      // Total - prefer bottom of page, strong label match
      total: extractTotalField(invoicePages, totalInvoiceLines),
    },
  };
}

// Special extraction for total amount with position-based scoring
function extractTotalField(pages: ParsedPage[], totalLines: number): ExtractedField {
  const candidates = findAllCandidates(
    pages,
    'invoice',
    [
      {
        pattern: /(?:Total\s*Due|Amount\s*Due|Balance\s*Due|Grand\s*Total)[:\s$]*([0-9,]+\.?\d{0,2})/i,
        labelKeywords: ['total due', 'amount due', 'balance due', 'grand total'],
        formatValidator: formatValidators.currency,
        preferPosition: 'bottom',
      },
      {
        pattern: /(?:Total)[:\s$]*([0-9,]+\.\d{2})/i,
        labelKeywords: ['total'],
        formatValidator: formatValidators.currency,
        preferPosition: 'bottom',
      },
      {
        pattern: /\$\s*([0-9,]+\.\d{2})\s*$/m,
        labelKeywords: [],
        formatValidator: formatValidators.currency,
        preferPosition: 'bottom',
      },
    ],
    totalLines
  );
  
  // If multiple totals exist, prefer the one with strongest label + bottom position
  return selectBestCandidate(candidates, 'invoice', true);
}

function extractField(
  pages: ParsedPage[],
  docType: 'invoice' | 'w9',
  patterns: PatternConfig[]
): ExtractedField {
  const totalLines = pages.reduce((sum, p) => sum + p.lineCount, 0);
  const candidates = findAllCandidates(pages, docType, patterns, totalLines);
  const hasPositionPreference = patterns.some(p => p.preferPosition);
  return selectBestCandidate(candidates, docType, hasPositionPreference);
}
