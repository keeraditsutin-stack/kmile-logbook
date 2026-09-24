import { test } from "node:test";
import assert from "node:assert/strict";
import { seedMatrix, TPM_ROLES, GMM_POSITIONS, roleLabel, CROSS_LINKS } from "../src/lib/requirements.js";

test("seed matrix has both sources with docRef/issue/revision/date", () => {
  const m = seedMatrix();
  assert.equal(m.tpm.docRef, "FSDS4/MAN9-002");
  assert.equal(m.tpm.issue, "1");
  assert.equal(m.tpm.revision, "02");
  assert.equal(m.tpm.date, "2026-02-11");
  assert.equal(m.gmm.docRef, "FSDS4/MAN1-001");
  assert.equal(m.gmm.issue, "7");
  assert.equal(m.gmm.revision, "00");
  assert.equal(m.gmm.date, "2026-04-30");
});

test("TPM has 13 role columns, GMM has 19", () => {
  assert.equal(TPM_ROLES.length, 13);
  assert.equal(GMM_POSITIONS.length, 19);
});

test("TPM CAAT Regulations row requires all 13 roles as Initial", () => {
  const m = seedMatrix();
  const row = m.tpm.rows.find(r => r.id === "tpm.caat_regulations");
  assert.ok(row);
  assert.equal(Object.keys(row.cells).length, 13);
  for (const role of TPM_ROLES) assert.equal(row.cells[role.k].type, "I", `${role.k} should be Initial`);
});

test("TPM MSS Personnel column matches the spec's expected requirement set", () => {
  const m = seedMatrix();
  const mssRows = m.tpm.rows.filter(r => r.cells.mss_personnel);
  const ids = mssRows.map(r => r.id).sort();
  const expected = [
    "tpm.avsec_awareness", "tpm.caat_regulations", "tpm.company_manual", "tpm.human_factors",
    "tpm.parts_receiving_sup", "tpm.ramp_safety", "tpm.scms", "tpm.test_equipment_gse",
  ].sort();
  for (const id of expected) assert.ok(ids.includes(id), `expected ${id} in MSS column`);
  assert.equal(mssRows.find(r => r.id === "tpm.scms").cells.mss_personnel.type, "R");
  assert.equal(mssRows.find(r => r.id === "tpm.scms").cells.mss_personnel.years, 1);
});

test("TPM Certifying Staff includes type rating, EWIS, FTS/CDCCL phase 2, and AVSEC in-flight R(1)", () => {
  const m = seedMatrix();
  const byId = Object.fromEntries(m.tpm.rows.map(r => [r.id, r]));
  assert.equal(byId["tpm.company_manual"].cells.certifying_staff.type, "R");
  assert.equal(byId["tpm.company_manual"].cells.certifying_staff.years, 2);
  assert.equal(byId["tpm.avsec_inflight"].cells.certifying_staff.years, 1);
  assert.ok(byId["tpm.ewis_g1g2"].cells.certifying_staff);
  assert.ok(byId["tpm.fts_cdccl_phase2"].cells.certifying_staff);
  assert.equal(byId["tpm.type_rating_initial"].cells.certifying_staff.type, "I");
  assert.equal(byId["tpm.type_rating_recurrent"].cells.certifying_staff.years, 2);
});

test("GMM recurrent intervals are folded into the matching rows", () => {
  const m = seedMatrix();
  const byId = Object.fromEntries(m.gmm.rows.map(r => [r.id, r]));
  assert.equal(byId["gmm.esetc"].cells.MCC.years, 1);
  assert.equal(byId["gmm.human_factors"].cells.HOE.years, 2);
  assert.equal(byId["gmm.ewis_g1g2"].cells.ETM.years, 2);
  assert.equal(byId["gmm.deicing_anti_icing"].cells.MCC.years, 2);
});

test("cross-links reference ids that exist in both matrices", () => {
  const m = seedMatrix();
  const tpmIds = new Set(m.tpm.rows.map(r => r.id));
  const gmmIds = new Set(m.gmm.rows.map(r => r.id));
  for (const [t, g] of CROSS_LINKS) {
    assert.ok(tpmIds.has(t), `missing tpm id ${t}`);
    assert.ok(gmmIds.has(g), `missing gmm id ${g}`);
  }
});

test("roleLabel resolves both sources", () => {
  assert.equal(roleLabel("tpm", "certifying_staff"), "Certifying Staff");
  assert.equal(roleLabel("gmm", "LLAE_LAE"), "LLAE / LAE");
});
