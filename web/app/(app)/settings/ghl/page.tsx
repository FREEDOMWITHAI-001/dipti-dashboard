import { supabaseServer } from '@/lib/supabase/server';
import { Link2, RefreshCw, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function GhlSettingsPage() {
  const sb = supabaseServer();

  const [{ data: settings }, { data: events }] = await Promise.all([
    sb.from('ghl_settings').select('*').eq('id', 1).maybeSingle(),
    sb.from('reminder_events').select('id, name, default_workflow_id, recipient_type, enabled').order('id'),
  ]);

  const locationConfigured = !!(settings as any)?.location_id;
  const lastSync = (settings as any)?.last_full_sync as string | null;

  return (
    <div className="px-7 py-7 max-w-[1000px]">
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-tight">GHL Integration</h1>
        <p className="text-[13.5px] text-ink-500 mt-1">Connection status and reminder workflow IDs.</p>
      </div>

      <div className="bg-white border border-ink-200/70 rounded-xl p-5 mb-4">
        <div className="flex items-start gap-3">
          <span className={`w-9 h-9 rounded-lg grid place-items-center ${locationConfigured ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            <Link2 className="w-4 h-4" />
          </span>
          <div className="flex-1">
            <div className="font-semibold text-[14px]">
              {locationConfigured ? 'Connected' : 'Not configured'}
            </div>
            <div className="text-[12.5px] text-ink-500 mt-0.5">
              {locationConfigured
                ? <>Location: <span className="font-mono text-ink-700">{(settings as any).location_id}</span></>
                : <>Set <span className="font-mono">GHL_PIT_TOKEN</span> and <span className="font-mono">GHL_LOCATION_ID</span> in your environment, then trigger a sync.</>}
            </div>
            <div className="text-[11.5px] text-ink-500 mt-2">
              Last full sync: {lastSync ? new Date(lastSync).toLocaleString() : 'never'}
            </div>
          </div>
          <button className="h-9 px-3 rounded-lg border border-ink-200 text-[12.5px] font-medium hover:bg-ink-50 inline-flex items-center gap-1.5" title="Manual sync coming soon" disabled>
            <RefreshCw className="w-3.5 h-3.5" /> Sync now
          </button>
        </div>
      </div>

      <div className="bg-white border border-ink-200/70 rounded-xl">
        <div className="px-5 py-3.5 border-b border-ink-100">
          <div className="font-semibold text-[14px]">Reminder workflow mapping</div>
          <div className="text-[12px] text-ink-500 mt-0.5">Each event triggers a GHL workflow. IDs are read-only here — edit in the Reminders page.</div>
        </div>
        <div className="divide-y divide-ink-100">
          {(events ?? []).length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-ink-500 inline-flex items-center gap-2 justify-center w-full">
              <AlertCircle className="w-4 h-4" /> No reminder events configured.
            </div>
          ) : (
            (events as any[]).map((e) => (
              <div key={e.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium truncate">{e.name}</div>
                  <div className="text-[11.5px] text-ink-500"><span className="font-mono">{e.id}</span> · {e.recipient_type}</div>
                </div>
                <div className="text-[12px] font-mono text-ink-500 truncate max-w-[280px]">
                  {e.default_workflow_id ?? <span className="text-amber-700">unmapped</span>}
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${e.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-600'}`}>
                  {e.enabled ? 'enabled' : 'paused'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
