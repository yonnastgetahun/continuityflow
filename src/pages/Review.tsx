import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { PDFViewer } from '@/components/PDFViewer';
import { ExtractionDebugPanel, ExtractionDebugInfo } from '@/components/ExtractionDebugPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ParsedDocument, ExtractedFields, ExtractedField, FieldEvidence } from '@/lib/pdfParser';

type FieldKey = 
  | 'vendorName' | 'vendorAddress' | 'vendorCity' | 'vendorState' | 'vendorZip' 
  | 'vendorTaxId' | 'vendorEmail' | 'vendorPhone'
  | 'invoiceNumber' | 'invoiceDate' | 'dueDate' | 'subtotal' | 'tax' | 'total';

interface ConfirmedFields {
  [key: string]: boolean;
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
      <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1">
        <UserCheck className="h-3 w-3" />
        Confirmed
      </span>
    );
  }

  const config = {
    high: { icon: Check, className: 'bg-green-500/20 text-green-600 dark:text-green-400', label: 'High' },
    medium: { icon: AlertTriangle, className: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400', label: 'Review' },
    low: { icon: Info, className: 'bg-red-500/20 text-red-600 dark:text-red-400', label: 'Low' },
  };
  
  const { icon: Icon, className, label } = config[confidence];
  
  return (
    <span className={`${className} text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1`}>
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
    return <Check className="h-3 w-3 text-green-500" />;
  }
  
  return (
    <span title="Required field">
      <CircleDot className="h-3 w-3 text-destructive" />
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

  const { invoiceDoc, w9Doc, extractedFields, invoiceFile, w9File, debugInfo } = (location.state || {}) as {
    invoiceDoc?: ParsedDocument;
    w9Doc?: ParsedDocument;
    extractedFields?: ExtractedFields;
    invoiceFile?: File;
    w9File?: File;
    storeDocuments?: boolean;
    debugInfo?: ExtractionDebugInfo;
  };

  const isScanned = invoiceDoc?.isScanned || w9Doc?.isScanned;

  const baseFields: ExtractedFields = extractedFields || {
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
  };

  // For scanned documents, override all field confidences to 'low'
  const getFieldWithScannedOverride = (field: ExtractedField): ExtractedField => {
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
  };

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
  }), [isScanned, baseFields]);

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
  }, [isScanned]);

  useEffect(() => {
    if (!invoiceDoc && !location.state) {
      navigate('/upload');
    }
  }, [navigate, invoiceDoc, location.state]);

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

      const { error: invoiceError } = await supabase
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
        });

      if (invoiceError) throw invoiceError;

      toast.success('Records saved successfully!');
      navigate('/records');
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save records. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/upload')} className="gap-2 mb-1">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="font-display text-2xl font-bold">Review Extracted Data</h1>
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
          <div className="flex items-start gap-3 p-4 mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg animate-scale-in">
            <ScanLine className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-600 dark:text-amber-400">Scanned PDF Detected</p>
              <p className="text-sm text-muted-foreground">
                This appears to be a scanned PDF. OCR is not enabled yet. Please enter fields manually.
                All fields are set to low confidence until confirmed.
              </p>
            </div>
          </div>
        )}

        {/* Required Fields Notice */}
        {!requiredFieldsStatus.allValid && (
          <div className="flex items-start gap-3 p-3 mb-4 bg-muted border rounded-lg">
            <Info className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">Required fields must be confirmed</p>
              <p className="text-xs text-muted-foreground">
                Edit or verify: <span className={requiredFieldsStatus.vendorName ? 'text-green-600' : 'text-destructive'}>Vendor Name</span>
                {', '}
                <span className={requiredFieldsStatus.invoiceDate ? 'text-green-600' : 'text-destructive'}>Invoice Date</span>
                {', '}
                <span className={requiredFieldsStatus.total ? 'text-green-600' : 'text-destructive'}>Total</span>
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
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Records'}
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
                debugInfo={debugInfo}
              />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
