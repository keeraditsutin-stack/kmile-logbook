import { useState, useMemo, useRef, useEffect } from "react";
import {
  X, Upload, UploadCloud, FileSpreadsheet, FileText, Info, AlertTriangle,
  CheckCircle2, Download, Edit3, KeyRound,
} from "lucide-react";
import { Field } from "./ui.jsx";
import { fmtDate, todayISO } from "../lib/helpers.js";
import { parseLogbookXlsx } from "../lib/excelImport.js";
import { parseTrainingPdf, parseLogbookPdf } from "../lib/pdfImport.js";
import { exportLogbookPdf } from "../lib/pdfExport.js";
import { hashPassword, newSalt, verifyPassword } from "../lib/storage.js";

/* ============ generic modal shell ============ */
function Modal({ title, icon: Icon, onClose, children, wide }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={"modal" + (wide ? " modal-wide" : "")} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-title">{Icon && <Icon size={18} />} {title}</div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Dropzone({ accept, hint, busy, onFile }) {
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);
  return (
    <>
      <div className={"dropzone " + (drag ? "dropzone-active" : "")}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
        onClick={() => fileRef.current?.click()}>
        <UploadCloud size={34} strokeWidth={1.6} />
        <div className="dz-title">{busy ? "Reading file…" : hint}</div>
        <div className="dz-sub">or click to browse</div>
        <input ref={fileRef} type="file" accept={accept} hidden onChange={e => onFile(e.target.files[0])} />
      </div>
    </>
  );
}

