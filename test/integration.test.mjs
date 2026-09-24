import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractPagesFromFile } from "../testlib/extractPagesNode.mjs";
import { parseTrainingPages } from "../src/lib/pdfParse.js";
import { seedMatrix, DEFAULT_POSITION_ROLE_MAP, normPosition } from "../src/lib/requirements.js";
import { assessCompliance } from "../src/lib/complianceAssess.js";
import { parseMatrixPages, detectMatrixDoc } from "../src/lib/requirementParse.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES = path.join(__dirname, "samples");

async function parseTrainingRecordFile(name) {
  const pages = await extractPagesFromFile(path.join(SAMPLES, name));
  return parseTrainingPages(pages);
}

test("parses Verapong's real training record PDF and finds the staff header", async () => {
  const { records, meta } = await parseTrainingRecordFile("verapong_training_record.pdf");
  assert.equal(meta.staffId, "KMA0153");
  assert.equal(meta.name, "Verapong Mingchai");
  assert.equal(meta.position, "Licensed Aircraft Engineer");
  assert.ok(records.length > 80, `expected 80+ records, got ${records.length}`);
});

test("parses Kititanatat's real training record PDF", async () => {
  const { records, meta } = await parseTrainingRecordFile("kititanatat_training_record.pdf");
  assert.equal(meta.staffId, "KMO0277"); // full text-layer ID, not the visually truncated "KMO027"
  assert.equal(meta.position, "Maintenance Support & Store Officer");
  assert.equal(records.length, 22);
});

test("dropping the same training-record PDF twice does not duplicate records (dedupe on from+to+description)", async () => {
  const a = await parseTrainingRecordFile("verapong_training_record.pdf");
  const b = await parseTrainingRecordFile("verapong_training_record.pdf");
  const key = (r) => `${r.date}|${r.dateTo}|${r.course.slice(0, 40)}`;
  const seen = new Set();
  const merged = [];
  for (const r of [...a.records, ...b.records]) { const k = key(r); if (seen.has(k)) continue; seen.add(k); merged.push(r); }
  assert.equal(merged.length, a.records.length, "merging two identical parses should not grow the record count");
});

function personFor(meta, authorizedTypes) {
  const roles = DEFAULT_POSITION_ROLE_MAP[normPosition(meta.position)] || { tpm: [], gmm: [] };
  return { tpmRoles: roles.tpm, gmmPositions: roles.gmm, authorizedTypes, conditions: {} };
}

test("Verapong (Certifying Staff, B737CL+B737NG) at audit date 2026-09-24: SCMS compliant via the later Jan-2026 record, AVSEC in-flight due soon", async () => {
  const { records, meta } = await parseTrainingRecordFile("verapong_training_record.pdf");
  const matrix = seedMatrix();
  const person = personFor(meta, ["B737-400", "B737-800"]);
  const result = assessCompliance({ trainingRecords: records, matrix, person, auditDate: "2026-09-24" });

  const scms = result.findings.find(f => f.reqId === "tpm.scms");
  assert.equal(scms.status, "COMPLIANT", "the 21-Jan-2026 SCMS recurrent record should supersede the earlier expired one");
  assert.equal(scms.completed, "2026-01-21");
  assert.equal(scms.dueDate, "2027-01-20");

  const avsecInflight = result.findings.find(f => f.reqId === "tpm.avsec_inflight");
  assert.equal(avsecInflight.status, "DUE_SOON");
  assert.equal(avsecInflight.dueDate, "2026-10-14");

  const humanFactors = result.findings.find(f => f.reqId === "tpm.human_factors");
  assert.equal(humanFactors.status, "COMPLIANT");
  assert.equal(humanFactors.dueDate, "2028-01-11");

  const companyManual = result.findings.find(f => f.reqId === "tpm.company_manual");
  assert.equal(companyManual.status, "COMPLIANT");
  assert.equal(companyManual.dueDate, "2028-04-07");

  const typeCl = result.findings.find(f => f.reqId === "tpm.type_rating_recurrent");
  assert.equal(typeCl.status, "COMPLIANT");

  assert.equal(result.overall, "ACTION_REQUIRED"); // due-soon item present
  assert.ok(result.counts.EXPIRED === 0, "no expired items once the later SCMS record is considered");
});

