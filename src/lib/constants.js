export const AIRCRAFT_TYPES = ["B737-400", "B737-800", "B767-300", "Other"];
export const GROUPS = [{
  id: "G1", name: "Group 1", types: ["B737-400", "B737-800", "B767-300"],
  note: "Similar construction, systems, and technology",
}];
export const groupOf = (t) => (GROUPS.find(g => g.types.includes(t)) || { id: "OTHER", name: "Other" }).id;
export const groupName = (id) => id === "OTHER" ? "Other / Not grouped" : (GROUPS.find(g => g.id === id)?.name || id);

export const RATINGS = ["A1", "A2", "A3", "A4", "B1.1", "B1.2", "B1.3", "B1.4", "B2", "B3", "C"];
export const TASK_TYPES = [
  { k: "FOT", label: "FOT", full: "Functional Operational Test" },
  { k: "SGH", label: "SGH", full: "Servicing / Ground Handling" },
  { k: "RI", label: "R/I", full: "Removal / Installation / Activation" },
  { k: "TS", label: "T/S", full: "Trouble Shooting" },
  { k: "OPC", label: "OPC", full: "Operational Check" },
  { k: "REP", label: "REP", full: "Replacement" },
  { k: "INSP", label: "INSP", full: "Inspection" },
];
export const ACTIVITY_TYPES = [
  { k: "TRAINING", label: "Training" },
  { k: "PERFORM", label: "Perform" },
  { k: "SUPERVISE", label: "Supervise" },
  { k: "CRS", label: "CRS", full: "Certificate of Release to Service" },
];
export const EXP_CATEGORIES = [
  { k: "direct", label: "Direct maintenance", alt: false },
  { k: "instructor", label: "Training instructor / assessor", alt: true },
  { k: "techsupport", label: "Technical support / engineering", alt: true },
  { k: "management", label: "Maintenance management / planning", alt: true },
];
export const TRAINING_CATS = ["Type Training", "Continuation Training", "Human Factors", "Fuel Tank Safety", "EWIS", "SMS", "Safety / Security", "Dangerous Goods", "Other"];

export const POSITIONS = [
  "LAE", "Certifying Staff", "Support Staff", "Technician", "Engineer", "Manager",
  "Compliance Monitoring Personnel",
];
export const ADMIN_POSITION = "Compliance Monitoring Personnel";

export const USER_STATUSES = [
  { k: "active", label: "Active" },
  { k: "inactive", label: "Inactive" },
  { k: "archived", label: "Archived" },
];

export const TASKS_TARGET = 180;
export const DAYS_TARGET = 100;
export const ALT_MAX_PCT = 0.20;
export const SIMILAR_MIN_PCT = 0.30;
export const FULL_DAY_HOURS = 7;
export const MAX_GAP_DAYS = 122; // ~4 months
export const EXPIRY_WARN_DAYS = 60;

/* ============================ LOGBOOK FORM TEMPLATE ============================
   Drives the labels/title/legend of the logbook table and the exported PDF.
   Admins can override it by uploading a revised Word (.docx) form. The 7 task
   types + 4 activity types data model is fixed; only labels/title/legend and
   the declaration/signature captions change. */
export const DEFAULT_FORM_TEMPLATE = {
  title: "Aircraft Maintenance Experience Logbook",
  columns: {
    date: "DATE",
    location: "LOCATION",
    acType: "A/C or COMP (TYPE)",
    acReg: "A/C REG. OR COMP S/N",
    rating: "TYPE OF MAINT. (RATING)",
    privilege: "PRIVILEGE USED",
    taskType: "TASK TYPE",
    activity: "TYPE OF ACTIVITY",
    ata: "ATA",
    details: "TASK DETAILS",
    duration: "TIME DURATION (HOUR)",
    ref: "MAINTENANCE RECORD REFERENCE",
    remark: "REMARK",
  },
  // sub-column headers, keyed to the fixed data model
  taskCols: { FOT: "FOT", SGH: "SGH", RI: "R/I", TS: "T/S", OPC: "OPC", REP: "REP", INSP: "INSP" },
  activityCols: { TRAINING: "TRAINING", PERFORM: "PERFORM", SUPERVISE: "SUPERVISE", CRS: "CRS" },
  legend: [
    "FOT: Functional Operational Test",
    "SGH: Servicing Ground Handling",
    "R/I: Removal Installation Activation",
    "T/S: Trouble Shooting Exercise",
    "OPC: Operational Check",
    "REP: Replacement",
    "INSP: Inspection",
    "CRS: Certificate of Release to Service",
  ],
  declaration: "I declare that the entries in this logbook are completed and true.",
  signatureCaption: "Logbook Owner's Signature",
  dateCaption: "Date",
  companyFooter: "K-Mile Air Co.,Ltd.",
  formNo: "FSDS4/FORM1-059/Rev.00/Jun 2023",
};
