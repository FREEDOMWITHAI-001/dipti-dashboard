# Architecture & GHL Sync Strategy

## Decision: Hybrid (Postgres + GHL), not GHL-only

GHL is excellent at messaging/automation but a bad fit as a primary transactional DB for this app. We use Postgres (Supabase) as the system-of-record and mirror the customer-facing slice to GHL as the system-of-engagement. This is the standard pattern for ops dashboards built on top of GHL.

### Why not GHL-only

| Need                                        | GHL-only                          | Hybrid                          |
|---------------------------------------------|-----------------------------------|---------------------------------|
| List 999 students with 5 filters in <300ms  | ❌ multi-second, hits rate limit | ✅ single SQL query             |
| Realtime collaborative comments             | ❌ polling only                   | ✅ Supabase Realtime over WS    |
| 12 calls/student × 999 students = audit log | ❌ flat Notes, no structure       | ✅ `call_logs` with FK + index  |
| KPI aggregates (Collected MTD)              | ❌ N+1 API hell                   | ✅ `SUM()` in one query         |
| EMI 9-installment with status transitions   | ❌ Opportunities don't fit        | ✅ `emi_schedule` table         |
| GHL outage                                  | ❌ app dead                       | ✅ degrades gracefully          |

### Why we still tie deeply to GHL

- DVA's team already lives in GHL for WhatsApp/SMS/Email — we don't replace that.
- GHL Workflows handle delivery, retries, opt-outs, compliance.
- Dashboard never sends a message directly; it always triggers a GHL Workflow.

---

## Data flow

```
┌─────────────────┐      writes        ┌─────────────────────┐
│  Dashboard UI   │ ─────────────────▶ │  Supabase Postgres  │
│  (Next.js)      │ ◀───────────────── │  (system-of-record) │
└────────┬────────┘   reads (realtime) └──────────┬──────────┘
         │                                        │
         │ trigger workflow                       │ on every write,
         │ (manual or scheduled)                  │ upsert to GHL Contact
         ▼                                        ▼
┌──────────────────────────────────────────────────────────────┐
│                  GoHighLevel (GHL)                           │
│   Contacts · Tags · Custom Fields · Workflows · Conversations │
└──────────────────────────────────────────────────────────────┘
         │
         │ webhooks: contact.updated, message.delivered, opp.changed
         ▼
┌──────────────────────────────────────────────────────────────┐
│  /api/ghl/webhook → updates Supabase                          │
└──────────────────────────────────────────────────────────────┘
```

---

## Field ownership (single source of truth, no duplication)

| Field                     | Owner       | Where it lives                  | Sync direction         |
|---------------------------|-------------|----------------------------------|------------------------|
| email, name, mobile       | Dashboard   | `students` + GHL Contact         | Dashboard → GHL        |
| membership, tags          | Dashboard   | `students` + GHL Tags/CF         | Dashboard → GHL        |
| start_date, end_date      | Dashboard   | `students` + GHL Custom Field    | Dashboard → GHL        |
| month_1..month_6 progress | Dashboard   | `students`                       | not synced (internal)  |
| call_logs (timeline)      | Dashboard   | `call_logs` table                | summarized to GHL Note |
| emi_schedule              | Dashboard   | `emi_schedule` table             | last-due as GHL CF     |
| reminder dispatch         | GHL         | GHL Workflow                     | GHL → dashboard (status) |
| WhatsApp/SMS conversation | GHL         | GHL Conversations                | read-only embed in UI  |
| message delivery / opt-out | GHL        | GHL                              | webhook → dashboard    |
| audit log (who edited)    | Dashboard   | `audit_log` table                | not synced             |

The rule: **whichever side a feature is built on, owns the field.** No two-way write conflicts.

---

## Postgres schema (v1)

