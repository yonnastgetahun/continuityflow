import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { PDFViewer } from '@/components/PDFViewer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  FileText, 
  Check, 
  AlertTriangle,
  Info,
  Save,
  ArrowLeft,
  Building2,
  Receipt,
  FileWarning,
  ExternalLink,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ParsedDocument, ExtractedFields, ExtractedField, FieldEvidence } from '@/lib/pdfParser';

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
      Jump to source
    </Button>
  );
}

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
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

interface EditableFieldProps {
  label: string;
  field: ExtractedField;
  value: string;
  onChange: (value: string) => void;
  onJumpToSource: (evidence: FieldEvidence) => void;
}

function EditableField({ label, field, value, onChange, onJumpToSource }: EditableFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm">{label}</Label>
        <div className="flex items-center gap-1">
          <ConfidenceBadge confidence={field.confidence} />
          <JumpToSourceButton evidence={field.evidence} onJump={onJumpToSource} />
        </div>
      </div>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9" />
    </div>
  );
}

// Default field for when no data is available
const createDefaultField = (): ExtractedField => ({
  value: '',
  confidence: 'low',
  evidence: { docType: 'invoice', pageNumber: 0, snippet: 'Not found in document' },
});

export default function ReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, refreshProfile, isReadOnly } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [showViewer, setShowViewer] = useState(true);
  const [activeDoc, setActiveDoc] = useState<'invoice' | 'w9'>('invoice');
  const [viewerPage, setViewerPage] = useState(1);
  const [highlightSnippet, setHighlightSnippet] = useState<string | undefined>();

  // Get parsed data from navigation state
  const { invoiceDoc, w9Doc, extractedFields, invoiceFile, w9File } = (location.state || {}) as {
    invoiceDoc?: ParsedDocument;
    w9Doc?: ParsedDocument;
    extractedFields?: ExtractedFields;
    invoiceFile?: File;
    w9File?: File;
    storeDocuments?: boolean;
  };

  // Default empty extracted data
  const fields: ExtractedFields = extractedFields || {
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
    
    // Clear highlight after a delay
    setTimeout(() => setHighlightSnippet(undefined), 5000);
  };

  const handleSave = async () => {
    if (!user || isReadOnly) return;

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
        if (!dateStr) return null;
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

  const isScanned = invoiceDoc?.isScanned || w9Doc?.isScanned;
  const currentFile = activeDoc === 'invoice' ? invoiceFile : w9File;
  const currentFileName = activeDoc === 'invoice' ? invoiceDoc?.fileName : w9Doc?.fileName;

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

        {/* Scanned Warning */}
        {isScanned && (
          <div className="flex items-start gap-3 p-3 mb-4 bg-warning/10 border border-warning/30 rounded-lg">
            <FileWarning className="h-5 w-5 text-warning flex-shrink-0" />
            <div>
              <p className="font-medium text-warning text-sm">Scanned Document Detected</p>
              <p className="text-xs text-muted-foreground">
                Fields may be empty or inaccurate. Please review manually.
              </p>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* PDF Viewer Panel */}
          {showViewer && (
            <div className="w-[400px] flex-shrink-0 flex flex-col bg-card rounded-lg border overflow-hidden">
              {/* Document Tabs */}
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
            <div className="grid lg:grid-cols-2 gap-4">
              {/* Vendor Information */}
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-4 w-4 text-primary" />
                    Vendor Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4">
                  <EditableField
                    label="Vendor Name"
                    field={fields.vendor.name}
                    value={vendorName}
                    onChange={setVendorName}
                    onJumpToSource={handleJumpToSource}
                  />
                  <EditableField
                    label="Address"
                    field={fields.vendor.address}
                    value={vendorAddress}
                    onChange={setVendorAddress}
                    onJumpToSource={handleJumpToSource}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <EditableField
                      label="City"
                      field={fields.vendor.city}
                      value={vendorCity}
                      onChange={setVendorCity}
                      onJumpToSource={handleJumpToSource}
                    />
                    <EditableField
                      label="State"
                      field={fields.vendor.state}
                      value={vendorState}
                      onChange={setVendorState}
                      onJumpToSource={handleJumpToSource}
                    />
                    <EditableField
                      label="ZIP"
                      field={fields.vendor.zip}
                      value={vendorZip}
                      onChange={setVendorZip}
                      onJumpToSource={handleJumpToSource}
                    />
                  </div>
                  <EditableField
                    label="Tax ID"
                    field={fields.vendor.taxId}
                    value={vendorTaxId}
                    onChange={setVendorTaxId}
                    onJumpToSource={handleJumpToSource}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <EditableField
                      label="Email"
                      field={fields.vendor.email}
                      value={vendorEmail}
                      onChange={setVendorEmail}
                      onJumpToSource={handleJumpToSource}
                    />
                    <EditableField
                      label="Phone"
                      field={fields.vendor.phone}
                      value={vendorPhone}
                      onChange={setVendorPhone}
                      onJumpToSource={handleJumpToSource}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Invoice Information */}
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Receipt className="h-4 w-4 text-accent" />
                    Invoice Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4">
                  <EditableField
                    label="Invoice Number"
                    field={fields.invoice.invoiceNumber}
                    value={invoiceNumber}
                    onChange={setInvoiceNumber}
                    onJumpToSource={handleJumpToSource}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <EditableField
                      label="Invoice Date"
                      field={fields.invoice.invoiceDate}
                      value={invoiceDate}
                      onChange={setInvoiceDate}
                      onJumpToSource={handleJumpToSource}
                    />
                    <EditableField
                      label="Due Date"
                      field={fields.invoice.dueDate}
                      value={dueDate}
                      onChange={setDueDate}
                      onJumpToSource={handleJumpToSource}
                    />
                  </div>

                  <Separator className="my-2" />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm">Subtotal</Label>
                      <div className="flex items-center gap-1">
                        <ConfidenceBadge confidence={fields.invoice.subtotal.confidence} />
                        <JumpToSourceButton evidence={fields.invoice.subtotal.evidence} onJump={handleJumpToSource} />
                        <Input 
                          value={subtotal} 
                          onChange={(e) => setSubtotal(e.target.value)}
                          className="w-28 text-right h-9"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm">Tax</Label>
                      <div className="flex items-center gap-1">
                        <ConfidenceBadge confidence={fields.invoice.tax.confidence} />
                        <JumpToSourceButton evidence={fields.invoice.tax.evidence} onJump={handleJumpToSource} />
                        <Input 
                          value={tax} 
                          onChange={(e) => setTax(e.target.value)}
                          className="w-28 text-right h-9"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm font-semibold">Total</Label>
                      <div className="flex items-center gap-1">
                        <ConfidenceBadge confidence={fields.invoice.total.confidence} />
                        <JumpToSourceButton evidence={fields.invoice.total.evidence} onJump={handleJumpToSource} />
                        <Input 
                          value={total} 
                          onChange={(e) => setTotal(e.target.value)}
                          className="w-28 text-right h-9 font-semibold"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Save Button */}
            <div className="flex justify-center py-4">
              <Button
                size="lg"
                onClick={handleSave}
                disabled={isSaving || isReadOnly}
                className="gap-2 min-w-48"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Records'}
              </Button>
            </div>

            {profile?.subscription_status === 'trial_not_started' && (
              <p className="text-center text-sm text-muted-foreground pb-4">
                Saving will start your 7-day free trial with full Pro features.
              </p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
