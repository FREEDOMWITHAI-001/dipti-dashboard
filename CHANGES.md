# Changes applied to this folder

Two waves of updates layered on top of the original
`dva-student-audit-dashbaord-main`. Nothing in Supabase auth setup,
sidebar nav, or route paths was changed.

---

## Wave 2 (latest)

### 6. EMI setup at student creation time

The Add Student modal now has a collapsible **"Set up EMI plan now"**
section. Toggle it on and you get fields for total fee, down payment,
down payment date, number of installments, monthly amount (auto-computed
from total − down ÷ installments, but editable), first due date, and
reminder lead time. Submitting creates the student AND the EMI rows in
one go.

The same form is reused as a standalone modal on the Payments tab for
existing students who don't yet have an EMI plan.

| File | Status |
|---|---|
| `supabase/migrations/0006_downpayment_and_fee.sql` | **NEW** |
| `web/types/database.ts` | updated (3 new columns) |
| `web/components/students/emi-setup-modal.tsx` | **NEW** |
| `web/components/students/students-actions.tsx` | replaced |

### 7. Payments tab now shows down payment

A new 4-column KPI strip: Total fee · Down payment · Paid so far · Outstanding.
If a down payment exists, it's shown as a highlighted row at the top of the
schedule. If a student has neither a down payment nor an EMI plan, you see
a friendly empty state with a **"Set up EMI plan"** button.

| File | Status |
|---|---|
| `web/components/students/payments-tab.tsx` | replaced |

### 8. Monthly progress toggling now works correctly

The bug: clicking a month checkbox saved to DB but the UI didn't update
until the slide-over was closed and reopened. Fixed by:

- Progress tab now does optimistic UI updates and bubbles changes up to
  the slide-over via an `onChange` prop.
- Slide-over patches its own student state on each change, then keeps
  it in sync via a Supabase Realtime channel so changes made by another
  coach also reflect live.

| File | Status |
|---|---|
| `web/components/students/progress-tab.tsx` | replaced |
| `web/components/students/student-slideover.tsx` | replaced |

### 9. Notification bell now works

Clicking the bell opens a dropdown listing what needs attention right
now, queried live from Supabase:

- Overdue EMIs (count + total amount → links to /emi?tab=overdue)
- Follow-ups due today (count → /calls)
- Silent students (no call in 30 days → /calls)
- Courses expiring within 14 days (→ /students?filter=expiring)

Each card refreshes when the dropdown opens. A red badge with the
total count appears on the bell when anything's pending.

| File | Status |
|---|---|
| `web/components/shell/topbar.tsx` | replaced |

---

## Wave 1 (earlier)

### 1. Settings — input boxes for tokens / keys
Admin can paste GHL token + location ID + OpenAI key + Anthropic key
directly in the UI. Values land in `ghl_settings` (RLS-locked, admin
only) and are never returned to the browser in plaintext.

### 2. Pull from GHL / Import CSV actually work
No more "coming soon" toasts. Pull from GHL → calls the existing
import-by-tag route. Import CSV → parses in browser, upserts in chunks.

### 3. Dark mode hover / visibility fixes
Comprehensive dark-mode overrides in globals.css.

### 4. Students KPI cards become clickable filters
Click "Active" / "Expiring 30d" → filters the table. "EMI overdue"
jumps to /emi?tab=overdue.

### 5. EMI KPI cards drive the tab
Click any KPI → switches to that tab. URL `?tab=` is bookmarkable.

| Wave 1 files |
|---|
| `supabase/migrations/0005_settings_secrets.sql` (new) |
| `web/app/api/settings/save/route.ts` (new) |
| `web/components/settings/settings-form.tsx` (new) |
| `web/app/(app)/settings/page.tsx` (replaced) |
| `web/app/globals.css` (replaced) |
| `web/app/(app)/students/page.tsx` (replaced) |
| `web/components/students/students-table.tsx` (replaced) |
| `web/app/(app)/emi/page.tsx` (replaced) |
| `web/components/emi/emi-table.tsx` (replaced) |

---

## How to apply Wave 2 changes

If you already have the project running:

1. **Run the new migration** in Supabase SQL Editor:
   `supabase/migrations/0006_downpayment_and_fee.sql`
2. Copy/replace the files listed in the table above into your project.
3. Restart `npm run dev` (Tailwind and TypeScript will pick up the new types).

That's it — no env changes, no schema breakages, nothing destructive.
