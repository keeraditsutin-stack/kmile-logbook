/* Matches a training record's free-text course description to a requirement
   row id from the active matrix. Pure, testable. Aliases are ordered most-
   specific first since the first match wins. */

const ALIAS_RULES = [
  // --- shared / renamed courses seen across real K-Mile training records ---
  { id: "scms", re: /safety and comp\w*\s*management system|\bsqms\b|safety management system \(sms\)|safety quality management system/i },
  { id: "esetc", re: /\bes?etc\b|safety (and )?emergency equipment (procedure|training)|safety equipment and procedure/i },
  { id: "human_factors", re: /human factors?(\s*(for engineering|and crew resource management)?)?|\bhf\/?crm\b|crew resource management and human factor/i },
  { id: "avsec_both", re: /aviation security.*(awareness.*in-?flight|in-?flight.*awareness)/i },
  { id: "avsec_awareness", re: /aviation security.*awareness|security awareness training/i },
  { id: "avsec_inflight", re: /aviation security.*in-?flight|in-?flight security/i },
  { id: "dg_engineering", re: /dangerous goods.*(for )?engineering|dangerous goods regulation training/i },
  { id: "caat_regulations", re: /aviation regulation.*air law|general air law|tcar\s*8?\s*part\s*145|tcar8 part145/i },
  { id: "company_manual", re: /(general maintenance manual|gmm).*(company manual)?|moe.*tpm|company manual.*(moe|tpm)|part\s*145 maintenance organi[sz]ation exposition/i },
  { id: "basic_amos", re: /basic amos/i },
  { id: "eng_maint_documentation", re: /engineering and maint(enance)?\.? document|mpd.*rpm.*mel\/cdl|engineering and maintenance documentation/i },
  { id: "ramp_safety", re: /ramp safety/i },
  { id: "test_equipment_gse", re: /test equipment.*(tools|gse)|ground support equipment/i },
  { id: "type_rating_recurrent", re: /(b73[7-9]\w*|b767)[\w -]*(type )?(rating|recurrent).*recurrent|aircraft type b7\d\d-?\d* recurrent|(b737cl|b737ng|b767)\s*aircraft type rating\s*-?\s*recurrent/i },
  { id: "type_rating_initial", re: /(b737cl|b737ng|b767)[\w -]*(type rating|gen(eral)? fam)|b737[\w\-/]*type course|type course.*airframe powerplant/i },
  { id: "b737_fam", re: /b737cl (to )?(and )?b737ng.*(famil|differences)|b737-?(400|800)?\s*gen(eral)? fam/i },
  { id: "b767_fam", re: /b767[\w -]*famil/i },
  { id: "engine_ground_run", re: /engine ground run/i },
  { id: "cargo_diff_door", re: /cargo aircraft differential.*door|differential cargo aircraft.*door|i\.?a\.?i freighter configuration/i },
  { id: "cargo_conversion_config", re: /cargo (aircraft )?conversion configuration|boeing conversion freighter configuration/i },
  { id: "basic_inspection_technique", re: /basic aircraft inspection technique/i },
  { id: "parts_receiving_sup", re: /part(s)? receiving inspection|suspect(ed)? unapproved part|receiving inspection/i },
  { id: "borescope", re: /borescope inspection/i },
  { id: "auditor_training", re: /auditor training/i },
  { id: "internal_auditor", re: /internal auditor/i },
  { id: "investigator", re: /investigator/i },
  { id: "internal_compliance_briefing", re: /internal compliance monitoring process briefing/i },
  { id: "ewis_g5", re: /ewis.*group\s*5|electrical wiring.*group\s*5/i },
  { id: "ewis_g1g2", re: /ewis|electrical wiring/i },
  { id: "fts_cdccl_phase1", re: /fuel tank (safety|system).*(cdccl|critical design).*phase\s*1(?!.*phase\s*2)/i },
  { id: "fts_cdccl_phase2", re: /fuel tank (safety|system).*(cdccl|critical design).*phase\s*2(?!.*phase\s*1)|fuel tank.*phase\s*1\s*\+\s*2|fuel tank.*phase 1\+2/i },
  { id: "deicing_anti_icing", re: /de-?icing.*anti-?icing/i },
  { id: "erp", re: /emergency response plan|\berp\b/i },
  { id: "aircraft_operation_spec", re: /aircraft operation specification/i },
  { id: "reliability_program", re: /reliability program/i },
  { id: "fdr_cvr", re: /fdr and cvr|fdr\/cvr/i },
  { id: "train_the_trainer", re: /train the trainer/i },
];

