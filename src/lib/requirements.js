/* ==========================================================================
   Training requirement matrices (GMM §2.11.9–2.11.10 and TPM §2.7).
   Data model, seeded defaults, and versioning helpers. Pure — no DOM/React.
   ========================================================================== */
import { uid } from "./helpers.js";

/* ---------------------------------------------------------------------- */
/* Role/position columns, in the exact left-to-right order printed in the
   source manuals. Column order matters: it's how the PDF parser maps a
   detected column index back to a role when it can't read the rotated
   header text with full confidence. */
export const TPM_ROLES = [
  { k: "am_manager", label: "AM and Manager" },
  { k: "certifying_staff", label: "Certifying Staff" },
  { k: "mechanic", label: "Mechanic" },
  { k: "borescope_inspector", label: "Borescope Inspector" },
  { k: "maintenance_planning", label: "Maintenance Planning Personnel" },
  { k: "technical_service", label: "Technical Service Personnel" },
  { k: "cd_auditor", label: "CD Personnel and Auditor" },
  { k: "safety_personnel", label: "Safety Personnel" },
  { k: "mcc_personnel", label: "MCC Personnel" },
  { k: "receiving_inspector", label: "Receiving Inspector" },
  { k: "mss_personnel", label: "MSS Personnel" },
  { k: "procurement", label: "Procurement Personnel" },
  { k: "engineering_training", label: "Engineering Training Personnel" },
];

export const GMM_POSITIONS = [
  { k: "HOE", label: "HOE" },
  { k: "CME", label: "CME" },
  { k: "LMM", label: "LMM" },
  { k: "MCM", label: "MCM" },
  { k: "MSM_PEM", label: "MSM / PEM" },
  { k: "TSM", label: "TSM" },
  { k: "MPM", label: "MPM" },
  { k: "ETM", label: "ETM" },
  { k: "MCC", label: "MCC" },
  { k: "LLAE_LAE", label: "LLAE / LAE" },
  { k: "MEC", label: "MEC" },
  { k: "MCO", label: "MCO" },
  { k: "MSS_PES", label: "MSS / PES Staff" },
  { k: "TSS", label: "TSS Staff" },
  { k: "MPN", label: "MPN Staff" },
  { k: "ETS", label: "ETS Staff" },
  { k: "TCM", label: "TCM" },
  { k: "CM_ENG", label: "CM-ENG Staff" },
  { k: "ADMIN", label: "Admin Staff" },
];

export const roleLabel = (source, k) =>
  (source === "tpm" ? TPM_ROLES : GMM_POSITIONS).find(r => r.k === k)?.label || k;

/* ---------------------------------------------------------------------- */
/* Cell value model: { type: "I" | "R", years?: number, note?: string,
   footnote?: "reliability" | "fdrcvr" | "safetymgr" }
   "I" = initial, one time enough. "R" = initial + recurrent every `years`. */
const I = () => ({ type: "I" });
const R = (years) => ({ type: "R", years });

/* ---------------------------------------------------------------------- */
/* TPM §2.7 — fully coordinate-verified against TPM_2_7.pdf (Issue 1, Rev 02,
   11 Feb 2026). Every row below was checked against the PDF's text-layer
   x/y positions, not just eyeballed off the rendered table. */
