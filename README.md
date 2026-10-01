# EventOps

Event volunteer & crowd coordination platform.

## Structure

```
my-project/     # Next.js 16 app (React 19, Tailwind 4, Prisma, Neon)
  solver/       # Python FastAPI + OR-Tools CP-SAT allocation service
```

## Running locally

### Next.js app

```bash
cd my-project
npm install
cp .env.example .env   # fill in DATABASE_URL, DIRECT_URL, SOLVER_URL
npx prisma migrate dev
npx prisma db seed     # creates 3 dev users
npm run dev
```

Open http://localhost:3000. Use any seed login (password: `password123`):
- `organiser@eventops.com` — Organiser
- `volunteer@eventops.com` — Volunteer (Team Lead)
- `attendee@eventops.com` — Attendee

### Python solver

```bash
cd my-project/solver
python -m venv .venv && source .venv/bin/activate
pip install fastapi uvicorn ortools pydantic
uvicorn main:app --port 8001
```

The Next app POSTs to `${SOLVER_URL}/solve` (default `http://localhost:8001`) via `/api/assign`.
