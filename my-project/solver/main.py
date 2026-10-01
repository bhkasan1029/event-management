# solver/main.py
import random
from typing import Optional
from fastapi import FastAPI
from pydantic import BaseModel
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
    skill: Optional[str] = None
    needed: int = 1
    minLevel: int = 1                # optional minimum proficiency


class Payload(BaseModel):
    users: list[User]
    slots: list[Slot]
    tasks: list[Task]
    adjacent: list[tuple[int, int]] = []
    timeLimit: float = 5.0
    avoidConsecutive: bool = True


class StressPayload(BaseModel):
    users: list[User]
    slots: list[Slot]
    tasks: list[Task]
    adjacent: list[tuple[int, int]] = []
    runs: int = 100
    dropoutMin: float = 0.15
    dropoutMax: float = 0.20
    innerTimeLimit: float = 0.5
    seed: int = 42


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

            if t.skill is not None:
                prof_cost.append((5 - min(lvl, 5)) * v)
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
                    m.Add(c >= sum(wa) + sum(wb) - 1)
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

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = p.timeLimit
    solver.parameters.num_workers = 8
    status = solver.Solve(m)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {"status": "infeasible", "assignments": [], "unfilled": [], "maxLoad": 0, "consecutiveShifts": 0}

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


@app.post("/stress-test")
def stress_test(p: StressPayload):
    """Monte Carlo: run the solver ~100 times with random volunteer dropouts,
    aggregate per-zone/per-skill/per-user fragility counts."""
    rng = random.Random(p.seed)
    n = len(p.users)
    task_by_id = {t.id: t for t in p.tasks}
    zone_of_task = {t.id: t.zoneId for t in p.tasks}
    all_zone_ids = sorted({t.zoneId for t in p.tasks})

    task_fail_count = {t.id: 0 for t in p.tasks}
    zone_fail_count = {z: 0 for z in all_zone_ids}
    skill_shortage_count: dict = {}
    user_dropped_count = {u.id: 0 for u in p.users}
    user_dropped_and_failed = {u.id: 0 for u in p.users}
    runs_with_shortage = 0
    total_unfilled_units = 0

    for _ in range(p.runs):
        pct = rng.uniform(p.dropoutMin, p.dropoutMax)
        drop_n = max(1, int(round(n * pct)))
        dropped_idx = set(rng.sample(range(n), min(drop_n, n)))
        dropped_user_ids = {p.users[i].id for i in dropped_idx}
        remaining = [u for i, u in enumerate(p.users) if i not in dropped_idx]

        for uid in dropped_user_ids:
            user_dropped_count[uid] += 1

        inner = Payload(
            users=remaining,
            slots=p.slots,
            tasks=p.tasks,
            adjacent=p.adjacent,
            timeLimit=p.innerTimeLimit,
            avoidConsecutive=True,
        )
        result = solve_model(inner)

        failed_zones_this_run: set = set()
        run_had_shortage = False
        for item in result["unfilled"]:
            missing = item["missing"]
            if missing <= 0:
                continue
            tid = item["taskId"]
            task_fail_count[tid] += missing
            total_unfilled_units += missing
            run_had_shortage = True
            failed_zones_this_run.add(zone_of_task[tid])
            skill = task_by_id[tid].skill
            if skill:
                skill_shortage_count[skill] = skill_shortage_count.get(skill, 0) + missing

        for zid in failed_zones_this_run:
            zone_fail_count[zid] += 1

        if run_had_shortage:
            runs_with_shortage += 1
            for uid in dropped_user_ids:
                user_dropped_and_failed[uid] += 1

    return {
        "runs": p.runs,
        "runsWithShortage": runs_with_shortage,
        "totalUnfilledUnits": total_unfilled_units,
        "taskFailCount": task_fail_count,
        "zoneFailCount": zone_fail_count,
        "skillShortageCount": skill_shortage_count,
        "userDroppedCount": user_dropped_count,
        "userDroppedAndFailed": user_dropped_and_failed,
    }
