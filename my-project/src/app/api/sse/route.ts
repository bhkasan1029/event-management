import { NextRequest } from "next/server";
import { subscribe, TOPIC } from "@/lib/bus";

// Required so Next doesn't try to statically prerender this route.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const requested = url.searchParams.get("topics")?.split(",").filter(Boolean) ?? Object.values(TOPIC);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (topic: string, payload: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${topic}\ndata: ${JSON.stringify(payload)}\n\n`),
        );
      };

      // Initial "connected" ping so the client knows the connection is live.
      send("ready", { topics: requested, at: Date.now() });

      const unsubs = requested.map((t) => subscribe(t, (payload) => send(t, payload)));

      // Keep-alive heartbeat every 25s — proxies tend to drop idle SSE.
      const beat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(beat);
        }
      }, 25_000);

      req.signal.addEventListener("abort", () => {
        clearInterval(beat);
        unsubs.forEach((u) => u());
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
