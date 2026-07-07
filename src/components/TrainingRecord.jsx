import { useState } from "react";
import { Plus, Trash2, FileText } from "lucide-react";
import { Field, StatusPill } from "./ui.jsx";
import { TrainingImportModal } from "./modals.jsx";
import { AIRCRAFT_TYPES, TRAINING_CATS } from "../lib/constants.js";
import { uid, todayISO, fmtDate } from "../lib/helpers.js";
import { trainingStatus } from "../lib/assess.js";

const emptyTraining = () => ({ date: todayISO(), course: "", acType: "B737-400", org: "", category: "Type Training", theoretical: true, practical: false, result: "Pass", ref: "", expiry: "", remark: "" });

function ExpiryCell({ t }) {
  const s = trainingStatus(t);
  if (!t.expiry || t.expiry === "NEVER") return <span className="mono muted">Never</span>;
  if (t.expiry === "RECURRENT") return <span className="tag tag-blue">Recurrent</span>;
  const state = s.state === "expired" ? "fail" : s.state === "expiring" ? "caution" : "pass";
  return <StatusPill state={state}>{fmtDate(t.expiry)}</StatusPill>;
}

export default function TrainingRecord({ records, onAdd, onDelete, onImport, readOnly }) {
  const [form, setForm] = useState(emptyTraining());
  const [open, setOpen] = useState(!readOnly);
  const [importOpen, setImportOpen] = useState(false);
  const save = () => { if (!form.course.trim()) return; onAdd({ ...form, id: uid() }); setForm(emptyTraining()); };
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="page">
      <header className="page-head">
        <div><div className="eyebrow">Training</div><h2 className="page-title">Training records</h2></div>
        <div className="head-actions">
          {!readOnly && <button className="btn btn-ghost" onClick={() => setImportOpen(true)}><FileText size={16} /> Import PDF</button>}
          {!readOnly && <button className="btn btn-ghost" onClick={() => setOpen(o => !o)}>{open ? "Hide form" : <>New training <Plus size={16} /></>}</button>}
        </div>
      </header>
      {importOpen && !readOnly && <TrainingImportModal onClose={() => setImportOpen(false)} onImport={onImport} existingCount={records.length} />}

      {open && !readOnly && (
        <div className="panel form-panel">
          <div className="form-panel-title">Add a training record</div>
          <div className="form-grid">
            <Field label="Date"><input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Course / training name" wide><input className="input" placeholder="B737-800 Type Training (CAT B1)" value={form.course} onChange={e => setForm({ ...form, course: e.target.value })} /></Field>
            <Field label="Aircraft type">
              <select className="input" value={form.acType} onChange={e => setForm({ ...form, acType: e.target.value })}>{AIRCRAFT_TYPES.map(t => <option key={t}>{t}</option>)}</select>
            </Field>
            <Field label="Category">
              <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{TRAINING_CATS.map(c => <option key={c}>{c}</option>)}</select>
            </Field>
            <Field label="Organisation (Part‑147)"><input className="input" placeholder="Approved CAAT Part-147 org" value={form.org} onChange={e => setForm({ ...form, org: e.target.value })} /></Field>
            <Field label="Result">
              <select className="input" value={form.result} onChange={e => setForm({ ...form, result: e.target.value })}><option>Pass</option><option>Fail</option><option>In progress</option></select>
            </Field>
            <Field label="Certificate reference"><input className="input mono" value={form.ref} onChange={e => setForm({ ...form, ref: e.target.value })} /></Field>
            <Field label="Expiry date" hint="blank = never">
              <input className="input" type="date" value={form.expiry === "NEVER" || form.expiry === "RECURRENT" ? "" : form.expiry} onChange={e => setForm({ ...form, expiry: e.target.value })} />
            </Field>
            <Field label="Remark"><input className="input" value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} /></Field>
          </div>
          <div className="check-block">
            <div className="check-col"><div className="check-title">Scope</div>
              <div className="check-row">
                <button type="button" className={"toggle " + (form.theoretical ? "toggle-on" : "")} onClick={() => setForm({ ...form, theoretical: !form.theoretical })}>Theoretical</button>
                <button type="button" className={"toggle " + (form.practical ? "toggle-on" : "")} onClick={() => setForm({ ...form, practical: !form.practical })}>Practical</button>
              </div>
            </div>
          </div>
          <div className="form-actions"><button className="btn btn-primary" onClick={save}>Add training</button></div>
        </div>
      )}

      <div className="table-wrap">
        {sorted.length === 0 ? <div className="empty">No training records yet. Add one above or import the PERSONAL TRAINING RECORDS PDF.</div> : (
          <table className="tbl">
            <thead><tr><th>Date</th><th>Course</th><th>A/C</th><th>Category</th><th>Organisation</th><th>Scope</th><th>Result</th><th>Expiry</th><th>Ref</th>{!readOnly && <th></th>}</tr></thead>
            <tbody>
              {sorted.map(t => {
                const credit = t.category === "Type Training" && t.theoretical && t.practical && t.result === "Pass";
                return (
                  <tr key={t.id}>
                    <td className="mono nowrap">{fmtDate(t.date)}</td>
                    <td className="cell-details">{t.course} {credit && <span className="tag tag-amber">Credit</span>}</td>
                    <td className="mono">{t.acType}</td>
                    <td>{t.category}</td>
                    <td>{t.org || "—"}</td>
                    <td className="cell-tags">{t.theoretical && <span className="tag">Theory</span>}{t.practical && <span className="tag">Practical</span>}</td>
                    <td><StatusPill state={t.result === "Pass" ? "pass" : t.result === "Fail" ? "fail" : "caution"}>{t.result}</StatusPill></td>
                    <td className="nowrap"><ExpiryCell t={t} /></td>
                    <td className="mono">{t.ref || "—"}</td>
                    {!readOnly && <td className="cell-actions"><button className="icon-btn icon-danger" onClick={() => onDelete(t.id)}><Trash2 size={15} /></button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
