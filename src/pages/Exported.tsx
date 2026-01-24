import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  CheckCircle, 
  Download, 
  FileText,
  ArrowRight,
  ClipboardList,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { downloadPoPdf, type POData } from '@/lib/generatePoPdf';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function ExportedPage() {
  const location = useLocation();
  const { poId, poNumber, poData } = location.state || { 
    poId: null,
    poNumber: 'PO-UNKNOWN', 
    poData: null 
  };
  
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!poData) {
      toast.error('PDF data not available. Please generate a new PO.');
      return;
    }

    setDownloading(true);
    try {
      await downloadPoPdf(poData as POData);
      
      // Update exported_at timestamp
      if (poId) {
        await supabase
          .from('purchase_orders')
          .update({ 
            status: 'exported',
            exported_at: new Date().toISOString()
          })
          .eq('id', poId);
      }
      
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('PDF download failed:', error);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg text-center animate-scale-in">
        <div className="mx-auto h-20 w-20 rounded-full bg-success/10 flex items-center justify-center mb-6">
          <CheckCircle className="h-10 w-10 text-success" />
        </div>

        <h1 className="font-display text-3xl font-bold mb-2">
          Purchase Order Created!
        </h1>
        <p className="text-muted-foreground mb-8">
          Your purchase order <span className="font-mono font-medium text-foreground">{poNumber}</span> has been generated successfully.
        </p>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg mb-4">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium">{poNumber}.pdf</p>
                  <p className="text-sm text-muted-foreground">Purchase Order Document</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={handleDownload}
                disabled={!poData || downloading}
              >
                {downloading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Download Again
                  </>
                )}
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground">
              {poData 
                ? 'You can download the PDF again anytime from this page or your Records.'
                : 'PDF data not available. Generate a new PO to download.'
              }
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/records">
            <Button variant="outline" className="gap-2 w-full sm:w-auto">
              <ClipboardList className="h-4 w-4" />
              View All Records
            </Button>
          </Link>
          <Link to="/upload">
            <Button className="gap-2 w-full sm:w-auto">
              Create Another PO
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
