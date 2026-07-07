import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard, ClipboardList, GraduationCap, HelpCircle, ShieldCheck, Users,
  LogOut, Plane, Edit3, KeyRound, FileText,
} from "lucide-react";
import Login from "./components/Login.jsx";
import Dashboard from "./components/Dashboard.jsx";
import LogbookRecord from "./components/LogbookRecord.jsx";
import TrainingRecord from "./components/TrainingRecord.jsx";
import UserGuide from "./components/UserGuide.jsx";
import { AdminDashboard, UserManagement, FormTemplateAdmin } from "./components/Admin.jsx";
import { SignatureModal, ChangePasswordModal } from "./components/modals.jsx";
import { K, load, save, seedAdminIfEmpty, DEFAULT_ADMIN } from "./lib/storage.js";
import { TASK_TYPES, ACTIVITY_TYPES } from "./lib/constants.js";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [logbook, setLogbook] = useState({});
  const [training, setTraining] = useState({});
  const [current, setCurrent] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [viewingEmail, setViewingEmail] = useState(null); // admin viewing a staff
  const [sigOpen, setSigOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [firstRun, setFirstRun] = useState(false);
  const [formTemplate, setFormTemplate] = useState(null);

  useEffect(() => { (async () => {
    let u = load(K.users, []);
    if (u.length === 0) { u = await seedAdminIfEmpty(u); setFirstRun(true); }
    const lb = load(K.logbook, {});
    const tr = load(K.training, {});
    const ft = load(K.formTemplate, null);
    const sess = load(K.session, null);
    setUsers(u); setLogbook(lb); setTraining(tr); setFormTemplate(ft);
    if (sess?.email) { const me = u.find(x => x.email === sess.email); if (me && me.status === "active") setCurrent(me); }
    setLoading(false);
  })(); }, []);

  const persistUsers = useCallback((u) => { setUsers(u); save(K.users, u); }, []);
  const persistLog = useCallback((lb) => { setLogbook(lb); save(K.logbook, lb); }, []);
  const persistTr = useCallback((tr) => { setTraining(tr); save(K.training, tr); }, []);

  const login = (user) => {
    setCurrent(user); setTab("dashboard"); save(K.session, { email: user.email });
    if (user.mustChangePassword) setPwOpen("forced");
  };
  const logout = () => { setCurrent(null); setViewingEmail(null); save(K.session, null); };

  const updateUser = (email, patch) => {
    const next = users.map(u => u.email === email ? { ...u, ...patch } : u);
    persistUsers(next);
    if (current?.email === email) setCurrent(c => ({ ...c, ...patch }));
  };
  const registerUser = (u) => persistUsers([...users, u]);

  const myLogs = logbook[current?.email] || [];
  const myTraining = training[current?.email] || [];

  const addLog = (rec) => persistLog({ ...logbook, [current.email]: [...myLogs, rec] });
  const updateLog = (id, rec) => persistLog({ ...logbook, [current.email]: myLogs.map(r => r.id === id ? { ...rec, id } : r) });
  const deleteLog = (id) => persistLog({ ...logbook, [current.email]: myLogs.filter(r => r.id !== id) });
  const importLogs = (recs, mode, period) => {
    const base = mode === "replace" ? [] : myLogs;
    persistLog({ ...logbook, [current.email]: [...base, ...recs] });
    if (period?.start && period?.end) updateUser(current.email, { periodStart: period.start, periodEnd: period.end });
    setTab("dashboard");
  };
  const addTr = (rec) => persistTr({ ...training, [current.email]: [...myTraining, rec] });
  const deleteTr = (id) => persistTr({ ...training, [current.email]: myTraining.filter(r => r.id !== id) });
  const importTr = (recs, mode) => {
    const base = mode === "replace" ? [] : myTraining;
    persistTr({ ...training, [current.email]: [...base, ...recs] });
  };
  const saveSignature = (dataURL) => updateUser(current.email, { signature: dataURL });
  const saveFormTemplate = (tpl) => { setFormTemplate(tpl); save(K.formTemplate, tpl); };
  const resetFormTemplate = () => { setFormTemplate(null); save(K.formTemplate, null); };

  const exportCSV = () => {
    const head = ["Email", "Name", "StaffID", "Status", "Date", "Location", "A/C Type", "Reg/SN", "Rating", "TaskTypes", "Activity", "ATA", "Details", "Hours", "Ref", "Category"];
    const lines = [head.join(",")];
    Object.entries(logbook).forEach(([email, recs]) => {
      const u = users.find(x => x.email === email) || {};
      recs.forEach(r => {
        const tt = TASK_TYPES.filter(t => r.tasks?.[t.k]).map(t => t.label).join("|");
        const ac = ACTIVITY_TYPES.filter(t => r.activity?.[t.k]).map(t => t.label).join("|");
        const row = [email, u.name, u.staffId, u.status, r.date, r.location, r.acType, r.acReg, r.rating, tt, ac, r.ata, r.details, r.duration, r.ref, r.category]
          .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
        lines.push(row);
      });
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "kmile_logbook_export.csv"; a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading) return <div className="kmile boot"><div className="boot-mark"><Plane size={26} /></div><div>Loading logbook…</div></div>;
  if (!current) return (
    <div className="kmile">
      <Login users={users} onLogin={login} />
      {firstRun && (
        <div className="first-run">
          <b>First launch:</b> a bootstrap admin account was created — <span className="mono">{DEFAULT_ADMIN.email}</span> / <span className="mono">{DEFAULT_ADMIN.password}</span>. Sign in and change the password immediately.
        </div>
      )}
    </div>
  );

  const isAdmin = current.role === "admin";
  const viewingUser = viewingEmail ? users.find(u => u.email === viewingEmail) : null;

  const NAV = [
    { k: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { k: "logbook", label: "Logbook record", icon: ClipboardList },
    { k: "training", label: "Training record", icon: GraduationCap },
    { k: "guideline", label: "User guide", icon: HelpCircle },
    ...(isAdmin ? [
      { k: "admin-dash", label: "Monitoring dashboard", icon: ShieldCheck },
      { k: "admin-users", label: "User management", icon: Users },
      { k: "admin-form", label: "Logbook form", icon: FileText },
    ] : []),
  ];

  return (
    <div className="kmile app-shell">
      <aside className="sidebar">
        <div className="brand sidebar-brand">
          <div className="brand-mark"><Plane size={20} strokeWidth={2.2} /></div>
          <div><div className="brand-name">K‑MILE AIR</div><div className="brand-sub">Experience Logbook</div></div>
        </div>
        <nav className="nav">
          {NAV.map(n => (
            <button key={n.k} className={"nav-item " + (tab === n.k ? "nav-active" : "")} onClick={() => { setTab(n.k); setViewingEmail(null); }}>
              <n.icon size={18} /><span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="su-avatar">{(current.name || "?").slice(0, 1).toUpperCase()}</div>
          <div className="su-info"><div className="su-name">{current.name}</div><div className="su-role">{isAdmin ? "Compliance Monitoring" : "Staff"} · {current.staffId}</div></div>
          <button className="icon-btn" onClick={() => setPwOpen(true)} title="Change password"><KeyRound size={16} /></button>
          <button className="icon-btn" onClick={() => setSigOpen(true)} title={current.signature ? "Edit signature" : "Add signature"}><Edit3 size={16} /></button>
          <button className="icon-btn" onClick={logout} title="Sign out"><LogOut size={16} /></button>
        </div>
      </aside>
      {sigOpen && <SignatureModal profile={current} onClose={() => setSigOpen(false)} onSave={saveSignature} />}
      {pwOpen && <ChangePasswordModal user={current} forced={pwOpen === "forced"} onClose={() => setPwOpen(false)} onSaved={(patch) => updateUser(current.email, patch)} />}

      <main className="main">
        {tab === "dashboard" && <Dashboard profile={current} records={myLogs} training={myTraining} />}
        {tab === "logbook" && <LogbookRecord records={myLogs} profile={current} formTemplate={formTemplate} onAdd={addLog} onUpdate={updateLog} onDelete={deleteLog} onImport={importLogs} />}
        {tab === "training" && <TrainingRecord records={myTraining} onAdd={addTr} onDelete={deleteTr} onImport={importTr} />}
        {tab === "guideline" && <UserGuide />}
        {tab === "admin-dash" && isAdmin && !viewingUser && (
          <AdminDashboard users={users} logbook={logbook} training={training} onExport={exportCSV} onView={setViewingEmail} />
        )}
        {tab === "admin-users" && isAdmin && (
          <UserManagement users={users} onRegister={registerUser} onUpdateUser={updateUser} selfEmail={current.email} />
        )}
        {tab === "admin-form" && isAdmin && (
          <FormTemplateAdmin template={formTemplate} onSave={saveFormTemplate} onReset={resetFormTemplate} />
        )}
        {tab === "admin-dash" && isAdmin && viewingUser && (
          <div className="page">
            <button className="link-back" onClick={() => setViewingEmail(null)}>← Back to monitoring dashboard</button>
            <div className="view-banner"><Users size={16} /> Viewing <b>{viewingUser.name}</b> ({viewingUser.email})</div>
            <Dashboard profile={viewingUser} records={logbook[viewingUser.email] || []} training={training[viewingUser.email] || []} />
            <TrainingRecord records={training[viewingUser.email] || []} readOnly onAdd={() => {}} onDelete={() => {}} onImport={() => {}} />
            <LogbookRecord records={logbook[viewingUser.email] || []} profile={viewingUser} formTemplate={formTemplate} readOnly onAdd={() => {}} onUpdate={() => {}} onDelete={() => {}} />
          </div>
        )}
      </main>
    </div>
  );
}
