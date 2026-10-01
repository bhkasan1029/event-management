import random
from typing import Optional
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
    skill: Optional[str]
    needed: int


class Payload(BaseModel):
    users: list[User]
    slots: list[Slot]
    tasks: list[Task]
    adjacent: list[tuple[int, int]]  # pairs of back-to-back timeslot ids
    timeLimit: float = 5.0


class StressPayload(BaseModel):
    users: list[User]
    slots: list[Slot]
    tasks: list[Task]
    adjacent: list[tuple[int, int]]
    runs: int = 100
    dropoutMin: float = 0.15
    dropoutMax: float = 0.20
    innerTimeLimit: float = 0.5
    seed: int = 42


def _build_and_solve(users, slots, tasks, adjacent, time_limit):
    """Core CP-SAT model. Returns status, assignments, unfilled, maxLoad, consecutiveShifts."""
    m = cp_model.CpModel()
    hours = {s.id: s.hours for s in slots}
    x, by_user_slot, by_task = {}, {}, {}

    for t in tasks:
        for u in users:
            if t.slotId in u.slots and (t.skill is None or t.skill in u.skills):
                v = m.NewBoolVar(f"x_{u.id}_{t.id}")
                x[u.id, t.id] = v
                by_user_slot.setdefault((u.id, t.slotId), []).append(v)
                by_task.setdefault(t.id, []).append(v)

    for vs in by_user_slot.values():
        m.Add(sum(vs) <= 1)

    short = {}
    for t in tasks:
        short[t.id] = m.NewIntVar(0, t.needed, f"short_{t.id}")
        m.Add(sum(by_task.get(t.id, [])) + short[t.id] == t.needed)

    load = {}
    task_slot = {t.id: t.slotId for t in tasks}
    for u in users:
        mine = [(v, task_slot[tid]) for (uid, tid), v in x.items() if uid == u.id]
        load[u.id] = sum(v for v, _ in mine)
        m.Add(sum(int(hours[s] * 10) * v for v, s in mine) <= u.maxHours * 10)

    consec = []
    for u in users:
        for a, b in adjacent:
            wa, wb = by_user_slot.get((u.id, a)), by_user_slot.get((u.id, b))
            if wa and wb:
                c = m.NewBoolVar(f"c_{u.id}_{a}_{b}")
                m.Add(c >= sum(wa) + sum(wb) - 1)
                consec.append(c)

    max_load = m.NewIntVar(0, max(1, len(tasks)), "max_load")
    for u in users:
        m.Add(max_load >= load[u.id])

    zone = {t.id: t.zoneId for t in tasks}
    user_by_id = {u.id: u for u in users}
    pref_cost = sum(
        (min(p_rank - 1, 4) * v) if (p_rank := user_by_id[uid].prefs.get(zone[tid])) else (5 * v)
        for (uid, tid), v in x.items()
    )

    m.Minimize(1000 * sum(short.values()) + 20 * max_load + 10 * sum(consec) + 1 * pref_cost)

    s = cp_model.CpSolver()
    s.parameters.max_time_in_seconds = time_limit
    s.parameters.num_workers = 8
    status = s.Solve(m)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {"status": "infeasible", "assignments": [], "unfilled": [], "maxLoad": 0, "consecutiveShifts": 0}

    return {
        "status": "optimal" if status == cp_model.OPTIMAL else "feasible",
        "assignments": [{"taskId": t, "userId": u} for (u, t), v in x.items() if s.Value(v)],
        "unfilled": [{"taskId": i, "missing": s.Value(v)} for i, v in short.items() if s.Value(v)],
        "consecutiveShifts": sum(s.Value(c) for c in consec),
        "maxLoad": s.Value(max_load),
    }


@app.post("/solve")
def solve(p: Payload):
    return _build_and_solve(p.users, p.slots, p.tasks, p.adjacent, p.timeLimit)


@app.post("/stress-test")
def stress_test(p: StressPayload):
    """Monte Carlo: run the solver ~100 times with random 15–20% volunteer dropouts,
    aggregate per-zone/per-skill/per-user fragility counts."""
    rng = random.Random(p.seed)
    n = len(p.users)
    task_by_id = {t.id: t for t in p.tasks}
    zone_of_task = {t.id: t.zoneId for t in p.tasks}
    all_zone_ids = sorted({t.zoneId for t in p.tasks})

    task_fail_count: dict[int, int] = {t.id: 0 for t in p.tasks}
    zone_fail_count: dict[int, int] = {z: 0 for z in all_zone_ids}
    skill_shortage_count: dict[str, int] = {}
    user_dropped_count: dict[int, int] = {u.id: 0 for u in p.users}
    user_dropped_and_failed: dict[int, int] = {u.id: 0 for u in p.users}
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

        result = _build_and_solve(remaining, p.slots, p.tasks, p.adjacent, p.innerTimeLimit)

        failed_zones_this_run: set[int] = set()
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
