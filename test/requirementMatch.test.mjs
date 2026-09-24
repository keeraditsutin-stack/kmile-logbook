import { test } from "node:test";
import assert from "node:assert/strict";
import { matchRequirements } from "../src/lib/requirementMatch.js";
import { seedMatrix } from "../src/lib/requirements.js";

const matrix = seedMatrix();

test("matches SCMS including the real typo'd and renamed variants", () => {
  assert.ok(matchRequirements("Safety Quality Management System (SQMS)", matrix).includes("tpm.scms"));
  assert.ok(matchRequirements("Safety and Complianace Management System (SCMS) - Recurrent", matrix).includes("tpm.scms"));
  assert.ok(matchRequirements("Safety Management System (SMS)", matrix).includes("tpm.scms"));
});

test("FTS Phase 1+2 combined description satisfies both phases", () => {
  const ids = matchRequirements("Fuel Tank Safety (FTS) and Critical Design Configuration Control Limitation (CDCCL) Phase 1+2 (Initial)", matrix);
  assert.ok(ids.includes("tpm.fts_cdccl_phase1"));
  assert.ok(ids.includes("tpm.fts_cdccl_phase2"));
});

test("FTS Phase 2 only ('System' typo'd wording) matches phase 2 but NOT phase 1", () => {
  const ids = matchRequirements("Fuel Tank System (FTS)&Critical Design Confuguration Control Limitation (CDCCL) for Phase 2 -Initial", matrix);
  assert.ok(ids.includes("tpm.fts_cdccl_phase2"), "should still match despite 'System' instead of 'Safety' and a typo");
  assert.ok(!ids.includes("tpm.fts_cdccl_phase1"), "must not also match phase 1 just because most other words overlap");
});

test("EWIS Group 5 does not fall through to the Group 1&2 requirement, and vice versa", () => {
  const g5 = matchRequirements("Electrical Wiring Interconnection System (EWIS) Group 5 - Initial", matrix);
  assert.ok(g5.includes("gmm.ewis_g5"));
  assert.ok(!g5.includes("tpm.ewis_g1g2"));

  const g12 = matchRequirements("Electrical Wiring Interconnection System (EWIS) Group 1 and 2 (Initial)", matrix);
  assert.ok(g12.includes("tpm.ewis_g1g2"));
  assert.ok(!g12.includes("gmm.ewis_g5"));
});

test("ESETC matches both the acronym and the renamed 'SEP' record", () => {
  assert.ok(matchRequirements("Emergency and safety equipment training and checking (ESETC) -Recurrent", matrix).includes("gmm.esetc"));
  assert.ok(matchRequirements("Safety and Emergency Equipment Procedure (SEP)", matrix).includes("gmm.esetc"));
});

test("combined AVSEC awareness+in-flight record satisfies both TPM rows", () => {
  const ids = matchRequirements("Aviation Security (Awareness and In-Flight) - Recurrent", matrix);
  assert.ok(ids.includes("tpm.avsec_awareness"));
  assert.ok(ids.includes("tpm.avsec_inflight"));
});

test("Human Factors matches the old 'Crew Resource Management and Human Factor' wording (singular, no acronym)", () => {
  const ids = matchRequirements("Crew Resource Management and Human Factor", matrix);
  assert.ok(ids.includes("tpm.human_factors"), "should match via the HF/CRM synonym + plural stemming, not just an exact phrase");
});

test("B737-400 / B737-800 K-Mile registration naming resolves to the manuals' B737CL/B737NG naming", () => {
  assert.ok(matchRequirements("Aircraft Type B737-400 recurrent", matrix).includes("tpm.type_rating_recurrent"));
  assert.ok(matchRequirements("B737NG Aircraft Type Rating Recurrent", matrix).includes("tpm.type_rating_recurrent"));
});

test("engineering & maintenance documentation matches despite the shortened real wording", () => {
  const ids = matchRequirements("Engineering and Maint. Document (MPD,RNP,MEL/CDL,and Technical Pub.) - Initial", matrix);
  assert.ok(ids.includes("gmm.eng_maint_documentation"));
});

test("does not match an unrelated course", () => {
  assert.deepEqual(matchRequirements("Tire Care & Maintenance Training provided by Goodyear (Thailand)", matrix), []);
  assert.deepEqual(matchRequirements("EFB Introduction Briefing", matrix), []);
});

test("note-only rows (refers to DGM/ERPM) never produce a compliance finding even if matched — they have no requirement cells", () => {
  const row = matrix.tpm.rows.find(r => r.id === "tpm.dg_awareness");
  assert.deepEqual(row.cells, {}, "note-only rows must carry no per-role cells, so evalRow always skips them");
});