// map a canonical alias id to the actual requirement row ids in each source
// (tpm./gmm. prefixed) — a record can satisfy both at once.
const ALIAS_TO_REQUIREMENTS = {
  scms: ["tpm.scms", "gmm.scms_awareness", "gmm.scms_inflight"],
  esetc: ["gmm.esetc"],
  human_factors: ["tpm.human_factors", "gmm.human_factors"],
  avsec_both: ["tpm.avsec_awareness", "tpm.avsec_inflight", "gmm.avsec_nonsecurity", "gmm.avsec_security"],
  avsec_awareness: ["tpm.avsec_awareness", "gmm.avsec_nonsecurity"],
  avsec_inflight: ["tpm.avsec_inflight", "gmm.avsec_security"],
  dg_engineering: ["tpm.dg_engineering", "gmm.dg_engineering"],
  caat_regulations: ["tpm.caat_regulations", "gmm.general_air_law"],
  company_manual: ["tpm.company_manual", "gmm.company_manuals"],
  basic_amos: ["tpm.basic_amos", "gmm.basic_amos"],
  eng_maint_documentation: ["gmm.eng_maint_documentation"],
  ramp_safety: ["tpm.ramp_safety", "gmm.ramp_safety"],
  test_equipment_gse: ["tpm.test_equipment_gse"],
  type_rating_recurrent: ["tpm.type_rating_recurrent"],
  type_rating_initial: ["tpm.type_rating_initial", "gmm.b737cl_type_rating_initial", "gmm.b737ng_type_rating_initial", "gmm.b767_type_rating_initial"],
  b737_fam: ["tpm.b737_fam", "gmm.b737_fam"],
  b767_fam: ["tpm.b767_fam", "gmm.b767_fam"],
  engine_ground_run: ["tpm.engine_ground_run", "gmm.engine_ground_run"],
  cargo_diff_door: ["tpm.cargo_diff_door", "gmm.cargo_diff_door_737cl"],
  cargo_conversion_config: ["tpm.cargo_conversion_737ng", "tpm.freighter_config_767", "gmm.cargo_conversion_737ng"],
  basic_inspection_technique: ["tpm.basic_inspection_technique", "gmm.basic_inspection_technique"],
  parts_receiving_sup: ["tpm.parts_receiving_sup", "gmm.parts_receiving_sup"],
  borescope: ["tpm.borescope_cfm56_pw4000", "tpm.borescope_tool"],
  auditor_training: ["tpm.auditor_training"],
  internal_auditor: ["gmm.internal_auditor"],
  investigator: ["tpm.investigator"],
  internal_compliance_briefing: ["tpm.internal_compliance_briefing"],
  ewis_g1g2: ["tpm.ewis_g1g2", "gmm.ewis_g1g2"],
  ewis_g5: ["tpm.ewis_g5", "gmm.ewis_g5"],
  fts_cdccl_phase1: ["tpm.fts_cdccl_phase1", "gmm.fts_cdccl_phase1"],
  fts_cdccl_phase2: ["tpm.fts_cdccl_phase2", "gmm.fts_cdccl_phase2"],
  deicing_anti_icing: ["gmm.deicing_anti_icing"],
  erp: ["gmm.erp"],
  aircraft_operation_spec: ["gmm.aircraft_operation_spec_initial"],
  reliability_program: ["gmm.reliability_program"],
  fdr_cvr: ["gmm.fdr_cvr"],
  train_the_trainer: ["tpm.train_the_trainer"],
};

/* Returns the list of requirement ids (across TPM + GMM) that a training
   record's course description satisfies, or [] if nothing matched. FTS
   "Phase 1+2" descriptions satisfy both phases at once. */
export function matchRequirements(description) {
  const d = String(description || "");
  const isFtsBoth = /fuel tank.*phase\s*1\s*\+\s*2|fuel tank.*phase 1\+2|cdccl.*phase 1\+2/i.test(d);
  if (isFtsBoth) {
    return [...(ALIAS_TO_REQUIREMENTS.fts_cdccl_phase1 || []), ...(ALIAS_TO_REQUIREMENTS.fts_cdccl_phase2 || [])];
  }
  for (const rule of ALIAS_RULES) {
    if (rule.re.test(d)) return ALIAS_TO_REQUIREMENTS[rule.id] || [];
  }
  return [];
}

/* Given the active matrix (tpm+gmm), resolve which of the matched
   requirement ids actually exist in it (defends against ids drifting after
   an admin uploads a revised matrix that renames/removes rows). */
export function resolveRequirementIds(ids, matrix) {
  const known = new Set([
    ...(matrix.tpm?.rows || []).map(r => r.id),
    ...(matrix.gmm?.rows || []).map(r => r.id),
  ]);
  return ids.filter(id => known.has(id));
}
