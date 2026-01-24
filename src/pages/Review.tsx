import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Check, 
  AlertTriangle,
  Info,
  Save,
  ArrowLeft,
  Building2,
  Receipt
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ExtractedField {
  value: string;
  confidence: 'high' | 'medium' | 'low';
  evidence?: string;
}

interface ExtractedData {
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

// Mock extracted data (in real app, this would come from an extraction service)
const mockExtractedData: ExtractedData = {
  vendor: {
    name: { value: 'Acme Supplies Inc.', confidence: 'high', evidence: 'Found in W9 header' },
    address: { value: '123 Business Ave', confidence: 'high', evidence: 'Line 2 of W9' },
    city: { value: 'San Francisco', confidence: 'high', evidence: 'Address section' },
    state: { value: 'CA', confidence: 'high', evidence: 'Address section' },
    zip: { value: '94105', confidence: 'medium', evidence: 'Partially visible' },
    taxId: { value: '12-3456789', confidence: 'high', evidence: 'TIN field on W9' },
    email: { value: 'billing@acme.com', confidence: 'medium', evidence: 'Invoice footer' },
    phone: { value: '(415) 555-0100', confidence: 'low', evidence: 'May be fax number' },
  },
  invoice: {
    invoiceNumber: { value: 'INV-2024-0892', confidence: 'high', evidence: 'Top right of invoice' },
    invoiceDate: { value: '2024-01-15', confidence: 'high', evidence: 'Invoice date field' },
    dueDate: { value: '2024-02-14', confidence: 'high', evidence: 'Due date field' },
    subtotal: { value: '2,450.00', confidence: 'high', evidence: 'Subtotal line' },
    tax: { value: '196.00', confidence: 'high', evidence: 'Tax line' },
    total: { value: '2,646.00', confidence: 'high', evidence: 'Total amount' },
  }
};

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const config = {
    high: { icon: Check, className: 'confidence-high', label: 'High' },
    medium: { icon: AlertTriangle, className: 'confidence-medium', label: 'Review' },
    low: { icon: Info, className: 'confidence-low', label: 'Low' },
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
}

function EditableField({ label, field, value, onChange }: EditableFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <ConfidenceBadge confidence={field.confidence} />
      </div>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
      {field.evidence && (
        <p className="text-xs text-muted-foreground">
          <Info className="h-3 w-3 inline mr-1" />
          {field.evidence}
        </p>
      )}
    </div>
  );
}

export default function ReviewPage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, isReadOnly } = useAuth();
  const [extractedData] = useState<ExtractedData>(mockExtractedData);
  const [isSaving, setIsSaving] = useState(false);

  // Editable fields
  const [vendorName, setVendorName] = useState(extractedData.vendor.name.value);
  const [vendorAddress, setVendorAddress] = useState(extractedData.vendor.address.value);
  const [vendorCity, setVendorCity] = useState(extractedData.vendor.city.value);
  const [vendorState, setVendorState] = useState(extractedData.vendor.state.value);
  const [vendorZip, setVendorZip] = useState(extractedData.vendor.zip.value);
  const [vendorTaxId, setVendorTaxId] = useState(extractedData.vendor.taxId.value);
  const [vendorEmail, setVendorEmail] = useState(extractedData.vendor.email.value);
  const [vendorPhone, setVendorPhone] = useState(extractedData.vendor.phone.value);

  const [invoiceNumber, setInvoiceNumber] = useState(extractedData.invoice.invoiceNumber.value);
  const [invoiceDate, setInvoiceDate] = useState(extractedData.invoice.invoiceDate.value);
  const [dueDate, setDueDate] = useState(extractedData.invoice.dueDate.value);
  const [subtotal, setSubtotal] = useState(extractedData.invoice.subtotal.value);
  const [tax, setTax] = useState(extractedData.invoice.tax.value);
  const [total, setTotal] = useState(extractedData.invoice.total.value);

  useEffect(() => {
    // Check if we came from the upload page
    const uploadedInvoice = sessionStorage.getItem('uploadedInvoice');
    if (!uploadedInvoice) {
      navigate('/upload');
    }
  }, [navigate]);

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
          name: vendorName,
          address: vendorAddress,
          city: vendorCity,
          state: vendorState,
          zip: vendorZip,
          tax_id: vendorTaxId,
          email: vendorEmail,
          phone: vendorPhone,
        })
        .select()
        .single();

      if (vendorError) throw vendorError;

      // Save invoice
      const { error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          vendor_id: vendor.id,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate,
          subtotal: parseFloat(subtotal.replace(/,/g, '')),
          tax: parseFloat(tax.replace(/,/g, '')),
          total: parseFloat(total.replace(/,/g, '')),
        });

      if (invoiceError) throw invoiceError;

      // Clear session storage
      sessionStorage.removeItem('uploadedInvoice');
      sessionStorage.removeItem('uploadedW9');

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
                field={extractedData.vendor.name}
                value={vendorName}
                onChange={setVendorName}
              />
              <EditableField
                label="Address"
                field={extractedData.vendor.address}
                value={vendorAddress}
                onChange={setVendorAddress}
              />
              <div className="grid grid-cols-3 gap-4">
                <EditableField
                  label="City"
                  field={extractedData.vendor.city}
                  value={vendorCity}
                  onChange={setVendorCity}
                />
                <EditableField
                  label="State"
                  field={extractedData.vendor.state}
                  value={vendorState}
                  onChange={setVendorState}
                />
                <EditableField
                  label="ZIP"
                  field={extractedData.vendor.zip}
                  value={vendorZip}
                  onChange={setVendorZip}
                />
              </div>
              <EditableField
                label="Tax ID"
                field={extractedData.vendor.taxId}
                value={vendorTaxId}
                onChange={setVendorTaxId}
              />
              <div className="grid grid-cols-2 gap-4">
                <EditableField
                  label="Email"
                  field={extractedData.vendor.email}
                  value={vendorEmail}
                  onChange={setVendorEmail}
                />
                <EditableField
                  label="Phone"
                  field={extractedData.vendor.phone}
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
                field={extractedData.invoice.invoiceNumber}
                value={invoiceNumber}
                onChange={setInvoiceNumber}
              />
              <div className="grid grid-cols-2 gap-4">
                <EditableField
                  label="Invoice Date"
                  field={extractedData.invoice.invoiceDate}
                  value={invoiceDate}
                  onChange={setInvoiceDate}
                />
                <EditableField
                  label="Due Date"
                  field={extractedData.invoice.dueDate}
                  value={dueDate}
                  onChange={setDueDate}
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Subtotal</Label>
                  <div className="flex items-center gap-2">
                    <ConfidenceBadge confidence={extractedData.invoice.subtotal.confidence} />
                    <Input 
                      value={subtotal} 
                      onChange={(e) => setSubtotal(e.target.value)}
                      className="w-32 text-right"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Tax</Label>
                  <div className="flex items-center gap-2">
                    <ConfidenceBadge confidence={extractedData.invoice.tax.confidence} />
                    <Input 
                      value={tax} 
                      onChange={(e) => setTax(e.target.value)}
                      className="w-32 text-right"
                    />
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold">Total</Label>
                  <div className="flex items-center gap-2">
                    <ConfidenceBadge confidence={extractedData.invoice.total.confidence} />
                    <Input 
                      value={total} 
                      onChange={(e) => setTotal(e.target.value)}
                      className="w-32 text-right font-semibold"
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
