# DVA Student Ops Dashboard — Screen Mockups v1

Design tokens (lock these first, every screen obeys them):

```
Font          Inter / Roboto, 14px base, 13px secondary, 12px meta
Grid          8px spacing scale — 8 / 16 / 24 / 32 / 48
Radius        8px cards, 6px inputs, 999px pills
Color         Surface #FFFFFF · Canvas #F7F8FA · Border #E6E8EC
              Text #111827 · Muted #6B7280
              Accent #4F46E5 (indigo) · used sparingly, primary CTAs only
Status pills  Active #DCFCE7/#166534 · Due-soon #FEF3C7/#92400E
              Overdue #FEE2E2/#991B1B · Paid #E0E7FF/#3730A3 · Inactive #F3F4F6/#6B7280
Density       List rows 56px tall · 24px horizontal padding · zebra OFF
Motion        150ms ease-out for hover, 200ms for panel slide-in
```

> Rule of thumb: any screen that needs >7 columns visible at once is wrong — push detail into the slide-over.

---

## SCREEN 1 — Students List (the home screen)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ▌DVA           Search students, email, mobile…              🔔 3   AK  ▾       │
├──────────┬──────────────────────────────────────────────────────────────────────┤
│          │                                                                      │
│ ◉ Students│  Students                                          + Add student    │
│ ○ EMI    │  ─────────────────────────────────────────────────────────────────  │
│ ○ Calls  │                                                                      │
│ ○ Reminders│ Membership ▾   Tag ▾   Status ▾   End-date ▾        947 students  │
│ ○ Reports │                                                                      │
│          │  ┌───────────────────────────────────────────────────────────────┐  │
│ ──────── │  │ Name              Membership   Tags     End date    Last call │  │
│ ⚙ Settings│ ├───────────────────────────────────────────────────────────────┤  │
│          │  │ ●  Priya Sharma   Diamond      SH       31 Jul 26  2 d ago • DV│  │
│          │  │ ●  Rohan Iyer     Diamond      BBR2     14 Jun 26  Today • AK  │  │
│          │  │ ●  Meera Kapoor   Ex-Diamond   SBF      30 Apr 26  5 d ago • FM│  │
│          │  │ ◐  Anjali Roy     Diamond      —        02 Sep 26  Never       │  │
│          │  │ ●  Kiran Reddy    Diamond      bfs      11 Mar 27  1 d ago • DV│  │
│          │  └───────────────────────────────────────────────────────────────┘  │
│          │                                            ‹ 1  2  3  …  20 ›       │
└──────────┴──────────────────────────────────────────────────────────────────────┘

• Click any row → slide-over (Screen 2) opens from right, list stays visible behind.
• Status dot: green = active, amber = expiring <30d, gray = expired.
• "Last call" shows relative time + initials of last coach who logged it.
• Only 5 visible columns. Everything else lives in the detail panel.
```

---

## SCREEN 2 — Student Detail (slide-over, 720px wide)

```
                          ┌─────────────────────────────────────────────────┐
                          │  ←   Priya Sharma                    ⋯    ✕     │
                          │      priya@example.com · +91 90032 12289        │
                          │      [Diamond]  [SH]  [Active until 31 Jul 26]  │
                          ├─────────────────────────────────────────────────┤
                          │  Profile · Progress · Calls (12) · Payments(5/9)│
                          │  ─────────                                      │
                          ├─────────────────────────────────────────────────┤
                          │                                                 │
                          │  Profile                                        │
                          │                                                 │
                          │  First name      Priya                          │
                          │  Last name       Sharma                         │
                          │  Membership      Diamond            ▾           │
                          │  Tags            SH ✕   + add                   │
                          │  Start / End     31 Jul 25  →  31 Jul 26        │
                          │  Background      Small town, decorated cake…   │
                          │                                                 │
                          │  Assignments     ☑ M1  ☑ M2  ☐ M3  ☐ M4  ☐ M5  │
                          │                                                 │
                          │           Saved 2s ago by AK · audit log →     │
                          │                                                 │
                          ├─────────────────────────────────────────────────┤
                          │  💬  Log a call    📨  Send reminder    Sync↻  │
                          └─────────────────────────────────────────────────┘

