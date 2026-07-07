import {
  TASK_TYPES, ACTIVITY_TYPES, EXP_CATEGORIES, groupOf, groupName,
  TASKS_TARGET, DAYS_TARGET, ALT_MAX_PCT, SIMILAR_MIN_PCT, FULL_DAY_HOURS, MAX_GAP_DAYS,
  EXPIRY_WARN_DAYS,
} from "./constants.js";
import { daysBetween, clampPct, todayISO } from "./helpers.js";

export function assess(records, profile) {
  const start = profile?.periodStart, end = profile?.periodEnd;
  const inWin = (records || []).filter(r => r.date && (!start || r.date >= start) && (!end || r.date <= end));
  const sorted = [...inWin].sort((a, b) => a.date.localeCompare(b.date));

  // distinct dates & hours/day
  const byDate = {};
  sorted.forEach(r => { byDate[r.date] = (byDate[r.date] || 0) + (Number(r.duration) || 0); });
  const distinctDates = Object.keys(byDate).sort();
  const workingDays = distinctDates.filter(d => byDate[d] >= FULL_DAY_HOURS).length || distinctDates.length;
  const fullDays = distinctDates.filter(d => byDate[d] >= FULL_DAY_HOURS).length;

  // alternative activities
  const isAlt = (r) => EXP_CATEGORIES.find(c => c.k === r.category)?.alt;
  const altCount = inWin.filter(isAlt).length;
  const directCount = inWin.length - altCount;
  const altCapTasks = Math.floor(TASKS_TARGET * ALT_MAX_PCT); // 36
  const altCountedTasks = Math.min(altCount, altCapTasks);
  const effTasks = directCount + altCountedTasks;

  // criterion 1: tasks OR days
  const tasksMet = effTasks >= TASKS_TARGET;
  const daysMet = fullDays >= DAYS_TARGET;
  const crit1 = tasksMet || daysMet;

  // spread over period
  let firstHalf = 0, secondHalf = 0, mid = null, maxGap = 0, spreadOk = false;
  if (start && end) {
    mid = new Date((new Date(start).getTime() + new Date(end).getTime()) / 2).toISOString().slice(0, 10);
    firstHalf = inWin.filter(r => r.date < mid).length;
    secondHalf = inWin.filter(r => r.date >= mid).length;
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

  // activity breakdown
  const actCounts = {};
  ACTIVITY_TYPES.forEach(a => actCounts[a.k] = inWin.filter(r => r.activity?.[a.k]).length);

  // similar aircraft distribution
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
  const eligible = crit1 && spreadOk && natureOk && altOk && similarOk && inWin.length > 0;

  return {
    total: inWin.length, directCount, altCount, effTasks, fullDays, workingDays, distinctDates: distinctDates.length,
    tasksMet, daysMet, crit1, tasksPct: clampPct((effTasks / TASKS_TARGET) * 100), daysPct: clampPct((fullDays / DAYS_TARGET) * 100),
    firstHalf, secondHalf, mid, maxGap, spreadOk, typeCounts, typesCovered, natureOk, missingTypes, actCounts,
    groupDist, typeDist, usingPrivilege, similarOk, altCapTasks, altOk, eligible, start, end, byDate, distinctDatesList: distinctDates,
  };
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
