import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, 
  Receipt, 
  FileOutput,
  Plus,
  ChevronRight,
  Search,
  Download
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface Vendor {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  created_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  total: number | null;
  vendor_id: string | null;
  vendors?: { id: string; name: string } | null;
  created_at: string;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  po_date: string;
  total: number | null;
  status: string | null;
  vendors?: { id: string; name: string } | null;
  created_at: string;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  po_date: string;
  total: number | null;
  status: string | null;
  vendors?: Vendor | null;
  created_at: string;
}

export default function RecordsPage() {
  const navigate = useNavigate();
  const { user, isReadOnly } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vendorsRes, invoicesRes, posRes] = await Promise.all([
        supabase.from('vendors').select('*').order('created_at', { ascending: false }),
        supabase.from('invoices').select('*, vendors(id, name)').order('created_at', { ascending: false }),
        supabase.from('purchase_orders').select('*, vendors(id, name)').order('created_at', { ascending: false }),
      ]);

      if (vendorsRes.data) setVendors(vendorsRes.data);
      if (invoicesRes.data) setInvoices(invoicesRes.data as Invoice[]);
      if (posRes.data) setPurchaseOrders(posRes.data as PurchaseOrder[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredInvoices = invoices.filter(i =>
    i.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (i.vendors as Vendor | null)?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPOs = purchaseOrders.filter(po =>
    po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (po.vendors as Vendor | null)?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Records</h1>
            <p className="text-muted-foreground">
              View and manage your vendors, invoices, and purchase orders.
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/upload">
              <Button className="gap-2" disabled={isReadOnly}>
                <Plus className="h-4 w-4" />
                New Upload
              </Button>
            </Link>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs defaultValue="vendors" className="animate-fade-in">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="vendors" className="gap-2">
              <Building2 className="h-4 w-4" />
              Vendors ({vendors.length})
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2">
              <Receipt className="h-4 w-4" />
              Invoices ({invoices.length})
            </TabsTrigger>
            <TabsTrigger value="pos" className="gap-2">
              <FileOutput className="h-4 w-4" />
              POs ({purchaseOrders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vendors" className="space-y-4 mt-4">
            {filteredVendors.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No vendors yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Upload your first invoice to add a vendor.
                  </p>
                  <Link to="/upload">
                    <Button disabled={isReadOnly}>Upload Documents</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {filteredVendors.map((vendor) => (
                  <Card key={vendor.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                    <CardContent className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-medium">{vendor.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {vendor.city && vendor.state ? `${vendor.city}, ${vendor.state}` : 'Location not set'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4 mt-4">
            {filteredInvoices.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No invoices yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Upload your first invoice to get started.
                  </p>
                  <Link to="/upload">
                    <Button disabled={isReadOnly}>Upload Documents</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {filteredInvoices.map((invoice) => (
                  <Card key={invoice.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                    <CardContent className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                          <Receipt className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                          <h3 className="font-medium">{invoice.invoice_number || 'No number'}</h3>
                          <p className="text-sm text-muted-foreground">
                            {(invoice.vendors as Vendor | null)?.name || 'Unknown vendor'} •{' '}
                            {invoice.invoice_date ? format(new Date(invoice.invoice_date), 'MMM d, yyyy') : 'No date'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-semibold">{formatCurrency(invoice.total)}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/generate', { state: { invoiceId: invoice.id } });
                          }}
                          disabled={isReadOnly}
                        >
                          Generate PO
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pos" className="space-y-4 mt-4">
            {filteredPOs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileOutput className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No purchase orders yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Generate a PO from an invoice to see it here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {filteredPOs.map((po) => (
                  <Card key={po.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                    <CardContent className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                          <FileOutput className="h-5 w-5 text-success" />
                        </div>
                        <div>
                          <h3 className="font-medium">{po.po_number}</h3>
                          <p className="text-sm text-muted-foreground">
                            {(po.vendors as Vendor | null)?.name || 'Unknown vendor'} •{' '}
                            {format(new Date(po.po_date), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          po.status === 'exported' ? 'trust-badge' : 'bg-muted text-muted-foreground'
                        }`}>
                          {po.status?.toUpperCase() || 'DRAFT'}
                        </span>
                        <span className="font-semibold">{formatCurrency(po.total)}</span>
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
