import {
  TASK_TYPES, ACTIVITY_TYPES, EXP_CATEGORIES, groupOf, groupName,
  TASKS_TARGET, DAYS_TARGET, ALT_MAX_PCT, SIMILAR_MIN_PCT, FULL_DAY_HOURS, MAX_GAP_DAYS,
  EXPIRY_WARN_DAYS,
} from "./constants.js";
import { daysBetween, clampPct, todayISO, addYears } from "./helpers.js";

/* Training records that count as experience feeding the logbook: every course
   with a record inside the experience period. Each course contributes its
   training day(s) as full working day(s) and one experience task (Training
   activity). Recomputed on every training/logbook change. */
export function trainingContribution(training, start, end) {
  const days = new Set();
  let tasks = 0;
  const recs = (training || []).filter(t =>
    t.date && (!start || t.date >= start) && (!end || t.date <= end));
  for (const t of recs) {
    tasks += 1;
    // count each calendar day of a course (date .. dateTo), capped at 30 days
    const from = t.date;
    const to = (t.dateTo && t.dateTo >= t.date) ? t.dateTo : t.date;
    const span = Math.min(30, Math.max(0, daysBetween(from, to)));
    for (let i = 0; i <= span; i++) {
      const d = new Date(from); d.setDate(d.getDate() + i);
      days.add(d.toISOString().slice(0, 10));
    }
  }
  return { tasks, days, recs };
}

