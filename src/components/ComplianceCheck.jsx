import { useState, useMemo, useRef } from "react";
import {
  UploadCloud, FileText, AlertTriangle, CheckCircle2, XCircle, Clock, Download,
  ChevronDown, ChevronRight, Info, Users, Save,
} from "lucide-react";
import { Field, StatusPill } from "./ui.jsx";
import { parseTrainingPdf } from "../lib/pdfImport.js";
import { exportComplianceReportPdf } from "../lib/pdfExport.js";
import { assessCompliance, brushUpCheck } from "../lib/complianceAssess.js";
import { versionForDate, normPosition, DEFAULT_POSITION_ROLE_MAP, TPM_ROLES, GMM_POSITIONS } from "../lib/requirements.js";
import { todayISO, fmtDate } from "../lib/helpers.js";
import { AIRCRAFT_TYPES } from "../lib/constants.js";

const STATUS_META = {
  COMPLIANT: { icon: CheckCircle2, cls: "ic-ok", label: "Compliant" },
  DUE_SOON: { icon: Clock, cls: "ic-warn", label: "Due soon" },
  EXPIRED: { icon: XCircle, cls: "ic-bad", label: "Expired" },
  MISSING: { icon: AlertTriangle, cls: "ic-bad", label: "Missing" },
};

function resolveRoles(position, positionRoleMap) {
  const key = normPosition(position);
  return positionRoleMap?.[key] || DEFAULT_POSITION_ROLE_MAP[key] || null;
}

function Dropzone({ busy, onFiles }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef(null);
  return (
    <div className={"dropzone " + (drag ? "dropzone-active" : "")}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); onFiles([...e.dataTransfer.files]); }}
      onClick={() => ref.current?.click()}>
      <UploadCloud size={34} strokeWidth={1.6} />
      <div className="dz-title">{busy ? "Reading…" : "Drop PERSONAL TRAINING RECORDS PDF(s) here"}</div>
      <div className="dz-sub">one or many at once — or click to browse</div>
      <input ref={ref} type="file" accept=".pdf" multiple hidden onChange={e => onFiles([...e.target.files])} />
    </div>
  );
}

