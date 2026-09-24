import { useState, useRef, useMemo } from "react";
import {
  UploadCloud, FileText, FileSpreadsheet, Download, AlertTriangle, CheckCircle2,
  Info, History, RotateCcw, Users,
} from "lucide-react";
import { Field } from "./ui.jsx";
import { parseRequirementPdf, exportMatrixXlsx, parseMatrixXlsx, diffMatrixSource, sha256Hex } from "../lib/requirementImport.js";
import { seedMatrix, newMatrixVersion, TPM_ROLES, GMM_POSITIONS, DEFAULT_POSITION_ROLE_MAP, normPosition } from "../lib/requirements.js";
import { assessCompliance } from "../lib/complianceAssess.js";
import { todayISO, fmtDate, uid } from "../lib/helpers.js";

function Dropzone({ busy, hint, onFile }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef(null);
  return (
    <div className={"dropzone " + (drag ? "dropzone-active" : "")}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
      onClick={() => ref.current?.click()}>
      <UploadCloud size={34} strokeWidth={1.6} />
      <div className="dz-title">{busy ? "Reading…" : hint}</div>
      <div className="dz-sub">or click to browse</div>
      <input ref={ref} type="file" accept=".pdf,.xlsx,.xls" hidden onChange={e => onFile(e.target.files[0])} />
    </div>
  );
}

function cellsFromParsedRows(parsedRows, existingRows) {
  // build full requirement rows: reuse the existing row's id when we can
  // match it (by id from Excel, or by course-name similarity from PDF),
  // otherwise mint a new id — the review screen shows these as "added"
  return parsedRows.map(r => {
    let id = r.id;
    if (!id) {
      const match = existingRows.find(e => e.course.toLowerCase().slice(0, 20) === r.course.toLowerCase().slice(0, 20));
      id = match?.id || `custom.${uid()}`;
    }
    const cells = {};
    for (const [k, v] of Object.entries(r.cells || {})) cells[k] = { type: v.type, years: v.years, footnote: v.footnote };
    return { id, course: r.course, cells, note: r.note };
  });
}

