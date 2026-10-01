import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { latestReport, runTriScenario } from "@/services/stressTest";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "organiser") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { eventId } = await req.json().catch(() => ({}));
  if (!eventId || typeof eventId !== "number") {
    return NextResponse.json({ error: "eventId (number) required" }, { status: 400 });
  }

  try {
    const report = await runTriScenario(eventId);
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "organiser") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const eventIdStr = req.nextUrl.searchParams.get("eventId");
  const eventId = eventIdStr ? Number(eventIdStr) : NaN;
  if (!eventId || Number.isNaN(eventId)) {
    return NextResponse.json({ error: "eventId query param required" }, { status: 400 });
  }

  const report = await latestReport(eventId);
  return NextResponse.json({ report });
}
