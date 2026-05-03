# Automated Student Submission Monitor

> Google Apps Script automation that detects empty assignment submissions across 7 Google Classroom courses and notifies students and parents the same day — no manual intervention required.

![Status](https://img.shields.io/badge/status-deployed-brightgreen)
![Platform](https://img.shields.io/badge/platform-Google%20Apps%20Script-blue)
![API](https://img.shields.io/badge/API-Google%20Classroom%20%7C%20Gmail-yellow)
![Auth](https://img.shields.io/badge/auth-OAuth%202.0-orange)

---

## The Problem

As a teacher managing 7 active Google Classroom courses across Music and Spanish, tracking students who submit assignments without attaching their work was a recurring administrative burden. The manual process required:

1. Reviewing each course individually to identify empty submissions
2. Contacting the student to request a correction
3. Separately notifying the parent or guardian — a step that was easy to skip under a busy schedule

A student who submitted incorrectly on a Monday might not receive feedback until Wednesday. Parents were often never notified at all.

---

## The Solution

A daily automation built with **Google Apps Script** and the **Google Classroom REST API** that:

- Runs every day at **4:00 PM** via a time-based trigger
- Scans all published assignments across all 7 target courses
- Identifies submissions turned in **without file attachments**
- Automatically emails the student and **CC's their parent/guardian**
- Logs each notification to prevent repeat emails on subsequent days

A student who submits incorrectly now receives a notification the same afternoon. Their parent is informed simultaneously — something that previously required two separate manual actions from the teacher.

---

## Technical Architecture

### Workflow

```
Authenticate (OAuth 2.0)
    ↓
Retrieve active courses → Filter to 7 target courses
    ↓
For each course: retrieve published assignments → Filter for [UPLOAD] tag
    ↓
For each tagged assignment: retrieve TURNED_IN submissions
    ↓
Inspect attachments array → Flag empty submissions
    ↓
Lookup student profile + guardian emails
    ↓
Check deduplication store (PropertiesService)
    ↓
Send Gmail notification → Log submission ID
```

### Key Technical Decisions

#### Assignment Tagging System
Not all assignments require digital uploads — many are completed on paper. Rather than flagging every empty submission, assignments requiring a file attachment are prefixed with `[UPLOAD]` in the title. The script filters on this tag before checking attachments, ensuring paper-based assignments are never incorrectly flagged.

#### API Limitation Discovery and Pivot
My initial approach was to post a private comment directly on the student's submission via the Classroom API — the most native solution. After reviewing the full API reference, I identified that the **Classroom REST API does not expose a write endpoint for private submission comments**. Rather than abandoning the project, I pivoted to a Gmail-based notification using `GmailApp` — which is arguably a better solution, as email is harder for students to overlook than a Classroom comment.

#### Deduplication via PropertiesService
Because the script runs daily, a naive implementation would email the same student repeatedly until they corrected the submission. A deduplication layer using Apps Script's `PropertiesService` persists a JSON array of already-notified submission IDs across executions. Each student receives exactly one notification per empty submission.

#### Graceful Error Handling
Guardian access via the Classroom API depends on domain-level settings controlled by the school's Google Workspace administrator. The guardian lookup is wrapped in a nested `try/catch` block independent of the outer email logic. If guardian access is unavailable, the script logs the reason and sends the email to the student alone — the core workflow never fails due to an optional feature being unavailable.

---

## Tools & Technologies

| Tool | Purpose |
|---|---|
| Google Apps Script | Scripting environment and execution host |
| Google Classroom REST API | Course, assignment, submission, and user data retrieval |
| Gmail API (`GmailApp`) | Student and guardian email notifications |
| OAuth 2.0 | Authentication and scope management across Google services |
| PropertiesService | Lightweight persistent key-value store for deduplication |
| Time-based Triggers | Unattended daily execution at 4:00 PM |

---

## Impact

| Metric | Result |
|---|---|
| Courses monitored | 7 active courses (Music 5–8, Spanish 5–8) |
| Notification speed | Same-day (4 PM) vs. delayed manual follow-up |
| Parent notification | Automated — previously a separate manual action |
| Repeat notifications | Eliminated via deduplication logic |
| Manual follow-up required | None — fully unattended |

---

## Skills Demonstrated

- **REST API integration** — reading official documentation, identifying endpoints, and making authenticated API calls
- **OAuth 2.0** — configuring scopes and managing authentication across multiple Google services in a single workflow
- **Conditional workflow logic** — multi-layer filtering (course name, assignment tag, submission state, attachment presence) before triggering any action
- **API limitation diagnosis** — identifying an unsupported endpoint through documentation review and re-architecting around an alternative solution
- **Error handling** — nested `try/catch` architecture that isolates optional-step failures without breaking the core workflow
- **Data persistence** — using `PropertiesService` as a lightweight cross-execution key-value store
- **Real-world deployment** — script runs live in an active classroom environment against real student data

---

## Project Context

This project was built as part of a personal automation portfolio during a transition from classroom teaching into AI integration and process automation. It demonstrates the same core skills applied in enterprise automation contexts: API integration, workflow logic, error handling, and reliable unattended execution.

---

*Built by Jacob | [LinkedIn](#) | Part of an AI Automation Portfolio*