export default function RequirementMatrixAdmin({ matrixVersions, onApplyVersion, positionRoleMap, onSavePositionRoleMap, users, training }) {
  const active = matrixVersions[matrixVersions.length - 1] || null;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [stage, setStage] = useState("pick"); // pick | review
  const [pending, setPending] = useState(null); // { source, meta, rows, warnings, diff, confirmedLow }
  const [showHistory, setShowHistory] = useState(false);

  const ensureSeed = () => {
    if (matrixVersions.length) return;
    const m = seedMatrix();
    onApplyVersion(newMatrixVersion(m, { appliedAt: todayISO(), appliedBy: "system", note: "Seeded default matrix" }));
  };

  const handleFile = async (file) => {
    if (!file) return;
    setErr(""); setBusy(true);
    try {
      const isXlsx = /\.(xlsx|xls)$/i.test(file.name);
      const buf = await file.arrayBuffer();
      if (isXlsx) {
        const parsed = parseMatrixXlsx(buf);
        for (const source of ["tpm", "gmm"]) {
          if (!parsed[source]) continue;
          const existingRows = active?.matrix?.[source]?.rows || [];
          const rows = cellsFromParsedRows(parsed[source].rows, existingRows);
          const diff = diffMatrixSource(source, existingRows, rows);
          setPending({ source, sha256: null, meta: parsed[source], rows, warnings: [], diff, confirmedLow: false });
          setStage("review");
          break; // handle one source per drop; drop the other sheet separately if both changed
        }
      } else {
        const parsed = await parseRequirementPdf(buf);
        const existingRows = active?.matrix?.[parsed.source]?.rows || [];
        const rows = cellsFromParsedRows(parsed.rows.map(r => ({ course: r.course, cells: r.cells })), existingRows);
        const diff = diffMatrixSource(parsed.source, existingRows, rows);
        const dup = matrixVersions.some(v => v.sourceFiles?.some(f => f.sha256 === parsed.sha256));
        if (dup) { setErr("No changes — this exact file has already been applied."); setBusy(false); return; }
        setPending({ source: parsed.source, sha256: parsed.sha256, fileName: file.name, meta: parsed, rows, warnings: parsed.warnings, diff, confirmedLow: false });
        setStage("review");
      }
    } catch (e) { setErr(e.message || "Could not read this file."); }
    setBusy(false);
  };

  const impactPreview = useMemo(() => {
    if (!pending || !active) return null;
    const nextMatrix = { ...active.matrix, [pending.source]: { ...active.matrix[pending.source], rows: pending.rows } };
    let changed = 0;
    const changedPeople = [];
    for (const u of users.filter(x => x.role !== "admin" && x.status !== "archived")) {
      const roles = { tpmRoles: u.requirementRoles?.tpmRoles || [], gmmPositions: u.requirementRoles?.gmmPositions || [] };
      if (!roles.tpmRoles.length && !roles.gmmPositions.length) continue;
      const person = { ...roles, authorizedTypes: u.requirementAuthorizedTypes || [], conditions: u.requirementConditions || {} };
      const before = assessCompliance({ trainingRecords: training[u.email] || [], matrix: active.matrix, person, auditDate: todayISO() });
      const after = assessCompliance({ trainingRecords: training[u.email] || [], matrix: nextMatrix, person, auditDate: todayISO() });
      if (before.overall !== after.overall || JSON.stringify(before.counts) !== JSON.stringify(after.counts)) { changed++; changedPeople.push(u.name); }
    }
    return { changed, changedPeople };
  }, [pending, active, users, training]);

  const lowConfidenceCount = pending?.diff.filter(d => d.lowConfidence).length || 0;

  const apply = () => {
    const baseMatrix = active?.matrix || {};
    const nextSource = {
      ...(baseMatrix[pending.source] || {}), rows: pending.rows,
      docRef: baseMatrix[pending.source]?.docRef || (pending.source === "tpm" ? "FSDS4/MAN9-002" : "FSDS4/MAN1-001"),
      issue: pending.meta.issue || baseMatrix[pending.source]?.issue,
      revision: pending.meta.revision || baseMatrix[pending.source]?.revision,
      date: pending.meta.date || baseMatrix[pending.source]?.date,
    };
    const nextMatrix = { ...baseMatrix, [pending.source]: nextSource };
    const version = newMatrixVersion(nextMatrix, {
      appliedAt: todayISO(), appliedBy: "admin",
      sourceFiles: [{ name: pending.fileName || "matrix.xlsx", sha256: pending.sha256, matrix: pending.source }],
    });
    onApplyVersion(version);
    setStage("pick"); setPending(null);
  };

  const downloadExcel = () => {
    if (!active) return;
    const blob = exportMatrixXlsx(active.matrix);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "kmile_requirement_matrix.xlsx"; a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="page">
      <header className="page-head">
        <div><div className="eyebrow">Administration</div><h2 className="page-title">Requirement matrix</h2></div>
        {matrixVersions.length > 0 && <button className="btn btn-ghost" onClick={downloadExcel}><FileSpreadsheet size={16} /> Download current matrix as Excel</button>}
      </header>

      {!active && (
        <div className="credit-note"><Info size={16} /> No matrix loaded yet. <button className="btn btn-mini" onClick={ensureSeed} style={{ marginLeft: 8 }}>Load the built-in default (TPM Issue 1/Rev 02, GMM Issue 7/Rev 00)</button></div>
      )}

      {active && (
        <div className="panel">
          <div className="panel-head"><span>Active matrix</span><span className="count-tag">applied {fmtDate(active.appliedAt)}</span></div>
          <div className="grid-4">
            <div className="stat"><div className="stat-n" style={{ fontSize: 18 }}>{active.matrix.tpm?.issue}/{active.matrix.tpm?.revision}</div><div className="stat-l">TPM issue/rev</div></div>
            <div className="stat"><div className="stat-n" style={{ fontSize: 14 }}>{active.matrix.tpm?.date}</div><div className="stat-l">TPM date</div></div>
            <div className="stat"><div className="stat-n" style={{ fontSize: 18 }}>{active.matrix.gmm?.issue}/{active.matrix.gmm?.revision}</div><div className="stat-l">GMM issue/rev</div></div>
            <div className="stat"><div className="stat-n" style={{ fontSize: 14 }}>{active.matrix.gmm?.date}</div><div className="stat-l">GMM date</div></div>
          </div>
          <div className="panel-foot">{active.matrix.tpm?.rows?.length || 0} TPM requirement rows · {active.matrix.gmm?.rows?.length || 0} GMM requirement rows</div>
        </div>
      )}

      {stage === "pick" && (
        <>
          <Dropzone busy={busy} hint="Drop a revised GMM or TPM section PDF, or the matrix .xlsx" onFile={handleFile} />
          <div className="dz-hint"><Info size={14} /> <span><b>PDF</b> — best-effort reading of the rotated-header matrix; every change is shown for review before anything is applied, and cells the parser wasn't sure about are flagged. <b>Excel</b> — the deterministic round-trip: download the current matrix, edit it, and drop it back.</span></div>
          {err && <div className="form-err" style={{ marginTop: 10 }}>{err}</div>}
        </>
      )}

      {stage === "review" && pending && (
        <div className="panel" style={{ marginTop: 14 }}>
          <div className="panel-head"><span>Review changes — {pending.source.toUpperCase()}</span><span className="count-tag">{pending.diff.length} row{pending.diff.length !== 1 ? "s" : ""} affected</span></div>
          {pending.warnings.length > 0 && (
            <div className="credit-note" style={{ marginBottom: 10 }}><AlertTriangle size={16} /> <span>{pending.warnings.join(" ")}</span></div>
          )}
          {lowConfidenceCount > 0 && (
            <div className="credit-note"><AlertTriangle size={16} /> <span><b>{lowConfidenceCount}</b> row{lowConfidenceCount !== 1 ? "s" : ""} contain low-confidence cells (columns the parser wasn't sure about) — check these against the PDF before applying.</span></div>
          )}
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Change</th><th>Requirement</th><th>Cell changes</th></tr></thead>
              <tbody>
                {pending.diff.map((d, i) => (
                  <tr key={i} className={d.lowConfidence ? "row-archived" : ""}>
                    <td><span className={"tag " + (d.kind === "added" ? "tag-blue" : d.kind === "removed" ? "tag-red" : "tag-amber")}>{d.kind}</span></td>
                    <td className="cell-details">{d.course}{d.lowConfidence && <span className="tag tag-amber" style={{ marginLeft: 6 }}>verify</span>}</td>
                    <td>{d.cellChanges.length === 0 ? <span className="sub-email">no cell changes</span> : d.cellChanges.map(c => (
                      <div key={c.role} className="sub-email"><b>{c.roleLabel}</b>: {c.from} → {c.to}</div>
                    ))}</td>
                  </tr>
                ))}
                {pending.diff.length === 0 && <tr><td colSpan={3} className="empty-sm">No differences from the active matrix.</td></tr>}
              </tbody>
            </table>
          </div>

          {impactPreview && (
            <div className="dz-hint" style={{ marginTop: 10 }}>
              <Users size={14} /> <span>{impactPreview.changed} registered pers{impactPreview.changed === 1 ? "on" : "ons"} would change compliance status{impactPreview.changed > 0 ? `: ${impactPreview.changedPeople.slice(0, 8).join(", ")}${impactPreview.changedPeople.length > 8 ? "…" : ""}` : ""}.</span>
            </div>
          )}

          {lowConfidenceCount > 0 && (
            <label className="checkline" style={{ marginTop: 12 }}>
              <input type="checkbox" checked={pending.confirmedLow} onChange={e => setPending(p => ({ ...p, confirmedLow: e.target.checked }))} />
              <span>I've checked the flagged low-confidence rows against the source document and confirmed the values above.</span>
            </label>
          )}

          <div className="form-actions" style={{ marginTop: 14 }}>
            <button className="btn btn-ghost" onClick={() => { setStage("pick"); setPending(null); setErr(""); }}>Cancel</button>
            <button className="btn btn-primary" disabled={lowConfidenceCount > 0 && !pending.confirmedLow} onClick={apply}>
              <CheckCircle2 size={15} /> Apply {pending.diff.length} change{pending.diff.length !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      )}

      <div className="panel" style={{ marginTop: 14 }}>
        <button className="btn btn-ghost btn-mini" onClick={() => setShowHistory(s => !s)}><History size={14} /> {showHistory ? "Hide" : "Show"} version history ({matrixVersions.length})</button>
        {showHistory && (
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table className="tbl">
              <thead><tr><th>Applied</th><th>TPM</th><th>GMM</th><th>Source file</th><th></th></tr></thead>
              <tbody>
                {[...matrixVersions].reverse().map(v => (
                  <tr key={v.id}>
                    <td className="mono nowrap">{fmtDate(v.appliedAt)}</td>
                    <td className="mono">{v.matrix.tpm?.issue}/{v.matrix.tpm?.revision}</td>
                    <td className="mono">{v.matrix.gmm?.issue}/{v.matrix.gmm?.revision}</td>
                    <td className="sub-email">{v.sourceFiles?.map(f => f.name).join(", ") || v.note || "—"}</td>
                    <td>{v.id !== active?.id && <button className="btn btn-mini btn-mini-ghost" onClick={() => onApplyVersion(newMatrixVersion(v.matrix, { appliedAt: todayISO(), appliedBy: "admin", note: `Reverted to version applied ${fmtDate(v.appliedAt)}` }))}><RotateCcw size={12} /> Revert to this</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PositionRoleMapAdmin positionRoleMap={positionRoleMap} onSave={onSavePositionRoleMap} />
    </div>
  );
}

function PositionRoleMapAdmin({ positionRoleMap, onSave }) {
  const [open, setOpen] = useState(false);
  const merged = { ...DEFAULT_POSITION_ROLE_MAP, ...positionRoleMap };
  const [draft, setDraft] = useState(merged);
  const [newPos, setNewPos] = useState("");

  const save = () => onSave(draft);
  const setRole = (pos, kind, val) => setDraft(d => ({ ...d, [pos]: { ...d[pos], [kind]: val ? [val] : [] } }));
  const addPosition = () => { const k = normPosition(newPos); if (!k || draft[k]) return; setDraft(d => ({ ...d, [k]: { tpm: [], gmm: [] } })); setNewPos(""); };

  return (
    <div className="panel" style={{ marginTop: 14 }}>
      <button className="btn btn-ghost btn-mini" onClick={() => setOpen(o => !o)}><FileText size={14} /> {open ? "Hide" : "Show"} position → role mapping</button>
      {open && (
        <>
          <div className="dz-hint" style={{ marginTop: 10 }}><Info size={14} /> Used to auto-assign a person's TPM/GMM role from the Position text found on a dropped training record or in User management. Unmapped positions are asked for inline instead of guessed.</div>
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table className="tbl">
              <thead><tr><th>Position</th><th>TPM role</th><th>GMM position</th></tr></thead>
              <tbody>
                {Object.keys(draft).map(pos => (
                  <tr key={pos}>
                    <td>{pos}</td>
                    <td><select className="mini-select" value={draft[pos]?.tpm?.[0] || ""} onChange={e => setRole(pos, "tpm", e.target.value)}>
                      <option value="">—</option>{TPM_ROLES.map(r => <option key={r.k} value={r.k}>{r.label}</option>)}
                    </select></td>
                    <td><select className="mini-select" value={draft[pos]?.gmm?.[0] || ""} onChange={e => setRole(pos, "gmm", e.target.value)}>
                      <option value="">—</option>{GMM_POSITIONS.map(r => <option key={r.k} value={r.k}>{r.label}</option>)}
                    </select></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-grid" style={{ marginTop: 10 }}>
            <Field label="Add a position"><input className="input" value={newPos} onChange={e => setNewPos(e.target.value)} placeholder="e.g. Store Officer" /></Field>
          </div>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={addPosition}>Add</button>
            <button className="btn btn-primary" onClick={save}>Save mapping</button>
          </div>
        </>
      )}
    </div>
  );
}