/* ============ LOGBOOK IMPORT (Excel + PDF) ============ */
export function ImportModal({ onClose, onImport, existingCount }) {
  const [stage, setStage] = useState("pick"); // pick | preview | error
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState("");
  const [mode, setMode] = useState("append");
  const [usePeriod, setUsePeriod] = useState(false);

  const handleFile = (file) => {
    if (!file) return;
    const isXlsx = /\.(xlsx|xlsm|xls)$/i.test(file.name);
    const isPdf = /\.pdf$/i.test(file.name);
    if (!isXlsx && !isPdf) { setMsg("Please choose an Excel file (.xlsx) or a PDF logbook (.pdf)."); setStage("error"); return; }
    setBusy(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = isXlsx
          ? parseLogbookXlsx(new Uint8Array(e.target.result))
          : await parseLogbookPdf(e.target.result);
        if (!parsed.records.length) { setMsg("No maintenance records with a valid date were found in this file."); setStage("error"); setBusy(false); return; }
        setData(parsed);
        setUsePeriod(!!(parsed.meta.periodStart && parsed.meta.periodEnd));
        setStage("preview"); setBusy(false);
      } catch (err) { setMsg(err.message || "Could not read this file."); setStage("error"); setBusy(false); }
    };
    reader.onerror = () => { setMsg("Could not read the file."); setStage("error"); setBusy(false); };
    reader.readAsArrayBuffer(file);
  };

  const stats = useMemo(() => {
    if (!data) return null;
    const dates = data.records.map(r => r.date).sort();
    const types = {}; data.records.forEach(r => types[r.acType] = (types[r.acType] || 0) + 1);
    return { count: data.records.length, min: dates[0], max: dates[dates.length - 1], types };
  }, [data]);

  const doImport = () => {
    onImport(data.records, mode, usePeriod ? { start: data.meta.periodStart, end: data.meta.periodEnd } : null);
    onClose();
  };

  return (
    <Modal title="Import logbook (Excel or PDF)" icon={FileSpreadsheet} onClose={onClose}>
      {stage === "pick" && (
        <div className="modal-body">
          <Dropzone accept=".xlsx,.xlsm,.xls,.pdf" busy={busy} hint="Drop your logbook .xlsx or .pdf here" onFile={handleFile} />
          <div className="dz-hint"><Info size={14} /> <span><b>Excel</b> — the standard K-Mile logbook template (row with <b>DATE, LOCATION, A/C TYPE…</b> headers and FOT / SGH / R/I task columns).<br /><b>PDF</b> — a logbook PDF in the K-Mile layout, e.g. one exported from this app. Check marks (√) are detected per task-type column.</span></div>
        </div>
      )}
      {stage === "error" && (
        <div className="modal-body">
          <div className="import-error"><AlertTriangle size={20} /><span>{msg}</span></div>
          <div className="form-actions"><button className="btn btn-primary" onClick={() => setStage("pick")}>Try another file</button></div>
        </div>
      )}
      {stage === "preview" && stats && (
        <div className="modal-body">
          <div className="import-summary">
            <div className="is-big"><CheckCircle2 size={20} /> {stats.count} record{stats.count !== 1 ? "s" : ""} ready to import</div>
            <div className="is-meta">
              <span>Date range: <b className="mono">{fmtDate(stats.min)} → {fmtDate(stats.max)}</b></span>
              {data.sheetsUsed > 1 && <span>Sheets read: <b>{data.sheetsUsed}</b></span>}
              {data.meta.name && <span>Logbook of: <b>{data.meta.name}</b></span>}
            </div>
            <div className="type-mini">{Object.entries(stats.types).map(([t, n]) => <span key={t} className="type-mini-item"><b className="mono">{t}</b> {n}</span>)}</div>
          </div>
          <div className="import-opts">
            <div className="opt-title">Add these records to the logbook</div>
            <label className={"radio " + (mode === "append" ? "radio-on" : "")}>
              <input type="radio" checked={mode === "append"} onChange={() => setMode("append")} />
              <span><b>Append</b> — keep the {existingCount} existing record{existingCount !== 1 ? "s" : ""} and add the new ones</span>
            </label>
            <label className={"radio " + (mode === "replace" ? "radio-on" : "")}>
              <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} />
              <span><b>Replace all</b> — delete the existing records first, then import</span>
            </label>
            {data.meta.periodStart && data.meta.periodEnd && (
              <label className="checkline">
                <input type="checkbox" checked={usePeriod} onChange={e => setUsePeriod(e.target.checked)} />
                <span>Also set the experience period to <b className="mono">{fmtDate(data.meta.periodStart)} → {fmtDate(data.meta.periodEnd)}</b> from the file</span>
              </label>
            )}
          </div>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => setStage("pick")}>Choose another file</button>
            <button className="btn btn-primary" onClick={doImport}><Upload size={15} /> Import {stats.count} record{stats.count !== 1 ? "s" : ""}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ============ TRAINING RECORD PDF IMPORT ============ */
export function TrainingImportModal({ onClose, onImport, existingCount }) {
  const [stage, setStage] = useState("pick");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState("");
  const [mode, setMode] = useState("append");

  const handleFile = (file) => {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) { setMsg("Please choose a PDF training record (.pdf)."); setStage("error"); return; }
    setBusy(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = await parseTrainingPdf(e.target.result);
        setData(parsed); setStage("preview"); setBusy(false);
      } catch (err) { setMsg(err.message || "Could not read this PDF."); setStage("error"); setBusy(false); }
    };
    reader.onerror = () => { setMsg("Could not read the file."); setStage("error"); setBusy(false); };
    reader.readAsArrayBuffer(file);
  };

  const stats = useMemo(() => {
    if (!data) return null;
    const dates = data.records.map(r => r.date).sort();
    const cats = {}; data.records.forEach(r => cats[r.category] = (cats[r.category] || 0) + 1);
    return { count: data.records.length, min: dates[0], max: dates[dates.length - 1], cats };
  }, [data]);

  return (
    <Modal title="Import training records (PDF)" icon={FileText} onClose={onClose} wide={stage === "preview"}>
      {stage === "pick" && (
        <div className="modal-body">
          <Dropzone accept=".pdf" busy={busy} hint="Drop the PERSONAL TRAINING RECORDS .pdf here" onFile={handleFile} />
          <div className="dz-hint"><Info size={14} /> <span>Uses the K-Mile <b>TRAINING RECORD</b> layout — a table with <b>From / To / Description / Reference / Expiry date / Remark</b> columns and the staff header (ID, Name, Position). Categories and aircraft types are detected automatically from each course description.</span></div>
        </div>
      )}
      {stage === "error" && (
        <div className="modal-body">
          <div className="import-error"><AlertTriangle size={20} /><span>{msg}</span></div>
          <div className="form-actions"><button className="btn btn-primary" onClick={() => setStage("pick")}>Try another file</button></div>
        </div>
      )}
      {stage === "preview" && stats && (
        <div className="modal-body">
          <div className="import-summary">
            <div className="is-big"><CheckCircle2 size={20} /> {stats.count} training record{stats.count !== 1 ? "s" : ""} found</div>
            <div className="is-meta">
              <span>Date range: <b className="mono">{fmtDate(stats.min)} → {fmtDate(stats.max)}</b></span>
              {data.meta.name && <span>Record of: <b>{data.meta.name}</b>{data.meta.staffId ? <> (<span className="mono">{data.meta.staffId}</span>)</> : null}</span>}
            </div>
            <div className="type-mini">{Object.entries(stats.cats).map(([t, n]) => <span key={t} className="type-mini-item"><b>{t}</b> {n}</span>)}</div>
          </div>
          <div className="import-preview-tbl table-wrap">
            <table className="tbl">
              <thead><tr><th>From</th><th>Course</th><th>Category</th><th>Ref</th><th>Expiry</th></tr></thead>
              <tbody>
                {data.records.slice(0, 8).map(r => (
                  <tr key={r.id}>
                    <td className="mono nowrap">{fmtDate(r.date)}</td>
                    <td className="cell-details">{r.course}</td>
                    <td>{r.category}</td>
                    <td className="mono">{r.ref || "—"}</td>
                    <td className="mono nowrap">{r.expiry === "NEVER" ? "Never" : r.expiry === "RECURRENT" ? "Recurrent" : (r.expiry ? fmtDate(r.expiry) : "—")}</td>
                  </tr>
                ))}
                {data.records.length > 8 && <tr><td colSpan={5} className="empty-sm">… and {data.records.length - 8} more</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="import-opts">
            <label className={"radio " + (mode === "append" ? "radio-on" : "")}>
              <input type="radio" checked={mode === "append"} onChange={() => setMode("append")} />
              <span><b>Append</b> — keep the {existingCount} existing record{existingCount !== 1 ? "s" : ""} and add these</span>
            </label>
            <label className={"radio " + (mode === "replace" ? "radio-on" : "")}>
              <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} />
              <span><b>Replace all</b> — delete the existing training records first, then import</span>
            </label>
          </div>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => setStage("pick")}>Choose another file</button>
            <button className="btn btn-primary" onClick={() => { onImport(data.records, mode); onClose(); }}><Upload size={15} /> Import {stats.count} record{stats.count !== 1 ? "s" : ""}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ============ EXPORT PDF ============ */
export function ExportModal({ records, profile, onClose }) {
  const [range, setRange] = useState("all");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const recs = range === "period"
    ? records.filter(r => (!profile.periodStart || r.date >= profile.periodStart) && (!profile.periodEnd || r.date <= profile.periodEnd))
    : records;
  const go = async () => {
    setBusy(true); setErr("");
    try { await exportLogbookPdf(recs, profile); onClose(); }
    catch (e) { setErr(e.message || "Export failed."); setBusy(false); }
  };
  return (
    <Modal title="Export logbook to PDF" icon={Download} onClose={onClose}>
      <div className="modal-body">
        <div className="import-opts">
          <div className="opt-title">Records to include</div>
          <label className={"radio " + (range === "all" ? "radio-on" : "")}><input type="radio" checked={range === "all"} onChange={() => setRange("all")} /><span><b>All records</b> — {records.length} total</span></label>
          <label className={"radio " + (range === "period" ? "radio-on" : "")}><input type="radio" checked={range === "period"} onChange={() => setRange("period")} /><span><b>Experience period only</b> — {fmtDate(profile.periodStart)} → {fmtDate(profile.periodEnd)}</span></label>
        </div>
        <div className="export-facts">
          <div><span>Signature</span><b>{profile.signature ? "Included ✓" : "Not set"}</b></div>
          <div><span>Export date</span><b className="mono">{fmtDate(todayISO())}</b></div>
        </div>
        {!profile.signature && <div className="dz-hint"><Info size={14} /> No signature saved yet — add one from the pen icon by your name in the sidebar to have it printed on the PDF.</div>}
        {err && <div className="import-error"><AlertTriangle size={18} /><span>{err}</span></div>}
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={go} disabled={busy}>{busy ? "Generating…" : <><Download size={15} /> Generate PDF</>}</button>
        </div>
      </div>
    </Modal>
  );
}

/* ============ SIGNATURE ============ */
export function SignatureModal({ profile, onClose, onSave }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [empty, setEmpty] = useState(!profile.signature);
  const fileRef = useRef(null);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#0A1E3F"; ctx.lineWidth = 2.4; ctx.lineJoin = "round"; ctx.lineCap = "round";
    if (profile.signature) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height); img.src = profile.signature; }
  }, []);

  const pos = (e) => {
    const c = canvasRef.current, rect = c.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - rect.left) * (c.width / rect.width), y: (t.clientY - rect.top) * (c.height / rect.height) };
  };
  const start = (e) => { e.preventDefault(); drawing.current = true; last.current = pos(e); };
  const move = (e) => {
    if (!drawing.current) return; e.preventDefault();
    const ctx = canvasRef.current.getContext("2d"); const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p; setEmpty(false);
  };
  const end = () => { drawing.current = false; };
  const clear = () => { const c = canvasRef.current, ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.strokeStyle = "#0A1E3F"; setEmpty(true); };
  const upload = (file) => {
    if (!file) return; const reader = new FileReader();
    reader.onload = (e) => { const img = new Image(); img.onload = () => { const c = canvasRef.current, ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); const r = Math.min(c.width / img.width, c.height / img.height); const w = img.width * r, hh = img.height * r; ctx.drawImage(img, (c.width - w) / 2, (c.height - hh) / 2, w, hh); setEmpty(false); }; img.src = e.target.result; };
    reader.readAsDataURL(file);
  };
  const save = () => { onSave(empty ? "" : canvasRef.current.toDataURL("image/png")); onClose(); };

  return (
    <Modal title="Your signature" icon={Edit3} onClose={onClose}>
      <div className="modal-body">
        <p className="sig-hint">Draw your signature below (mouse or touch), or upload an image. It will appear on exported PDF logbooks.</p>
        <canvas ref={canvasRef} width={460} height={150} className="sig-canvas"
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
        <div className="sig-actions">
          <button className="btn btn-ghost" onClick={clear}>Clear</button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}><Upload size={15} /> Upload image</button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => upload(e.target.files[0])} />
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={save}>Save signature</button>
        </div>
      </div>
    </Modal>
  );
}