const TPM_ROWS = [
  { id: "tpm.caat_regulations", course: "CAAT Regulations (General Air Law and TCAR 8 Part 145)",
    cells: allRoles(TPM_ROLES, I()) },
  { id: "tpm.company_manual", course: "Company Manual (MOE, TPM), and Policies, Procedures",
    cells: { ...allRoles(TPM_ROLES, I()), certifying_staff: R(2) } },
  { id: "tpm.basic_amos", course: "Basic AMOS Systems",
    cells: pick(["certifying_staff", "mechanic", "borescope_inspector", "maintenance_planning",
      "technical_service", "cd_auditor", "safety_personnel", "mcc_personnel", "receiving_inspector",
      "mss_personnel", "procurement"], I()) },
  { id: "tpm.ramp_safety", course: "Ramp Safety", cells: allRoles(TPM_ROLES, I()) },
  { id: "tpm.b737_fam", course: "B737CL and B737NG Aircraft Familiarization",
    cells: pick(["mechanic", "borescope_inspector", "maintenance_planning", "technical_service",
      "cd_auditor", "safety_personnel", "mcc_personnel", "receiving_inspector", "mss_personnel",
      "procurement"], I()) },
  { id: "tpm.b767_fam", course: "B767-300 Aircraft Familiarization",
    cells: pick(["mechanic", "borescope_inspector", "maintenance_planning", "technical_service",
      "cd_auditor", "safety_personnel", "mcc_personnel", "receiving_inspector", "mss_personnel",
      "procurement"], I()) },
  { id: "tpm.test_equipment_gse", course: "Test Equipment, including Tools and Ground Support Equipment (GSE)",
    cells: pick(["certifying_staff", "mechanic", "borescope_inspector", "receiving_inspector",
      "mss_personnel", "procurement"], I()) },
  { id: "tpm.avsec_awareness", course: "Aviation Security (AVSEC) Awareness",
    cells: allRoles(TPM_ROLES, R(2)) },
  { id: "tpm.avsec_inflight", course: "Aviation Security (AVSEC) In-Flight",
    cells: pick(["certifying_staff", "mechanic"], R(1)) },
  { id: "tpm.scms", course: "Safety and Compliance Management System (SCMS)",
    cells: { ...allRoles(TPM_ROLES, R(1)), am_manager: R(2) } },
  { id: "tpm.human_factors", course: "Human Factors for Engineering", cells: allRoles(TPM_ROLES, R(2)) },
  { id: "tpm.dg_engineering", course: "Dangerous Goods Training Program for Engineering Staff",
    cells: {}, note: "Refers to DGM (Dangerous Goods Manual)" },
  { id: "tpm.dg_oversight", course: "Dangerous Goods Training Program for Oversight of Dangerous Goods Operations",
    cells: {}, note: "Refers to DGM" },
  { id: "tpm.dg_awareness", course: "Dangerous Goods Training Program for Dangerous Goods Awareness",
    cells: {}, note: "Refers to DGM" },
  { id: "tpm.ewis_g1g2", course: "Electrical Wiring Interconnection System (EWIS) Group 1 and 2",
    cells: pick(["certifying_staff", "mechanic", "borescope_inspector"], R(2)) },
  { id: "tpm.ewis_g5", course: "Electrical Wiring Interconnection System (EWIS) Group 5",
    cells: { maintenance_planning: R(2), technical_service: R(2), cd_auditor: R(2), safety_personnel: I(), mcc_personnel: R(2) } },
  { id: "tpm.fts_cdccl_phase1", course: "Fuel Tank Safety (FTS) and CDCCL — Phase 1",
    cells: { cd_auditor: R(2), safety_personnel: I() } },
  { id: "tpm.fts_cdccl_phase2", course: "Fuel Tank Safety (FTS) and CDCCL — Phase 2",
    cells: pick(["certifying_staff", "mechanic", "borescope_inspector", "maintenance_planning",
      "technical_service", "mcc_personnel"], R(2)) },
  { id: "tpm.type_rating_initial", course: "Aircraft Type Rating (B737CL / B737NG / B767-300) — Initial",
    cells: pick(["certifying_staff"], I()), aircraftSpecific: true },
  { id: "tpm.type_rating_recurrent", course: "Aircraft Type Rating (B737CL / B737NG / B767-300) — Recurrent",
    cells: pick(["certifying_staff"], R(2)), aircraftSpecific: true },
  { id: "tpm.engine_ground_run", course: "Engine Ground Run", cells: pick(["certifying_staff"], I()) },
  { id: "tpm.cargo_diff_door", course: "B737CL Cargo Aircraft Differential and Door System (AEI and IAI)",
    cells: pick(["certifying_staff", "mechanic", "borescope_inspector", "maintenance_planning",
      "technical_service", "cd_auditor", "safety_personnel", "mcc_personnel"], I()), aircraftSpecific: true },
  { id: "tpm.cargo_conversion_737ng", course: "B737NG Cargo Aircraft Conversion Configuration",
    cells: pick(["certifying_staff", "mechanic", "borescope_inspector", "maintenance_planning",
      "technical_service", "cd_auditor", "safety_personnel", "mcc_personnel"], I()), aircraftSpecific: true },
  { id: "tpm.freighter_config_767", course: "B767-300 Boeing Conversion Freighter Configuration",
    cells: pick(["certifying_staff", "mechanic", "borescope_inspector", "maintenance_planning",
      "technical_service", "cd_auditor", "safety_personnel", "mcc_personnel"], I()), aircraftSpecific: true },
  { id: "tpm.basic_inspection_technique", course: "Basic Aircraft Inspection Techniques",
    cells: pick(["certifying_staff"], I()) },
  { id: "tpm.parts_receiving_sup", course: "Aircraft Parts Receiving Inspection and Suspect Unapproved Part (SUP)",
    cells: pick(["certifying_staff", "mechanic", "mcc_personnel", "receiving_inspector", "mss_personnel", "procurement"], I()) },
  { id: "tpm.borescope_cfm56_pw4000", course: "Borescope Inspection — CFM56 / PW4000",
    cells: pick(["borescope_inspector"], I()) },
  { id: "tpm.borescope_tool", course: "Borescope Inspection and Tool (CFM56 & PW4000)",
    cells: pick(["borescope_inspector"], I()) },
  { id: "tpm.auditor_training", course: "Auditor Training", cells: pick(["cd_auditor"], I()) },
  { id: "tpm.investigator", course: "Investigator", cells: { safety_personnel: { ...I(), footnote: "safetymgr" } } },
  { id: "tpm.internal_compliance_briefing", course: "Internal Compliance Monitoring Process Briefing",
    cells: pick(["cd_auditor"], I()) },
  { id: "tpm.train_the_trainer", course: "Train the Trainer", cells: {}, note: "For Authorized Instructor" },
];