```sql
-- Auth via Supabase Auth (no custom users table needed beyond profiles)
create table profiles (
  id uuid primary key references auth.users,
  display_name text not null,
  initials text not null,        -- "AK", "DV", "FM"
  role text not null default 'coach' check (role in ('coach','admin')),
  created_at timestamptz default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  ghl_contact_id text unique,    -- mapping to GHL
  email text not null unique,
  first_name text,
  last_name text,
  mobile text,
  membership text,                -- "Diamond", "Ex-Diamond", ...
  tags text[] default '{}',       -- ["SH","BBR2",...]
  start_date date,
  end_date date,
  background text,
  upgrade_flag boolean default false,
  month_1 boolean default false,
  month_2 boolean default false,
  month_3 boolean default false,
  month_4 boolean default false,
  month_5 boolean default false,
  month_6 boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  updated_by uuid references profiles(id)
);
create index on students using gin (tags);
create index on students (end_date);

create table call_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  coach_id uuid not null references profiles(id),
  comment text not null,
  outcome text check (outcome in ('connected','no_answer','rescheduled','wrong_number')),
  next_action text,
  next_action_due date,
  created_at timestamptz default now()
);
create index on call_logs (student_id, created_at desc);

create table emi_schedule (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  installment_no int not null,
  installments_total int not null,        -- gives "5/9" for free
  amount numeric(10,2) not null,
  due_date date not null,
  reminder_date date not null,
  status text not null default 'upcoming'
    check (status in ('upcoming','due_soon','overdue','paid','cancelled')),
  paid_date date,
  payment_link text,
  payment_mode text,
  unique (student_id, installment_no)
);
create index on emi_schedule (due_date, status);

create table reminders (
  id uuid primary key default gen_random_uuid(),
  emi_id uuid references emi_schedule(id),
  student_id uuid references students(id),
  ghl_workflow_id text not null,
  channel text check (channel in ('whatsapp','sms','email')),
  scheduled_at timestamptz not null,
  fired_at timestamptz,
  status text default 'queued'
    check (status in ('queued','sent','delivered','failed','cancelled')),
  triggered_by uuid references profiles(id),  -- null if scheduler
  error text
);
create index on reminders (scheduled_at, status);

create table audit_log (
  id bigserial primary key,
  actor_id uuid references profiles(id),
  entity text not null,         -- 'student', 'emi', 'call'
  entity_id uuid not null,
  action text not null,         -- 'create', 'update', 'delete'
  diff jsonb,
  at timestamptz default now()
);
create index on audit_log (entity, entity_id, at desc);
```

RLS: all signed-in coaches can read+write everything (per your "all equal" answer). Audit log gives traceability.

---

## GHL integration surface (what we actually call)

| Action                                  | GHL endpoint                                              |
|-----------------------------------------|-----------------------------------------------------------|
| On new/updated student                  | `POST /contacts/upsert` (by email)                        |
| Set student tags                        | `POST /contacts/{id}/tags`                                |
| Update custom fields (membership, end_date, last_emi, etc.) | `PUT /contacts/{id}` with `customFields[]` |
| Trigger reminder                        | `POST /contacts/{id}/workflow/{workflowId}`               |
| List available workflows                | `GET /workflows/`                                         |
| Read conversation thread (UI embed)     | `GET /conversations/{contactId}/messages`                 |
| Receive updates                         | Webhook subscriptions: `ContactUpdate`, `OutboundMessage`, `WorkflowComplete` |

Auth: GHL **Private Integration** token (Location-level), stored in Supabase Vault, rotated via the dashboard's Settings page.

Rate limits: cap dashboard → GHL writes at **8 req/sec** (well under 10/sec limit) using a Postgres-backed queue (`pg_boss` or Supabase Edge cron).

---

## Scheduler (for auto-reminders)

- Single Supabase **scheduled Edge Function** runs at **09:00 IST daily**.
- Query: `select * from emi_schedule where reminder_date <= today and status in ('upcoming','due_soon') and not exists (select 1 from reminders where emi_id = emi_schedule.id and status in ('queued','sent','delivered'))`
- For each row, insert a `reminders` row + call GHL workflow trigger.
- A second function runs hourly to flip `due_soon` ↔ `overdue` based on `due_date`.

---

## Initial import & ongoing data entry

DVA's seed data lives in **GHL (999 active students, tagged)**. The dashboard pulls students from GHL **by tag**, then augments them with the data GHL doesn't hold (EMI schedule, monthly progress, call notes, background) via CSV upload or manual entry.

### Three data-entry paths

