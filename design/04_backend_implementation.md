# Backend implementation plan

**TL;DR — there is no separate backend server.** The "backend" is three pieces:

1. **Next.js API routes** running serverlessly on Vercel (the parts the browser calls).
2. **Supabase** doing the heavy lifting: Postgres + Auth + Realtime + Storage + Edge Functions (DB-side logic).
3. **Vercel Cron** firing scheduled jobs (the auto-reminders).

This means **one repo, one deploy, one bill, no servers to maintain.** It's the modern equivalent of "monolith with a database" but serverless.

---

## Where every backend responsibility lives

```
┌────────────────────────── BROWSER ──────────────────────────┐
│  Next.js client (React) — reads/writes through:             │
│   • Supabase JS SDK  (most reads, all realtime subscribes)  │
│   • fetch('/api/…')  (writes that need server-side secrets) │
└──────────────┬──────────────────────────┬───────────────────┘
               │                          │
   reads + RLS-safe writes           server-only actions
               │                          │
               ▼                          ▼
   ┌────────────────────┐    ┌────────────────────────────────┐
   │ SUPABASE Postgres  │    │ Vercel: Next.js API routes     │
   │  + Auth + Realtime │    │  - /api/ghl/* (uses GHL token) │
   │  + Storage         │    │  - /api/voice/transcribe       │
   │  + Edge Functions  │    │  - /api/briefing/generate      │
   └────────┬───────────┘    │  - /api/cron/* (scheduled)     │
            │                │  - /api/webhooks/ghl           │
            │ webhook        └──────────────┬─────────────────┘
            │ on insert/update              │
            ▼                               │
   ┌────────────────────┐                   │
   │ Database trigger   │                   │
   │ → mark briefing    │                   │
   │   stale            │                   │
   └────────────────────┘                   │
                                            ▼
                              ┌─────────────────────────┐
                              │ External services       │
                              │  - GHL REST API         │
                              │  - OpenAI Whisper       │
                              │  - Anthropic Claude API │
                              └─────────────────────────┘
```

---

## Repo layout

```
audit-students-dashboard/
├─ app/                            # Next.js App Router
│  ├─ (auth)/login/page.tsx        # Supabase Auth login
│  ├─ (app)/
│  │  ├─ layout.tsx                # sidebar + topbar shell
│  │  ├─ page.tsx                  # students list
│  │  ├─ students/[id]/page.tsx    # slide-over works as overlay
│  │  ├─ emi/page.tsx
│  │  ├─ reminders/page.tsx
│  │  ├─ calls/page.tsx
│  │  ├─ reports/page.tsx
│  │  └─ settings/page.tsx
│  └─ api/
│     ├─ ghl/
│     │  ├─ import-by-tag/route.ts     # POST  Settings → "Pull from GHL"
│     │  ├─ upsert-contact/route.ts    # POST  called server-side after each write
│     │  └─ trigger-workflow/route.ts  # POST  fire a workflow on a contact
│     ├─ voice/
│     │  └─ transcribe/route.ts        # POST  audio blob → Whisper → text
│     ├─ briefing/
│     │  └─ generate/route.ts          # POST  student_id → Claude Haiku → MD
│     ├─ webhooks/
│     │  └─ ghl/route.ts               # POST  GHL → us (delivery, opt-out)
│     └─ cron/
│        ├─ daily-09/route.ts          # called by Vercel Cron at 09:00 IST
│        └─ daily-10/route.ts          # called by Vercel Cron at 10:00 IST
├─ components/                     # UI components (from prototype/)
├─ lib/
│  ├─ supabase/
│  │  ├─ client.ts                 # browser client
│  │  ├─ server.ts                 # server client (cookies)
│  │  └─ admin.ts                  # service-role client (server-only)
│  ├─ ghl/
│  │  ├─ client.ts                 # fetch wrapper, auth, retry, rate-limit
│  │  └─ types.ts
│  ├─ ai/
│  │  ├─ briefing.ts               # Claude prompt + parser
│  │  └─ whisper.ts
│  ├─ rate-limit.ts                # token bucket for outbound GHL calls
│  └─ events.ts                    # reminder event registry
├─ supabase/
│  ├─ migrations/                  # SQL versioned migrations
│  │  ├─ 0001_init.sql
│  │  ├─ 0002_partitioning.sql
│  │  └─ 0003_rls.sql
│  ├─ functions/                   # Edge Functions
│  │  └─ scheduler/index.ts
│  └─ seed.sql
├─ scripts/
│  └─ import-excel.ts              # one-time historical Excel → Supabase
├─ .env.example
└─ vercel.json                     # cron schedule definitions
```

