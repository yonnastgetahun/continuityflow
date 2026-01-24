import { useTestMode } from '@/hooks/useTestMode';
import { FlaskConical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TestModeBanner() {
  const { isTestMode, disableTestMode } = useTestMode();

  if (!isTestMode) return null;

  return (
    <div className="bg-amber-500 text-white">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4" />
          <span className="text-sm font-medium">
            Test Mode — POs generated here are watermarked and non-billable
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={disableTestMode}
          className="text-white hover:bg-amber-600 hover:text-white h-7 px-2"
        >
          <X className="h-4 w-4 mr-1" />
          Exit
        </Button>
      </div>
    </div>
  );
}