```
┌──────────────────────┐
│ 1. GHL → app import  │  Settings → "Import students" → choose tag(s)
│    (by tag)          │    → app calls GET /contacts?tag=Diamond&limit=100
│                      │      paginates through all matches
│                      │      upserts into `students` (matched by email)
└──────────────────────┘

┌──────────────────────┐
│ 2. CSV bulk upload   │  Students page → "Import CSV"
│    (for EMI/progress │    → maps columns → preview diff → confirm
│     supplement data) │    → creates/updates rows, also pushes to GHL
└──────────────────────┘

┌──────────────────────┐
│ 3. Manual entry      │  Students page → "+ Add student" or row edit
│                      │    → autosave → mirrors to GHL Contact
└──────────────────────┘
```

**Re-running the GHL import** is safe — it's idempotent (upsert by email). DVA can re-import after adding new students to GHL and the dashboard absorbs only the deltas.

The two Excel files are imported **once** as historical seed for EMI history / monthly progress that GHL never had. After that, Excel goes to archive.

---

## Reminder system (multi-recipient, event-driven)

DVA wants reminders routed through GHL to **three recipient types**:

| Recipient | Reminder examples                                       | Channel via GHL          |
|-----------|---------------------------------------------------------|--------------------------|
| Student   | EMI due, EMI overdue, course expiring, monthly tasks   | WhatsApp / SMS / Email   |
| Coach     | Follow-up with student X, no calls logged in 30 days   | WhatsApp / SMS / Email   |
| Admin     | Daily overdue digest, weekly expiry digest, sync errors | Email / WhatsApp         |

Coaches and admins are themselves GHL Contacts (separate `internal_team` tag) so a single GHL workflow engine handles everyone. In-app notifications complement (free, instant) GHL messages (paid, off-platform).

### Event catalog (v1)

```sql
create table reminder_events (
  id text primary key,                  -- e.g. 'emi.reminder_due'
  recipient_type text check (recipient_type in ('student','coach','admin')),
  default_workflow_id text,             -- GHL workflow id, configurable in Settings
  schedule text not null,               -- cron expression OR 'on_event'
  enabled boolean default true
);
```

| Event ID                  | Trigger                                                | Recipient | Default schedule    |
|---------------------------|--------------------------------------------------------|-----------|---------------------|
| `emi.reminder_due`        | EMI `reminder_date` is today AND status = upcoming    | Student   | Daily 09:00 IST     |
| `emi.overdue`             | EMI `due_date` < today AND status ≠ paid              | Student   | Daily 10:00 IST     |
| `emi.batch_overdue`       | Any EMI overdue today                                  | Admin     | Daily 09:30 IST (digest) |
| `course.month_pending`    | Month N checkbox unchecked at end of month N          | Student   | Last day of month   |
| `course.expiring_soon`    | `end_date` within 14 days                              | Student   | Daily 09:00 IST     |
| `course.expiry_digest`    | Any student expiring this week                         | Admin     | Weekly Mon 09:00    |
| `student.no_call_30d`     | No call_log entry in 30 days                          | Coach     | Daily 09:00 IST     |
| `call.followup_due`       | `call_logs.next_action_due` is today                  | Coach     | Daily 09:00 IST     |
| `student.assigned`        | Admin assigns student to coach                         | Coach     | on_event            |
| `reminder.failed`         | GHL workflow trigger returned error                    | Admin     | on_event            |

Each event has: a **GHL workflow ID** (configurable in Settings), an **enable toggle**, and **template variables** (student name, amount, due date, payment link, coach name) substituted by GHL's own template engine — we just pass a payload.

### Manual reminders coexist

Every event also has a **manual trigger button** in the UI ("Send reminder now") that fires the same GHL workflow with the same payload — coaches don't need to wait for the cron.

### How a reminder actually executes

```
Scheduler (Vercel Cron @ 09:00 IST)
    │
    ▼
SELECT due reminders from `reminders` table
    │
    ▼
For each: insert audit row → POST /contacts/{id}/workflow/{wf_id}
    │                          (rate-limited 8 req/sec)
    ▼
GHL → sends WhatsApp/SMS/Email via DVA's configured templates
    │
    ▼
GHL webhook → our /api/ghl/webhook → updates reminders.status
    │
    ▼
Dashboard shows ✓ delivered / ✗ failed inline on the row
```

