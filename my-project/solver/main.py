# solver/main.py
from fastapi import FastAPI
from pydantic import BaseModel, Field
from ortools.sat.python import cp_model

app = FastAPI()

# ---------- weights: coverage >> fairness > consecutive > proficiency > preference ----------
W_SHORT, W_FAIR, W_CONSEC, W_PROF, W_PREF = 1000, 20, 10, 3, 1


class User(BaseModel):
    id: int
    skills: list[str] = []
    levels: dict[str, int] = {}      # optional proficiency: {"medical": 4}
    maxHours: float = 8
    slots: list[int] = []            # timeslot ids the user is available for
    prefs: dict[int, int] = {}       # zone_id -> rank (1 = most preferred)


class Slot(BaseModel):
    id: int
    hours: float


class Task(BaseModel):
    id: int
    zoneId: int
    slotId: int
    skill: str | None = None
    needed: int = 1
    minLevel: int = 1                # optional minimum proficiency


class Payload(BaseModel):
    users: list[User]
    slots: list[Slot]
    tasks: list[Task]
    adjacent: list[tuple[int, int]] = []
    timeLimit: float = 5.0
    avoidConsecutive: bool = True


def skill_level(u: User, skill: str) -> int:
    """0 = doesn't have the skill. Skills without a level count as level 1."""
    if skill in u.levels:
        return u.levels[skill]
    return 1 if skill in u.skills else 0


def solve_model(p: Payload) -> dict:
    m = cp_model.CpModel()
    hours = {s.id: s.hours for s in p.slots}
    task_by_id = {t.id: t for t in p.tasks}

    x = {}                           # (user_id, task_id) -> BoolVar
    by_user_slot: dict = {}          # (user_id, slot_id) -> [vars]
    by_task: dict = {}               # task_id -> [vars]
    by_user: dict = {}               # user_id -> [(var, task)]
    prof_cost = []
    pref_cost = []

    # ---- 1. Hard constraints: only create variables for eligible pairs ----
    for u in p.users:
        avail = set(u.slots)
        for t in p.tasks:
            if t.slotId not in avail:
                continue
            lvl = 0
            if t.skill is not None:
                lvl = skill_level(u, t.skill)
                if lvl < max(1, t.minLevel):
                    continue
            v = m.NewBoolVar(f"x_{u.id}_{t.id}")
            x[u.id, t.id] = v
            by_user_slot.setdefault((u.id, t.slotId), []).append(v)
            by_task.setdefault(t.id, []).append(v)
            by_user.setdefault(u.id, []).append((v, t))

            # soft cost: prefer higher proficiency (level 5 -> 0, level 1 -> 4)
            if t.skill is not None:
                prof_cost.append((5 - min(lvl, 5)) * v)
            # soft cost: preference rank (1 -> 0, unranked -> 5)
            rank = u.prefs.get(t.zoneId)
            pref_cost.append((min(rank - 1, 4) if rank else 5) * v)

    # ---- 2. At most one task per user per timeslot ----
    for vs in by_user_slot.values():
        m.Add(sum(vs) <= 1)

    # ---- 3. Coverage, with a shortfall var so the model is never infeasible ----
    short = {}
    for t in p.tasks:
        short[t.id] = m.NewIntVar(0, t.needed, f"short_{t.id}")
        m.Add(sum(by_task.get(t.id, [])) + short[t.id] == t.needed)

    # ---- 4. Max hours per user + load for fairness ----
    load = {}
    for u in p.users:
        pairs = by_user.get(u.id, [])
        if not pairs:
            continue
        load[u.id] = sum(v for v, _ in pairs)
        m.Add(sum(int(hours[t.slotId] * 10) * v for v, t in pairs) <= int(u.maxHours * 10))

    # ---- 5. Soft: avoid consecutive shifts ----
    consec = []
    if p.avoidConsecutive:
        for u in p.users:
            for a, b in p.adjacent:
                wa, wb = by_user_slot.get((u.id, a)), by_user_slot.get((u.id, b))
                if wa and wb:
                    c = m.NewBoolVar(f"c_{u.id}_{a}_{b}")
                    m.Add(c >= sum(wa) + sum(wb) - 1)   # c = 1 if both slots worked
                    consec.append(c)

    # ---- 6. Soft: fairness = minimise the busiest volunteer's load ----
    max_load = m.NewIntVar(0, max(1, len(p.tasks)), "max_load")
    for expr in load.values():
        m.Add(max_load >= expr)

    m.Minimize(
        W_SHORT * sum(short.values())
        + W_FAIR * max_load
        + W_CONSEC * sum(consec)
        + W_PROF * sum(prof_cost)
        + W_PREF * sum(pref_cost)
    )

    # ---- Solve ----
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = p.timeLimit
    solver.parameters.num_workers = 8
    status = solver.Solve(m)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {"status": "infeasible", "assignments": [], "unfilled": []}

    unfilled = [
        {"taskId": tid, "zoneId": task_by_id[tid].zoneId, "missing": solver.Value(v)}
        for tid, v in short.items() if solver.Value(v) > 0
    ]
    return {
        "status": "optimal" if status == cp_model.OPTIMAL else "feasible",
        "assignments": [
            {"taskId": t, "userId": u} for (u, t), v in x.items() if solver.Value(v)
        ],
        "unfilled": unfilled,
        "consecutiveShifts": sum(solver.Value(c) for c in consec),
        "maxLoad": solver.Value(max_load),
    }


@app.post("/solve")
def solve(p: Payload):
    return solve_model(p)


@app.get("/health")
def health():
    return {"ok": True}