/* ---------------------------------------------------------------------- */
/* GMM §2.11.10.1 Initial Training rows — coordinate-verified against
   GMM_training_requirement.pdf page 77 (19/19 columns detected cleanly).
   High confidence. */
const GMM_INITIAL_ROWS = [
  { id: "gmm.general_air_law", course: "General Air Law",
    cells: pick(["HOE","CME","LMM","MCM","MSM_PEM","TSM","MPM","ETM","MCC","LLAE_LAE","MEC","MCO","MSS_PES","TSS","MPN","ETS","TCM","CM_ENG"], I()) },
  { id: "gmm.company_manuals", course: "General Maintenance Manual (GMM) and Company Manuals",
    cells: allRoles(GMM_POSITIONS, I()) },
  { id: "gmm.eng_maint_documentation", course: "Engineering and Maintenance Documentation (MPD, RPM, MEL/CDL, and Technical Publications)",
    cells: pick(["HOE","CME","LMM","MCM","MSM_PEM","TSM","MPM","ETM","MCC","LLAE_LAE","MEC","MCO","MSS_PES","TSS","MPN","ETS","TCM","CM_ENG"], I()) },
  { id: "gmm.ramp_safety", course: "Ramp Safety", cells: allRoles(GMM_POSITIONS, I()) },
  { id: "gmm.basic_amos", course: "Basic AMOS System",
    cells: pick(["HOE","CME","LMM","MCM","MSM_PEM","TSM","MPM","MCC","LLAE_LAE","MEC","MCO","MSS_PES","TSS","MPN","TCM","CM_ENG"], I()) },
  { id: "gmm.aircraft_operation_spec_initial", course: "Aircraft Operation Specifications (Initial)",
    cells: pick(["HOE","CME","LMM","MCM","TSM","MPM","MCC","LLAE_LAE","MEC","MSS_PES","TSS","MPN","TCM","CM_ENG"], I()) },
  { id: "gmm.avsec_nonsecurity", course: "Aviation Security (AVSEC) — Awareness",
    cells: pick(["CME","LMM","MCM","MSM_PEM","TSM","MPM","ETM","MCC","LLAE_LAE","MEC","MCO","MSS_PES","TSS","MPN","ETS","TCM","CM_ENG","ADMIN"], I()) },
  { id: "gmm.avsec_security", course: "Aviation Security (AVSEC) — In-flight",
    cells: pick(["MCC","LLAE_LAE","MEC"], I()) },
  { id: "gmm.b737_fam", course: "B737CL and B737NG Aircraft Familiarization",
    cells: pick(["CME","LMM","MCM","MSM_PEM","TSM","MPM","MEC","MCO","MSS_PES","TSS","MPN","TCM","CM_ENG"], I()) },
  { id: "gmm.b767_fam", course: "B767 Aircraft Familiarization",
    cells: pick(["CME","LMM","MCM","MSM_PEM","TSM","MPM","MEC","MCO","MSS_PES","TSS","MPN","TCM","CM_ENG"], I()) },
  { id: "gmm.scms_awareness", course: "SCMS — Awareness", cells: allRoles(GMM_POSITIONS, I()) },
  { id: "gmm.scms_inflight", course: "SCMS — In-flight", cells: pick(["MCC","LLAE_LAE","MEC"], I()) },
  { id: "gmm.human_factors", course: "Human Factors for Engineering", cells: allRoles(GMM_POSITIONS, I()) },
  { id: "gmm.dg_engineering", course: "DG for Engineering", cells: {}, note: "DG Training Program refers to DGM" },
];