• Tabs swap content; header + footer action bar persist.
• Inline edit, autosave, with attribution line so coaches never wonder "who changed this?"
• Footer is the action bar — the two things coaches do most are 1 click away.
```

---

## SCREEN 3 — Calls Timeline (inside Student Detail, "Calls" tab)

```
                          ┌─────────────────────────────────────────────────┐
                          │  Priya Sharma  ›  Calls                         │
                          ├─────────────────────────────────────────────────┤
                          │                                                 │
                          │  ┌─ Log a new call ──────────────────────────┐  │
                          │  │ How did the call go?                       │ │
                          │  │ Next action ▾   Outcome ▾    Save  ⏎      │ │
                          │  └────────────────────────────────────────────┘ │
                          │                                                 │
                          │  ● Today · 10:42                                │
                          │    AK  Anjali (you)                             │
                          │    She is not taking many orders. Asked her    │
                          │    to push WhatsApp marketing.                 │
                          │    [Follow-up in 7d]   [Outcome: connected]    │
                          │                                                 │
                          │  ● 27 Nov 25 · 16:10                            │
                          │    DV  Dipti                                    │
                          │    Called twice, msg sent. No reply.            │
                          │    [Outcome: no answer]                        │
                          │                                                 │
                          │  ● 12 Nov 25 · 11:30                            │
                          │    FM  Fatima                                   │
                          │    Background alignment done.  6m extension.   │
                          │    [Outcome: connected]                        │
                          │                                                 │
                          │  · · ·                                          │
                          └─────────────────────────────────────────────────┘

• Realtime: a green dot pulses on row when another coach is typing.
• Each call is immutable; edits create a new entry — that's the audit trail.
• "Next action" feeds the Reminders queue automatically.
```

---

## SCREEN 4 — EMI Tracker

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  EMI Tracker                                                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ Due this week│ │   Overdue    │ │ Collected MTD│ │  Active EMIs │           │
│  │              │ │              │ │              │ │              │           │
│  │   ₹2.4 L     │ │   ₹86,200    │ │   ₹14.7 L    │ │     86       │           │
│  │   12 students│ │   5 students │ │              │ │              │           │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘           │
│                                                                                 │
│  [ Due this week ]  Overdue    Upcoming    Paid          Search…       Export  │
│  ──────────────                                                                 │
│                                                                                 │
│  Student            Installment  Amount    Due date     Status       Action    │
│  ───────────────────────────────────────────────────────────────────────────── │
│  Priya Sharma         5 / 9      ₹26,173   13 May 26   ● Due 4d    Send  ▾    │
│  Rohan Iyer           6 / 9      ₹23,333   14 May 26   ● Due 5d    Send  ▾    │
│  Meera Kapoor         3 / 9      ₹22,777   10 May 26   ⬤ Due 1d    Send  ▾    │
│  Anjali Roy           7 / 9      ₹26,173   08 May 26   ⬤ Overdue   Send  ▾    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

• KPI strip up top so the team's daily question ("what needs collecting today?")
  is answered before they even look at the table.
• "Send ▾" is a split button: click = send now via GHL; ▾ = schedule / preview.
• Auto-scheduler runs at 9:00 IST every morning; rows show "Auto-scheduled · 8:00 AM"
  as a subtle gray label when a reminder is queued.
```

---

## SCREEN 5 — Reminder Modal (triggered from "Send" on EMI row)

```
                  ┌──────────────────────────────────────────────────┐
                  │  Send reminder                              ✕    │
                  ├──────────────────────────────────────────────────┤
                  │                                                  │
                  │  To       Priya Sharma · +91 90032 12289         │
                  │  Channel  ◉ WhatsApp   ○ SMS   ○ Email           │
                  │  Workflow GHL · "EMI Reminder – Diamond"   ▾     │
                  │                                                  │
                  │  Preview                                         │
                  │  ┌────────────────────────────────────────────┐ │
                  │  │ Hi Priya, your EMI of ₹26,173 (5/9) is     │ │
                  │  │ due on 13 May. Pay here:                    │ │
                  │  │ baking.diptivartakacademy.com/pay/abc123   │ │
                  │  │ — Team DVA                                  │ │
                  │  └────────────────────────────────────────────┘ │
                  │                                                  │
                  │  When     ◉ Send now                             │
                  │           ○ On reminder date (11 May, 9:00 AM)   │
                  │           ○ Custom…                              │
                  │                                                  │
                  │                              Cancel    Send →    │
                  └──────────────────────────────────────────────────┘

• One modal handles both manual & scheduled — no separate "automation" screen
  for v1. The scheduler simply re-uses this same payload format under the hood.
• Channel options come from GHL workflows the team has configured;
  we don't hardcode templates.
```

---

## What this design buys DVA

| Excel pain                                | New design fixes it via                                    |
|-------------------------------------------|------------------------------------------------------------|
| 39-col row, scroll-to-find-anything       | 5-col list + slide-over detail with tabs                   |
| DV/AK/FM overwriting each other's notes   | Append-only Calls timeline with attribution + realtime     |
| No reminders                              | Manual "Send" button + auto-scheduler, both via GHL        |
| No audit trail                            | Every edit shows "edited by AK · 2m ago" + immutable calls |
| 999 rows = file unusable                  | Server-side pagination, search, filters                    |
| EMI tracking in a separate file           | Surfaced on Student detail · KPIs on EMI page              |

## Open questions for v1.1 (not blocking)

1. Reports/exports — what do you actually report to leadership? (list of metrics needed)
2. Bulk actions — import CSV, bulk reminder send, bulk tag — needed in v1 or v1.1?
3. Mobile — coaches on phones during calls? Responsive vs. dedicated mobile view?
