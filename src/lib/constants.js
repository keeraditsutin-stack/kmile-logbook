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
