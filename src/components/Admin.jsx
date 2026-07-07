import { useMemo, useState, useRef } from "react";
import {
  Download, ShieldCheck, Users, UserPlus, CheckCircle2, AlertTriangle, GraduationCap,
  KeyRound, Archive, Eye, EyeOff, LayoutDashboard, ClipboardList, FileText, UploadCloud, RotateCcw, Info,
} from "lucide-react";
import { Field, StatusPill, Bar } from "./ui.jsx";
import { assess, trainingAlerts } from "../lib/assess.js";
import {
  TASK_TYPES, TASKS_TARGET, DAYS_TARGET, POSITIONS, ADMIN_POSITION, USER_STATUSES,
  DEFAULT_FORM_TEMPLATE, TASK_TYPES as TT,
} from "../lib/constants.js";
import { todayISO, addYears, fmtDate } from "../lib/helpers.js";
import { hashPassword, newSalt } from "../lib/storage.js";
import { parseFormDocx, mergeTemplate } from "../lib/formTemplate.js";

const statusBadge = (s) =>
  s === "active" ? <span className="status-badge st-active">Active</span> :
  s === "inactive" ? <span className="status-badge st-inactive">Inactive</span> :
  <span className="status-badge st-archived">Archived</span>;

/* ==================== MONITORING DASHBOARD ==================== */
export function AdminDashboard({ users, logbook, training, onView, onExport }) {
  // monitored staff only — admins (Compliance Monitoring) are not trainees
  const rows = useMemo(() => users
    .filter(u => u.status !== "archived" && u.role !== "admin")
    .map(u => {
      const a = assess(logbook[u.email] || [], u, training[u.email] || []);
      const alerts = trainingAlerts(training[u.email] || []);
      return { u, a, tr: (training[u.email] || []).length, alerts };
    })
    .sort((x, y) => (x.a.eligible === y.a.eligible ? 0 : x.a.eligible ? 1 : -1)), [users, logbook, training]);

  const eligible = rows.filter(r => r.a.eligible).length;
  const totalRecords = rows.reduce((s, r) => s + (logbook[r.u.email] || []).length, 0);
  const expiredAll = rows.reduce((s, r) => s + r.alerts.expired.length, 0);
  const expiringAll = rows.reduce((s, r) => s + r.alerts.expiring.length, 0);
  const activeUsers = users.filter(u => u.status === "active" && u.role !== "admin").length;

  // task-type coverage across all monitored staff
  const coverage = TASK_TYPES.map(t => ({
    ...t,
    ok: rows.filter(r => r.a.typeCounts[t.k] > 0).length,
  }));

  return (
    <div className="page">
      <header className="page-head">
        <div><div className="eyebrow">Compliance monitoring</div><h2 className="page-title">Monitoring dashboard</h2></div>
        <button className="btn btn-ghost" onClick={onExport}><Download size={16} /> Export all data (CSV)</button>
      </header>

      <div className="grid-4">
        <div className="stat"><div className="stat-n">{activeUsers}</div><div className="stat-l">Active users</div></div>
        <div className="stat"><div className="stat-n stat-good">{eligible}<span className="stat-sub">/ {rows.length}</span></div><div className="stat-l">Eligible now</div></div>
        <div className="stat"><div className="stat-n">{totalRecords}</div><div className="stat-l">Logbook records</div></div>
        <div className={"stat " + (expiredAll ? "stat-alert" : "")}>
          <div className={"stat-n " + (expiredAll ? "stat-bad" : "")}>{expiredAll}<span className="stat-sub">+ {expiringAll} expiring</span></div>
          <div className="stat-l">Training expired</div>
        </div>
      </div>

      {(expiredAll > 0 || expiringAll > 0) && (
        <div className="credit-note"><AlertTriangle size={16} />
          <span><b>Training compliance alert:</b> {expiredAll > 0 && <>{expiredAll} training record{expiredAll !== 1 ? "s are" : " is"} <b>expired</b>. </>}
          {expiringAll > 0 && <>{expiringAll} will expire within 60 days.</>} Open the affected staff below to review.</span>
        </div>
      )}

      <div className="panel">
        <div className="panel-head"><span>Nature of experience — staff covering each task type</span><span className="count-tag">all 7 types required per person</span></div>
        <div className="chips">
          {coverage.map(t => (
            <div key={t.k} className={"chip " + (t.ok === rows.length && rows.length > 0 ? "chip-on" : "chip-off")} title={t.full}>
              <span className="chip-k">{t.label}</span><span className="chip-n">{t.ok}/{rows.length}</span>
            </div>
          ))}
        </div>
        <div className="panel-foot">Number of monitored staff with at least one record of each task type. The 6/24-month criterion is only satisfied when a person covers <b>all 7</b> types.</div>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? <div className="empty">No staff registered yet. Add users in User management.</div> : (
          <table className="tbl">
            <thead><tr>
              <th>Name</th><th>Staff ID</th><th>Position</th><th>Status</th>
              <th style={{ minWidth: 130 }}>Tasks</th><th>Days</th><th>Spread</th><th>Nature</th><th>Training</th><th>Readiness</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map(({ u, a, tr, alerts }) => (
                <tr key={u.email}>
                  <td><b>{u.name}</b><div className="sub-email">{u.email}</div></td>
                  <td className="mono">{u.staffId}</td>
                  <td>{u.position}{u.role === "admin" && <span className="role-badge role-admin" style={{ marginLeft: 6 }}><ShieldCheck size={11} /> Admin</span>}</td>
                  <td>{statusBadge(u.status)}</td>
                  <td>
                    <div className="mini-bar-label mono">{a.effTasks}/{TASKS_TARGET}</div>
                    <Bar pct={a.tasksPct} tone={a.tasksMet ? "green" : "blue"} />
                  </td>
                  <td className="mono">{a.fullDays}/{DAYS_TARGET}</td>
                  <td>{a.spreadOk ? <CheckCircle2 size={16} className="ic-ok" /> : <AlertTriangle size={16} className="ic-warn" />}</td>
                  <td>
                    <span className={"mono " + (a.natureOk ? "txt-ok" : "txt-warn")}>{a.typesCovered}/{TASK_TYPES.length}</span>
                    {!a.natureOk && a.missingTypes.length > 0 && <div className="sub-email">missing {a.missingTypes.join(", ")}</div>}
                  </td>
                  <td>
                    <span className="mono">{tr}</span>
                    {alerts.expired.length > 0 && <span className="tag tag-red" title={alerts.expired.map(t => t.course).join("\n")}>{alerts.expired.length} expired</span>}
                    {alerts.expiring.length > 0 && <span className="tag tag-amber" title={alerts.expiring.map(t => t.course).join("\n")}>{alerts.expiring.length} expiring</span>}
                  </td>
                  <td><StatusPill state={a.eligible ? "pass" : "caution"}>{a.eligible ? "Eligible" : "Pending"}</StatusPill></td>
                  <td className="admin-actions"><button className="btn btn-mini btn-mini-ghost" onClick={() => onView(u.email)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ==================== USER MANAGEMENT ==================== */
export function UserManagement({ users, onRegister, onUpdateUser, selfEmail }) {
  const [form, setForm] = useState({
    name: "", email: "", staffId: "", amelNo: "", position: "LAE", role: "staff",
    status: "active", password: "", usePrivilege: true,
    periodStart: addYears(todayISO(), -2), periodEnd: todayISO(),
  });
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [filter, setFilter] = useState("all");

  const register = async () => {
    setErr(""); setOk("");
    const email = form.email.trim().toLowerCase();
    if (!form.name.trim() || !form.staffId.trim()) { setErr("Name and Staff ID are required."); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setErr("Enter a valid email address."); return; }
    if (users.some(u => u.email === email)) { setErr("A user with this email already exists."); return; }
    if (form.password.length < 8) { setErr("Temporary password must be at least 8 characters."); return; }
    const salt = newSalt();
    const passHash = await hashPassword(form.password, salt);
    onRegister({
      email, name: form.name.trim(), staffId: form.staffId.trim(), amelNo: form.amelNo.trim(),
      position: form.role === "admin" ? ADMIN_POSITION : form.position,
      role: form.role, status: form.status, usePrivilege: form.usePrivilege,
      periodStart: form.periodStart, periodEnd: form.periodEnd,
      salt, passHash, mustChangePassword: true, createdAt: todayISO(),
    });
    setOk(`${form.name.trim()} registered. Give them the temporary password — they will be asked to change it at first sign-in.`);
    setForm(f => ({ ...f, name: "", email: "", staffId: "", amelNo: "", password: "" }));
  };

  const resetPassword = async (u) => {
    const pw = window.prompt(`New temporary password for ${u.name} (min 8 characters):`);
    if (!pw) return;
    if (pw.length < 8) { window.alert("Password must be at least 8 characters."); return; }
    const salt = newSalt();
    const passHash = await hashPassword(pw, salt);
    onUpdateUser(u.email, { salt, passHash, mustChangePassword: true });
    window.alert(`Password reset. ${u.name} must change it at next sign-in.`);
  };

  const setStatus = (u, status) => {
    if (u.email === selfEmail) { window.alert("You cannot change your own account status."); return; }
    if (status === "archived" && !window.confirm(`Archive ${u.name}? They will no longer be able to sign in. Their records are kept for audit.`)) return;
    onUpdateUser(u.email, { status });
  };
  const setRole = (u, role) => {
    if (u.email === selfEmail) { window.alert("You cannot change your own role."); return; }
    onUpdateUser(u.email, role === "admin" ? { role, position: ADMIN_POSITION } : { role });
  };

  const shown = users.filter(u => filter === "all" ? true : u.status === filter);

  return (
    <div className="page">
      <header className="page-head">
        <div><div className="eyebrow">Administration</div><h2 className="page-title">User management</h2></div>
      </header>
      <div className="credit-note"><ShieldCheck size={16} /> Only administrators (<b>{ADMIN_POSITION}</b>) can register accounts. Staff cannot self-register. Statuses: <b>Active</b> can sign in · <b>Inactive</b> is temporarily blocked · <b>Archived</b> is permanently retired but kept for audit.</div>

      <div className="panel form-panel">
        <div className="form-panel-title"><UserPlus size={15} style={{ verticalAlign: "-2px" }} /> Register a new user</div>
        <div className="form-grid">
          <Field label="Full name"><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Work email"><input className="input" type="email" placeholder="name@kmileair.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Staff ID"><input className="input" placeholder="KMA0175" value={form.staffId} onChange={e => setForm({ ...form, staffId: e.target.value })} /></Field>
          <Field label="AMEL No."><input className="input" value={form.amelNo} onChange={e => setForm({ ...form, amelNo: e.target.value })} /></Field>
          <Field label="Position">
            <select className="input" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} disabled={form.role === "admin"}>
              {POSITIONS.map(p => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Role" hint={form.role === "admin" ? ADMIN_POSITION : null}>
            <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="staff">Staff</option><option value="admin">Admin (Compliance Monitoring)</option>
            </select>
          </Field>
          <Field label="Temporary password" hint="min 8 chars">
            <div className="pw-wrap">
              <input className="input" type={showPw ? "text" : "password"} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              <button type="button" className="pw-eye" onClick={() => setShowPw(s => !s)}>{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </Field>
          <Field label="Account status">
            <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {USER_STATUSES.map(s => <option key={s.k} value={s.k}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Similar‑aircraft privilege">
            <select className="input" value={form.usePrivilege ? "yes" : "no"} onChange={e => setForm({ ...form, usePrivilege: e.target.value === "yes" })}>
              <option value="yes">Using privilege</option><option value="no">Not using</option>
            </select>
          </Field>
          <Field label="Experience period — start"><input className="input" type="date" value={form.periodStart} onChange={e => setForm({ ...form, periodStart: e.target.value })} /></Field>
          <Field label="Experience period — end"><input className="input" type="date" value={form.periodEnd} onChange={e => setForm({ ...form, periodEnd: e.target.value })} /></Field>
        </div>
        {err && <div className="form-err">{err}</div>}
        {ok && <div className="form-ok">{ok}</div>}
        <div className="form-actions"><button className="btn btn-primary" onClick={register}><UserPlus size={15} /> Register user</button></div>
      </div>

      <div className="table-tools">
        <div className="chips">
          {[["all", "All"], ...USER_STATUSES.map(s => [s.k, s.label])].map(([k, l]) => (
            <button key={k} className={"toggle " + (filter === k ? "toggle-on" : "")} onClick={() => setFilter(k)}>{l} ({k === "all" ? users.length : users.filter(u => u.status === k).length})</button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>Name</th><th>Staff ID</th><th>Position</th><th>Role</th><th>Status</th><th>Registered</th><th></th></tr></thead>
          <tbody>
            {shown.map(u => (
              <tr key={u.email} className={u.status === "archived" ? "row-archived" : ""}>
                <td><b>{u.name}</b><div className="sub-email">{u.email}</div></td>
                <td className="mono">{u.staffId}</td>
                <td>{u.position}</td>
                <td>{u.role === "admin"
                  ? <span className="role-badge role-admin"><ShieldCheck size={12} /> Admin</span>
                  : <span className="role-badge">Staff</span>}</td>
                <td>
                  {u.email === selfEmail ? statusBadge(u.status) : (
                    <select className="mini-select" value={u.status} onChange={e => setStatus(u, e.target.value)}>
                      {USER_STATUSES.map(s => <option key={s.k} value={s.k}>{s.label}</option>)}
                    </select>
                  )}
                </td>
                <td className="mono nowrap">{u.createdAt ? fmtDate(u.createdAt) : "—"}</td>
                <td className="admin-actions">
                  {u.email === selfEmail ? <span className="you-tag">You</span> : (
                    <>
                      {u.role === "admin"
                        ? <button className="btn btn-mini btn-mini-ghost" onClick={() => setRole(u, "staff")}>Revoke admin</button>
                        : <button className="btn btn-mini" onClick={() => setRole(u, "admin")}>Make admin</button>}
                      <button className="btn btn-mini btn-mini-ghost" title="Reset password" onClick={() => resetPassword(u)}><KeyRound size={13} /> Reset</button>
                      {u.status !== "archived" && <button className="btn btn-mini btn-mini-ghost" title="Archive" onClick={() => setStatus(u, "archived")}><Archive size={13} /></button>}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==================== LOGBOOK FORM TEMPLATE ==================== */
export function FormTemplateAdmin({ template, onSave, onReset }) {
  const tpl = mergeTemplate(template);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    if (!/\.docx$/i.test(file.name)) { setErr("Please choose a Word .docx file (not .doc or .pdf)."); setOk(""); return; }
    setBusy(true); setErr(""); setOk("");
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const { template: parsed, parsed: info } = await parseFormDocx(e.target.result);
        onSave(parsed);
        setOk(`Form template updated from "${file.name}" — matched ${info.columnsMatched} column labels${info.legendLines.length ? `, ${info.legendLines.length} legend lines` : ""}. The logbook table and PDF export now use this layout.`);
        setBusy(false);
      } catch (er) { setErr(er.message || "Could not read this Word form."); setBusy(false); }
    };
    reader.onerror = () => { setErr("Could not read the file."); setBusy(false); };
    reader.readAsArrayBuffer(file);
  };

  const isCustom = !!template;
  const colRows = [
    ["date", "location", "acType", "acReg"], ["rating", "privilege", "ata", "details"],
    ["duration", "ref", "remark", "taskType"],
  ];

  return (
    <div className="page">
      <header className="page-head">
        <div><div className="eyebrow">Administration</div><h2 className="page-title">Logbook form template</h2></div>
        {isCustom && <button className="btn btn-ghost" onClick={() => { onReset(); setOk("Reverted to the built-in K-Mile form."); setErr(""); }}><RotateCcw size={16} /> Reset to default</button>}
      </header>
      <div className="credit-note"><Info size={16} /> If the official logbook form is revised, upload the new Word (<b>.docx</b>) form here. The app reads its <b>title, column headers and legend</b> and applies them to the on-screen logbook table and the exported PDF. The 7 task types and 4 activity types stay fixed — only labels/wording change.</div>

      <div className="panel form-panel">
        <div className="form-panel-title"><FileText size={15} style={{ verticalAlign: "-2px" }} /> Upload a revised form (.docx)</div>
        <div className={"dropzone " + (drag ? "dropzone-active" : "")}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => fileRef.current?.click()}>
          <UploadCloud size={34} strokeWidth={1.6} />
          <div className="dz-title">{busy ? "Reading form…" : "Drop the revised logbook .docx here"}</div>
          <div className="dz-sub">or click to browse</div>
          <input ref={fileRef} type="file" accept=".docx" hidden onChange={e => handleFile(e.target.files[0])} />
        </div>
        {err && <div className="form-err" style={{ marginTop: 14 }}>{err}</div>}
        {ok && <div className="form-ok" style={{ marginTop: 14 }}>{ok}</div>}
      </div>

      <div className="panel">
        <div className="panel-head"><span>Active form — {isCustom ? "custom (uploaded)" : "built-in default"}</span><span className="count-tag">{tpl.title}</span></div>
        <table className="doc-tbl" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <tbody>
            {colRows.map((r, i) => (
              <tr key={i}>
                {r.map(k => (
                  <td key={k} style={{ border: "1px solid var(--line)", padding: "8px 10px" }}>
                    <div className="sub-email">{k}</div><b>{tpl.columns[k]}</b>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="type-mini" style={{ marginTop: 12 }}>
          {TT.map(t => <span key={t.k} className="type-mini-item"><b>{tpl.taskCols[t.k] || t.label}</b></span>)}
          {["TRAINING", "PERFORM", "SUPERVISE", "CRS"].map(k => <span key={k} className="type-mini-item tag-blue" style={{ color: "var(--blue)" }}><b>{tpl.activityCols[k] || k}</b></span>)}
        </div>
        <div className="panel-foot"><b>Legend:</b> {tpl.legend.join("  ·  ")}</div>
      </div>
    </div>
  );
}

export const ADMIN_TABS = [
  { k: "admin-dash", label: "Monitoring dashboard", icon: LayoutDashboard },
  { k: "admin-users", label: "User management", icon: Users },
];