export function assess(records, profile, training) {
  // rolling 24-month demonstration window: both ends always slide with
  // today, rather than being pinned to whatever was stored when the
  // account/period was last set
  const end = todayISO(), start = addYears(end, -2);
  const all = records || [];

  // records excluded from the count entirely, and why — keyed by record id so
  // the logbook table can highlight the exact rows that don't count
  const excludedIds = new Map();
  const inWin = [];
  for (const r of all) {
    if (!r.date) { excludedIds.set(r.id, "nodate"); continue; }
    if (start && r.date < start) { excludedIds.set(r.id, "before"); continue; }
    if (end && r.date > end) { excludedIds.set(r.id, "after"); continue; }
    inWin.push(r);
  }
  const sorted = [...inWin].sort((a, b) => a.date.localeCompare(b.date));

  const noDateCount = [...excludedIds.values()].filter(v => v === "nodate").length;
  const beforePeriodCount = [...excludedIds.values()].filter(v => v === "before").length;
  const afterPeriodCount = [...excludedIds.values()].filter(v => v === "after").length;

  // training-derived experience folded into the logbook totals
  const tc = trainingContribution(training, start, end);

  // distinct dates & hours/day (logbook), then merge training days as full days
  const byDate = {};
  sorted.forEach(r => { byDate[r.date] = (byDate[r.date] || 0) + (Number(r.duration) || 0); });
  tc.days.forEach(d => { byDate[d] = Math.max(byDate[d] || 0, FULL_DAY_HOURS); });
  const distinctDates = Object.keys(byDate).sort();
  const workingDays = distinctDates.filter(d => byDate[d] >= FULL_DAY_HOURS).length || distinctDates.length;
  const fullDays = distinctDates.filter(d => byDate[d] >= FULL_DAY_HOURS).length;

  // alternative activities — instructor/support/management logbook entries
  // PLUS practical training courses fed in from the training record. They all
  // count under the same 20% alternative-activities allowance.
  const isAlt = (r) => EXP_CATEGORIES.find(c => c.k === r.category)?.alt;
  const altRecordsSorted = inWin.filter(isAlt).sort((a, b) => a.date.localeCompare(b.date));
  const logbookAltCount = altRecordsSorted.length;
  const directCount = inWin.length - logbookAltCount;
  const trainingTasks = tc.tasks;
  const altCount = logbookAltCount + trainingTasks;
  const altCapTasks = Math.floor(TASKS_TARGET * ALT_MAX_PCT); // 36
  const altCountedTasks = Math.min(altCount, altCapTasks);
  const effTasks = directCount + altCountedTasks;

  // training tasks (not editable logbook rows) fill the cap first; earliest
  // logbook alt entries fill what's left, so the latest-dated excess is flagged
  const capForLogbookAlt = Math.max(0, altCapTasks - trainingTasks);
  altRecordsSorted.forEach((r, i) => { if (i >= capForLogbookAlt) excludedIds.set(r.id, "altcap"); });

  // criterion 1: tasks OR days
  const tasksMet = effTasks >= TASKS_TARGET;
  const daysMet = fullDays >= DAYS_TARGET;
  const crit1 = tasksMet || daysMet;

  // spread over period — include training days
  const spreadCount = inWin.length + tc.tasks;
  let firstHalf = 0, secondHalf = 0, mid = null, maxGap = 0, spreadOk = false;
  if (start && end) {
    mid = new Date((new Date(start).getTime() + new Date(end).getTime()) / 2).toISOString().slice(0, 10);
    const midStr = mid;
    firstHalf = distinctDates.filter(d => d < midStr).length;
    secondHalf = distinctDates.filter(d => d >= midStr).length;
    const marks = [start, ...distinctDates, end];
    for (let i = 1; i < marks.length; i++) maxGap = Math.max(maxGap, daysBetween(marks[i - 1], marks[i]));
    spreadOk = firstHalf > 0 && secondHalf > 0 && maxGap <= MAX_GAP_DAYS;
  }

  // nature of experience (task type coverage) — ALL 7 types are required
  const typeCounts = {};
  TASK_TYPES.forEach(t => typeCounts[t.k] = inWin.filter(r => r.tasks?.[t.k]).length);
  const typesCovered = TASK_TYPES.filter(t => typeCounts[t.k] > 0).length;
  const natureOk = typesCovered >= TASK_TYPES.length;
  const missingTypes = TASK_TYPES.filter(t => typeCounts[t.k] === 0).map(t => t.label);

  // activity breakdown — training adds to the Training activity
  const actCounts = {};
  ACTIVITY_TYPES.forEach(a => actCounts[a.k] = inWin.filter(r => r.activity?.[a.k]).length);
  actCounts.TRAINING = (actCounts.TRAINING || 0) + trainingTasks;

  // similar aircraft distribution (logbook records)
  const grpCounts = {};
  inWin.forEach(r => { const g = groupOf(r.acType); grpCounts[g] = (grpCounts[g] || 0) + 1; });
  const activeGroups = Object.keys(grpCounts);
  const total = inWin.length || 1;
  const groupDist = activeGroups.map(g => ({ id: g, name: groupName(g), count: grpCounts[g], pct: (grpCounts[g] / total) * 100 }))
    .sort((a, b) => b.count - a.count);
  const typeDist = {};
  inWin.forEach(r => { const t = r.acType || "Other"; typeDist[t] = (typeDist[t] || 0) + 1; });
  const usingPrivilege = profile?.usePrivilege && activeGroups.length > 1;
  const similarOk = !usingPrivilege || groupDist.every(g => g.pct >= SIMILAR_MIN_PCT * 100);

  const altOk = altCount <= altCapTasks;
  const eligible = crit1 && spreadOk && natureOk && altOk && similarOk && (inWin.length + trainingTasks) > 0;

  // excess alternative-activity / training records beyond the 20% cap — logged
  // but not counted toward the task target
  const excessAltCount = [...excludedIds.values()].filter(v => v === "altcap").length;
  const excludedTotal = excludedIds.size;
  const exclusionReasons = [
    beforePeriodCount > 0 && { k: "before", label: EXCLUSION_LABELS.before, count: beforePeriodCount },
    afterPeriodCount > 0 && { k: "after", label: EXCLUSION_LABELS.after, count: afterPeriodCount },
    noDateCount > 0 && { k: "nodate", label: EXCLUSION_LABELS.nodate, count: noDateCount },
    excessAltCount > 0 && { k: "altcap", label: exclusionLabel("altcap", altCapTasks), count: excessAltCount },
  ].filter(Boolean);

  return {
    total: inWin.length, directCount, altCount, logbookAltCount, effTasks, fullDays, workingDays, distinctDates: distinctDates.length,
    trainingTasks, trainingDays: tc.days.size,
    tasksMet, daysMet, crit1, tasksPct: clampPct((effTasks / TASKS_TARGET) * 100), daysPct: clampPct((fullDays / DAYS_TARGET) * 100),
    firstHalf, secondHalf, mid, maxGap, spreadOk, typeCounts, typesCovered, natureOk, missingTypes, actCounts,
    groupDist, typeDist, usingPrivilege, similarOk, altCapTasks, altOk, eligible, start, end, byDate, distinctDatesList: distinctDates,
    noDateCount, beforePeriodCount, afterPeriodCount, excessAltCount, excludedTotal, exclusionReasons, excludedIds,
  };
}

/* Shared "why isn't this counted" labels, used by the dashboard summary and
   the logbook table's per-row highlight so the wording always matches. */
const EXCLUSION_LABELS = {
  before: "Dated before the experience period",
  after: "Dated after the experience period",
  nodate: "Missing a date",
};
export function exclusionLabel(key, altCapTasks) {
  if (key === "altcap") return `Exceeds the 20% alternative-activities cap (max ${altCapTasks})`;
  return EXCLUSION_LABELS[key] || "Not counted";
}

/* Training expiry status, for compliance monitoring. */
export function trainingStatus(t) {
  const exp = t.expiry;
  if (!exp || exp === "NEVER") return { state: "ok", label: "No expiry" };
  if (exp === "RECURRENT") return { state: "info", label: "Recurrent" };
  const today = todayISO();
  if (exp < today) return { state: "expired", label: "Expired" };
  if (daysBetween(today, exp) <= EXPIRY_WARN_DAYS) return { state: "expiring", label: "Expiring soon" };
  return { state: "ok", label: "Valid" };
}

export function trainingAlerts(trainingList) {
  const expired = [], expiring = [];
  (trainingList || []).forEach(t => {
    const s = trainingStatus(t);
    if (s.state === "expired") expired.push(t);
    else if (s.state === "expiring") expiring.push(t);
  });
  return { expired, expiring };
}