/* GMM §2.11.10.1 Specific Technical Training rows (pages 78–79). Column
   detection on these pages was noisier than page 77 (sparser data means
   fewer x-clusters to calibrate against) — these rows are marked
   verified: false so the UI flags them for confirmation on first use. */
const GMM_TECHNICAL_ROWS = [
  { id: "gmm.b737cl_type_rating_initial", course: "B737CL Type Rating (Initial)", cells: pick(["ETM","MCC"], I()), verified: false, aircraftSpecific: true },
  { id: "gmm.b737ng_type_rating_initial", course: "B737NG Type Rating (Initial)", cells: pick(["ETM","MCC"], I()), verified: false, aircraftSpecific: true },
  { id: "gmm.b767_type_rating_initial", course: "B767 Type Rating (Initial)", cells: pick(["ETM","MCC"], I()), verified: false, aircraftSpecific: true },
  { id: "gmm.type_rating_differential", course: "Aircraft Type Rating Differential", cells: pick(["ETM","MCC"], I()), verified: false },
  { id: "gmm.engine_ground_run", course: "Engine Ground Run", cells: pick(["ETM","MCC"], I()), verified: false },
  { id: "gmm.parts_receiving_sup", course: "Aircraft Part Receiving Inspection and Suspected Unapproved Part (SUP)",
    cells: pick(["MSM_PEM","ETM","MCC","MCO","MPN"], I()), verified: false },
  { id: "gmm.basic_inspection_technique", course: "Basic Aircraft Inspection Technique", cells: pick(["ETM"], I()), verified: false },
  { id: "gmm.dg_oversight", course: "DG for Oversight", cells: {}, note: "DG Training Program refers to DGM" },
  { id: "gmm.cargo_diff_door_737cl", course: "B737CL Cargo Aircraft Differential and Door System (AEI and IAI)",
    cells: pick(["HOE","CME","LMM","MCM","TSM","MPM","ETM","MCC","LLAE_LAE","MEC","MSS_PES","MPN"], I()), verified: false, aircraftSpecific: true },
  { id: "gmm.cargo_conversion_737ng", course: "B737NG Cargo Aircraft Conversion Configuration",
    cells: pick(["HOE","CME","LMM","MCM","TSM","MPM","ETM","MCC","LLAE_LAE","MEC","MSS_PES","MPN"], I()), verified: false, aircraftSpecific: true },
  { id: "gmm.ewis_g1g2", course: "Electrical Wiring Interconnection System (EWIS) Group 1 and 2",
    cells: pick(["ETM","MCC","LLAE_LAE"], R(2)), verified: false },
  { id: "gmm.ewis_g5", course: "Electrical Wiring Interconnection System (EWIS) Group 5",
    cells: pick(["TSM","MPM","MEC","MCO","MSS_PES","TSS","ETS"], R(2)), verified: false },
  { id: "gmm.fts_cdccl_phase1", course: "Fuel Tank Safety (FTS) and CDCCL — Phase 1",
    cells: pick(["CME","TSM","MPM","ETM","MCC","LLAE_LAE","MSS_PES","TSS","ETS"], R(2)), verified: false,
    note: "Only personnel who plan, perform, supervise, inspect and certify the maintenance of aircraft and fuel system components" },
  { id: "gmm.fts_cdccl_phase2", course: "Fuel Tank Safety (FTS) and CDCCL — Phase 2",
    cells: pick(["TSM","MPM","ETM","MCC","LLAE_LAE","MSS_PES","TSS"], R(2)), verified: false,
    note: "Only personnel who plan, perform, supervise, inspect and certify the maintenance of aircraft and fuel system components" },
  { id: "gmm.deicing_anti_icing", course: "De-icing and Anti-Icing",
    cells: pick(["MCC","LLAE_LAE","MEC"], R(2)), verified: false },
  { id: "gmm.erp", course: "Emergency Response Plan (ERP)", cells: {}, note: "Refer to ERPM" },
  { id: "gmm.internal_auditor", course: "Internal Auditor", cells: pick(["CME","CM_ENG"], I()), verified: false },
  { id: "gmm.reliability_program", course: "Reliability Program Management",
    cells: pick(["HOE","LMM","MSM_PEM","ETM","TSS","TCM","CM_ENG"], { ...I(), footnote: "reliability" }), verified: false,
    note: "Only staff responsible for the reliability program" },
  { id: "gmm.fdr_cvr", course: "FDR and CVR Basic Knowledge and Interpretation",
    cells: pick(["MSM_PEM","TSS","CM_ENG"], { ...I(), footnote: "fdrcvr" }), verified: false,
    note: "Only staff responsible for FDR/CVR readout report evaluation" },
  { id: "gmm.esetc", course: "Emergency and Safety Equipment Training and Checking (ESETC)",
    cells: pick(["MCC","LLAE_LAE"], R(1)), verified: false },
];

