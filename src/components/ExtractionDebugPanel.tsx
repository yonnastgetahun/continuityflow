import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, Bug, FileText, Hash, Search } from 'lucide-react';
import { ParsedDocument } from '@/lib/pdfParser';

interface ExtractionDebugPanelProps {
  invoiceDoc?: ParsedDocument;
  w9Doc?: ParsedDocument;
  debugInfo?: ExtractionDebugInfo;
}

export interface ExtractionDebugInfo {
  candidateCounts: Record<string, number>;
  detectedKeywords: string[];
}

const DETECTED_KEYWORDS = [
  'invoice', 'bill', 'total', 'subtotal', 'tax', 'amount due',
  'due date', 'date', 'vendor', 'supplier', 'company', 'name',
  'address', 'city', 'state', 'zip', 'ein', 'tin', 'tax id',
  'phone', 'email', 'fax', 'w-9', 'w9'
];

function detectKeywords(text: string): string[] {
  const lowerText = text.toLowerCase();
  return DETECTED_KEYWORDS.filter(keyword => lowerText.includes(keyword.toLowerCase()));
}

export function ExtractionDebugPanel({ invoiceDoc, w9Doc, debugInfo }: ExtractionDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const invoiceText = invoiceDoc?.fullText || '';
  const w9Text = w9Doc?.fullText || '';
  const combinedText = `${invoiceText}\n${w9Text}`.trim();
  
  const detectedKeywords = debugInfo?.detectedKeywords || detectKeywords(combinedText);
  const candidateCounts = debugInfo?.candidateCounts || {};

  const fieldLabels: Record<string, string> = {
    vendorName: 'Vendor Name',
    vendorAddress: 'Address',
    vendorCity: 'City',
    vendorState: 'State',
    vendorZip: 'ZIP',
    vendorTaxId: 'Tax ID',
    vendorEmail: 'Email',
    vendorPhone: 'Phone',
    invoiceNumber: 'Invoice #',
    invoiceDate: 'Invoice Date',
    dueDate: 'Due Date',
    subtotal: 'Subtotal',
    tax: 'Tax',
    total: 'Total',
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed border-accent/50 bg-accent/5">
        <CollapsibleTrigger asChild>
          <CardHeader className="py-2 px-4 cursor-pointer hover:bg-accent/10 transition-colors">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-accent-foreground">
                <Bug className="h-4 w-4" />
                Extraction Debug Panel
                <Badge variant="outline" className="ml-2 text-xs font-normal">Owner Only</Badge>
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4 px-4 pb-4 text-sm">
            {/* Scanned Status */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span className="font-medium">Document Status</span>
              </div>
              <div className="pl-6 space-y-1">
                <div className="flex items-center gap-2">
                  <span>Invoice:</span>
                  <Badge variant={invoiceDoc?.isScanned ? 'destructive' : 'secondary'}>
                    {invoiceDoc ? (invoiceDoc.isScanned ? 'Scanned (OCR needed)' : 'Text-based') : 'Not loaded'}
                  </Badge>
                </div>
                {w9Doc && (
                  <div className="flex items-center gap-2">
                    <span>W9:</span>
                    <Badge variant={w9Doc.isScanned ? 'destructive' : 'secondary'}>
                      {w9Doc.isScanned ? 'Scanned (OCR needed)' : 'Text-based'}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Extracted Text Preview */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Hash className="h-4 w-4" />
                <span className="font-medium">
                  Extracted Text (first 500 chars)
                </span>
              </div>
              <pre className="pl-6 p-2 bg-muted/50 rounded text-xs overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto font-mono">
                {combinedText.substring(0, 500) || '(No text extracted)'}
                {combinedText.length > 500 && '...'}
              </pre>
              <p className="pl-6 text-xs text-muted-foreground">
                Total characters: {combinedText.length.toLocaleString()}
              </p>
            </div>

            {/* Detected Keywords */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Search className="h-4 w-4" />
                <span className="font-medium">Detected Keywords ({detectedKeywords.length})</span>
              </div>
              <div className="pl-6 flex flex-wrap gap-1">
                {detectedKeywords.length > 0 ? (
                  detectedKeywords.map(keyword => (
                    <Badge key={keyword} variant="outline" className="text-xs">
                      {keyword}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">(No keywords detected)</span>
                )}
              </div>
            </div>

            {/* Candidate Counts */}
            {Object.keys(candidateCounts).length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Hash className="h-4 w-4" />
                  <span className="font-medium">Candidate Counts per Field</span>
                </div>
                <div className="pl-6 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                  {Object.entries(candidateCounts).map(([field, count]) => (
                    <div key={field} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{fieldLabels[field] || field}:</span>
                      <Badge variant={count > 0 ? 'secondary' : 'outline'} className="text-xs ml-2">
                        {count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
