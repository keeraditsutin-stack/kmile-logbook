import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDueDate, assessCompliance } from "../src/lib/complianceAssess.js";
import { seedMatrix } from "../src/lib/requirements.js";

test("computeDueDate: completion + interval - 1 day, matching K-Mile record convention", () => {
  assert.equal(computeDueDate("2025-10-15", 1), "2026-10-14");
  assert.equal(computeDueDate("2026-05-22", 2), "2028-05-21");
  assert.equal(computeDueDate(null, 2), null);
  assert.equal(computeDueDate("2025-01-01", null), null);
});

function matrixWithOneRow() {
  return {
    tpm: {
      source: "TPM", docRef: "TEST", issue: "1", revision: "00", date: "2026-01-01",
      rows: [
        { id: "tpm.test_initial", course: "Test Initial Course", cells: { certifying_staff: { type: "I" } } },
        { id: "tpm.test_recurrent", course: "Test Recurrent Course", cells: { certifying_staff: { type: "R", years: 1 } } },
      ],
    },
    gmm: { source: "GMM", docRef: "TEST", issue: "1", revision: "00", date: "2026-01-01", rows: [] },
  };
}

test("status classification: MISSING, COMPLIANT, DUE_SOON, EXPIRED", () => {
  const matrix = matrixWithOneRow();
  const person = { tpmRoles: ["certifying_staff"], gmmPositions: [], authorizedTypes: [], conditions: {} };

  // nothing completed -> both missing
  let r = assessCompliance({ trainingRecords: [], matrix, person, auditDate: "2026-06-01" });
  assert.equal(r.findings.find(f => f.reqId === "tpm.test_initial").status, "MISSING");
  assert.equal(r.findings.find(f => f.reqId === "tpm.test_recurrent").status, "MISSING");

  const records = [
    { id: "r1", date: "2026-01-10", dateTo: "2026-01-10", course: "Test Initial Course", expiry: "NEVER", requirementOverride: ["tpm.test_initial"] },
    { id: "r2", date: "2026-01-10", dateTo: "2026-01-10", course: "Test Recurrent Course", expiry: "", requirementOverride: ["tpm.test_recurrent"] },
  ];

  // right after completion: initial compliant forever, recurrent compliant (due 2027-01-09)
  r = assessCompliance({ trainingRecords: records, matrix, person, auditDate: "2026-06-01" });
  assert.equal(r.findings.find(f => f.reqId === "tpm.test_initial").status, "COMPLIANT");
  const rec1 = r.findings.find(f => f.reqId === "tpm.test_recurrent");
  assert.equal(rec1.status, "COMPLIANT");
  assert.equal(rec1.dueDate, "2027-01-09");

  // within warn window (60 days) of the due date -> DUE_SOON
  r = assessCompliance({ trainingRecords: records, matrix, person, auditDate: "2026-11-15" });
  assert.equal(r.findings.find(f => f.reqId === "tpm.test_recurrent").status, "DUE_SOON");

  // past the due date -> EXPIRED
  r = assessCompliance({ trainingRecords: records, matrix, person, auditDate: "2027-02-01" });
  assert.equal(r.findings.find(f => f.reqId === "tpm.test_recurrent").status, "EXPIRED");
});

test("records dated after the audit date never count (retrospective audit)", () => {
  const matrix = matrixWithOneRow();
  const person = { tpmRoles: ["certifying_staff"], gmmPositions: [], authorizedTypes: [], conditions: {} };
  const records = [{ id: "r1", date: "2026-08-01", dateTo: "2026-08-01", course: "Test Initial Course", expiry: "NEVER", requirementOverride: ["tpm.test_initial"] }];
  const r = assessCompliance({ trainingRecords: records, matrix, person, auditDate: "2026-06-01" });
  assert.equal(r.findings.find(f => f.reqId === "tpm.test_initial").status, "MISSING");
});

test("expiry mismatch flag: recorded expiry differs from the computed due date", () => {
  const matrix = matrixWithOneRow();
  const person = { tpmRoles: ["certifying_staff"], gmmPositions: [], authorizedTypes: [], conditions: {} };
  const records = [{ id: "r1", date: "2025-10-15", dateTo: "2025-10-15", course: "Test Recurrent Course", expiry: "2026-10-14", requirementOverride: ["tpm.test_recurrent"] }];
  const r = assessCompliance({ trainingRecords: records, matrix, person, auditDate: "2026-06-01" });
  const f = r.findings.find(x => x.reqId === "tpm.test_recurrent");
  // computed due = 2026-10-14 (1yr - 1day), recorded = 2026-10-14 -> no mismatch here
  assert.equal(f.mismatch, false);
});

test("a role not assigned to the requirement is not required for that person", () => {
  const matrix = matrixWithOneRow();
  const person = { tpmRoles: ["mechanic"], gmmPositions: [], authorizedTypes: [], conditions: {} };
  const r = assessCompliance({ trainingRecords: [], matrix, person, auditDate: "2026-06-01" });
  assert.equal(r.findings.length, 0);
});

test("unmapped training records are reported, not silently dropped", () => {
  const matrix = matrixWithOneRow();
  const person = { tpmRoles: ["certifying_staff"], gmmPositions: [], authorizedTypes: [], conditions: {} };
  const records = [{ id: "r1", date: "2026-01-01", dateTo: "2026-01-01", course: "Some Completely Unrelated Course", expiry: "NEVER" }];
  const r = assessCompliance({ trainingRecords: records, matrix, person, auditDate: "2026-06-01" });
  assert.equal(r.unmappedRecords.length, 1);
  assert.equal(r.unmappedRecords[0].course, "Some Completely Unrelated Course");
});
