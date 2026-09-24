import { test } from "node:test";
import assert from "node:assert/strict";
import { matchRequirements } from "../src/lib/requirementMatch.js";

test("matches SCMS including the real typo'd variant", () => {
  assert.deepEqual(matchRequirements("Safety Quality Management System (SQMS)"), ["tpm.scms", "gmm.scms_awareness", "gmm.scms_inflight"]);
  assert.deepEqual(matchRequirements("Safety and Complianace Management System (SCMS) - Recurrent"), ["tpm.scms", "gmm.scms_awareness", "gmm.scms_inflight"]);
});

test("FTS Phase 1+2 combined description satisfies both phases", () => {
  const ids = matchRequirements("Fuel Tank Safety (FTS) and Critical Design Configuration Control Limitation (CDCCL) Phase 1+2 (Initial)");
  assert.ok(ids.includes("tpm.fts_cdccl_phase1"));
  assert.ok(ids.includes("tpm.fts_cdccl_phase2"));
  assert.ok(ids.includes("gmm.fts_cdccl_phase1"));
  assert.ok(ids.includes("gmm.fts_cdccl_phase2"));
});

test("FTS Phase 2 only description does not also satisfy Phase 1", () => {
  const ids = matchRequirements("Fuel Tank System (FTS)&Critical Design Confuguration Control Limitation (CDCCL) for Phase 2 -Initial");
  assert.ok(ids.includes("tpm.fts_cdccl_phase2"));
  assert.ok(!ids.includes("tpm.fts_cdccl_phase1"));
});

test("EWIS Group 5 does not fall through to the Group 1&2 requirement", () => {
  const ids = matchRequirements("Electrical Wiring Interconnection System (EWIS) Group 5 - Initial");
  assert.ok(ids.includes("gmm.ewis_g5"));
  assert.ok(!ids.includes("tpm.ewis_g1g2"));
});

test("EWIS Group 1 and 2 matches the group 1&2 requirement", () => {
  const ids = matchRequirements("Electrical Wiring Interconnection System (EWIS) Group 1 and 2 (Initial)");
  assert.ok(ids.includes("tpm.ewis_g1g2"));
});

test("ESETC matches both the acronym and the renamed 'SEP' record", () => {
  assert.ok(matchRequirements("Emergency and safety equipment training and checking (ESETC) -Recurrent").includes("gmm.esetc"));
  assert.ok(matchRequirements("Safety and Emergency Equipment Procedure (SEP)").includes("gmm.esetc"));
});

test("combined AVSEC awareness+in-flight record satisfies both", () => {
  const ids = matchRequirements("Aviation Security (Awareness and In-Flight) - Recurrent");
  assert.ok(ids.includes("tpm.avsec_awareness"));
  assert.ok(ids.includes("tpm.avsec_inflight"));
});

test("no match for an unrelated course", () => {
  assert.deepEqual(matchRequirements("Tire Care & Maintenance Training provided by Goodyear (Thailand)"), []);
});
