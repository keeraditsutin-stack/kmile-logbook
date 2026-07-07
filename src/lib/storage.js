import { parseJSON, uid, todayISO, addYears } from "./helpers.js";
import { ADMIN_POSITION } from "./constants.js";

/* localStorage-backed store. All data lives in this browser. */
export const K = {
  users: "kmile:v3:users",
  logbook: "kmile:v3:logbook",
  training: "kmile:v3:training",
  session: "kmile:v3:session",
};

export const load = (key, fb) => parseJSON(localStorage.getItem(key), fb);
export const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

/* ---------- password hashing (SHA-256 with per-user salt) ---------- */
export async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}::${password}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
export const newSalt = () => uid() + uid();

export async function verifyPassword(user, password) {
  if (!user?.passHash || !user?.salt) return false;
  return (await hashPassword(password, user.salt)) === user.passHash;
}

/* ---------- bootstrap admin ----------
   Registration is admin-only, so the very first account must exist already.
   Created once, on first launch, then managed like any other user. */
export const DEFAULT_ADMIN = { email: "admin@kmileair.com", password: "Admin@1234" };

export async function seedAdminIfEmpty(users) {
  if (users.length > 0) return users;
  const salt = newSalt();
  const passHash = await hashPassword(DEFAULT_ADMIN.password, salt);
  const admin = {
    email: DEFAULT_ADMIN.email,
    name: "Compliance Administrator",
    staffId: "KMA-ADMIN",
    amelNo: "",
    position: ADMIN_POSITION,
    role: "admin",
    status: "active",
    usePrivilege: true,
    periodStart: addYears(todayISO(), -2),
    periodEnd: todayISO(),
    salt, passHash,
    mustChangePassword: true,
    createdAt: todayISO(),
  };
  const next = [admin];
  save(K.users, next);
  return next;
}
