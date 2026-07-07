# K-MILE AIR — Aircraft Maintenance Experience Logbook (Web)

Web application for K-Mile certifying staff to record and track maintenance
experience toward the 6-month / 24-month requirement, with compliance
monitoring for administrators.

## Run it

```bash
npm install
npm run dev        # development — http://localhost:5173
npm run build      # production bundle in dist/
npm run preview    # serve the production bundle
```

Requires Node.js 18+ (installed on this machine: Node 24, `C:\Program Files\nodejs`).

## First sign-in

Accounts can only be registered by an administrator — there is no self
sign-up. On the very first launch the app creates a bootstrap admin:

| Email | Password |
|---|---|
| `admin@kmileair.com` | `Admin@1234` |

You are forced to set a new password at first sign-in. Then use
**User management** to register the real users.

## Features

- **Email + password login** — passwords stored as salted SHA-256 hashes.
  Inactive/archived accounts cannot sign in.
- **Admin-only registration** (role: *Compliance Monitoring Personnel*) with
  account statuses **Active / Inactive / Archived** (archived users are kept
  for audit), password resets and role management.
- **Monitoring dashboard** (admin) — per-user readiness: task/day progress,
  experience spread, nature-of-experience coverage, training expiry alerts
  (expired / expiring ≤ 60 days), overall eligibility, and read-only access to
  any logbook. CSV export of all records.
- **Nature of experience** — **all 7 task types are required** (FOT, SGH, R/I,
  T/S, OPC, REP, INSP); the criterion is not satisfied until every type has at
  least one record.
- **Training record PDF import** — reads the K-Mile *PERSONAL TRAINING
  RECORDS* PDF (From / To / Description / Reference / Expiry date columns),
  auto-detects course category and aircraft type, tracks expiry.
- **Logbook import** — Excel (standard K-Mile template) **and PDF** (the
  K-Mile logbook layout, e.g. a PDF exported from this app, √ marks included).
- **Logbook PDF export** with signature, and the readiness dashboard from the
  original prototype (180 tasks / 100 days, spread, 20% alternative cap,
  30% similar-aircraft rule).

## Data

All data is stored in the browser's localStorage of this machine (key prefix
`kmile:v3:`). Clearing site data removes it — export PDF/CSV for backup.
For multi-device use a real backend would be the next step.

## Structure

```
src/
  App.jsx                 shell, auth/session, routing, CSV export
  components/             Login, Dashboard, LogbookRecord, TrainingRecord,
                          Admin (monitoring + user management), modals, guide
  lib/
    constants.js          ratings, task types, thresholds, statuses
    assess.js             6/24-month assessment engine + training expiry
    storage.js            localStorage store, password hashing, admin seed
    excelImport.js        .xlsx logbook template import
    pdfParse.js           pure PDF table parsers (unit-testable in Node)
    pdfImport.js          pdf.js text extraction wrapper
    pdfExport.js          official-layout logbook PDF export
```
