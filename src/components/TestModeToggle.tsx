import { useTestMode } from '@/hooks/useTestMode';
import { FlaskConical } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function TestModeToggle() {
  const { isTestMode, toggleTestMode } = useTestMode();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2">
          <Switch
            id="test-mode"
            checked={isTestMode}
            onCheckedChange={toggleTestMode}
            className="data-[state=checked]:bg-amber-500"
          />
          <Label 
            htmlFor="test-mode" 
            className={`text-xs cursor-pointer flex items-center gap-1 ${
              isTestMode ? 'text-amber-600 font-medium' : 'text-muted-foreground'
            }`}
          >
            <FlaskConical className="h-3 w-3" />
            Test
          </Label>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[200px]">
        <p className="text-xs">
          Test Mode generates watermarked POs that are non-billable and clearly marked as tests.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