### Settings page (admin-only)

A `/settings/reminders` page where admin can:
- Toggle each event on/off
- Map each event to a specific GHL workflow ID (so DVA controls the message templates)
- Override default schedule per event
- Test-fire any event against a sample student

---

## AI features — voice notes & call briefings

Two features that turn the dashboard from a tracker into a coaching assistant.

### 1. Voice-to-text for any comment field

**Why:** post-call fatigue + multi-language fluency. Coaches mix Hindi/English/Marathi. Native Web Speech API butchers Indian accents; Whisper handles them well.

**Stack:** OpenAI Whisper API (`whisper-1`) at $0.006/min. Indian-language and code-switching support is excellent.

**Flow:**
```
Coach taps 🎙 → mediaRecorder captures up to 90s → blob
       ↓
POST /api/voice/transcribe (multipart) → Whisper API
       ↓
returns text → injected into textarea (editable before save)
       ↓
optional: original audio archived to Supabase Storage
         (off by default; admin toggle in Settings)
```

**Where it appears:** every comment field in the app — call notes, student background, admin notes, even reminder custom messages.

**Cost at scale:** 999 students × 12 calls/yr × 30 sec avg ≈ 100 hours/yr ≈ **$36/year**. Negligible.

**Schema addition:**
```sql
alter table call_logs add column voice_transcript boolean default false;
alter table call_logs add column voice_audio_path text;  -- supabase storage
```

### 2. AI Briefing — pre-call summary across all prior calls

**Why:** chronological timeline is good for audit, bad for "I'm about to call this student in 30 seconds, what do I need to know?" Coaches need a *briefing*, not a *log*.

**What it shows:**
- **Story** — the student's situation in 2–3 sentences
- **Ongoing threads** — what each coach (DV / AK / FM) has been working on with this student (your specific ask: per-coach attribution so User4 doesn't repeat User1's pitch)
- **Open actions** — promised follow-ups, due dates
- **Flags** — payment issues, missed checkpoints, unusual patterns

**Stack:** Claude Haiku via Anthropic API. ~2K input tokens + ~200 output tokens per summary ≈ ₹0.07/regen.

**Schema:**
```sql
create table student_briefings (
  student_id uuid primary key references students(id) on delete cascade,
  summary_md text not null,            -- markdown, rendered in UI
  generated_at timestamptz not null default now(),
  source_calls_count int not null,     -- how many calls fed the summary
  source_max_call_at timestamptz,      -- timestamp of newest call summarized
  is_stale boolean default false,      -- flipped true when new call added
  model text default 'claude-haiku',
  tokens_in int,
  tokens_out int
);
```

**Generation lifecycle:**
1. Trigger to mark stale: `after insert on call_logs do update student_briefings set is_stale = true`.
2. On first view of Calls tab: if briefing missing OR `is_stale = true`, call `/api/briefing/generate?student_id=…`.
3. Backend pulls: student profile + all `call_logs` (last 50, oldest+newest matter most) + EMI snapshot + monthly progress.
4. Sends to Claude Haiku with structured prompt (below). Saves result + flips `is_stale = false`.
5. Lazy regen — never auto-runs on every save (saves cost, avoids flicker).
6. Manual ⟳ button on the card forces fresh regen.

**Prompt skeleton:**
```
You are a coaching ops assistant. Summarize this student for the next coach
who is about to call. Be concrete, cite call dates, and attribute themes to
the coach who introduced them. Do NOT invent facts. If something is unclear,
say so explicitly.

OUTPUT MARKDOWN with these sections only:
## Story (2–3 sentences)
## Ongoing threads (per coach, with date ranges)
## Open actions (with due dates)
## Flags (only if real concerns exist)

INPUT:
- Student profile: {name, membership, tags, start, end, background, progress[]}
- EMI status: {next_due, installment, amount, history[]}
- Calls (chronological): {date, coach_initials, outcome, comment}
```

