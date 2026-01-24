import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
  FileWarning
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ParsedDocument, ExtractedFields, ExtractedField } from '@/lib/pdfParser';

function ConfidenceBadge({ confidence, evidence }: { confidence: 'high' | 'medium' | 'low'; evidence?: { docType: string; pageNumber: number; snippet: string } }) {
  const config = {
    high: { icon: Check, className: 'bg-green-500/20 text-green-600 dark:text-green-400', label: 'High' },
    medium: { icon: AlertTriangle, className: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400', label: 'Review' },
    low: { icon: Info, className: 'bg-red-500/20 text-red-600 dark:text-red-400', label: 'Low' },
  };
  
  const { icon: Icon, className, label } = config[confidence];
  
  const badge = (
    <span className={`${className} text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 cursor-help`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );

  if (evidence && evidence.pageNumber > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-medium text-xs mb-1">
              Source: {evidence.docType.toUpperCase()}, Page {evidence.pageNumber}
            </p>
            <p className="text-xs text-muted-foreground italic">"{evidence.snippet}"</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return badge;
}

interface EditableFieldProps {
  label: string;
  field: ExtractedField;
  value: string;
  onChange: (value: string) => void;
}

function EditableField({ label, field, value, onChange }: EditableFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <ConfidenceBadge confidence={field.confidence} evidence={field.evidence} />
      </div>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
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

  // Get parsed data from navigation state
  const { invoiceDoc, w9Doc, extractedFields, storeDocuments } = (location.state || {}) as {
    invoiceDoc?: ParsedDocument;
    w9Doc?: ParsedDocument;
    extractedFields?: ExtractedFields;
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
    // Check if we came from the upload page with data
    if (!invoiceDoc && !location.state) {
      navigate('/upload');
    }
  }, [navigate, invoiceDoc, location.state]);

  const handleSave = async () => {
    if (!user || isReadOnly) return;

    setIsSaving(true);
    try {
      // Start trial if this is the first extraction
      if (profile?.subscription_status === 'trial_not_started') {
        const { error: trialError } = await supabase.functions.invoke('start-trial');
        if (trialError) throw trialError;
        await refreshProfile();
      }

      // Save vendor
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

      // Parse and format date for database
      const parseDate = (dateStr: string): string | null => {
        if (!dateStr) return null;
        // Try to parse various date formats
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
        return null;
      };

      // Parse currency values
      const parseCurrency = (value: string): number | null => {
        if (!value) return null;
        const cleaned = value.replace(/[$,\s]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
      };

      // Save invoice
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

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/upload')} className="gap-2 mb-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Upload
            </Button>
            <h1 className="font-display text-3xl font-bold">Review Extracted Data</h1>
            <p className="text-muted-foreground">
              Verify and edit the extracted information before saving.
            </p>
          </div>
        </div>

        {/* Scanned Document Warning */}
        {isScanned && (
          <div className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/30 rounded-lg animate-scale-in">
            <FileWarning className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-warning">Scanned Document Detected</p>
              <p className="text-sm text-muted-foreground">
                One or more documents appear to be scanned images without selectable text. 
                Fields may be empty or inaccurate. Please review and enter data manually.
              </p>
            </div>
          </div>
        )}

        {/* Document Info */}
        <div className="flex flex-wrap gap-3">
          {invoiceDoc && (
            <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <span>{invoiceDoc.fileName}</span>
              {invoiceDoc.isScanned && (
                <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded">Scanned</span>
              )}
            </div>
          )}
          {w9Doc && (
            <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm">
              <FileText className="h-4 w-4 text-accent" />
              <span>{w9Doc.fileName}</span>
              {w9Doc.isScanned && (
                <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded">Scanned</span>
              )}
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Vendor Information */}
          <Card className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Vendor Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <EditableField
                label="Vendor Name"
                field={fields.vendor.name}
                value={vendorName}
                onChange={setVendorName}
              />
              <EditableField
                label="Address"
                field={fields.vendor.address}
                value={vendorAddress}
                onChange={setVendorAddress}
              />
              <div className="grid grid-cols-3 gap-4">
                <EditableField
                  label="City"
                  field={fields.vendor.city}
                  value={vendorCity}
                  onChange={setVendorCity}
                />
                <EditableField
                  label="State"
                  field={fields.vendor.state}
                  value={vendorState}
                  onChange={setVendorState}
                />
                <EditableField
                  label="ZIP"
                  field={fields.vendor.zip}
                  value={vendorZip}
                  onChange={setVendorZip}
                />
              </div>
              <EditableField
                label="Tax ID"
                field={fields.vendor.taxId}
                value={vendorTaxId}
                onChange={setVendorTaxId}
              />
              <div className="grid grid-cols-2 gap-4">
                <EditableField
                  label="Email"
                  field={fields.vendor.email}
                  value={vendorEmail}
                  onChange={setVendorEmail}
                />
                <EditableField
                  label="Phone"
                  field={fields.vendor.phone}
                  value={vendorPhone}
                  onChange={setVendorPhone}
                />
              </div>
            </CardContent>
          </Card>

          {/* Invoice Information */}
          <Card className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-accent" />
                Invoice Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <EditableField
                label="Invoice Number"
                field={fields.invoice.invoiceNumber}
                value={invoiceNumber}
                onChange={setInvoiceNumber}
              />
              <div className="grid grid-cols-2 gap-4">
                <EditableField
                  label="Invoice Date"
                  field={fields.invoice.invoiceDate}
                  value={invoiceDate}
                  onChange={setInvoiceDate}
                />
                <EditableField
                  label="Due Date"
                  field={fields.invoice.dueDate}
                  value={dueDate}
                  onChange={setDueDate}
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Subtotal</Label>
                  <div className="flex items-center gap-2">
                    <ConfidenceBadge confidence={fields.invoice.subtotal.confidence} evidence={fields.invoice.subtotal.evidence} />
                    <Input 
                      value={subtotal} 
                      onChange={(e) => setSubtotal(e.target.value)}
                      className="w-32 text-right"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Tax</Label>
                  <div className="flex items-center gap-2">
                    <ConfidenceBadge confidence={fields.invoice.tax.confidence} evidence={fields.invoice.tax.evidence} />
                    <Input 
                      value={tax} 
                      onChange={(e) => setTax(e.target.value)}
                      className="w-32 text-right"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold">Total</Label>
                  <div className="flex items-center gap-2">
                    <ConfidenceBadge confidence={fields.invoice.total.confidence} evidence={fields.invoice.total.evidence} />
                    <Input 
                      value={total} 
                      onChange={(e) => setTotal(e.target.value)}
                      className="w-32 text-right font-semibold"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Save Button */}
        <div className="flex justify-center pt-4 animate-fade-in">
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
          <p className="text-center text-sm text-muted-foreground animate-fade-in">
            Saving will start your 7-day free trial with full Pro features.
          </p>
        )}
      </div>
    </AppLayout>
  );
}
