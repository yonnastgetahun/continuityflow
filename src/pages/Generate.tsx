import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { 
  FileOutput, 
  Download,
  ArrowLeft,
  Building2,
  Calendar,
  Hash,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { downloadPoPdf, type POData } from '@/lib/generatePoPdf';

export default function GeneratePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isReadOnly } = useAuth();
  const invoiceId = location.state?.invoiceId;

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // PO Fields
  const [poNumber, setPoNumber] = useState('');
  const [poDate, setPoDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [vendorName, setVendorName] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [shipTo, setShipTo] = useState('');
  const [billTo, setBillTo] = useState('');
  const [subtotal, setSubtotal] = useState('0.00');
  const [tax, setTax] = useState('0.00');
  const [total, setTotal] = useState('0.00');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (invoiceId && user) {
      fetchInvoiceData();
    } else {
      // Generate a new PO number
      setPoNumber(`PO-${format(new Date(), 'yyyyMMdd')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`);
      setLoading(false);
    }
  }, [invoiceId, user]);

  const fetchInvoiceData = async () => {
    try {
      const { data: invoice, error } = await supabase
        .from('invoices')
        .select('*, vendors(*)')
        .eq('id', invoiceId)
        .single();

      if (error) throw error;

      if (invoice) {
        setPoNumber(`PO-${format(new Date(), 'yyyyMMdd')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`);
        setSubtotal(invoice.subtotal?.toString() || '0.00');
        setTax(invoice.tax?.toString() || '0.00');
        setTotal(invoice.total?.toString() || '0.00');
        
        if (invoice.vendors) {
          const vendor = invoice.vendors as any;
          setVendorName(vendor.name || '');
          setVendorAddress(
            [vendor.address, vendor.city, vendor.state, vendor.zip]
              .filter(Boolean)
              .join(', ')
          );
        }
      }
    } catch (error) {
      console.error('Error fetching invoice:', error);
      toast.error('Failed to load invoice data');
    } finally {
      setLoading(false);
    }
  };

  // Build PO data object for PDF generation
  const buildPoData = (): POData => ({
    poNumber,
    poDate,
    vendorName,
    vendorAddress,
    shipTo,
    billTo,
    subtotal,
    tax,
    total,
    notes,
  });

  const handleGenerate = async () => {
    if (!user || isReadOnly) return;

    setGenerating(true);
    try {
      // 1. Get vendor_id from invoice if available
      const { data: invoice } = invoiceId 
        ? await supabase.from('invoices').select('vendor_id').eq('id', invoiceId).single()
        : { data: null };

      // 2. Insert PO record
      const { data: po, error } = await supabase
        .from('purchase_orders')
        .insert({
          user_id: user.id,
          vendor_id: invoice?.vendor_id || null,
          invoice_id: invoiceId || null,
          po_number: poNumber,
          po_date: poDate,
          ship_to: shipTo,
          bill_to: billTo,
          subtotal: parseFloat(subtotal),
          tax: parseFloat(tax),
          total: parseFloat(total),
          notes: notes,
          status: 'generated',
        })
        .select()
        .single();

      if (error) throw error;

      // 3. Generate and download PDF
      const poData = buildPoData();
      try {
        await downloadPoPdf(poData);
        
        // 4. Update status to exported with timestamp
        await supabase
          .from('purchase_orders')
          .update({ 
            status: 'exported',
            exported_at: new Date().toISOString()
          })
          .eq('id', po.id);

        toast.success('Purchase Order exported successfully!');
      } catch (pdfError) {
        console.error('PDF generation failed:', pdfError);
        toast.error('PDF download failed. You can try again from the next screen.');
      }

      // 5. Navigate to exported page
      navigate('/exported', { 
        state: { 
          poId: po.id, 
          poNumber,
          poData,
        } 
      });
    } catch (error) {
      console.error('Error generating PO:', error);
      toast.error('Failed to generate PO. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto section-gap">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 mb-2 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-semibold">Generate Purchase Order</h1>
          <p className="text-muted-foreground text-sm">
            Review and customize before exporting.
          </p>
        </div>

        {/* PO Preview Card */}
        <Card className="animate-fade-in border">
          <CardHeader className="bg-secondary border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg font-medium">
                <FileOutput className="h-5 w-5 text-primary" />
                Purchase Order
              </CardTitle>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">PO Number</p>
                <p className="font-mono text-sm font-medium">{poNumber}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-8">
            {/* Header Info */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  PO Number
                </Label>
                <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Date
                </Label>
                <Input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} />
              </div>
            </div>

            <Separator />

            {/* Vendor & Shipping */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Vendor
                  </Label>
                  <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Vendor name" />
                  <Textarea 
                    value={vendorAddress} 
                    onChange={(e) => setVendorAddress(e.target.value)} 
                    placeholder="Vendor address"
                    rows={3}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Ship To</Label>
                  <Textarea 
                    value={shipTo} 
                    onChange={(e) => setShipTo(e.target.value)} 
                    placeholder="Shipping address"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bill To</Label>
                  <Textarea 
                    value={billTo} 
                    onChange={(e) => setBillTo(e.target.value)} 
                    placeholder="Billing address"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Totals */}
            <div className="max-w-xs ml-auto space-y-3">
              <div className="flex justify-between items-center">
                <Label>Subtotal</Label>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">$</span>
                  <Input 
                    value={subtotal} 
                    onChange={(e) => setSubtotal(e.target.value)} 
                    className="w-28 text-right"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <Label>Tax</Label>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">$</span>
                  <Input 
                    value={tax} 
                    onChange={(e) => setTax(e.target.value)} 
                    className="w-28 text-right"
                  />
                </div>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <Label className="text-lg font-semibold">Total</Label>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">$</span>
                  <Input 
                    value={total} 
                    onChange={(e) => setTotal(e.target.value)} 
                    className="w-28 text-right font-semibold"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                placeholder="Additional notes or terms..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Generate Button */}
        <div className="flex justify-center gap-4 pt-4">
          <Button
            size="lg"
            onClick={handleGenerate}
            disabled={generating || isReadOnly || !poNumber}
            className="gap-2 min-w-48"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Generate & Download PDF
              </>
            )}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