---

## Authentication

**Supabase Auth, email + password, magic links optional.**

```ts
// lib/supabase/server.ts (RSC + route handlers)
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const supabaseServer = () =>
  createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: n => cookies().get(n)?.value, set: () => {}, remove: () => {} } }
  );
```

**Middleware** (`middleware.ts`) checks session and redirects unauthenticated requests to `/login` for any route under `(app)/`.

**Profiles bootstrap:** A SQL trigger creates a `profiles` row whenever a new `auth.users` row is inserted, so you never have to manage two systems.

```sql
create function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name, initials)
  values (new.id, new.email, upper(substr(new.email,1,2)));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

**Row-level security:** all signed-in coaches can read+write everything (per your decision). Public access is denied. Audit trail catches bad behaviour.

```sql
alter table students enable row level security;
create policy "coaches read"  on students for select using (auth.role() = 'authenticated');
create policy "coaches write" on students for all    using (auth.role() = 'authenticated');
-- repeat for call_logs, emi_schedule, reminders, audit_log
```

---

## Realtime (live comments)

In the React component for the Calls tab:

```ts
const supabase = createClient();
useEffect(() => {
  const ch = supabase.channel(`calls:${studentId}`)
    .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'call_logs', filter: `student_id=eq.${studentId}` },
        payload => setCalls(prev => [payload.new, ...prev]))
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}, [studentId]);
```

That's it — no WebSocket server to write. When AK inserts a row, DV's browser receives it in <1 sec.

**Presence** (so you can show "DV is viewing this student"):
```ts
ch.on('presence', { event: 'sync' }, () => setViewers(ch.presenceState()))
  .track({ user: profile.initials, ts: Date.now() });
