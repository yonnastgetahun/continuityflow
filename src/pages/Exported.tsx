import { useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  CheckCircle, 
  Download, 
  FileText,
  ArrowRight,
  ClipboardList
} from 'lucide-react';

export default function ExportedPage() {
  const location = useLocation();
  const { poNumber } = location.state || { poNumber: 'PO-UNKNOWN' };

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
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground">
              You can also access this document anytime from your Records.
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
