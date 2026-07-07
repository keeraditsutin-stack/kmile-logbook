import { useMemo } from "react";
import { Clock, Gauge, Info } from "lucide-react";
import { StatusPill, Bar } from "./ui.jsx";
import { assess } from "../lib/assess.js";
import {
  TASK_TYPES, ACTIVITY_TYPES, TASKS_TARGET, DAYS_TARGET, FULL_DAY_HOURS, MAX_GAP_DAYS,
} from "../lib/constants.js";
import { fmtDate, daysBetween, todayISO, clampPct } from "../lib/helpers.js";

export default function Dashboard({ profile, records, training }) {
  const a = useMemo(() => assess(records, profile), [records, profile]);
  const recentTraining = (training || []).filter(t => t.category === "Type Training" && t.theoretical && t.practical && t.result === "Pass" && daysBetween(t.date, todayISO()) <= 365);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">Summary sheet</div>
          <h2 className="page-title">Experience readiness</h2>
        </div>
        <div className="period-tag"><Clock size={14} />{fmtDate(profile.periodStart)} → {fmtDate(profile.periodEnd)}</div>
      </header>

      <div className={"readiness " + (a.eligible ? "readiness-ok" : "readiness-no")}>
        <div className="readiness-light"><Gauge size={30} strokeWidth={1.8} /></div>
        <div className="readiness-body">
          <div className="readiness-status">{a.eligible ? "ELIGIBLE" : "NOT YET ELIGIBLE"}</div>
          <div className="readiness-sub">
            {a.eligible
              ? "All experience criteria for the 6/24‑month demonstration are met for this period."
              : "One or more criteria are not yet satisfied. Review the caution items below."}
          </div>
        </div>
        <div className="readiness-count">
          <div className="rc-n">{a.total}</div><div className="rc-l">records in period</div>
        </div>
      </div>

      {recentTraining.length > 0 && (
        <div className="credit-note"><Info size={16} />
          Type training passed at a Part‑147 organisation within the last 12 months — <b>Credit of Experience</b> may supersede the 6/24‑month demonstration (ref 3.9.3.1).
        </div>
      )}

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head"><span>Tasks on different dates</span><StatusPill state={a.tasksMet ? "pass" : "caution"}>{a.effTasks} / {TASKS_TARGET}</StatusPill></div>
          <Bar pct={a.tasksPct} tone={a.tasksMet ? "green" : "blue"} />
          <div className="panel-foot">Effective tasks incl. capped alternative activities. Meet <b>either</b> this or working days.</div>
        </div>
        <div className="panel">
          <div className="panel-head"><span>Working days (full 7–8 h)</span><StatusPill state={a.daysMet ? "pass" : "caution"}>{a.fullDays} / {DAYS_TARGET}</StatusPill></div>
          <Bar pct={a.daysPct} tone={a.daysMet ? "green" : "blue"} />
          <div className="panel-foot">{a.distinctDates} distinct active dates recorded ({a.fullDays} counted as full days).</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span>Experience spread across the 2‑year period</span>
          <StatusPill state={a.spreadOk ? "pass" : "caution"}>{a.spreadOk ? "Well distributed" : "Uneven / gap detected"}</StatusPill>
        </div>
        <SpreadTimeline a={a} profile={profile} />
        <div className="split-legend">
          <span><b>{a.firstHalf}</b> in year 1</span>
          <span><b>{a.secondHalf}</b> in year 2</span>
          <span>Longest gap: <b>{a.maxGap} days</b>{a.maxGap > MAX_GAP_DAYS && <em className="warn"> — exceeds ~4 months</em>}</span>
        </div>
        <div className="panel-foot">Experience recorded only in the first year is not acceptable — activity must be spread to avoid long inactive intervals (ref 3.9.3.1).</div>
      </div>

      <div className="panel">
        <div className="panel-head"><span>Nature of experience — task type coverage</span><StatusPill state={a.natureOk ? "pass" : "caution"}>{a.typesCovered} / {TASK_TYPES.length} types</StatusPill></div>
        <div className="chips">
          {TASK_TYPES.map(t => (
            <div key={t.k} className={"chip " + (a.typeCounts[t.k] > 0 ? "chip-on" : "chip-off")} title={t.full}>
              <span className="chip-k">{t.label}</span><span className="chip-n">{a.typeCounts[t.k]}</span>
            </div>
          ))}
        </div>
        <div className="panel-foot">
          <b>All {TASK_TYPES.length} task types must be covered</b> — the criterion is not satisfied until every type (FOT, SGH, R/I, T/S, OPC, REP, INSP) has at least one record.
          {!a.natureOk && a.missingTypes.length > 0 && <> Missing: <b className="warn">{a.missingTypes.join(", ")}</b>.</>}
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <span>Similar‑aircraft distribution</span>
            <StatusPill state={a.usingPrivilege ? (a.similarOk ? "pass" : "fail") : "na"}>{a.usingPrivilege ? (a.similarOk ? "≥30% each group" : "below 30%") : "single group"}</StatusPill>
          </div>
          {a.groupDist.length === 0 ? <div className="empty-sm">No records yet.</div> :
            a.groupDist.map(g => (
              <div key={g.id} className="dist-row">
                <div className="dist-top"><span>{g.name}</span><span className="mono">{g.count} · {g.pct.toFixed(0)}%</span></div>
                <Bar pct={g.pct} tone={a.usingPrivilege && g.pct < 30 ? "amber" : "cyan"} threshold={a.usingPrivilege ? 30 : null} />
              </div>
            ))}
          <div className="type-mini">
            {Object.entries(a.typeDist).map(([t, n]) => <span key={t} className="type-mini-item"><b className="mono">{t}</b> {n}</span>)}
          </div>
          <div className="panel-foot">When using the privilege, a minimum of 30% of experience must be recorded per similar‑aircraft group (ref 3.9.3.2).</div>
        </div>

        <div className="panel">
          <div className="panel-head"><span>Alternative activities cap</span><StatusPill state={a.altOk ? "pass" : "fail"}>{a.altCount} / {a.altCapTasks} max</StatusPill></div>
          <Bar pct={(a.altCount / a.altCapTasks) * 100} tone={a.altOk ? "cyan" : "red"} threshold={100} />
          <div className="panel-foot" style={{ marginBottom: 14 }}>Instructor/assessor, technical support and management/planning may replace up to 20% of required experience.</div>
          <div className="panel-head" style={{ marginTop: 4 }}><span>Type of activity</span></div>
          <div className="chips">
            {ACTIVITY_TYPES.map(t => (
              <div key={t.k} className={"chip " + (a.actCounts[t.k] > 0 ? "chip-on" : "chip-off")} title={t.full || t.label}>
                <span className="chip-k">{t.label}</span><span className="chip-n">{a.actCounts[t.k]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SpreadTimeline({ a, profile }) {
  const start = profile.periodStart, end = profile.periodEnd;
  if (!start || !end) return <div className="empty-sm">Set an experience period to see the distribution.</div>;
  const span = Math.max(1, daysBetween(start, end));
  const pos = (d) => clampPct((daysBetween(start, d) / span) * 100);
  return (
    <div className="timeline">
      <div className="tl-track">
        <div className="tl-mid" style={{ left: "50%" }}><span>1 yr</span></div>
        {a.distinctDatesList.map((d, i) => {
          const heavy = a.byDate[d] >= FULL_DAY_HOURS;
          return <div key={i} className={"tl-mark " + (heavy ? "tl-heavy" : "")} style={{ left: pos(d) + "%" }} title={`${fmtDate(d)} · ${a.byDate[d].toFixed(1)}h`} />;
        })}
      </div>
      <div className="tl-axis"><span className="mono">{fmtDate(start)}</span><span className="mono">{fmtDate(end)}</span></div>
    </div>
  );
}
