import { NextResponse } from "next/server";
import { runAssignment } from "@/services/assign";

export async function POST(req: Request) {
  const { eventId } = await req.json();
  try {
    return NextResponse.json(await runAssignment(eventId));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
