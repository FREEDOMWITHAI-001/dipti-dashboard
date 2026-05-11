'use client';

import { Download, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/shell/toast-region';

export function EmiActions() {
  const { toast } = useToast();
  return (
    <div className="flex items-center gap-2">
      <Button onClick={() => toast('CSV export is coming soon.', 'info')}>
        <Download className="w-4 h-4" /> Export
      </Button>
      <Button variant="primary" onClick={() => toast('Add EMI is coming soon — for now, EMIs are seeded via the import script.', 'info')}>
        <Plus className="w-4 h-4" /> Add EMI
      </Button>
    </div>
  );
}
