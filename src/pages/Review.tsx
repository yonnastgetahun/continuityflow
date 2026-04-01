import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { PDFViewer } from '@/components/PDFViewer';
import { ExtractionDebugPanel, ExtractionDebugInfo } from '@/components/ExtractionDebugPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  FileText, 
  Check, 
  AlertTriangle,
  Info,
  Save,
  ArrowLeft,
  Building2,
  Receipt,
  ExternalLink,
  PanelLeftClose,
  PanelLeft,
  UserCheck,
  CircleDot,
  ScanLine,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import type {
  ExtractionCandidateRecord,
  ExtractionResult,
  ReviewDecisionSource,
} from '@/lib/extraction/types';
import { flattenExtractedFields } from '@/lib/extraction/localExtractor';
import { getReviewRoutingReasonLabel, type ReviewRoutingReason } from '@/lib/extraction/ui';
import { ParsedDocument, ExtractedFields, ExtractedField, FieldEvidence } from '@/lib/pdfParser';

type FieldKey = 
  | 'vendorName' | 'vendorAddress' | 'vendorCity' | 'vendorState' | 'vendorZip' 
  | 'vendorTaxId' | 'vendorEmail' | 'vendorPhone'
  | 'invoiceNumber' | 'invoiceDate' | 'dueDate' | 'subtotal' | 'tax' | 'total';

interface ConfirmedFields {
  [key: string]: boolean;
}

const FIELD_LABELS: Record<FieldKey, string> = {
  vendorName: 'Vendor Name',
  vendorAddress: 'Vendor Address',
  vendorCity: 'Vendor City',
  vendorState: 'Vendor State',
  vendorZip: 'Vendor ZIP',
  vendorTaxId: 'Vendor Tax ID',
  vendorEmail: 'Vendor Email',
  vendorPhone: 'Vendor Phone',
  invoiceNumber: 'Invoice Number',
  invoiceDate: 'Invoice Date',
  dueDate: 'Due Date',
  subtotal: 'Subtotal',
  tax: 'Tax',
  total: 'Total',
};

interface CandidateComparisonRow {
  fieldKey: FieldKey;
  label: string;
  localValue: string;
  aiValue: string;
  currentValue: string;
  localEvidence?: FieldEvidence;
  aiEvidence?: FieldEvidence;
}

interface JumpToSourceProps {
  evidence: FieldEvidence;
  onJump: (evidence: FieldEvidence) => void;
}

function JumpToSourceButton({ evidence, onJump }: JumpToSourceProps) {
  if (!evidence || evidence.pageNumber === 0) return null;
  
  return (
    <Button 
      variant="ghost" 
      size="sm" 
      className="h-6 px-2 text-xs text-primary hover:text-primary/80 gap-1"
      onClick={() => onJump(evidence)}
    >
      <ExternalLink className="h-3 w-3" />
      Source
    </Button>
  );
}

