// Session user type. (Seed data now lives in prisma/seed.ts — run `npx prisma db seed`.)

export type UserRole = "organiser" | "volunteer" | "participant";
export type VolunteerSubRole = "team_lead" | "normal";

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  volunteerSubRole?: VolunteerSubRole;
};
