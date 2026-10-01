import { cookies } from "next/headers";
import type { SessionUser } from "./seed-users";

const COOKIE_NAME = "eventops_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function setSession(user: SessionUser) {
  const store = await cookies();
  store.set(COOKIE_NAME, JSON.stringify(user), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function roleLabel(user: SessionUser): string {
  if (user.role === "organiser") return "Organiser";
  if (user.role === "participant") return "Attendee";
  if (user.role === "volunteer") {
    return user.volunteerSubRole === "team_lead" ? "Team Lead" : "Volunteer";
  }
  return user.role;
}