function ConfidenceBadge({ 
  confidence, 
  isConfirmed 
}: { 
  confidence: 'high' | 'medium' | 'low'; 
  isConfirmed?: boolean;
}) {
  if (isConfirmed) {
    return (
      <span className="state-ready text-xs px-2 py-0.5 rounded inline-flex items-center gap-1">
        <UserCheck className="h-3 w-3" />
        Confirmed
      </span>
    );
  }

  const config = {
    high: { icon: Check, className: 'confidence-high', label: 'High' },
    medium: { icon: AlertTriangle, className: 'confidence-medium', label: 'Review' },
    low: { icon: Info, className: 'confidence-low', label: 'Low' },
  };
  
  const { icon: Icon, className, label } = config[confidence];
  
  return (
    <span className={`${className} text-xs px-2 py-0.5 rounded inline-flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

interface RequiredIndicatorProps {
  isRequired: boolean;
  isFilled: boolean;
  isConfirmed: boolean;
}

function RequiredIndicator({ isRequired, isFilled, isConfirmed }: RequiredIndicatorProps) {
  if (!isRequired) return null;
  
  if (isFilled && isConfirmed) {
    return <Check className="h-3 w-3 state-confirmed-text" />;
  }
  
  return (
    <span title="Required field">
      <CircleDot className="h-3 w-3 state-error-text" />
    </span>
  );
}

interface EditableFieldProps {
  label: string;
  field: ExtractedField;
  value: string;
  onChange: (value: string) => void;
  onJumpToSource: (evidence: FieldEvidence) => void;
  isConfirmed: boolean;
  isRequired?: boolean;
}

function EditableField({ 
  label, 
  field, 
  value, 
  onChange, 
  onJumpToSource, 
  isConfirmed,
  isRequired = false
}: EditableFieldProps) {
  const isFilled = value.trim().length > 0;
  
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Label className="text-sm">{label}</Label>
          <RequiredIndicator isRequired={isRequired} isFilled={isFilled} isConfirmed={isConfirmed} />
        </div>
        <div className="flex items-center gap-1">
          <ConfidenceBadge confidence={field.confidence} isConfirmed={isConfirmed} />
          <JumpToSourceButton evidence={field.evidence} onJump={onJumpToSource} />
        </div>
      </div>
      <Input 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        className={`h-9 ${isRequired && !isFilled ? 'border-destructive/50' : ''}`}
      />
    </div>
  );
}

const createDefaultField = (): ExtractedField => ({
  value: '',
  confidence: 'low',
  evidence: { docType: 'invoice', pageNumber: 0, snippet: 'Not found in document' },
});

function candidateToEvidence(candidate?: ExtractionCandidateRecord): FieldEvidence | undefined {
  if (!candidate || !candidate.pageNumber || !candidate.evidenceSnippet) {
    return undefined;
  }

  const metadata = candidate.metadata as { docType?: 'invoice' | 'w9' } | undefined;

  return {
    docType: metadata?.docType ?? 'invoice',
    pageNumber: candidate.pageNumber,
    snippet: candidate.evidenceSnippet,
  };
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

export default function ReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, refreshProfile, isReadOnly, isOwner } = useAuth();
  const isDevelopment = import.meta.env.DEV;
  const [isSaving, setIsSaving] = useState(false);
  const [showViewer, setShowViewer] = useState(true);
  const [activeDoc, setActiveDoc] = useState<'invoice' | 'w9'>('invoice');
  const [viewerPage, setViewerPage] = useState(1);
  const [highlightSnippet, setHighlightSnippet] = useState<string | undefined>();
  const [confirmedFields, setConfirmedFields] = useState<ConfirmedFields>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { extractionResult, invoiceFile, w9File, debugInfo } = (location.state || {}) as {
    extractionResult?: ExtractionResult;
    invoiceFile?: File;
    w9File?: File;
    debugInfo?: ExtractionDebugInfo;
  };
  const invoiceDoc = extractionResult?.invoiceDoc as ParsedDocument | undefined;
  const w9Doc = extractionResult?.w9Doc as ParsedDocument | undefined;
  const extractedFields = extractionResult?.extractedFields;

  const isScanned = invoiceDoc?.isScanned || w9Doc?.isScanned;

  const baseFields: ExtractedFields = useMemo(() => extractedFields || {
    vendor: {
      name: createDefaultField(),
      address: createDefaultField(),
      city: createDefaultField(),
      state: createDefaultField(),
      zip: createDefaultField(),
      taxId: createDefaultField(),
      email: createDefaultField(),
      phone: createDefaultField(),
    },
    invoice: {
      invoiceNumber: createDefaultField(),
      invoiceDate: createDefaultField(),
      dueDate: createDefaultField(),
      subtotal: createDefaultField(),
      tax: createDefaultField(),
      total: createDefaultField(),
    },
  }, [extractedFields]);

  // For scanned documents, override all field confidences to 'low'
  const getFieldWithScannedOverride = useCallback((field: ExtractedField): ExtractedField => {
    if (isScanned) {
      return {
        ...field,
        confidence: 'low',
        evidence: {
          ...field.evidence,
          snippet: field.value ? field.evidence.snippet : 'Scanned document - manual entry required',
        },
      };
    }
    return field;
  }, [isScanned]);

  const fields: ExtractedFields = useMemo(() => ({
    vendor: {
      name: getFieldWithScannedOverride(baseFields.vendor.name),
      address: getFieldWithScannedOverride(baseFields.vendor.address),
      city: getFieldWithScannedOverride(baseFields.vendor.city),
      state: getFieldWithScannedOverride(baseFields.vendor.state),
      zip: getFieldWithScannedOverride(baseFields.vendor.zip),
      taxId: getFieldWithScannedOverride(baseFields.vendor.taxId),
      email: getFieldWithScannedOverride(baseFields.vendor.email),
      phone: getFieldWithScannedOverride(baseFields.vendor.phone),
    },
    invoice: {
      invoiceNumber: getFieldWithScannedOverride(baseFields.invoice.invoiceNumber),
      invoiceDate: getFieldWithScannedOverride(baseFields.invoice.invoiceDate),
      dueDate: getFieldWithScannedOverride(baseFields.invoice.dueDate),
      subtotal: getFieldWithScannedOverride(baseFields.invoice.subtotal),
      tax: getFieldWithScannedOverride(baseFields.invoice.tax),
      total: getFieldWithScannedOverride(baseFields.invoice.total),
    },
  }), [baseFields, getFieldWithScannedOverride]);

  // Editable fields state
  const [vendorName, setVendorName] = useState(fields.vendor.name.value);
  const [vendorAddress, setVendorAddress] = useState(fields.vendor.address.value);
  const [vendorCity, setVendorCity] = useState(fields.vendor.city.value);
  const [vendorState, setVendorState] = useState(fields.vendor.state.value);
  const [vendorZip, setVendorZip] = useState(fields.vendor.zip.value);
  const [vendorTaxId, setVendorTaxId] = useState(fields.vendor.taxId.value);
  const [vendorEmail, setVendorEmail] = useState(fields.vendor.email.value);
  const [vendorPhone, setVendorPhone] = useState(fields.vendor.phone.value);

  const [invoiceNumber, setInvoiceNumber] = useState(fields.invoice.invoiceNumber.value);
  const [invoiceDate, setInvoiceDate] = useState(fields.invoice.invoiceDate.value);
  const [dueDate, setDueDate] = useState(fields.invoice.dueDate.value);
  const [subtotal, setSubtotal] = useState(fields.invoice.subtotal.value);
  const [tax, setTax] = useState(fields.invoice.tax.value);
  const [total, setTotal] = useState(fields.invoice.total.value);

  const candidateLookup = useMemo(() => {
    const lookup: {
      local: Partial<Record<FieldKey, ExtractionCandidateRecord>>;
      ai: Partial<Record<FieldKey, ExtractionCandidateRecord>>;
    } = {
      local: {},
      ai: {},
    };

    extractionResult?.candidates.forEach((candidate) => {
      const fieldKey = candidate.fieldKey as FieldKey;
      if (!(fieldKey in FIELD_LABELS)) return;

      if (candidate.source === 'local') {
        lookup.local[fieldKey] = candidate;
      }

      if (candidate.source === 'ai') {
        lookup.ai[fieldKey] = candidate;
      }
    });

    return lookup;
  }, [extractionResult]);

  const currentFieldValues = useMemo<Record<FieldKey, string>>(() => ({
    vendorName,
    vendorAddress,
    vendorCity,
    vendorState,
    vendorZip,
    vendorTaxId,
    vendorEmail,
    vendorPhone,
    invoiceNumber,
    invoiceDate,
    dueDate,
    subtotal,
    tax,
    total,
  }), [
    dueDate,
    invoiceDate,
    invoiceNumber,
    subtotal,
    tax,
    total,
    vendorAddress,
    vendorCity,
    vendorEmail,
    vendorName,
    vendorPhone,
    vendorState,
    vendorTaxId,
    vendorZip,
  ]);

  const aiComparisonRows = useMemo<CandidateComparisonRow[]>(() => {
    return (Object.keys(FIELD_LABELS) as FieldKey[])
      .map((fieldKey) => {
        const localCandidate = candidateLookup.local[fieldKey];
        const aiCandidate = candidateLookup.ai[fieldKey];

        if (!aiCandidate) return null;

        const localValue = localCandidate?.candidateValue ?? '';
        const aiValue = aiCandidate.candidateValue ?? '';

        if (localValue === aiValue) return null;

        return {
          fieldKey,
          label: FIELD_LABELS[fieldKey],
          localValue,
          aiValue,
          currentValue: currentFieldValues[fieldKey] ?? '',
          localEvidence: candidateToEvidence(localCandidate),
          aiEvidence: candidateToEvidence(aiCandidate),
        };
      })
      .filter((row): row is CandidateComparisonRow => row !== null);
  }, [candidateLookup, currentFieldValues]);

  const routingReason = useMemo<ReviewRoutingReason>(() => {
    const automaticReason = extractionResult?.metadata?.automaticRoutingReason;
    if (automaticReason === 'scanned_document' || automaticReason === 'low_confidence_required_fields') {
      return automaticReason;
    }

    if (extractionResult?.mode === 'enhanced_accuracy') {
      return 'manual_request';
    }

    return null;
  }, [extractionResult]);

  const routingReasonLabel = useMemo(
    () => getReviewRoutingReasonLabel(routingReason),
    [routingReason]
  );

  const summaryDescription = useMemo(() => {
    if (!extractionResult) return '';

    if (extractionResult.usedFallback) {
      return 'Enhanced extraction was attempted, but Continuity is currently using the local result in review.';
    }

    if (routingReason === 'manual_request') {
      return 'You forced enhanced extraction for this document, and Continuity merged the result into review.';
    }

    if (routingReasonLabel) {
      return `${routingReasonLabel}. Continuity automatically used enhanced extraction and merged the result into review.`;
    }

    return extractionResult.finalProvider === 'ai'
      ? 'Enhanced Accuracy resolved this document with OpenAI and merged the result into review.'
      : 'Continuity is currently using the local result in review.';
  }, [extractionResult, routingReason, routingReasonLabel]);

  const handleFieldChange = (fieldKey: FieldKey, value: string, setter: (v: string) => void) => {
    setter(value);
    // When user edits, mark as confirmed (they've reviewed it)
    if (!confirmedFields[fieldKey]) {
      setConfirmedFields(prev => ({ ...prev, [fieldKey]: true }));
    }
  };

  // Required fields: Vendor Name, Invoice Date, Total
  const requiredFieldsStatus = useMemo(() => {
    const vendorNameValid = vendorName.trim().length > 0 && confirmedFields.vendorName;
    const invoiceDateValid = (invoiceDate.trim().length > 0 || invoiceDate.toLowerCase() === 'unknown') && confirmedFields.invoiceDate;
    const totalValid = total.trim().length > 0 && confirmedFields.total;

    return {
      vendorName: vendorNameValid,
      invoiceDate: invoiceDateValid,
      total: totalValid,
      allValid: vendorNameValid && invoiceDateValid && totalValid,
    };
  }, [vendorName, invoiceDate, total, confirmedFields]);

  // Auto-confirm high confidence required fields with valid values (reduces manual clicks)
  useEffect(() => {
    if (isScanned) return; // Don't auto-confirm for scanned documents
    
    const autoConfirm: ConfirmedFields = {};
    
    // Auto-confirm required fields if they have high confidence and a value
    if (baseFields.vendor.name.confidence === 'high' && baseFields.vendor.name.value) {
      autoConfirm.vendorName = true;
    }
    if (baseFields.invoice.invoiceDate.confidence === 'high' && baseFields.invoice.invoiceDate.value) {
      autoConfirm.invoiceDate = true;
    }
    if (baseFields.invoice.total.confidence === 'high' && baseFields.invoice.total.value) {
      autoConfirm.total = true;
    }
    
    // Also auto-confirm non-required fields with high confidence
    if (baseFields.invoice.invoiceNumber.confidence === 'high' && baseFields.invoice.invoiceNumber.value) {
      autoConfirm.invoiceNumber = true;
    }
    
    if (Object.keys(autoConfirm).length > 0) {
      setConfirmedFields(prev => ({ ...prev, ...autoConfirm }));
    }
  }, [
    isScanned,
    baseFields.vendor.name.confidence,
    baseFields.vendor.name.value,
    baseFields.invoice.invoiceDate.confidence,
    baseFields.invoice.invoiceDate.value,
    baseFields.invoice.total.confidence,
    baseFields.invoice.total.value,
    baseFields.invoice.invoiceNumber.confidence,
    baseFields.invoice.invoiceNumber.value,
  ]);

  const handleJumpToSource = (evidence: FieldEvidence) => {
    setActiveDoc(evidence.docType);
    setViewerPage(evidence.pageNumber);
    setHighlightSnippet(evidence.snippet);
    setShowViewer(true);
    
    setTimeout(() => setHighlightSnippet(undefined), 5000);
  };

  const handleSave = async () => {
    if (!user || isReadOnly) return;

    if (!requiredFieldsStatus.allValid) {
      toast.error('Please confirm all required fields before saving.');
      return;
    }

    setIsSaving(true);
    try {
      if (profile?.subscription_status === 'trial_not_started') {
        const { error: trialError } = await supabase.functions.invoke('start-trial');
        if (trialError) throw trialError;
        await refreshProfile();
      }

      const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .insert({
          user_id: user.id,
          name: vendorName || 'Unknown Vendor',
          address: vendorAddress || null,
          city: vendorCity || null,
          state: vendorState || null,
          zip: vendorZip || null,
          tax_id: vendorTaxId || null,
          email: vendorEmail || null,
          phone: vendorPhone || null,
        })
        .select()
        .single();

      if (vendorError) throw vendorError;

      const parseDate = (dateStr: string): string | null => {
        if (!dateStr || dateStr.toLowerCase() === 'unknown') return null;
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
        return null;
      };

      const parseCurrency = (value: string): number | null => {
        if (!value) return null;
        const cleaned = value.replace(/[$,\s]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
      };

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          vendor_id: vendor.id,
          invoice_number: invoiceNumber || null,
          invoice_date: parseDate(invoiceDate),
          due_date: parseDate(dueDate),
          subtotal: parseCurrency(subtotal),
          tax: parseCurrency(tax),
          total: parseCurrency(total),
          raw_data: invoiceDoc ? { 
            fullText: invoiceDoc.fullText.substring(0, 10000), 
            isScanned: invoiceDoc.isScanned 
          } : null,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      if (extractionResult) {
        const sessionInsert: TablesInsert<'extraction_sessions'> = {
          user_id: user.id,
          invoice_id: invoice.id,
          vendor_id: vendor.id,
          source_document_type: 'invoice',
          mode: extractionResult.mode,
          status: extractionResult.status,
          requested_provider: extractionResult.requestedProvider,
          final_provider: extractionResult.finalProvider,
          ai_provider: extractionResult.aiProvider ?? null,
          is_scanned: extractionResult.isScanned,
          used_fallback: extractionResult.usedFallback,
          failure_reason: extractionResult.failureReason ?? null,
          ai_processed_at: extractionResult.aiProvider ? new Date().toISOString() : null,
          ai_pages: extractionResult.usage.aiPages,
          ai_cost_usd: extractionResult.usage.aiCostUsd,
          completed_at: new Date().toISOString(),
          metadata: extractionResult.metadata ?? {},
        };

        const { data: session, error: sessionError } = await supabase
          .from('extraction_sessions')
          .insert(sessionInsert)
          .select()
          .single();

        if (sessionError) throw sessionError;

        if (extractionResult.candidates.length > 0) {
          const candidateRows: TablesInsert<'extraction_field_candidates'>[] = extractionResult.candidates.map(
            (candidate) => ({
              session_id: session.id,
              field_key: candidate.fieldKey,
              source: candidate.source,
              candidate_value: candidate.candidateValue,
              confidence: candidate.confidence,
              page_number: candidate.pageNumber,
              evidence_snippet: candidate.evidenceSnippet,
              selected_for_review: candidate.selectedForReview,
              metadata: candidate.metadata ?? {},
            })
          );

          const { error: candidatesError } = await supabase
            .from('extraction_field_candidates')
            .insert(candidateRows);

          if (candidatesError) throw candidatesError;
        }

        const originalFieldMap = flattenExtractedFields(extractionResult.extractedFields);
        const finalFieldMap = currentFieldValues;

        const decisionRows: TablesInsert<'review_field_decisions'>[] = (Object.entries(finalFieldMap) as Array<[FieldKey, string]>)
          .map(([fieldKey, finalValue]) => {
            const localValue = candidateLookup.local[fieldKey]?.candidateValue ?? originalFieldMap[fieldKey]?.value ?? null;
            const aiValue = candidateLookup.ai[fieldKey]?.candidateValue ?? null;
            const normalizedFinalValue = finalValue || null;
            const userChanged = (localValue ?? '') !== (normalizedFinalValue ?? '');
            let chosenSource: ReviewDecisionSource = 'manual';

            if (!userChanged) {
              chosenSource =
                aiValue && normalizedFinalValue === aiValue && aiValue !== localValue
                  ? 'ai'
                  : 'local';
            }

            return {
              session_id: session.id,
              field_key: fieldKey,
              local_value: localValue,
              ai_value: aiValue,
              final_value: normalizedFinalValue,
              chosen_source: chosenSource,
              user_changed: userChanged,
              notes: confirmedFields[fieldKey] ? 'Reviewed in Phase 2 foundation flow' : null,
            };
          });

        const { error: decisionsError } = await supabase
          .from('review_field_decisions')
          .insert(decisionRows);

        if (decisionsError) throw decisionsError;
      }

      toast.success('Structured records saved. Continue to purchase order generation.');
      navigate('/generate', {
        state: {
          invoiceId: invoice.id,
          fromReview: true,
        },
      });
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save records. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!extractionResult || !invoiceFile) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto section-gap">
          <Card data-testid="review-recovery-card">
            <CardHeader>
              <CardTitle>Review session unavailable</CardTitle>
              <CardDescription>
                Your extracted review state is no longer in memory. Return to upload and run extraction again.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/upload">Return to Upload</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/records">Go to Records</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/upload')} className="gap-2 mb-1 -ml-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-xl font-semibold" data-testid="review-heading">Review Extracted Data</h1>
            <div className="mt-2 flex items-center gap-2">
              {extractionResult?.finalProvider === 'ai' && (
                <Badge variant="secondary">AI Assisted</Badge>
              )}
              {extractionResult?.mode === 'enhanced_accuracy' && extractionResult?.finalProvider !== 'ai' && (
                <Badge variant="secondary">Enhanced Accuracy Requested</Badge>
              )}
              {extractionResult?.usedFallback && (
                <Badge variant="outline">Using Local Fallback</Badge>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowViewer(!showViewer)}
            className="gap-2"
          >
            {showViewer ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            {showViewer ? 'Hide' : 'Show'} Preview
          </Button>
        </div>

        {/* Scanned Document Banner */}
        {isScanned && (
          <div className="state-attention rounded-lg p-4 mb-4 flex items-start gap-3 animate-fade-in">
            <ScanLine className="h-5 w-5 state-attention-text flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm state-attention-text">Scanned PDF detected</p>
              <p className="text-sm text-muted-foreground">
                OCR is not enabled yet. Please enter fields manually.
              </p>
            </div>
          </div>
        )}

        {extractionResult?.usedFallback && (
          <div className="state-attention rounded-lg p-4 mb-4 flex items-start gap-3 animate-fade-in">
            <Sparkles className="h-5 w-5 state-attention-text flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm state-attention-text">Enhanced Accuracy fallback</p>
              <p className="text-sm text-muted-foreground">
                {extractionResult.failureReason || 'Enhanced extraction was unavailable, so Continuity used local processing.'}
              </p>
            </div>
          </div>
        )}

        {/* Required Fields Notice */}
        {!requiredFieldsStatus.allValid && (
          <div className="rounded-lg p-4 mb-4 bg-muted/50 flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Required fields need confirmation</p>
              <p className="text-xs text-muted-foreground mt-1">
                <span className={requiredFieldsStatus.vendorName ? 'state-confirmed-text' : 'state-error-text'}>Vendor Name</span>
                {' · '}
                <span className={requiredFieldsStatus.invoiceDate ? 'state-confirmed-text' : 'state-error-text'}>Invoice Date</span>
                {' · '}
                <span className={requiredFieldsStatus.total ? 'state-confirmed-text' : 'state-error-text'}>Total</span>
              </p>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* PDF Viewer Panel */}
          {showViewer && (
            <div className="w-[400px] flex-shrink-0 flex flex-col bg-card rounded-lg border overflow-hidden">
              <Tabs value={activeDoc} onValueChange={(v) => setActiveDoc(v as 'invoice' | 'w9')} className="flex flex-col h-full">
                <TabsList className="w-full justify-start rounded-none border-b bg-muted/30 p-0 h-auto">
                  <TabsTrigger 
                    value="invoice" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                    disabled={!invoiceFile}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Invoice
                  </TabsTrigger>
                  <TabsTrigger 
                    value="w9" 
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
                    disabled={!w9File}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    W9
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="invoice" className="flex-1 m-0 min-h-0">
                  <PDFViewer 
                    file={invoiceFile || null}
                    fileName={invoiceDoc?.fileName}
                    currentPage={activeDoc === 'invoice' ? viewerPage : 1}
                    onPageChange={setViewerPage}
                    highlightSnippet={activeDoc === 'invoice' ? highlightSnippet : undefined}
                    className="h-full"
                  />
                </TabsContent>
                <TabsContent value="w9" className="flex-1 m-0 min-h-0">
                  <PDFViewer 
                    file={w9File || null}
                    fileName={w9Doc?.fileName}
                    currentPage={activeDoc === 'w9' ? viewerPage : 1}
                    onPageChange={setViewerPage}
                    highlightSnippet={activeDoc === 'w9' ? highlightSnippet : undefined}
                    className="h-full"
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Form Panel */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {/* Essential Fields Card */}
            {(extractionResult?.mode === 'enhanced_accuracy' || extractionResult?.usedFallback) && (
              <Card data-testid="extraction-summary-card">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Extraction Summary
                  </CardTitle>
                  <CardDescription>{summaryDescription}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-4 pb-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Requested</p>
                      <p className="mt-1 text-sm font-medium">
                        {extractionResult.mode === 'enhanced_accuracy' ? 'Enhanced Accuracy' : 'Local Only'}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Final Provider</p>
                      <p className="mt-1 text-sm font-medium">
                        {extractionResult.finalProvider === 'ai'
                          ? `${extractionResult.aiProvider ?? 'AI'}`
                          : extractionResult.finalProvider === 'fallback_local'
                            ? 'Local fallback'
                            : 'Local'}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Routing Reason</p>
                      <p className="mt-1 text-sm font-medium">
                        {routingReasonLabel ?? 'No escalation'}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">AI Usage</p>
                      <p className="mt-1 text-sm font-medium">
                        {extractionResult.usage.aiPages > 0
                          ? `${extractionResult.usage.aiPages} page · ${formatUsd(extractionResult.usage.aiCostUsd)}`
                          : 'No AI usage'}
                      </p>
                    </div>
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Processing</p>
                      <p className="mt-1 text-sm font-medium">
                        {extractionResult.metadata?.processingMode === 'in-memory-only'
                          ? 'In-memory only'
                          : 'Local browser'}
                      </p>
                    </div>
                  </div>

                  {aiComparisonRows.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">AI changes to review</p>
                        <Badge variant="secondary">{aiComparisonRows.length} field{aiComparisonRows.length === 1 ? '' : 's'}</Badge>
                      </div>
                      <div className="space-y-3">
                        {aiComparisonRows.map((row) => (
                          <div key={row.fieldKey} className="rounded-md border p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium">{row.label}</p>
                              <Badge variant="outline">AI override</Badge>
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-3">
                              <div className="space-y-1">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Local</p>
                                <p className="text-sm">{row.localValue || '—'}</p>
                                {row.localEvidence && (
                                  <JumpToSourceButton evidence={row.localEvidence} onJump={handleJumpToSource} />
                                )}
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">AI</p>
                                <p className="text-sm font-medium">{row.aiValue || '—'}</p>
                                {row.aiEvidence && (
                                  <JumpToSourceButton evidence={row.aiEvidence} onJump={handleJumpToSource} />
                                )}
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Review Value</p>
                                <p className="text-sm">{row.currentValue || '—'}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="h-4 w-4 text-primary" />
                  Essential Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-4 pb-4">
                {/* MVP Fields Grid */}
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Vendor Name */}
                  <EditableField
                    label="Vendor Name"
                    field={fields.vendor.name}
                    value={vendorName}
                    onChange={(v) => handleFieldChange('vendorName', v, setVendorName)}
                    onJumpToSource={handleJumpToSource}
                    isConfirmed={!!confirmedFields.vendorName}
                    isRequired
                  />
                  
                  {/* Invoice Number */}
                  <EditableField
                    label="Invoice Number"
                    field={fields.invoice.invoiceNumber}
                    value={invoiceNumber}
                    onChange={(v) => handleFieldChange('invoiceNumber', v, setInvoiceNumber)}
                    onJumpToSource={handleJumpToSource}
                    isConfirmed={!!confirmedFields.invoiceNumber}
                  />
                </div>
                
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Invoice Date */}
                  <EditableField
                    label="Invoice Date"
                    field={fields.invoice.invoiceDate}
                    value={invoiceDate}
                    onChange={(v) => handleFieldChange('invoiceDate', v, setInvoiceDate)}
                    onJumpToSource={handleJumpToSource}
                    isConfirmed={!!confirmedFields.invoiceDate}
                    isRequired
                  />
                  
                  {/* Total */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-sm font-semibold">Total</Label>
                        <RequiredIndicator 
                          isRequired 
                          isFilled={total.trim().length > 0} 
                          isConfirmed={!!confirmedFields.total} 
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <ConfidenceBadge confidence={fields.invoice.total.confidence} isConfirmed={!!confirmedFields.total} />
                        <JumpToSourceButton evidence={fields.invoice.total.evidence} onJump={handleJumpToSource} />
                      </div>
                    </div>
                    <Input 
                      value={total} 
                      onChange={(e) => handleFieldChange('total', e.target.value, setTotal)}
                      className={`h-9 font-semibold ${!total.trim() ? 'border-destructive/50' : ''}`}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Advanced Fields Accordion */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/30 transition-colors">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        Additional Details
                      </span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4 px-4 pb-4 pt-0">
                    <Separator className="mb-4" />
                    
                    {/* Vendor Details */}
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-muted-foreground">Vendor Details</p>
                      <EditableField
                        label="Address"
                        field={fields.vendor.address}
                        value={vendorAddress}
                        onChange={(v) => handleFieldChange('vendorAddress', v, setVendorAddress)}
                        onJumpToSource={handleJumpToSource}
                        isConfirmed={!!confirmedFields.vendorAddress}
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <EditableField
                          label="City"
                          field={fields.vendor.city}
                          value={vendorCity}
                          onChange={(v) => handleFieldChange('vendorCity', v, setVendorCity)}
                          onJumpToSource={handleJumpToSource}
                          isConfirmed={!!confirmedFields.vendorCity}
                        />
                        <EditableField
                          label="State"
                          field={fields.vendor.state}
                          value={vendorState}
                          onChange={(v) => handleFieldChange('vendorState', v, setVendorState)}
                          onJumpToSource={handleJumpToSource}
                          isConfirmed={!!confirmedFields.vendorState}
                        />
                        <EditableField
                          label="ZIP"
                          field={fields.vendor.zip}
                          value={vendorZip}
                          onChange={(v) => handleFieldChange('vendorZip', v, setVendorZip)}
                          onJumpToSource={handleJumpToSource}
                          isConfirmed={!!confirmedFields.vendorZip}
                        />
                      </div>
                      <EditableField
                        label="Tax ID"
                        field={fields.vendor.taxId}
                        value={vendorTaxId}
                        onChange={(v) => handleFieldChange('vendorTaxId', v, setVendorTaxId)}
                        onJumpToSource={handleJumpToSource}
                        isConfirmed={!!confirmedFields.vendorTaxId}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <EditableField
                          label="Email"
                          field={fields.vendor.email}
                          value={vendorEmail}
                          onChange={(v) => handleFieldChange('vendorEmail', v, setVendorEmail)}
                          onJumpToSource={handleJumpToSource}
                          isConfirmed={!!confirmedFields.vendorEmail}
                        />
                        <EditableField
                          label="Phone"
                          field={fields.vendor.phone}
                          value={vendorPhone}
                          onChange={(v) => handleFieldChange('vendorPhone', v, setVendorPhone)}
                          onJumpToSource={handleJumpToSource}
                          isConfirmed={!!confirmedFields.vendorPhone}
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Invoice Details */}
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-muted-foreground">Invoice Details</p>
                      <EditableField
                        label="Due Date"
                        field={fields.invoice.dueDate}
                        value={dueDate}
                        onChange={(v) => handleFieldChange('dueDate', v, setDueDate)}
                        onJumpToSource={handleJumpToSource}
                        isConfirmed={!!confirmedFields.dueDate}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-sm">Subtotal</Label>
                            <div className="flex items-center gap-1">
                              <ConfidenceBadge confidence={fields.invoice.subtotal.confidence} isConfirmed={!!confirmedFields.subtotal} />
                              <JumpToSourceButton evidence={fields.invoice.subtotal.evidence} onJump={handleJumpToSource} />
                            </div>
                          </div>
                          <Input 
                            value={subtotal} 
                            onChange={(e) => handleFieldChange('subtotal', e.target.value, setSubtotal)}
                            className="h-9"
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-sm">Tax</Label>
                            <div className="flex items-center gap-1">
                              <ConfidenceBadge confidence={fields.invoice.tax.confidence} isConfirmed={!!confirmedFields.tax} />
                              <JumpToSourceButton evidence={fields.invoice.tax.evidence} onJump={handleJumpToSource} />
                            </div>
                          </div>
                          <Input 
                            value={tax} 
                            onChange={(e) => handleFieldChange('tax', e.target.value, setTax)}
                            className="h-9"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Save Button */}
            <div className="flex flex-col items-center gap-2 py-4">
              <Button
                size="lg"
                onClick={handleSave}
                disabled={isSaving || isReadOnly || !requiredFieldsStatus.allValid}
                className="gap-2 min-w-48"
                data-testid="save-continue-button"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save and Continue'}
              </Button>
              {!requiredFieldsStatus.allValid && (
                <p className="text-xs text-muted-foreground">
                  Confirm required fields to enable saving
                </p>
              )}
            </div>

            {profile?.subscription_status === 'trial_not_started' && (
              <p className="text-center text-sm text-muted-foreground pb-4">
                Saving will start your 7-day free trial with full Pro features.
              </p>
            )}

            {/* Owner-only Extraction Debug Panel - hidden in production by default */}
            {isOwner && isDevelopment && (
              <ExtractionDebugPanel
                invoiceDoc={invoiceDoc}
                w9Doc={w9Doc}
                debugInfo={debugInfo ?? (extractionResult?.metadata as ExtractionDebugInfo | undefined)}
              />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
