// src/services/assign.ts
import { sql } from "../db";

const SOLVER_URL = process.env.SOLVER_URL ?? "http://localhost:8001";

type SolverAssignment = { taskId: number; userId: number };

export async function runAssignment(eventId: number) {
  // 1. Load this event's timeslots and tasks
  const slots = await sql`
    SELECT * FROM timeslots WHERE event_id = ${eventId} ORDER BY starts_at`;
  const tasks = await sql`
    SELECT * FROM tasks WHERE event_id = ${eventId}`;

  if (!slots.length || !tasks.length) {
    throw new Error("Event has no timeslots or tasks");
  }

  const slotIds: number[] = slots.map((s) => s.id);
  const taskIds: number[] = tasks.map((t) => t.id);

  // 2. Load volunteers, their availability for these slots, and their zone preferences
  const [users, avail, prefs] = await Promise.all([
    sql`SELECT id, skills, max_hours FROM users WHERE role = 'volunteer'`,
    sql`SELECT user_id, timeslot_id FROM availability
        WHERE timeslot_id = ANY(${slotIds})`,
    sql`SELECT user_id, zone_id, rank FROM volunteer_preferences`,
  ]);

  // 3. Index once instead of filtering per user
  const availByUser = new Map<number, number[]>();
  for (const a of avail) {
    if (!availByUser.has(a.user_id)) availByUser.set(a.user_id, []);
    availByUser.get(a.user_id)!.push(a.timeslot_id);
  }

  const prefsByUser = new Map<number, Record<number, number>>();
  for (const p of prefs) {
    if (!prefsByUser.has(p.user_id)) prefsByUser.set(p.user_id, {});
    prefsByUser.get(p.user_id)![p.zone_id] = p.rank;
  }

  // 4. Back-to-back slots (gap of 30 minutes or less)
  const adjacent: [number, number][] = [];
  for (let i = 0; i < slots.length - 1; i++) {
    const gapMin =
      (+new Date(slots[i + 1].starts_at) - +new Date(slots[i].ends_at)) / 60000;
    if (gapMin <= 30) adjacent.push([slots[i].id, slots[i + 1].id]);
  }

  // 5. Build the solver payload
  const payload = {
    users: users.map((u) => ({
      id: u.id,
      skills: u.skills ?? [],
      maxHours: u.max_hours,
      slots: availByUser.get(u.id) ?? [],
      prefs: prefsByUser.get(u.id) ?? {},
    })),
    slots: slots.map((s) => ({
      id: s.id,
      hours: (+new Date(s.ends_at) - +new Date(s.starts_at)) / 3.6e6,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      zoneId: t.zone_id,
      slotId: t.timeslot_id,
      skill: t.required_skill,
      needed: t.needed,
    })),
    adjacent,
  };

  // 6. Call the Python CP-SAT service
  const res = await fetch(`${SOLVER_URL}/solve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Solver failed: ${res.status} ${await res.text()}`);
  }
  const out = await res.json();

  // Keep existing assignments if the solve failed
  if (out.status === "infeasible") return out;

  // 7. Save atomically: delete old auto rows, insert new ones
  const assignments: SolverAssignment[] = out.assignments;
  const tIds = assignments.map((a) => a.taskId);
  const uIds = assignments.map((a) => a.userId);

  await sql.transaction([
    sql`DELETE FROM assignments
        WHERE source = 'auto'
          AND status = 'assigned'
          AND task_id = ANY(${taskIds})`,
    sql`INSERT INTO assignments (task_id, user_id, source)
        SELECT t, u, 'auto'
        FROM unnest(${tIds}::int[], ${uIds}::int[]) AS x(t, u)
        ON CONFLICT (task_id, user_id) DO NOTHING`,
  ]);

  return out; // status, unfilled, consecutiveShifts, maxLoad
}
