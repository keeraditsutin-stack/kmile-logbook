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
- **Training compliance check** — drop a training-record PDF (or pick a
  registered staff member) and get an instant pass/compliant summary against
  the GMM §2.11.9–2.11.10 and TPM §2.7 requirement matrices, evaluated as of
  a chosen audit date (defaults to today, so retrospective audits work).
  Flags Compliant / Due soon / Expired / Missing per requirement, cross-links
  the same real-world requirement across GMM and TPM (earlier due date
  governs), flags expiry-date mismatches between the record and the computed
  due date, and exports a signed-off PDF compliance report or CSV. Personnel
  record course names are matched to requirements by **keyword overlap
  against the matrix's own wording** (not a hand-maintained alias list), so
  the real-world naming drift between what's printed on a training record
  and the official GMM/TPM course title — typos, renamed courses, acronym
  vs spelled-out, "SQMS" vs "SCMS" — is tolerated automatically; anything
  that still can't be matched confidently is listed, never silently dropped.
- **Requirement matrix administration** — the GMM/TPM matrix itself is
  versioned data, updatable by dropping a revised GMM or TPM section PDF (or
  the deterministic Excel round-trip: download the current matrix, edit it,
  drop it back). Every change goes through a diff/review screen — low-
  confidence cells from the PDF parser must be confirmed — before it can be
  applied, and every past version is kept with a one-click revert. Includes
  an editable Position → TPM/GMM role mapping table.
- **Logbook import** — Excel (standard K-Mile template) **and PDF** (the
  K-Mile logbook layout, e.g. a PDF exported from this app, √ marks included).
- **Logbook PDF export** with signature, and the readiness dashboard from the
  original prototype (180 tasks / 100 days, spread, 20% alternative cap,
  30% similar-aircraft rule).

## Data

All data is stored in the browser's localStorage of this machine (key prefix
`kmile:v3:`). Clearing site data removes it — export PDF/CSV for backup.
For multi-device use a real backend would be the next step.

## Tests

Pure logic (matrix parsing, alias matching, due-date/status assessment) is
unit- and integration-tested with Node's built-in test runner, including
against the real sample PDFs in `test/samples/`:

```bash
npm test
```

## Known limitations

- The GMM §2.11.10.1 **Specific Technical Training** rows (2.1–2.21) were
  transcribed from a best-effort coordinate parse of the source PDF and are
  marked `verified: false` in `src/lib/requirements.js`. The **Initial
  Training** rows (1.1–1.12) and the entire TPM §2.7 matrix were
  cross-checked cell-by-cell against the PDF's text-layer coordinates and are
  high confidence. Re-drop the GMM PDF in **Requirement matrix** (admin) to
  re-derive and confirm the flagged rows, or correct them directly via the
  Excel round-trip.
- The PDF requirement-matrix parser (rotated column headers, wrapped course
  names) is best-effort by nature — every change it proposes goes through a
  mandatory diff/review screen before it can be applied, and the Excel
  round-trip is the deterministic fallback for a revision the parser
  struggles with.

## Structure

```
src/
  App.jsx                 shell, auth/session, routing, CSV export
  components/             Login, Dashboard, LogbookRecord, TrainingRecord,
                          Admin (monitoring + user management), ComplianceCheck,
                          RequirementMatrixAdmin, modals, guide
  lib/
    constants.js          ratings, task types, thresholds, statuses
    assess.js             6/24-month assessment engine + training expiry
    storage.js            localStorage store, password hashing, admin seed
    excelImport.js        .xlsx logbook template import
    pdfParse.js           pure PDF table parsers (unit-testable in Node)
    pdfImport.js          pdf.js text extraction wrapper
    pdfExport.js          official-layout logbook PDF export + compliance report
    requirements.js       GMM/TPM requirement matrix data model + seed data
    requirementMatch.js   training description -> requirement alias matching
    requirementParse.js   pure GMM/TPM matrix PDF table parser
    requirementImport.js  browser wrapper: PDF/Excel matrix import, diff
    complianceAssess.js   per-person compliance assessment engine
test/                     Node --test unit + integration tests (real sample PDFs)
```
