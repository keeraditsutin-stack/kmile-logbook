import { useState, useMemo, useRef } from "react";
import { Plus, Trash2, Download, Search, Edit3, FileSpreadsheet, GraduationCap } from "lucide-react";
import { Field } from "./ui.jsx";
import { ImportModal, ExportModal } from "./modals.jsx";
import { AIRCRAFT_TYPES, RATINGS, TASK_TYPES, ACTIVITY_TYPES, EXP_CATEGORIES, DEFAULT_FORM_TEMPLATE } from "../lib/constants.js";
import { uid, todayISO, fmtDate } from "../lib/helpers.js";
import { trainingStatus } from "../lib/assess.js";

const emptyRecord = () => ({
  date: todayISO(), location: "", acType: "B737-400", acReg: "", rating: "A1", privilege: "-",
  tasks: {}, activity: { PERFORM: true }, ata: "", details: "", duration: "", ref: "", supervisedBy: "",
  remark: "", category: "direct",
});

export default function LogbookRecord({ records, profile, formTemplate, training, onAdd, onUpdate, onDelete, onImport, readOnly }) {
  const cols = { ...DEFAULT_FORM_TEMPLATE.columns, ...(formTemplate?.columns || {}) };
  const [form, setForm] = useState(emptyRecord());
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(!readOnly);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [showTraining, setShowTraining] = useState(true);
  const topRef = useRef(null);

  const toggle = (grp, k) => setForm(f => ({ ...f, [grp]: { ...f[grp], [k]: !f[grp]?.[k] } }));
  const save = () => {
    if (!form.date || !form.details.trim()) return;
    if (editing) { onUpdate(editing, form); setEditing(null); } else { onAdd({ ...form, id: uid() }); }
    setForm(emptyRecord());
  };
  const startEdit = (r) => { setForm({ ...emptyRecord(), ...r }); setEditing(r.id); setOpen(true); topRef.current?.scrollIntoView({ behavior: "smooth" }); };

  // valid training records (not expired, not failed) shown combined in the logbook
  const trainingRows = useMemo(() => (training || [])
    .filter(t => t.result !== "Fail" && trainingStatus(t).state !== "expired")
    .map(t => ({
      id: "trn_" + t.id, _training: true, date: t.date, location: "", acType: t.acType,
      acReg: "", rating: "", privilege: "-", tasks: {}, activity: { TRAINING: true },
      ata: "", details: t.course, duration: "", ref: t.ref, supervisedBy: t.org || "", remark: t.category,
    })), [training]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = showTraining ? [...records, ...trainingRows] : [...records];
    return base.sort((a, b) => b.date.localeCompare(a.date))
      .filter(r => !s || [r.details, r.acType, r.acReg, r.location, r.ata, r.ref].some(v => (v || "").toLowerCase().includes(s)));
  }, [records, trainingRows, showTraining, q]);

  return (
    <div className="page" ref={topRef}>
      <header className="page-head">
        <div><div className="eyebrow">Logbook</div><h2 className="page-title">Maintenance experience records</h2></div>
        <div className="head-actions">
          <button className="btn btn-ghost" onClick={() => setExportOpen(true)} disabled={!records.length}><Download size={16} /> Export PDF</button>
          {!readOnly && <button className="btn btn-ghost" onClick={() => setImportOpen(true)}><FileSpreadsheet size={16} /> Import Excel / PDF</button>}
          {!readOnly && <button className="btn btn-ghost" onClick={() => setOpen(o => !o)}>{open ? "Hide form" : <>New record <Plus size={16} /></>}</button>}
        </div>
      </header>
      {importOpen && !readOnly && <ImportModal onClose={() => setImportOpen(false)} onImport={onImport} existingCount={records.length} />}
      {exportOpen && <ExportModal records={records} profile={profile} formTemplate={formTemplate} onClose={() => setExportOpen(false)} />}

      {open && !readOnly && (
        <div className="panel form-panel">
          <div className="form-panel-title">{editing ? "Edit record" : "Add a new maintenance record"}</div>
          <div className="form-grid">
            <Field label="Date"><input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Location"><input className="input" placeholder="BKK" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></Field>
            <Field label="A/C or component type">
              <select className="input" value={form.acType} onChange={e => setForm({ ...form, acType: e.target.value })}>{AIRCRAFT_TYPES.map(t => <option key={t}>{t}</option>)}</select>
            </Field>
            <Field label="A/C reg. or comp. S/N"><input className="input mono" placeholder="HS-KMB" value={form.acReg} onChange={e => setForm({ ...form, acReg: e.target.value })} /></Field>
            <Field label="Type of maint. (rating)">
              <select className="input" value={form.rating} onChange={e => setForm({ ...form, rating: e.target.value })}>{RATINGS.map(r => <option key={r}>{r}</option>)}</select>
            </Field>
            <Field label="Privilege used">
              <select className="input" value={form.privilege} onChange={e => setForm({ ...form, privilege: e.target.value })}>
                <option value="-">—</option><option>Similar aircraft</option><option>Type authorization</option>
              </select>
            </Field>
            <Field label="ATA"><input className="input mono" placeholder="21" value={form.ata} onChange={e => setForm({ ...form, ata: e.target.value })} /></Field>
            <Field label="Time duration (hours)"><input className="input" type="number" step="0.25" min="0" placeholder="0.5" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} /></Field>
            <Field label="Experience category" hint="20% rule">
              <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{EXP_CATEGORIES.map(c => <option key={c.k} value={c.k}>{c.label}</option>)}</select>
            </Field>
            <Field label="Maintenance record reference"><input className="input mono" placeholder="E-003236" value={form.ref} onChange={e => setForm({ ...form, ref: e.target.value })} /></Field>
            <Field label="Task details" wide><textarea className="input textarea" rows={2} placeholder="Preflight check, daily check, BITE test…" value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} /></Field>
          </div>

          <div className="check-block">
            <div className="check-col">
              <div className="check-title">Task type</div>
              <div className="check-row">{TASK_TYPES.map(t => (
                <button key={t.k} type="button" className={"toggle " + (form.tasks?.[t.k] ? "toggle-on" : "")} title={t.full} onClick={() => toggle("tasks", t.k)}>{t.label}</button>
              ))}</div>
            </div>
            <div className="check-col">
              <div className="check-title">Type of activity</div>
              <div className="check-row">{ACTIVITY_TYPES.map(t => (
                <button key={t.k} type="button" className={"toggle " + (form.activity?.[t.k] ? "toggle-on" : "")} title={t.full || t.label} onClick={() => toggle("activity", t.k)}>{t.label}</button>
              ))}</div>
            </div>
          </div>

          <div className="form-grid">
            <Field label="Supervision by (if required)"><input className="input" value={form.supervisedBy} onChange={e => setForm({ ...form, supervisedBy: e.target.value })} /></Field>
            <Field label="Remark"><input className="input" value={form.remark} onChange={e => setForm({ ...form, remark: e.target.value })} /></Field>
          </div>

          <div className="form-actions">
            {editing && <button className="btn btn-ghost" onClick={() => { setEditing(null); setForm(emptyRecord()); }}>Cancel</button>}
            <button className="btn btn-primary" onClick={save}>{editing ? "Save changes" : "Add record"}</button>
          </div>
        </div>
      )}

      <div className="table-tools">
        <div className="search"><Search size={15} /><input placeholder="Search records…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <div className="tools-right">
          {trainingRows.length > 0 && (
            <label className="training-toggle">
              <input type="checkbox" checked={showTraining} onChange={e => setShowTraining(e.target.checked)} />
              <GraduationCap size={14} /> Include valid training ({trainingRows.length})
            </label>
          )}
          <span className="count-tag">{records.length} logbook{showTraining && trainingRows.length > 0 ? ` · ${trainingRows.length} training` : ""}</span>
        </div>
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? <div className="empty">No records yet. Add your first maintenance task above.</div> : (
          <table className="tbl">
            <thead><tr>
              <th>{cols.date}</th><th>{cols.location}</th><th>{cols.acType}</th><th>{cols.acReg}</th><th>{cols.rating}</th><th>{cols.taskType}</th><th>{cols.activity}</th><th>{cols.ata}</th><th>{cols.details}</th><th>{cols.duration}</th><th>{cols.ref}</th><th>Supervision by</th>{!readOnly && <th></th>}
            </tr></thead>
            <tbody>
              {filtered.map(r => r._training ? (
                <tr key={r.id} className="row-training">
                  <td className="mono nowrap">{fmtDate(r.date)}</td>
                  <td>—</td>
                  <td className="mono">{r.acType}</td>
                  <td className="mono">—</td>
                  <td>—</td>
                  <td className="cell-tags">—</td>
                  <td className="cell-tags">{ACTIVITY_TYPES.filter(t => r.activity?.[t.k]).map(t => <span key={t.k} className="tag tag-blue">{t.label}</span>)}</td>
                  <td className="mono">—</td>
                  <td className="cell-details">{r.details} <span className="tag tag-amber"><GraduationCap size={10} style={{ verticalAlign: "-1px" }} /> Training</span></td>
                  <td className="mono">—</td>
                  <td className="mono">{r.ref || "—"}</td>
                  <td>{r.supervisedBy || "—"}</td>
                  {!readOnly && <td className="cell-actions"><span className="you-tag">from Training</span></td>}
                </tr>
              ) : (
                <tr key={r.id}>
                  <td className="mono nowrap">{fmtDate(r.date)}</td>
                  <td>{r.location || "—"}</td>
                  <td className="mono">{r.acType}</td>
                  <td className="mono">{r.acReg || "—"}</td>
                  <td>{r.rating}</td>
                  <td className="cell-tags">{TASK_TYPES.filter(t => r.tasks?.[t.k]).map(t => <span key={t.k} className="tag">{t.label}</span>)}</td>
                  <td className="cell-tags">{ACTIVITY_TYPES.filter(t => r.activity?.[t.k]).map(t => <span key={t.k} className="tag tag-blue">{t.label}</span>)}</td>
                  <td className="mono">{r.ata || "—"}</td>
                  <td className="cell-details">{r.details}</td>
                  <td className="mono">{r.duration || "—"}</td>
                  <td className="mono">{r.ref || "—"}</td>
                  <td>{r.supervisedBy || "—"}</td>
                  {!readOnly && <td className="cell-actions">
                    <button className="icon-btn" onClick={() => startEdit(r)} title="Edit"><Edit3 size={15} /></button>
                    <button className="icon-btn icon-danger" onClick={() => onDelete(r.id)} title="Delete"><Trash2 size={15} /></button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