test("Kititanatat (MSS Personnel) at audit date 2026-09-24: all completed MSS items compliant", async () => {
  const { records, meta } = await parseTrainingRecordFile("kititanatat_training_record.pdf");
  const matrix = seedMatrix();
  const person = personFor(meta, ["B737-400", "B737-800", "B767-300"]);
  const result = assessCompliance({ trainingRecords: records, matrix, person, auditDate: "2026-09-24" });

  for (const id of ["tpm.caat_regulations", "tpm.company_manual", "tpm.basic_amos", "tpm.ramp_safety",
    "tpm.b737_fam", "tpm.b767_fam", "tpm.test_equipment_gse", "tpm.parts_receiving_sup",
    "tpm.avsec_awareness", "tpm.scms", "tpm.human_factors"]) {
    const f = result.findings.find(x => x.reqId === id);
    assert.ok(f, `expected finding for ${id}`);
    assert.equal(f.status, "COMPLIANT", `${id} should be compliant`);
  }
  assert.equal(result.findings.find(f => f.reqId === "tpm.scms").dueDate, "2027-06-15");
  assert.equal(result.findings.find(f => f.reqId === "tpm.human_factors").dueDate, "2028-05-21");
  assert.equal(result.findings.find(f => f.reqId === "tpm.avsec_awareness").dueDate, "2028-05-24");
});

test("retrospective audit: the same person at 2026-06-01 (before most training was completed) shows those items as MISSING", async () => {
  const { records, meta } = await parseTrainingRecordFile("kititanatat_training_record.pdf");
  const matrix = seedMatrix();
  const person = personFor(meta, ["B737-400", "B737-800", "B767-300"]);
  const result = assessCompliance({ trainingRecords: records, matrix, person, auditDate: "2026-06-01" });

  for (const id of ["tpm.caat_regulations", "tpm.b737_fam", "tpm.b767_fam", "tpm.test_equipment_gse",
    "tpm.parts_receiving_sup", "tpm.scms", "tpm.company_manual"]) {
    assert.equal(result.findings.find(f => f.reqId === id).status, "MISSING", `${id} should not be complete yet at this audit date`);
  }
  // completed before the audit date should still be compliant
  assert.equal(result.findings.find(f => f.reqId === "tpm.basic_amos").status, "COMPLIANT");
  assert.equal(result.findings.find(f => f.reqId === "tpm.ramp_safety").status, "COMPLIANT");
});

test("re-parsing the real GMM and TPM matrix PDFs finds rows without throwing, and reads Issue/Revision/Date", async () => {
  const gmmPages = await extractPagesFromFile(path.join(SAMPLES, "gmm_training_requirement.pdf"));
  const gmmDoc = detectMatrixDoc(gmmPages);
  assert.equal(gmmDoc.source, "gmm");
  assert.equal(gmmDoc.issue, "7");
  assert.equal(gmmDoc.revision, "00");
  const gmmParsed = parseMatrixPages(gmmPages, "gmm");
  assert.ok(gmmParsed.rows.length > 10, `expected 10+ GMM rows, got ${gmmParsed.rows.length}`);

  const tpmPages = await extractPagesFromFile(path.join(SAMPLES, "tpm_2_7.pdf"));
  const tpmDoc = detectMatrixDoc(tpmPages);
  assert.equal(tpmDoc.source, "tpm");
  assert.equal(tpmDoc.issue, "1");
  assert.equal(tpmDoc.revision, "02");
  const tpmParsed = parseMatrixPages(tpmPages, "tpm");
  assert.ok(tpmParsed.rows.length > 10, `expected 10+ TPM rows, got ${tpmParsed.rows.length}`);
  // page 1 (the one with the most reliable header calibration) should
  // recover a full 13-column CAAT Regulations row
  const caat = tpmParsed.rows.find(r => /CAAT/i.test(r.course) || /TCAR/i.test(r.course));
  assert.ok(caat, "expected to find the CAAT Regulations row");
  assert.equal(Object.keys(caat.cells).length, 13);
});
