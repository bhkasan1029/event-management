from fastapi import FastAPI
from pydantic import BaseModel
from ortools.sat.python import cp_model

app = FastAPI()

class User(BaseModel):
    id: int
    skills: list[str]
    maxHours: int
    slots: list[int]                 # availability: timeslot ids
    prefs: dict[int, int] = {}       # zone_id -> rank (1 = best)

class Slot(BaseModel):
    id: int
    hours: float

class Task(BaseModel):
    id: int
    zoneId: int
    slotId: int
    skill: str | None
    needed: int

class Payload(BaseModel):
    users: list[User]
    slots: list[Slot]
    tasks: list[Task]
    adjacent: list[tuple[int, int]]  # pairs of back-to-back timeslot ids
    timeLimit: float = 5.0

@app.post("/solve")
def solve(p: Payload):
    m = cp_model.CpModel()
    hours = {s.id: s.hours for s in p.slots}
    x, by_user_slot, by_task = {}, {}, {}

    # decision vars only for eligible (user, task) pairs: hard constraints
    for t in p.tasks:
        for u in p.users:
            if t.slotId in u.slots and (t.skill is None or t.skill in u.skills):
                v = m.NewBoolVar(f"x_{u.id}_{t.id}")
                x[u.id, t.id] = v
                by_user_slot.setdefault((u.id, t.slotId), []).append(v)
                by_task.setdefault(t.id, []).append(v)

    # 1. at most one task per user per timeslot
    for vs in by_user_slot.values():
        m.Add(sum(vs) <= 1)

    # 2. task coverage, with a shortfall variable so the model never goes infeasible
    short = {}
    for t in p.tasks:
        short[t.id] = m.NewIntVar(0, t.needed, f"short_{t.id}")
        m.Add(sum(by_task.get(t.id, [])) + short[t.id] == t.needed)

    # 3. max hours per user
    load = {}
    for u in p.users:
        mine = [(v, next(tt.slotId for tt in p.tasks if tt.id == tid))
                for (uid, tid), v in x.items() if uid == u.id]
        load[u.id] = sum(v for v, _ in mine)
        m.Add(sum(int(hours[s] * 10) * v for v, s in mine) <= u.maxHours * 10)

    # 4. soft: avoid consecutive shifts
    consec = []
    for u in p.users:
        for a, b in p.adjacent:
            wa, wb = by_user_slot.get((u.id, a)), by_user_slot.get((u.id, b))
            if wa and wb:
                c = m.NewBoolVar(f"c_{u.id}_{a}_{b}")
                m.Add(c >= sum(wa) + sum(wb) - 1)   # c = 1 if both worked
                consec.append(c)

    # 5. soft: fairness = minimise the busiest volunteer's load
    max_load = m.NewIntVar(0, len(p.tasks), "max_load")
    for u in p.users:
        m.Add(max_load >= load[u.id])

    # 6. soft: preference (rank 1 best -> cost 0, unranked -> cost 5)
    zone = {t.id: t.zoneId for t in p.tasks}
    pref_cost = sum(min(p_rank - 1, 4) * v if (p_rank := u.prefs.get(zone[tid])) else 5 * v
                    for (uid, tid), v in x.items()
                    for u in p.users if u.id == uid)

    # weights: coverage >> fairness > consecutive > preference
    m.Minimize(1000 * sum(short.values()) + 20 * max_load
               + 10 * sum(consec) + 1 * pref_cost)

    s = cp_model.CpSolver()
    s.parameters.max_time_in_seconds = p.timeLimit
    s.parameters.num_workers = 8
    status = s.Solve(m)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {"status": "infeasible", "assignments": [], "unfilled": []}

    return {
        "status": "optimal" if status == cp_model.OPTIMAL else "feasible",
        "assignments": [{"taskId": t, "userId": u} for (u, t), v in x.items() if s.Value(v)],
        "unfilled": [{"taskId": i, "missing": s.Value(v)} for i, v in short.items() if s.Value(v)],
        "consecutiveShifts": sum(s.Value(c) for c in consec),
        "maxLoad": s.Value(max_load),
    }
