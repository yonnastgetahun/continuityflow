import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Upload as UploadIcon, 
  FileText, 
  X, 
  AlertCircle,
  Shield,
  Lock,
  Sparkles,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { parsePDF, extractFieldsFromText, ParsedDocument, ExtractedFields } from '@/lib/pdfParser';

interface UploadedFile {
  file: File;
  name: string;
  type: 'invoice' | 'w9';
}

export default function UploadPage() {
  const { profile, isReadOnly } = useAuth();
  const navigate = useNavigate();
  const [invoiceFile, setInvoiceFile] = useState<UploadedFile | null>(null);
  const [w9File, setW9File] = useState<UploadedFile | null>(null);
  const [storeDocuments, setStoreDocuments] = useState(false);
  const [isDragging, setIsDragging] = useState<'invoice' | 'w9' | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  const isPro = profile?.plan_type === 'pro' || 
    (profile?.subscription_status === 'trial_active' || 
     profile?.subscription_status === 'trial_expiring');

  const handleDrop = useCallback((e: React.DragEvent, type: 'invoice' | 'w9') => {
    e.preventDefault();
    setIsDragging(null);
    setExtractionError(null);

    if (isReadOnly) {
      toast.error('App is in read-only mode. Please upgrade to continue.');
      return;
    }

    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      if (type === 'invoice') {
        setInvoiceFile({ file, name: file.name, type: 'invoice' });
      } else {
        setW9File({ file, name: file.name, type: 'w9' });
      }
    } else {
      toast.error('Please upload a PDF file');
    }
  }, [isReadOnly]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'invoice' | 'w9') => {
    setExtractionError(null);
    
    if (isReadOnly) {
      toast.error('App is in read-only mode. Please upgrade to continue.');
      return;
    }

    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      if (type === 'invoice') {
        setInvoiceFile({ file, name: file.name, type: 'invoice' });
      } else {
        setW9File({ file, name: file.name, type: 'w9' });
      }
    } else {
      toast.error('Please upload a PDF file');
    }
  };

  const handleExtract = async () => {
    if (!invoiceFile) {
      toast.error('Please upload an invoice PDF');
      return;
    }

    if (isReadOnly) {
      toast.error('App is in read-only mode. Please upgrade to continue.');
      return;
    }

    setIsExtracting(true);
    setExtractionError(null);

    try {
      // Parse invoice PDF
      const invoiceDoc = await parsePDF(invoiceFile.file, 'invoice');
      
      // Parse W9 PDF if provided
      let w9Doc: ParsedDocument | undefined;
      if (w9File) {
        w9Doc = await parsePDF(w9File.file, 'w9');
      }

      // Check if documents are scanned (no text)
      const warnings: string[] = [];
      if (invoiceDoc.isScanned) {
        warnings.push('Invoice appears to be scanned (no selectable text). Manual entry may be required.');
      }
      if (w9Doc?.isScanned) {
        warnings.push('W9 appears to be scanned (no selectable text). Manual entry may be required.');
      }

      // Extract fields from parsed text
      const extractedFields = extractFieldsFromText(invoiceDoc, w9Doc);

      // Show warnings if any
      if (warnings.length > 0) {
        warnings.forEach(warning => toast.warning(warning));
      }

      // Navigate to review with extracted data and original files for PDF viewer
      navigate('/review', { 
        state: { 
          invoiceDoc,
          w9Doc,
          extractedFields,
          storeDocuments,
          invoiceFile: invoiceFile.file,
          w9File: w9File?.file,
        } 
      });

      toast.success('Documents parsed successfully!');
    } catch (error) {
      console.error('Extraction error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse PDF documents';
      setExtractionError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center animate-fade-in">
          <h1 className="font-display text-3xl font-bold mb-2">Upload Documents</h1>
          <p className="text-muted-foreground">
            Upload your invoice and optional W9 to extract vendor and billing information.
          </p>
        </div>

        {isReadOnly && (
          <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg animate-scale-in">
            <Lock className="h-5 w-5 text-destructive flex-shrink-0" />
            <div>
              <p className="font-medium text-destructive">Read-Only Mode</p>
              <p className="text-sm text-muted-foreground">
                Your trial has expired. Upgrade to upload and process new documents.
              </p>
            </div>
          </div>
        )}

        {extractionError && (
          <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg animate-scale-in">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
            <div>
              <p className="font-medium text-destructive">Extraction Failed</p>
              <p className="text-sm text-muted-foreground">{extractionError}</p>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Invoice Upload */}
          <Card className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Invoice PDF
                <span className="text-destructive">*</span>
              </CardTitle>
              <CardDescription>Required. Upload the invoice to process.</CardDescription>
            </CardHeader>
            <CardContent>
              {invoiceFile ? (
                <div className="flex items-center justify-between p-4 bg-success/10 border border-success/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-success" />
                    <div>
                      <p className="font-medium text-sm">{invoiceFile.name}</p>
                      <p className="text-xs text-muted-foreground">Ready to extract</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setInvoiceFile(null);
                      setExtractionError(null);
                    }}
                    disabled={isReadOnly || isExtracting}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label
                  className={`upload-zone rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                    isDragging === 'invoice' ? 'active' : ''
                  } ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!isReadOnly) setIsDragging('invoice');
                  }}
                  onDragLeave={() => setIsDragging(null)}
                  onDrop={(e) => handleDrop(e, 'invoice')}
                >
                  <UploadIcon className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium mb-1">Drop invoice PDF here</p>
                  <p className="text-xs text-muted-foreground">or click to browse</p>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e, 'invoice')}
                    disabled={isReadOnly}
                  />
                </label>
              )}
            </CardContent>
          </Card>

          {/* W9 Upload */}
          <Card className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-accent" />
                W9 PDF
                <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
              </CardTitle>
              <CardDescription>Upload W9 to auto-fill vendor details.</CardDescription>
            </CardHeader>
            <CardContent>
              {w9File ? (
                <div className="flex items-center justify-between p-4 bg-success/10 border border-success/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-success" />
                    <div>
                      <p className="font-medium text-sm">{w9File.name}</p>
                      <p className="text-xs text-muted-foreground">Ready to extract</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setW9File(null);
                      setExtractionError(null);
                    }}
                    disabled={isReadOnly || isExtracting}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label
                  className={`upload-zone rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                    isDragging === 'w9' ? 'active' : ''
                  } ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!isReadOnly) setIsDragging('w9');
                  }}
                  onDragLeave={() => setIsDragging(null)}
                  onDrop={(e) => handleDrop(e, 'w9')}
                >
                  <UploadIcon className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium mb-1">Drop W9 PDF here</p>
                  <p className="text-xs text-muted-foreground">or click to browse</p>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e, 'w9')}
                    disabled={isReadOnly}
                  />
                </label>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Privacy Toggle */}
        <Card className="animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                  isPro ? 'bg-primary/10' : 'bg-muted'
                }`}>
                  <Shield className={`h-5 w-5 ${isPro ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="store-docs" className="font-medium">
                      Store encrypted documents
                    </Label>
                    {!isPro && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
                        PRO
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Keep original PDFs encrypted for future reference.
                    {!isPro && ' Upgrade to Pro to enable this feature.'}
                  </p>
                </div>
              </div>
              <Switch
                id="store-docs"
                checked={storeDocuments}
                onCheckedChange={setStoreDocuments}
                disabled={!isPro || isReadOnly}
              />
            </div>
          </CardContent>
        </Card>

        {/* Privacy Notice */}
        <div className="trust-badge rounded-lg p-4 flex items-start gap-3 animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <Sparkles className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">Privacy First Processing</p>
            <p className="text-sm opacity-80">
              Documents are processed locally in your browser. Only the extracted, confirmed data is saved to your account.
            </p>
          </div>
        </div>

        {/* Extract Button */}
        <div className="flex justify-center animate-slide-up" style={{ animationDelay: '0.5s' }}>
          <Button
            size="lg"
            onClick={handleExtract}
            disabled={!invoiceFile || isReadOnly || isExtracting}
            className="gap-2 min-w-48"
          >
            {isExtracting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Extract Fields
              </>
            )}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