```

---

## GHL integration — the one server-only seam

GHL credentials must NEVER reach the browser. All GHL calls go through `/api/ghl/*`.

```ts
// lib/ghl/client.ts
const BASE = 'https://services.leadconnectorhq.com';

export async function ghl(path: string, opts: RequestInit = {}) {
  await rateLimit('ghl');                       // 8 req/sec ceiling
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${process.env.GHL_PIT_TOKEN}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
  if (res.status === 429) {                     // rate-limited → backoff
    await sleep(Number(res.headers.get('retry-after') ?? 1) * 1000);
    return ghl(path, opts);
  }
  if (!res.ok) throw new GhlError(res.status, await res.text());
  return res.json();
}
```

### Operations we expose

| Route                              | Verb | Purpose                                                   |
|------------------------------------|------|-----------------------------------------------------------|
| `/api/ghl/import-by-tag`           | POST | Paginate `GET /contacts?tag=…` → upsert into `students`. |
| `/api/ghl/upsert-contact`          | POST | After student write, mirror to GHL Contact (idempotent).  |
| `/api/ghl/trigger-workflow`        | POST | Fire workflow `wf_id` on contact `c_id`. Inserts row in `reminders`.|
| `/api/webhooks/ghl`                | POST | Receive GHL events: `OutboundMessage`, `WorkflowComplete`, `ContactUpdate`. Verify HMAC, update `reminders.status` or `students`. |

### Data ownership reminder

We **never read GHL on the read path** — list views, filters, search all go to Supabase. GHL is touched only on (a) initial import, (b) write mirroring, (c) reminder firing, (d) webhook intake. This keeps page loads fast no matter how slow GHL's API is.

---

## Reminder scheduler (the auto-fire engine)

Two layers:

**Layer 1 — Vercel Cron** (cheapest, no server). `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/daily-09",    "schedule": "30 3 * * *" },
    { "path": "/api/cron/daily-10",    "schedule": "30 4 * * *" },
    { "path": "/api/cron/end-of-month","schedule": "55 18 28-31 * *" }
  ]
}
```
(IST is UTC+5:30, so 09:00 IST = 03:30 UTC.)

**Layer 2 — the route**:

```ts
// app/api/cron/daily-09/route.ts
import { supabaseAdmin } from '@/lib/supabase/admin';
import { fireReminder } from '@/lib/events';

export async function GET(req: Request) {
  // verify Vercel cron header
  if (req.headers.get('user-agent') !== 'vercel-cron/1.0') return new Response('forbidden', { status: 403 });
  const sb = supabaseAdmin();

  const { data: dueEMI } = await sb.rpc('emi_reminders_due');         // SQL view
  for (const r of dueEMI) await fireReminder('emi.reminder_due', r);

  const { data: silent } = await sb.rpc('students_no_call_30d');
  for (const s of silent)  await fireReminder('student.no_call_30d', s);

  // ... other 09:00 events
  return Response.json({ ok: true, fired: dueEMI.length + silent.length });
}
```

**`fireReminder`** does three things atomically:
1. Insert a `reminders` row with `status='queued'`.
2. Call GHL `/contacts/{id}/workflow/{workflowId}` → on success flip to `sent`.
3. On failure save `error` and emit a `reminder.failed` event for admin.

The webhook later flips `sent` → `delivered` or `failed`.

---

## AI services

### Briefing — `/api/briefing/generate`

```ts
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const { studentId } = await req.json();
  const sb = supabaseServer();

  // permission via RLS (as the calling user)
  const [{ data: student }, { data: calls }, { data: emi }] = await Promise.all([
    sb.from('students').select('*').eq('id', studentId).single(),
    sb.from('call_logs').select('*').eq('student_id', studentId).order('created_at'),
    sb.from('emi_schedule').select('*').eq('student_id', studentId).order('installment_no'),
  ]);

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: BRIEFING_SYSTEM_PROMPT,                     // see /lib/ai/briefing.ts
    messages: [{ role: 'user', content: buildContext(student, calls, emi) }],
  });

  const summary = msg.content[0].type === 'text' ? msg.content[0].text : '';
  await sb.from('student_briefings').upsert({
    student_id: studentId,
    summary_md: summary,
    source_calls_count: calls.length,
    source_max_call_at: calls[calls.length-1]?.created_at,
    is_stale: false,
    tokens_in: msg.usage.input_tokens,
    tokens_out: msg.usage.output_tokens,
  });

  return Response.json({ summary });
}
```

A SQL trigger flips `is_stale=true` whenever a new `call_logs` row is inserted, so the next view regenerates lazily.

### Voice — `/api/voice/transcribe`

```ts
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('audio') as File;
  if (file.size > 5_000_000) return new Response('too large', { status: 413 });

  const openaiForm = new FormData();
  openaiForm.append('file', file);
  openaiForm.append('model', 'whisper-1');
  openaiForm.append('language', 'en');                  // auto-detect Hindi/Marathi

  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: openaiForm,
  });
  return Response.json(await r.json());
}
```

Audio is **never persisted by default**. If admin enables "archive voice notes" in Settings, we save to Supabase Storage with a 7-day signed-URL TTL.

---

## Excel import (one-shot)

`scripts/import-excel.ts` runs locally with the service-role key:

```ts
import { read, utils } from 'xlsx';
import { supabaseAdmin } from '@/lib/supabase/admin';

const wb = read(readFileSync('DVA_Diamond_Master_sheet.xlsx'));
const rows = utils.sheet_to_json(wb.Sheets['Diamond Master Sheet']);

for (const r of rows) {
  await supabaseAdmin.from('students').upsert({
    email: r.Email.trim().toLowerCase(),
    first_name: r['First Name'],
    last_name: r['Last Name'],
    mobile: r['Mobile Number'],
    membership: r.Membership,
    tags: parseTags(r.Tags),
    start_date: parseDate(r['Start Date']),
    end_date: parseDate(r['End Date']),
    background: r.Background,
    upgrade_flag: r.Upgrade === 'Upgrade',
    month_1: r['Month 1'] === true,
    // ...
  }, { onConflict: 'email' });
}
```

EMI tracker import is similar — parse `"5/9"` into `installment_no=5, installments_total=9`.

**Run with `--dry-run` first** to print diffs without writing.

---

## Environment variables (`.env.example`)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# GHL
GHL_PIT_TOKEN=                    # Private Integration token, location-scoped
GHL_LOCATION_ID=
GHL_WEBHOOK_SECRET=               # for HMAC verification

# AI
OPENAI_API_KEY=                   # for Whisper
ANTHROPIC_API_KEY=                # for Claude briefings

# App
NEXT_PUBLIC_APP_URL=https://dashboard.dva.com
```

---

## Step-by-step buildout (so we know what comes first)

| # | Phase                          | Output                                                           | Days |
|---|--------------------------------|------------------------------------------------------------------|------|
| 1 | **Skeleton**                   | Next.js app + Tailwind + ports the prototype HTML into RSC pages | 1    |
| 2 | **Database**                   | Supabase project, all migrations applied, seed.sql with 5 demo students | 1    |
| 3 | **Auth + RLS**                 | Login page, middleware, profiles trigger, RLS policies          | 0.5  |
| 4 | **Students CRUD + Realtime**   | List, detail, autosave, presence, attribution                    | 1.5  |
| 5 | **Calls timeline + composer**  | Insert + realtime fanout + outcome/next-action                   | 1    |
| 6 | **GHL client + import-by-tag** | Pull-from-GHL Settings page, contact upsert helpers              | 1    |
| 7 | **GHL contact mirroring**      | After-write hook → `/api/ghl/upsert-contact`                     | 0.5  |
| 8 | **EMI list + manual reminder** | Send-now modal → trigger workflow                                | 1    |
| 9 | **Scheduler + auto-reminders** | Vercel Cron → events catalog → fire                              | 1    |
| 10 | **GHL webhook receiver**      | Delivery status → `reminders.status`                             | 0.5  |
| 11 | **AI Briefing**               | Claude integration, lazy regen, stale-flag trigger               | 1    |
| 12 | **Voice notes**               | Recorder UI + Whisper route + optional archive                   | 0.5  |
| 13 | **Excel import script**       | One-shot CLI for legacy data                                     | 0.5  |
| 14 | **Settings (events config)**  | Toggle/map/test-fire UI                                          | 0.5  |
| 15 | **Reports v1**                | KPIs + 2 charts                                                  | 0.5  |
| 16 | **Polish + e2e tests**        | Playwright happy-path, deploy to staging                         | 1    |

**Total: ~12.5 working days for v1.**

---

## Why this is the right shape

- **No long-running server.** Every API route is serverless; cold starts are <500ms; cost scales to zero when idle.
- **One repo to deploy.** `git push` → Vercel rebuilds → live. No Docker, no orchestration, no separate services.
- **Database-first, not API-first.** Most reads bypass our API entirely (Supabase JS hits Postgres directly with RLS), which is faster *and* fewer lines of code we maintain.
- **Realtime is free.** Supabase ships it; we don't write a WebSocket server.
- **Vendor-portable.** Drop Supabase → run Postgres anywhere + write a thin auth shim. Drop Vercel → ship the Next.js app to Cloudflare/Netlify/AWS Amplify.
- **Honest about what's risky.** The single brittle seam is GHL's API. Everything we control (auth, DB, realtime, AI, schedulers) is rock-solid.