**Hallucination guardrails:**
- Prompt forbids invention; requires date citations.
- UI labels card: *"AI-generated — verify before quoting to a student"*
- Per-coach attribution forces grounding (named DV / AK / FM, not generic claims).
- Source-call count visible in card footer (`Based on 12 calls`) so coach knows it's complete.

**Privacy:**
- Anthropic API: zero-retention by default for API customers.
- Voice audio + briefings stored only in DVA's Supabase project — never shared.
- Document this in the privacy notice DVA shows their team.

**Cost at scale:** 999 students × 10 regens/yr ≈ 10,000 calls × ₹0.07 = **~₹700/year**.

### Where the briefing appears in UI

```
Student detail → Calls tab
┌───────────────────────────────────────────────────┐
│  📋 Briefing            Based on 12 calls    ⟳   │   ← AI card (collapsible)
│  ▼ expanded by default                            │
│  [...story / threads / actions / flags...]        │
│  AI-generated — verify before quoting             │
└───────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────┐
│  + Log a new call    🎙                            │   ← composer w/ voice button
└───────────────────────────────────────────────────┘

● Today · 10:42 · AK · …
● 27 Nov · 16:10 · DV · …
● 12 Nov · 11:30 · FM · …
   (chronological raw timeline below the briefing)
```

The **briefing is what coaches actually use day-to-day**; the timeline is the audit/proof layer underneath.

---

## Open architectural questions before we cut code

1. **GHL plan tier** — Custom Objects + Private Integrations require GHL Agency Pro / SaaS. Confirm DVA has it, or we use Custom Fields (works fine for this scope).
2. **Hosting** — Vercel (Next.js) + Supabase Cloud is the cheapest happy path (~$25/mo combined for this scale). Alternative: self-host on a single VPS (~₹1,000/mo) — more work, harder realtime.
3. **Where do payment links come from** today? Are they generated per installment by DVA, or via a payment gateway? This affects whether we just store the link or generate it.

---

## History & long-term storage

DVA never deletes — every call note, every EMI, every edit must be retrievable years later. The recommended stack handles this cheaply.

### Growth projection (realistic)

| Year | Active students | Total rows ever     | DB size  | Cost    |
|------|----------------:|--------------------:|---------:|--------:|
| 1    | 1,000           | ~250 K              | ~120 MB  | $0      |
| 3    | 5,000           | ~3 M                | ~1.5 GB  | $25/mo  |
| 5    | 10,000          | ~10 M               | ~5 GB    | $25/mo  |
| 10   | 10,000 + 80K alumni | ~30 M           | ~15 GB   | ~$30/mo |
| 15   | steady          | ~50 M               | ~25 GB   | ~$35/mo |

Supabase Pro = 8 GB included; extra at $0.125/GB/mo. Storing the *same* alumni history in GHL would cost hundreds per month — this is a key cost-of-ownership argument for our own DB.

### Make hot queries stay fast forever

1. **Indexes** on `call_logs(student_id, created_at desc)` and `emi_schedule(due_date, status)` already in schema.
2. **Range partitioning** on high-volume tables, by year:
   ```sql
   create table call_logs (...) partition by range (created_at);
   create table call_logs_2026 partition of call_logs
     for values from ('2026-01-01') to ('2027-01-01');
   ```
   A scheduled function creates next year's partition each December.
3. **Cold archive** (only after year ~5 if DB grows unexpectedly): nightly job dumps records older than N years to Supabase Storage as JSON, then `delete from audit_log_2022`. Storage at $0.021/GB/mo is ~6× cheaper than DB storage. Archived data still readable through a `/admin/archive` viewer.

### Retention policy (coded in, configurable)

| Entity            | Retention                | Rationale                                |
|-------------------|--------------------------|------------------------------------------|
| students          | forever                  | tiny; alumni context valuable            |
| call_logs         | forever                  | the conversation audit trail IS the product |
| emi_schedule      | forever                  | financial — regulatory + dispute defence |
| audit_log         | 3 years hot, then cold archive | high volume, low long-term query rate |
| reminders         | 1 year hot, then cold archive | delivery receipts, low long-term value |

Soft-delete (`deleted_at` column) used wherever the UI exposes a "delete" — actual rows never removed without an admin restore window.
