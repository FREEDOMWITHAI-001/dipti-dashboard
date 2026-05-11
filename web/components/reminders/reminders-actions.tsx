'use client';

import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/shell/toast-region';

export function RemindersActions() {
  const { toast } = useToast();
  return (
    <Button onClick={() => toast('Test-fire requires GHL credentials. Configure GHL_PIT_TOKEN to enable.', 'info')}>
      <Play className="w-4 h-4" /> Test-fire any event
    </Button>
  );
}