function PersonCard({ item, onChange, onExport, matrixVersion }) {
  const [openDetail, setOpenDetail] = useState(false);
  const { meta, roles, authorizedTypes, auditDate, result, unmatched } = item;

  const overallBad = result.overall !== "COMPLIANT";
  return (
    <div className="panel" style={{ marginBottom: 14 }}>
      <div className="panel-head">
        <span><b>{meta.name || "Unnamed"}</b> {meta.staffId && <span className="mono sub-email">({meta.staffId})</span>}</span>
        <StatusPill state={overallBad ? "caution" : "pass"}>{overallBad ? "Action required" : "Compliant"}</StatusPill>
      </div>
      <div className="form-grid" style={{ marginBottom: 10 }}>
        <Field label="Position">{meta.position || "—"}</Field>
        <Field label="Audit date">
          <input className="input" type="date" value={auditDate} onChange={e => onChange({ auditDate: e.target.value })} />
        </Field>
        <Field label="TPM role" wide>
          <select className="input" value={roles?.tpm?.[0] || ""} onChange={e => onChange({ roles: { ...roles, tpm: e.target.value ? [e.target.value] : [] } })}>
            <option value="">— none —</option>
            {TPM_ROLES.map(r => <option key={r.k} value={r.k}>{r.label}</option>)}
          </select>
        </Field>
        <Field label="GMM position" wide>
          <select className="input" value={roles?.gmm?.[0] || ""} onChange={e => onChange({ roles: { ...roles, gmm: e.target.value ? [e.target.value] : [] } })}>
            <option value="">— none —</option>
            {GMM_POSITIONS.map(r => <option key={r.k} value={r.k}>{r.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="check-block" style={{ marginBottom: 10 }}>
        <div className="check-col">
          <div className="check-title">Authorized aircraft types <em className="field-hint">inferred — confirm</em></div>
          <div className="check-row">
            {AIRCRAFT_TYPES.filter(t => t !== "Other").map(t => (
              <button key={t} type="button" className={"toggle " + (authorizedTypes.includes(t) ? "toggle-on" : "")}
                onClick={() => onChange({ authorizedTypes: authorizedTypes.includes(t) ? authorizedTypes.filter(x => x !== t) : [...authorizedTypes, t] })}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 10 }}>
        <div className="stat"><div className="stat-n stat-good">{result.counts.COMPLIANT}</div><div className="stat-l">Compliant</div></div>
        <div className="stat"><div className="stat-n">{result.counts.DUE_SOON}</div><div className="stat-l">Due soon</div></div>
        <div className={"stat " + (result.counts.EXPIRED ? "stat-alert" : "")}><div className={"stat-n " + (result.counts.EXPIRED ? "stat-bad" : "")}>{result.counts.EXPIRED}</div><div className="stat-l">Expired</div></div>
        <div className={"stat " + (result.counts.MISSING ? "stat-alert" : "")}><div className={"stat-n " + (result.counts.MISSING ? "stat-bad" : "")}>{result.counts.MISSING}</div><div className="stat-l">Missing</div></div>
      </div>

      {result.findings.some(f => f.status !== "COMPLIANT") && (
        <div className="table-wrap" style={{ marginBottom: 10 }}>
          <table className="tbl">
            <thead><tr><th>Requirement</th><th>Source</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>
              {result.findings.filter(f => f.status !== "COMPLIANT").map(f => {
                const M = STATUS_META[f.status];
                return (
                  <tr key={f.reqId}>
                    <td className="cell-details">{f.course}</td>
                    <td className="mono">{(f.sources || [f.source]).map(s => s.toUpperCase()).join("/")}</td>
                    <td className="mono nowrap">{f.dueDate ? fmtDate(f.dueDate) : "—"}</td>
                    <td><M.icon size={14} className={M.cls} style={{ verticalAlign: "-2px", marginRight: 4 }} />{M.label}{f.mismatch && <span className="tag tag-amber" style={{ marginLeft: 6 }}>expiry mismatch</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <button className="btn btn-ghost btn-mini" onClick={() => setOpenDetail(o => !o)}>
        {openDetail ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Full requirement table ({result.findings.length})
      </button>
      {openDetail && (
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table className="tbl">
            <thead><tr><th>Requirement</th><th>Source</th><th>Type</th><th>Completed</th><th>Due</th><th>Status</th><th>Remarks</th></tr></thead>
            <tbody>
              {result.findings.map(f => (
                <tr key={f.reqId}>
                  <td className="cell-details">{f.course}</td>
                  <td className="mono">{(f.sources || [f.source]).map(s => s.toUpperCase()).join("/")}</td>
                  <td className="mono">{f.type === "I" ? "Initial" : `R(${f.years})`}</td>
                  <td className="mono nowrap">{f.completed ? fmtDate(f.completed) : "—"}</td>
                  <td className="mono nowrap">{f.dueDate ? fmtDate(f.dueDate) : "—"}</td>
                  <td><StatusPill state={f.status === "COMPLIANT" ? "pass" : f.status === "DUE_SOON" ? "caution" : "fail"}>{STATUS_META[f.status].label}</StatusPill></td>
                  <td className="sub-email">{[f.mismatch && `expiry on record: ${fmtDate(f.recordedExpiry)}`, f.recordedNeverButRecurrent && "recorded NEVER, matrix requires recurrent", f.note].filter(Boolean).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {unmatched.length > 0 && (
        <div className="dz-hint" style={{ marginTop: 10 }}>
          <Info size={14} /> <span>{unmatched.length} training record{unmatched.length !== 1 ? "s" : ""} could not be matched to a requirement: {unmatched.slice(0, 5).map(r => r.course).join("; ")}{unmatched.length > 5 ? "…" : ""}</span>
        </div>
      )}

      <div className="form-actions" style={{ marginTop: 12 }}>
        <button className="btn btn-ghost" onClick={() => onExport(item)}><Download size={15} /> Export PDF report</button>
      </div>
    </div>
  );
}

export default function ComplianceCheck({ users, training, logbook, matrixVersions, positionRoleMap, isAdmin, currentUser, onSaveTraining }) {
  const [items, setItems] = useState([]); // one per dropped/selected person
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pickedEmail, setPickedEmail] = useState("");
  const [useLatestVersion, setUseLatestVersion] = useState(false);

  const buildItem = (records, meta, existingUser) => {
    const auditDate = todayISO();
    const version = versionForDate(matrixVersions, auditDate, useLatestVersion);
    const matrix = version?.matrix;
    const roleGuess = resolveRoles(meta.position, positionRoleMap);
    const authorizedTypes = [...new Set(records.map(r => r.acType).filter(t => t && t !== "Other"))];
    const roles = { tpm: roleGuess?.tpm || (existingUser?.requirementRoles?.tpmRoles) || [], gmm: roleGuess?.gmm || (existingUser?.requirementRoles?.gmmPositions) || [] };
    const person = { tpmRoles: roles.tpm, gmmPositions: roles.gmm, authorizedTypes, conditions: existingUser?.requirementConditions || {} };
    const result = matrix ? assessCompliance({ trainingRecords: records, matrix, person, auditDate }) : null;
    return { id: meta.staffId || meta.email || Math.random().toString(36), meta, records, roles, authorizedTypes, auditDate, matrixVersion: version, result, unmatched: result?.unmappedRecords || [], existingUser: existingUser || null };
  };

  const recompute = (item) => {
    if (!item.result) return item;
    const version = versionForDate(matrixVersions, item.auditDate, useLatestVersion);
    const person = { tpmRoles: item.roles.tpm, gmmPositions: item.roles.gmm, authorizedTypes: item.authorizedTypes, conditions: item.existingUser?.requirementConditions || {} };
    const result = assessCompliance({ trainingRecords: item.records, matrix: version.matrix, person, auditDate: item.auditDate });
    return { ...item, matrixVersion: version, result, unmatched: result.unmappedRecords };
  };

  const handleFiles = async (files) => {
    setErr(""); setBusy(true);
    const next = [];
    for (const file of files) {
      if (!/\.pdf$/i.test(file.name)) continue;
      try {
        const buf = await file.arrayBuffer();
        const { records, meta } = await parseTrainingPdf(buf);
        const existingUser = users.find(u => (meta.staffId && u.staffId === meta.staffId) || (meta.email && u.email === meta.email) || (meta.name && u.name?.toLowerCase() === meta.name.toLowerCase()));
        next.push(buildItem(records, meta, existingUser));
      } catch (e) { setErr(`${file.name}: ${e.message || "could not read this PDF"}`); }
    }
    setItems(prev => [...next, ...prev]);
    setBusy(false);
  };

  const pickExisting = () => {
    const u = users.find(x => x.email === pickedEmail);
    if (!u) return;
    const records = training[u.email] || [];
    setItems(prev => [buildItem(records, { name: u.name, staffId: u.staffId, position: u.position, email: u.email }, u), ...prev]);
    setPickedEmail("");
  };

  const updateItem = (idx, patch) => setItems(prev => prev.map((it, i) => i === idx ? recompute({ ...it, ...patch }) : it));

  const doExport = (item) => {
    exportComplianceReportPdf({
      person: { name: item.meta.name, staffId: item.meta.staffId, position: item.meta.position, tpmRoles: item.roles.tpm, gmmPositions: item.roles.gmm, authorizedTypes: item.authorizedTypes },
      result: item.result, matrixVersion: item.matrixVersion, unmappedRecords: item.unmatched,
    });
  };

  const registeredNotSelf = isAdmin ? users.filter(u => u.role !== "admin") : [];

  return (
    <div className="page">
      <header className="page-head">
        <div><div className="eyebrow">Compliance monitoring</div><h2 className="page-title">Compliance check</h2></div>
      </header>

      {matrixVersions.length === 0 && (
        <div className="import-error"><AlertTriangle size={20} /><span>No requirement matrix has been loaded yet. Ask an administrator to set up the GMM/TPM matrix in Requirement matrix.</span></div>
      )}

      <Dropzone busy={busy} onFiles={handleFiles} />
      <div className="dz-hint"><Info size={14} /> <span>Uses the K-Mile <b>TRAINING RECORD</b> layout. Each dropped file is checked against the active GMM/TPM requirement matrix and matched to a registered staff member by ID, email, or name where possible.</span></div>
      {err && <div className="form-err" style={{ marginTop: 10 }}>{err}</div>}

      {isAdmin && (
        <div className="panel form-panel" style={{ marginTop: 14 }}>
          <div className="form-panel-title"><Users size={15} style={{ verticalAlign: "-2px" }} /> Or check an already-registered staff member</div>
          <div className="form-grid">
            <Field label="Staff" wide>
              <select className="input" value={pickedEmail} onChange={e => setPickedEmail(e.target.value)}>
                <option value="">— choose —</option>
                {registeredNotSelf.map(u => <option key={u.email} value={u.email}>{u.name} ({u.staffId})</option>)}
              </select>
            </Field>
          </div>
          <div className="form-actions"><button className="btn btn-primary" disabled={!pickedEmail} onClick={pickExisting}>Check</button></div>
        </div>
      )}

      {items.length > 1 && (
        <div className="dz-hint" style={{ marginTop: 14 }}><Info size={14} /> {items.length} people checked in this batch — see each card below, or export a report for each.</div>
      )}

      <div style={{ marginTop: 16 }}>
        {items.map((item, idx) => item.result ? (
          <PersonCard key={item.id + idx} item={item} matrixVersion={item.matrixVersion} onExport={doExport}
            onChange={(patch) => updateItem(idx, patch)} />
        ) : (
          <div key={item.id + idx} className="import-error"><AlertTriangle size={18} /><span>No matrix loaded — cannot evaluate {item.meta.name}.</span></div>
        ))}
      </div>
    </div>
  );
}
