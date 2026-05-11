# Plain-English primer: GHL and Supabase, and why we use both

If you only read one design doc, read this one. Everything else builds on it.

---

## The simple analogy

Think of DVA's operation as a **kitchen running a catering service**:

| Role           | Who plays it in our app | Real-world analogy                                    |
|----------------|-------------------------|-------------------------------------------------------|
| **Recipe book** | Supabase                | Permanent record of every student, every call, every EMI. Always available, always accurate, always queryable. |
| **Megaphone**   | GHL                     | The thing that *talks* to students — WhatsApp, SMS, Email. It doesn't store recipes; it just shouts orders. |
| **Kitchen counter** | The dashboard (Next.js on Vercel) | Where coaches actually work. Reads from the recipe book, points at the megaphone. |

You don't bake bread by talking into a megaphone. And you don't run a CRM by stuffing every fact into a messaging tool. **Each tool does what it's good at.**

---

## What is GHL (GoHighLevel)?

A Software-as-a-Service product DVA already pays for. It's a marketing CRM. Its job is engagement — *getting messages to people and tracking the response*.

### Core things in GHL (its building blocks)

| GHL primitive    | What it is                                              | What we use it for                                |
|------------------|---------------------------------------------------------|---------------------------------------------------|
| **Contact**      | One person. Has email, phone, name.                     | One Contact per student (and per coach/admin).    |
| **Custom Field** | An extra slot you define on a Contact (e.g. "Membership"). | We mirror student fields here so DVA's marketing automations can use them. |
| **Tag**          | A label on a Contact (e.g. "Diamond", "SH").            | The handle we use to *import* students from GHL into the dashboard. |
| **Workflow**     | An automation: "When X happens, send WhatsApp Y."       | The actual messaging engine. We trigger workflows; GHL sends. |
| **Conversation** | The thread of WhatsApp/SMS/Email exchanged with a Contact. | We embed it read-only in the student detail.    |
| **Opportunity**  | A sales-pipeline card.                                  | We don't use it (poor fit for EMI installments). |

### What GHL is great at

- Sending WhatsApp / SMS / Email at scale, with retries, opt-out handling, delivery receipts.
- Cron-style automations ("3 days after sign-up, send onboarding email").
- Marketing templates and message scheduling.
- Compliance: DND lists, unsubscribe links, regulatory.

### What GHL is bad at (the reason we don't use it as the database)

- **Slow when listing many records.** Loading 999 contacts requires 10 paginated API calls (~3–5 seconds). 200,000 contacts would take 16+ minutes.
- **Rate-limited.** ~100 requests per 10 seconds per location. A team of 5 coaches actively using a dashboard built on GHL alone would constantly hit this wall.
- **No real-time push.** No WebSockets — we'd have to poll, which makes "live comments" stutter and burns API quota.
- **Flat fields, no joins, no aggregations.** Custom Fields can hold strings, dates, dropdowns. They cannot sum amounts, group by status, or store a list of structured calls per student.
- **No SQL queries.** "Show me students whose end-date is within 14 days AND who haven't been called in 30 days" requires fetching everything and filtering client-side.
- **Vendor lock-in.** If GHL's pricing or API changes, the entire app is at risk.

**One-line summary:** GHL is a megaphone, not a recipe book.

---

## What is Supabase?

An open-source platform that gives you four things in one place:

```
┌──────────────────────────────────────────────────────┐
│                     SUPABASE                          │
│                                                       │
│   ┌──────────┐  ┌────────┐  ┌─────────┐  ┌────────┐  │
│   │ Postgres │  │  Auth  │  │Realtime │  │Storage │  │
│   │  (the    │  │ (email │  │(WebSock-│  │ (files,│  │
│   │ database)│  │/google)│  │  ets)   │  │  audio)│  │
│   └──────────┘  └────────┘  └─────────┘  └────────┘  │
│                                                       │
│              + Edge Functions (cron jobs)             │
└──────────────────────────────────────────────────────┘
```

You can sign up, click 3 buttons, and have a working backend. It's free up to a generous limit, and the entire thing is just **Postgres** under the hood — the most respected open-source database in the world. If we ever leave Supabase, all our data is portable to any other Postgres host.

### What we use from Supabase

| Feature           | What it does for our app                                              |
|-------------------|-----------------------------------------------------------------------|
| **Postgres DB**   | Stores `students`, `call_logs`, `emi_schedule`, `audit_log` etc.      |
| **Auth**          | Coach login (email/password), session management, password resets.   |
| **Realtime**      | When AK saves a call note, DV sees it on their screen in <1 second. No polling. |
| **Storage**       | Optional: voice-note audio files, profile photos, CSV import staging. |
| **Edge Functions**| Scheduled jobs at 09:00 IST that fire the daily reminder sweeps.     |
| **Row-Level Security (RLS)** | "Coaches can edit anything; students can read nothing." Enforced at the database, not the app. |

### The "Postgres" part — why it matters

