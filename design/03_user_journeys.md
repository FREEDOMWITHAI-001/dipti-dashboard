# Daily routines — what life looks like with the dashboard

Three roles, three timelines, plus what runs in the background while no one is watching.

---

## ☀️ Coach AK's day (Wednesday)

| Time      | What AK does / sees                                                                                                |
|-----------|--------------------------------------------------------------------------------------------------------------------|
| **09:00** | Opens dashboard. **Home screen = AK's personal queue today:** 3 follow-up calls (from `call.followup_due`), 1 student silent 30+ days (`student.no_call_30d`), 2 newly assigned students. EMI reminders to students fired automatically at 09:00 — AK doesn't even think about them. |
| **09:15** | Calls Priya. Opens her slide-over while talking. Types notes live. Saves with `Outcome: connected · Next action: send Module 3 link · Due tomorrow`. That auto-creates tomorrow's follow-up. |
| **10:30** | Calls Rohan, no answer. Clicks **Send reminder now** → WhatsApp template "Tried calling, when can we talk?" → fires via GHL in 2 seconds. AK moves on. |
| **11:00** | Sees DV is online (presence dot on Priya's row). DV ticks M3 checkbox for Priya — AK sees it flip green in real-time. Zero coordination needed. |
| **13:00** | Admin assigns 3 new students. In-app toast + WhatsApp via GHL. They appear in AK's queue. |
| **14:00** | EMI tab → filter "Due this week" → notices Meera prefers personal touch. Clicks **Send reminder now** with custom note. Tomorrow's auto-scheduler will skip Meera since reminder already sent. |
| **17:30** | End of day. Reviews Anjali Roy's Calls timeline — sees DV's call from yesterday + own from today. Hands off cleanly to whoever picks her up tomorrow. Closes laptop. |

**Time spent in spreadsheets: 0 minutes.** Time spent on actual coaching conversations: maximised.

---

## 👩‍💼 Admin Dipti's day

| Time      | What Dipti does / sees                                                                                              |
|-----------|---------------------------------------------------------------------------------------------------------------------|
| **08:55** | Wakes up. WhatsApp from GHL — daily digest: *"5 EMIs overdue (₹86,200) · 3 students expiring this week · 0 sync errors · ₹14.7 L collected MTD."* |
| **09:15** | Opens Dashboard → Reports. Sees collection vs target, calls-per-student, top 5 students at risk. |
| **09:30** | 3 new students arrived in GHL overnight (tag `Diamond-2026`). She runs **Import from GHL** in Settings → 3 rows added → assigns each to a coach (coaches get notified instantly). |
| **11:00** | A student calls Dipti directly. Mid-call she opens the student's profile — sees last 8 calls, EMI 5/9 paid, M3 incomplete. Answers specifically, no fumbling. |
| **15:00** | Festival week coming. Goes to `/settings/reminders` → pauses `emi.reminder_due` for 3 days → notes will auto-resume. |
| **17:00** | Reviews Audit Log → confirms FM's edits to a sensitive record were correct. |
| **18:00** | Closes laptop. The system runs without her.                                                                          |

**Excel work eliminated. Decisions data-backed.**

---

## 👨‍🎓 Student Priya's experience (she never logs in)

| Time      | What Priya sees                                                                                                    |
|-----------|--------------------------------------------------------------------------------------------------------------------|
| **09:00** | WhatsApp: *"Hi Priya, your EMI of ₹26,173 (5/9) is due on 13 May. Pay here: [link]. — Team DVA"* — fired by the dashboard's scheduler through GHL. |
| **12:00** | Pays. Payment webhook flips `emi_schedule.status = paid` in Supabase → no more reminders fire. |
| **15:30** | Coach AK calls. Conversation feels personal — AK references her last call from 2 weeks ago because the timeline was right there. |
| **End of month** | Hasn't ticked M3 yet → automatic gentle nudge: *"Hi Priya, your Month 3 tasks are still pending — reply if you need help."* |

Priya never installed an app. Never logged in. Just got the right message at the right time.

---

## 🤖 Background automation (no human clicks)

These run on Vercel Cron, no UI:

| Time      | Job                              | What fires                                                                       |
|-----------|----------------------------------|----------------------------------------------------------------------------------|
| **09:00** | `emi.reminder_due` sweep         | Students with reminder_date = today AND status = upcoming → GHL workflow          |
| **09:00** | `course.expiring_soon` sweep     | Students with end_date within 14 days → GHL workflow                              |
| **09:00** | `student.no_call_30d` sweep      | Coaches notified about silent students                                            |
| **09:00** | `call.followup_due` sweep        | Coaches reminded of today's follow-ups                                            |
| **09:30** | `emi.batch_overdue` digest       | Admin gets aggregated overdue list                                                |
| **10:00** | `emi.overdue` sweep              | Students past due date → GHL escalation workflow                                  |
| **23:55** | Last day of month: `course.month_pending` | Students with current month checkbox unchecked → GHL nudge                |
| **Mon 09:00** | `course.expiry_digest`       | Admin gets weekly expiry digest                                                   |
| **Continuous** | GHL webhook receiver        | Updates `reminders.status` (queued → sent → delivered) so UI stays in sync       |

**Total human interaction needed for these: zero.** The system just runs.

---

## Side-by-side: before vs after

| Activity                                  | Excel today                                  | Dashboard tomorrow                          |
|-------------------------------------------|----------------------------------------------|---------------------------------------------|
| "Who do I call today?"                    | Open file → eyeball 39 cols × 999 rows       | Home queue — 4 items waiting                |
| Log a call                                | Find row, scroll right, hope no one else has the file open | Type in slide-over, autosaved, attribution recorded |
| See last call notes                       | Pray the previous coach didn't overwrite     | Calls timeline, oldest to newest, who+when  |
| Send EMI reminder                         | Copy-paste WhatsApp message manually         | Auto-fires at 09:00 OR 1-click button       |
| Assign student to a coach                 | DM the coach on WhatsApp                     | Click → coach gets notified instantly       |
| Know what's overdue                       | Sort EMI sheet, do mental math               | KPI card on top of EMI page                 |
| "What did we talk about with Anjali?"     | Search Excel ctrl+F, hope                    | Anjali → Calls tab → entire history         |
| Audit who changed what                    | Impossible                                    | Audit log filtered by student/user/date     |
| Onboard new coach                         | "Don't break the file"                       | Email invite → role applied → done          |

The dashboard isn't *one* improvement. Every action is faster, every question is answerable, and the team stops working *around* the tool.