/* GMM §2.11.9.3 A — recurrent intervals, keyed by requirement id. Read
   directly from the prose table (not a coordinate table), high confidence. */
const GMM_RECURRENT_INTERVALS = {
  "gmm.b737cl_type_rating_initial": 2, "gmm.b737ng_type_rating_initial": 2, "gmm.b767_type_rating_initial": 2,
  "gmm.ewis_g1g2": 2, "gmm.ewis_g5": 2,
  "gmm.fts_cdccl_phase1": 2, "gmm.fts_cdccl_phase2": 2,
  "gmm.human_factors": 2,
  "gmm.dg_oversight": 2, "gmm.dg_engineering": 2,
  "gmm.scms_awareness": 1, "gmm.scms_inflight": 1,
  "gmm.avsec_security": 1, "gmm.avsec_nonsecurity": 2,
  "gmm.deicing_anti_icing": 2,
  "gmm.erp": null, // Refer to ERPM
  "gmm.aircraft_operation_spec_initial": 2,
  "gmm.esetc": 1,
};
// Fold the recurrent intervals into the technical/initial row cells so a
// single row carries its own I/R(n) type — the matrix cell says "x" in the
// PDF; the interval comes from this separate table.
function applyGmmIntervals(rows) {
  return rows.map(r => {
    const years = GMM_RECURRENT_INTERVALS[r.id];
    if (years == null) return r;
    const cells = {};
    for (const [k, v] of Object.entries(r.cells)) cells[k] = { ...v, type: "R", years };
    return { ...r, cells };
  });
}

function allRoles(roleList, val) { const o = {}; roleList.forEach(r => o[r.k] = val); return o; }
function pick(keys, val) { const o = {}; keys.forEach(k => o[k] = val); return o; }

