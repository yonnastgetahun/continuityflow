import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { 
  Upload as UploadIcon, 
  FileText, 
  X, 
  AlertCircle,
  Lock,
  Sparkles,
  Loader2,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';
import type { ExtractionResult } from '@/lib/extraction/types';
import { isEnhancedAccuracyFeatureEnabled } from '@/lib/extraction/rolloutPolicy';

interface UploadedFile {
  file: File;
  name: string;
  type: 'invoice' | 'w9';
}

const ENHANCED_ACCURACY_KEY = 'continuity.enhancedAccuracyEnabled';

export default function UploadPage() {
  const { isReadOnly, profile, user } = useAuth();
  const navigate = useNavigate();
  const enhancedAccuracyFeatureEnabled = isEnhancedAccuracyFeatureEnabled();
  const [invoiceFile, setInvoiceFile] = useState<UploadedFile | null>(null);
  const [w9File, setW9File] = useState<UploadedFile | null>(null);
  const [isDragging, setIsDragging] = useState<'invoice' | 'w9' | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [enhancedAccuracyEnabled, setEnhancedAccuracyEnabled] = useState<boolean>(() => {
    const savedPreference = window.localStorage.getItem(ENHANCED_ACCURACY_KEY);
    return savedPreference === 'true';
  });

  const hasEnhancedAccuracyAccess = useMemo(() => {
    if (!profile || isReadOnly) return false;

    return (
      profile.plan_type === 'pro' ||
      profile.subscription_status === 'trial_not_started' ||
      profile.subscription_status === 'trial_active' ||
      profile.subscription_status === 'trial_expiring'
    );
  }, [isReadOnly, profile]);

  useEffect(() => {
    window.localStorage.setItem(ENHANCED_ACCURACY_KEY, enhancedAccuracyEnabled ? 'true' : 'false');
  }, [enhancedAccuracyEnabled]);

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
      const { extractDocuments, ENHANCED_ACCURACY_FALLBACK_REASON } = await import('@/lib/extraction/router');
      const extractionResult: ExtractionResult = await extractDocuments({
        invoiceFile: invoiceFile.file,
        w9File: w9File?.file ?? null,
        enableEnhancedAccuracy: enhancedAccuracyEnabled,
        hasEnhancedAccess: hasEnhancedAccuracyAccess,
        userId: user?.id ?? 'local-session',
        planType: profile?.plan_type ?? null,
      });

      // Check if documents are scanned (no text)
      const warnings: string[] = [];
      if (extractionResult.invoiceDoc.isScanned) {
        warnings.push('Invoice appears to be scanned (no selectable text). Manual entry may be required.');
      }
      if (extractionResult.w9Doc?.isScanned) {
        warnings.push('W9 appears to be scanned (no selectable text). Manual entry may be required.');
      }

      // Show warnings if any
      if (warnings.length > 0) {
        warnings.forEach(warning => toast.warning(warning));
      }

      if (extractionResult.usedFallback) {
        toast.warning(extractionResult.failureReason ?? ENHANCED_ACCURACY_FALLBACK_REASON);
      }

      // Navigate to review with extracted data and original files for PDF viewer
      navigate('/review', { 
        state: { 
          extractionResult,
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
      <div className="max-w-3xl mx-auto section-gap">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-semibold mb-2">Upload Documents</h1>
          <p className="text-muted-foreground text-sm">
            Upload your invoice and optional W-9 to extract vendor and billing information.
          </p>
        </div>

        {isReadOnly && (
          <div className="state-error rounded-lg p-4 flex items-start gap-3 animate-fade-in">
            <Lock className="h-5 w-5 state-error-text flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium state-error-text text-sm">Read-only mode</p>
              <p className="text-sm text-muted-foreground">
                Your trial has expired. Upgrade to upload and process new documents.
              </p>
            </div>
          </div>
        )}

        {extractionError && (
          <div className="state-error rounded-lg p-4 flex items-start gap-3 animate-fade-in">
            <AlertCircle className="h-5 w-5 state-error-text flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium state-error-text text-sm">Extraction failed</p>
              <p className="text-sm text-muted-foreground">{extractionError}</p>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Invoice Upload */}
          <Card className="border-0 shadow-none bg-transparent animate-fade-in" style={{ animationDelay: '0.05s' }}>
            <CardHeader className="px-0 pt-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                Invoice PDF
                <span className="text-destructive text-sm">*</span>
              </CardTitle>
              <CardDescription className="text-sm">Required</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {invoiceFile ? (
                <div className="state-confirmed rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-6 w-6 state-confirmed-text" />
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
                    data-testid="invoice-file-input"
                    onChange={(e) => handleFileSelect(e, 'invoice')}
                    disabled={isReadOnly}
                  />
                </label>
              )}
            </CardContent>
          </Card>

          {/* W9 Upload */}
          <Card className="border-0 shadow-none bg-transparent animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <CardHeader className="px-0 pt-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                W-9 PDF
                <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
              </CardTitle>
              <CardDescription className="text-sm">Auto-fill vendor details</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {w9File ? (
                <div className="state-confirmed rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-6 w-6 state-confirmed-text" />
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
                    data-testid="w9-file-input"
                    onChange={(e) => handleFileSelect(e, 'w9')}
                    disabled={isReadOnly}
                  />
                </label>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="p-5 rounded-lg border border-border bg-card animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 mt-0.5 text-primary" />
            <div>
              <p className="font-medium text-sm">Phase 1 privacy model</p>
              <p className="text-sm text-muted-foreground mt-1">
                Documents are processed locally in your browser. Continuity stores only the structured fields you confirm in review.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: '0.18s' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">Enhanced Accuracy</p>
                <Badge variant={enhancedAccuracyFeatureEnabled ? (hasEnhancedAccuracyAccess ? 'secondary' : 'outline') : 'outline'}>
                  {!enhancedAccuracyFeatureEnabled ? 'Off' : hasEnhancedAccuracyAccess ? 'Available' : 'Pro'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground max-w-xl">
                Recommended for scanned or complex invoices. Uses secure AI processing when available and falls back safely when it is not.
              </p>
              <p className="text-xs text-muted-foreground">
                {enhancedAccuracyFeatureEnabled
                  ? 'Documents sent for enhanced extraction are intended for temporary processing only.'
                  : 'Enhanced Accuracy is temporarily disabled by admin rollout controls.'}
              </p>
            </div>
            <Switch
              checked={enhancedAccuracyEnabled && hasEnhancedAccuracyAccess && enhancedAccuracyFeatureEnabled}
              disabled={!enhancedAccuracyFeatureEnabled || !hasEnhancedAccuracyAccess || isReadOnly}
              onCheckedChange={(checked) => setEnhancedAccuracyEnabled(checked)}
              aria-label="Enable Enhanced Accuracy"
              data-testid="enhanced-accuracy-toggle"
            />
          </div>
          {!enhancedAccuracyFeatureEnabled ? (
            <div className="mt-4 rounded-md bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                Enhanced Accuracy has been disabled globally. Continuity will use local processing only.
              </p>
            </div>
          ) : !hasEnhancedAccuracyAccess && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-md bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                Enhanced Accuracy is available on Pro and during the free Pro trial.
              </p>
              <Button asChild size="sm" variant="outline">
                <Link to="/upgrade">Upgrade</Link>
              </Button>
            </div>
          )}
        </div>

        <div className="text-center text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <p>Encrypted source document storage is not enabled in Phase 1.</p>
        </div>

        {/* Extract Button */}
        <div className="flex justify-center pt-4 animate-fade-in" style={{ animationDelay: '0.25s' }}>
          <Button
            size="lg"
            onClick={handleExtract}
            disabled={!invoiceFile || isReadOnly || isExtracting}
            className="gap-2 px-8"
            data-testid="extract-button"
          >
            {isExtracting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {enhancedAccuracyEnabled && hasEnhancedAccuracyAccess ? 'Processing...' : 'Extracting...'}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {enhancedAccuracyEnabled && hasEnhancedAccuracyAccess ? 'Use Enhanced Accuracy' : 'Extract Fields'}
              </>
            )}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