/* ============ CHANGE PASSWORD ============ */
export function ChangePasswordModal({ user, onClose, onSaved, forced }) {
  const [cur, setCur] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setErr("");
    if (!forced || user.passHash) {
      if (!(await verifyPassword(user, cur))) { setErr("Current password is incorrect."); return; }
    }
    if (p1.length < 8) { setErr("New password must be at least 8 characters."); return; }
    if (p1 !== p2) { setErr("New passwords do not match."); return; }
    setBusy(true);
    const salt = newSalt();
    const passHash = await hashPassword(p1, salt);
    onSaved({ salt, passHash, mustChangePassword: false });
    setBusy(false);
    onClose();
  };

  return (
    <Modal title={forced ? "Set a new password" : "Change password"} icon={KeyRound} onClose={forced ? () => {} : onClose}>
      <div className="modal-body">
        {forced && <div className="dz-hint" style={{ marginTop: 0 }}><Info size={14} /> You are using a temporary password. Please set your own password to continue.</div>}
        <Field label="Current password"><input className="input" type="password" value={cur} onChange={e => setCur(e.target.value)} autoFocus /></Field>
        <Field label="New password (min 8 characters)"><input className="input" type="password" value={p1} onChange={e => setP1(e.target.value)} /></Field>
        <Field label="Confirm new password"><input className="input" type="password" value={p2} onChange={e => setP2(e.target.value)} onKeyDown={e => e.key === "Enter" && save()} /></Field>
        {err && <div className="form-err">{err}</div>}
        <div className="form-actions">
          {!forced && <button className="btn btn-ghost" onClick={onClose}>Cancel</button>}
          <button className="btn btn-primary" onClick={save} disabled={busy}>Save new password</button>
        </div>
      </div>
    </Modal>
  );
}