/* ---------------------------------------------------------------------- */
export function seedMatrix() {
  return {
    tpm: {
      source: "TPM", docRef: "FSDS4/MAN9-002", issue: "1", revision: "02", date: "2026-02-11",
      rows: TPM_ROWS,
    },
    gmm: {
      source: "GMM", docRef: "FSDS4/MAN1-001", issue: "7", revision: "00", date: "2026-04-30",
      rows: applyGmmIntervals([...GMM_INITIAL_ROWS, ...GMM_TECHNICAL_ROWS]),
    },
  };
}

/* Links between a TPM row and the "same" real-world requirement in GMM, so
   the assessment engine can apply the "earliest due date governs" rule
   across the two manuals for roles that both matrices cover. */
export const CROSS_LINKS = [
  ["tpm.scms", "gmm.scms_awareness"],
  ["tpm.human_factors", "gmm.human_factors"],
  ["tpm.ewis_g1g2", "gmm.ewis_g1g2"],
  ["tpm.ewis_g5", "gmm.ewis_g5"],
  ["tpm.fts_cdccl_phase1", "gmm.fts_cdccl_phase1"],
  ["tpm.fts_cdccl_phase2", "gmm.fts_cdccl_phase2"],
  ["tpm.type_rating_recurrent", "gmm.b737cl_type_rating_initial"],
  ["tpm.company_manual", "gmm.company_manuals"],
  ["tpm.avsec_awareness", "gmm.avsec_nonsecurity"],
];

/* ---------------------------------------------------------------------- */
/* Position (from the K-Mile user profile / training-record PDF header) →
   default TPM/GMM role mapping. Editable by an admin at runtime; this is
   only the seeded default. Keys are lower-cased, whitespace-collapsed. */
export const DEFAULT_POSITION_ROLE_MAP = {
  "licensed aircraft engineer": { tpm: ["certifying_staff"], gmm: ["LLAE_LAE"] },
  "maintenance support & store officer": { tpm: ["mss_personnel"], gmm: ["MSS_PES"] },
  "lae": { tpm: ["certifying_staff"], gmm: ["LLAE_LAE"] },
  "certifying staff": { tpm: ["certifying_staff"], gmm: ["LLAE_LAE"] },
  "support staff": { tpm: ["mss_personnel"], gmm: ["MSS_PES"] },
  "technician": { tpm: ["mechanic"], gmm: ["MCO"] },
  "engineer": { tpm: ["technical_service"], gmm: ["TSM"] },
  "manager": { tpm: ["am_manager"], gmm: ["HOE"] },
  "compliance monitoring personnel": { tpm: ["cd_auditor"], gmm: ["CM_ENG"] },
};

export function normPosition(p) { return String(p || "").toLowerCase().replace(/\s+/g, " ").trim(); }

/* ---------------------------------------------------------------------- */
/* Matrix version envelope, as stored. */
export function newMatrixVersion(matrix, meta) {
  return {
    id: uid(),
    matrix, // { tpm: {...}, gmm: {...} }
    appliedAt: meta.appliedAt, appliedBy: meta.appliedBy,
    effectiveFrom: meta.effectiveFrom || (matrix.tpm?.date && matrix.gmm?.date
      ? [matrix.tpm.date, matrix.gmm.date].sort().pop() : (matrix.tpm?.date || matrix.gmm?.date)),
    sourceFiles: meta.sourceFiles || [], // [{ name, sha256, matrix: "tpm"|"gmm" }]
    note: meta.note || "",
  };
}

/* Pick the matrix version effective as of a given date (the latest version
   whose effectiveFrom is <= date), or the latest version overall. */
export function versionForDate(versions, date, useLatest) {
  if (!versions?.length) return null;
  const sorted = [...versions].sort((a, b) => (a.effectiveFrom || "").localeCompare(b.effectiveFrom || ""));
  if (useLatest) return sorted[sorted.length - 1];
  const eligible = sorted.filter(v => !v.effectiveFrom || v.effectiveFrom <= date);
  return eligible.length ? eligible[eligible.length - 1] : sorted[0];
}
