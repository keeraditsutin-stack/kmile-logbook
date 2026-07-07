import { useState } from "react";
import { Plane, ChevronRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Field } from "./ui.jsx";
import { verifyPassword } from "../lib/storage.js";

export default function Login({ users, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) { setErr("Enter a valid work email address."); return; }
    if (!password) { setErr("Enter your password."); return; }
    setBusy(true); setErr("");
    const user = users.find(u => u.email === e);
    if (!user) { setErr("No account found for this email. Accounts are registered by the administrator — please contact Compliance Monitoring."); setBusy(false); return; }
    const ok = await verifyPassword(user, password);
    if (!ok) { setErr("Incorrect password. Please try again or contact your administrator for a reset."); setBusy(false); return; }
    if (user.status === "inactive") { setErr("This account is inactive. Please contact the administrator to reactivate it."); setBusy(false); return; }
    if (user.status === "archived") { setErr("This account has been archived and can no longer sign in. Please contact the administrator."); setBusy(false); return; }
    setBusy(false);
    onLogin(user);
  };

  return (
    <div className="login-wrap">
      <div className="login-atmos" />
      <div className="login-card">
        <div className="brand">
          <div className="brand-mark"><Plane size={22} strokeWidth={2.2} /></div>
          <div>
            <div className="brand-name">K‑MILE AIR</div>
            <div className="brand-sub">Aircraft Maintenance Experience Logbook</div>
          </div>
        </div>

        <h1 className="login-h1">Sign in to your logbook</h1>
        <p className="login-p">Certifying staff record and track maintenance experience toward the 6‑month / 24‑month requirement.</p>

        <Field label="Work email">
          <input className="input" type="email" placeholder="name@kmileair.com" value={email}
            onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} autoFocus autoComplete="username" />
        </Field>
        <Field label="Password">
          <div className="pw-wrap">
            <input className="input" type={show ? "text" : "password"} placeholder="••••••••" value={password}
              onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} autoComplete="current-password" />
            <button type="button" className="pw-eye" onClick={() => setShow(s => !s)} title={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        {err && <div className="form-err">{err}</div>}
        <button className="btn btn-primary btn-block" onClick={submit} disabled={busy}>
          {busy ? "Signing in…" : <>Sign in <ChevronRight size={16} /></>}
        </button>
        <p className="login-note"><ShieldCheck size={13} style={{ verticalAlign: "-2px" }} /> New accounts are registered by the administrator (Compliance Monitoring Personnel) only.</p>
      </div>
      <div className="login-foot">Data is stored in this browser · authorised users only</div>
    </div>
  );
}
