import {
  Plane, LayoutDashboard, ClipboardList, FileSpreadsheet, GraduationCap, Edit3,
  ShieldCheck, Wrench, Layers, Info, AlertTriangle, CheckCircle2, XCircle, FileText,
} from "lucide-react";

function GuideStep({ n, title, children }) {
  return (
    <div className="gstep">
      <div className="gstep-n">{n}</div>
      <div className="gstep-body"><h4>{title}</h4>{children}</div>
    </div>
  );
}

export default function UserGuide() {
  return (
    <div className="page">
      <header className="page-head"><div><div className="eyebrow">Help</div><h2 className="page-title">How to use this app</h2></div></header>
      <div className="doc">
        <p className="doc-lead">A quick guide to recording your maintenance experience and reading your progress toward the 6‑month / 24‑month certifying‑staff requirement.</p>

        <section className="doc-sec">
          <h3><span className="doc-ic"><Plane size={16} /></span> Getting started</h3>
          <div className="gsteps">
            <GuideStep n="1" title="Get your account from the administrator">
              <p>Accounts are registered by the administrator (<b>Compliance Monitoring Personnel</b>) only — there is no self sign-up. You will receive your work email and a temporary password.</p>
            </GuideStep>
            <GuideStep n="2" title="Sign in and set your own password">
              <p>Sign in with your email and the temporary password. You'll be asked to set your own password (minimum 8 characters) the first time.</p>
            </GuideStep>
            <GuideStep n="3" title="Add your records">
              <p>Log tasks one by one, or import a whole logbook from Excel or PDF. Import your training history from the PERSONAL TRAINING RECORDS PDF. Your dashboard updates instantly.</p>
            </GuideStep>
          </div>
        </section>

        <section className="doc-sec">
          <h3><span className="doc-ic"><LayoutDashboard size={16} /></span> Reading the dashboard</h3>
          <p>The dashboard is your summary sheet. Each panel shows a status light: <span className="pill pill-pass" style={{ verticalAlign: "middle" }}><CheckCircle2 size={13} />pass</span> met, <span className="pill pill-caution" style={{ verticalAlign: "middle" }}><AlertTriangle size={13} />caution</span> not yet met, <span className="pill pill-fail" style={{ verticalAlign: "middle" }}><XCircle size={13} />fail</span> over a hard limit.</p>
          <ul>
            <li><b>Readiness banner</b> — overall eligibility. Green means every criterion below is satisfied for this period.</li>
            <li><b>Tasks & working days</b> — you meet the duration requirement by reaching <b>either</b> 180 tasks on different dates <b>or</b> 100 full working days.</li>
            <li><b>Experience spread</b> — the timeline plots each active date across your 2 years. Tall amber marks are full days (≥7 h). It flags experience that is bunched up or has a gap longer than ~4 months.</li>
            <li><b>Nature of experience</b> — <b>all 7 task types are required</b> (FOT, SGH, R/I, T/S, OPC, REP, INSP). The criterion stays unsatisfied until every type has at least one record; the panel lists any missing types.</li>
            <li><b>Similar‑aircraft distribution</b> — when using the privilege, each aircraft group must hold at least 30% of your experience.</li>
            <li><b>Alternative activities</b> — instructor, technical support and planning work can cover up to 20% of the requirement.</li>
          </ul>
        </section>

        <section className="doc-sec">
          <h3><span className="doc-ic"><FileSpreadsheet size={16} /></span> Importing your logbook (Excel or PDF)</h3>
          <div className="gsteps">
            <GuideStep n="1" title="Logbook record → Import Excel / PDF">
              <p>Drop your <span className="mono">.xlsx</span> (standard K-Mile logbook template) or a <span className="mono">.pdf</span> logbook in the K-Mile layout — for example one exported from this app.</p>
            </GuideStep>
            <GuideStep n="2" title="Review the preview">
              <p>The app detects the <b>DATE / LOCATION / A/C TYPE…</b> columns automatically and reads √ check marks per task-type column. It shows how many records were found, the date range and aircraft breakdown, and skips duplicates.</p>
            </GuideStep>
            <GuideStep n="3" title="Append or replace, then import">
              <p>Choose <b>Append</b> to add to what you have, or <b>Replace all</b> to start clean.</p>
            </GuideStep>
          </div>
        </section>

        <section className="doc-sec">
          <h3><span className="doc-ic"><FileText size={16} /></span> Importing training records (PDF)</h3>
          <p>On the Training record tab, click <b>Import PDF</b> and drop your <b>PERSONAL TRAINING RECORDS</b> PDF (the table with From / To / Description / Reference / Expiry date columns). Each course is imported with its dates, reference and expiry; the category (Type Training, EWIS, Fuel Tank Safety, Human Factors, SMS…) and aircraft type are detected from the description. Expired or soon-expiring courses are highlighted in the table and on the admin monitoring dashboard.</p>
        </section>

        <section className="doc-sec">
          <h3><span className="doc-ic"><GraduationCap size={16} /></span> Training records & credit</h3>
          <p>A <b>Type Training</b> that is theoretical + practical, passed at a Part‑147 organisation, is flagged as <span className="tag tag-amber">Credit</span>. If it was within the last 12 months, your dashboard shows a note that Credit of Experience may apply toward the requirement.</p>
        </section>

        <section className="doc-sec">
          <h3><span className="doc-ic"><Edit3 size={16} /></span> Signature & PDF export</h3>
          <p>Click the pen icon next to your name in the sidebar to draw or upload your signature once. Then use <b>Export PDF</b> on the Logbook record tab — the PDF is laid out like the official K‑Mile logbook with the task grid, √ marks, legend, and your signature with the export date.</p>
        </section>

        <section className="doc-sec">
          <h3><span className="doc-ic"><ShieldCheck size={16} /></span> For administrators (Compliance Monitoring Personnel)</h3>
          <ul>
            <li><b>Monitoring dashboard</b> — every staff member's readiness in one table: task/day progress, spread, nature-of-experience coverage (x/7), training counts with expiry alerts, and overall eligibility. Open any logbook read-only with <b>View</b>.</li>
            <li><b>User management</b> — register new users (name, email, Staff ID, temporary password), set their role, and manage the account status: <b>Active</b> / <b>Inactive</b> / <b>Archived</b>. Inactive and archived users cannot sign in; archived records are kept for audit. Password resets are done here too.</li>
          </ul>
        </section>

        <section className="doc-sec">
          <h3><span className="doc-ic"><Wrench size={16} /></span> How the assessment is calculated</h3>
          <p>The thresholds come from the KMI‑AMO 6/24‑month experience rules: <b>180 tasks</b> on different dates or <b>100 working days</b>; experience <b>spread</b> across the period; <b>all 7 task types covered</b>; up to <b>20%</b> from alternative activities; and, when using the similar‑aircraft privilege, at least <b>30%</b> per aircraft group (B737‑400 / B737‑800 / B767‑300).</p>
          <div className="callout callout-blue"><Info size={16} /><span>This app is a tracking aid. Final authorization decisions remain with KMI‑AMO in line with the approved procedures.</span></div>
        </section>

        <section className="doc-sec">
          <h3><span className="doc-ic"><Layers size={16} /></span> Your data</h3>
          <p>Records are saved automatically in this browser and stay available when you return. All accounts in this browser share one store so the administrator can review every logbook. Clearing the browser's site data will remove the records — export PDFs/CSV for backup.</p>
        </section>
      </div>
    </div>
  );
}
