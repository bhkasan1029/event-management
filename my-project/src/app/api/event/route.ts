import { NextResponse } from "next/server";
import { getActiveEvent } from "@/lib/event";

export async function GET() {
  const event = await getActiveEvent();
  if (!event) return NextResponse.json({ error: "no event" }, { status: 404 });
  return NextResponse.json(event);
}