Postgres is a relational database that:
- Handles **billions of rows** comfortably with proper indexes.
- Speaks **SQL** — so questions like "all students whose end_date is within 30 days AND whose last_call > 14 days ago" execute in 50ms.
- Supports **transactions** — when a coach saves a call AND updates "last_call_at" on the student, both either succeed or both fail. No half-saved state.
- Supports **joins and aggregations** — `SUM(amount) WHERE status='paid'` for KPI cards.
- **Partitioning** — split a million-row `call_logs` table into yearly chunks for fast queries even at scale.

GHL has none of these. That's the whole point.

---

## The division of labor in our app

```
                    ┌─────────────────────────────┐
                    │   Coach AK (browser)        │
                    │   dashboard.dva.com          │
                    └────────────┬─────────────────┘
                                 │
                                 │ HTTPS + WebSocket
                                 ▼
              ┌──────────────────────────────────────┐
              │         Vercel — Next.js app         │
              │  (the UI + API routes + scheduler)   │
              └──────┬─────────────────────────┬─────┘
                     │                         │
        SQL / Realtime                  HTTPS / Webhooks
                     │                         │
                     ▼                         ▼
            ┌────────────────┐        ┌─────────────────┐
            │   SUPABASE     │        │       GHL       │
            │                │        │                 │
            │ Postgres + Auth│        │ Contacts +      │
            │ + Realtime +   │        │ Workflows +     │
            │ Storage        │        │ Conversations   │
            │                │        │                 │
            │ ★ Source of    │        │ ★ System of     │
            │   truth        │        │   engagement    │
            └────────────────┘        └─────────────────┘
                                              │
                                              ▼
                              📱 Student's WhatsApp / SMS / Email
```

Plain English:

1. **Coach opens the dashboard** in a browser → goes to Vercel.
2. **Vercel reads/writes data** in Supabase (fast, real-time).
3. **Whenever a write happens** (new student, edited fields, EMI status change), Vercel also pushes a **mirror copy** of the relevant fields to GHL Contact via API.
4. **When a reminder needs to go out**, Vercel calls **GHL's "fire workflow" API** — GHL handles the actual WhatsApp/SMS/Email send.
5. **GHL fires webhooks back** to Vercel: "message delivered", "student replied", "opted out". Vercel updates Supabase.

So the flow is:

- **Reads & writes for the dashboard** → all Supabase. Fast, real-time, joins, aggregates.
- **Outbound messages** → all GHL. They're already great at that.
- **Inbound delivery status** → GHL → Vercel → Supabase. Single source of truth stays accurate.

---

## What lives where (the field map)

This is the most important table in this doc. **No field is duplicated** — each one has exactly one owner.

| Field                         | Owner          | In Supabase     | In GHL          | Sync direction         |
|-------------------------------|----------------|-----------------|-----------------|------------------------|
| Email, name, mobile           | Dashboard      | `students`      | Contact base    | Supabase → GHL         |
| Membership type               | Dashboard      | `students`      | Custom Field    | Supabase → GHL         |
| Tags (SH, BBR2, bfs…)         | Dashboard      | `students.tags` | Tags            | Supabase → GHL         |
| Start / End date              | Dashboard      | `students`      | Custom Field    | Supabase → GHL         |
| Monthly progress (M1–M6)      | Dashboard      | `students`      | (not synced)    | internal only          |
| Background notes              | Dashboard      | `students`      | (not synced)    | internal only          |
| Call logs (full timeline)     | Dashboard      | `call_logs`     | (not synced — privacy) | internal only |
| AI briefing                   | Dashboard      | `student_briefings` | (not synced) | internal only         |
| Voice audio files             | Dashboard      | Supabase Storage | (not synced)   | internal only          |
| EMI schedule (9 installments) | Dashboard      | `emi_schedule`  | last-due as CF  | Supabase → GHL (summary only) |
| Audit log                     | Dashboard      | `audit_log`     | (not synced)    | internal only          |
| **WhatsApp / SMS conversation** | **GHL**      | (read-only mirror) | Conversation thread | GHL → Supabase (read-only)|
| **Message delivery status**   | **GHL**        | `reminders.status` | Workflow run | GHL → Supabase (webhook)|
| **Opt-out / DND**             | **GHL**        | (read-only flag) | Contact field  | GHL → Supabase (webhook)|

---

## Why this split is safe

**If GHL goes down for an hour:** the dashboard still works. Coaches log calls, view history, update student data normally. Reminders queued during the outage simply fire when GHL recovers. No data lost.

**If Supabase goes down for an hour:** the dashboard is unavailable. GHL still sends scheduled reminders that were already queued in GHL's own system. When Supabase recovers, no data is lost (Vercel stores intent-to-write locally for the rare outage).

**If we ever leave GHL:** Supabase still has every student, call, EMI. We swap GHL for Twilio + SendGrid; messaging templates rewritten; data intact.

**If we ever leave Supabase:** the database is plain Postgres. We `pg_dump` and restore on AWS RDS, Neon, Vercel Postgres, self-hosted — anywhere.

That's the whole point: **two specialized tools, neither of which can hold us hostage.**
