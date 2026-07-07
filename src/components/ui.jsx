import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import { clampPct } from "../lib/helpers.js";

export function StatusPill({ state, children }) {
  const map = { pass: "pill pill-pass", caution: "pill pill-caution", fail: "pill pill-fail", na: "pill pill-na" };
  const Icon = state === "pass" ? CheckCircle2 : state === "fail" ? XCircle : state === "caution" ? AlertTriangle : Info;
  return <span className={map[state] || map.na}><Icon size={13} strokeWidth={2.4} />{children}</span>;
}

export function Bar({ pct, tone = "blue", threshold }) {
  return (
    <div className="bar">
      <div className={`bar-fill bar-${tone}`} style={{ width: clampPct(pct) + "%" }} />
      {threshold != null && <div className="bar-threshold" style={{ left: clampPct(threshold) + "%" }} title={`${threshold}%`} />}
    </div>
  );
}

export function Field({ label, children, hint, wide }) {
  return (
    <label className={"field" + (wide ? " field-wide" : "")}>
      <span className="field-label">{label}{hint && <em className="field-hint">{hint}</em>}</span>
      {children}
    </label>
  );
}
