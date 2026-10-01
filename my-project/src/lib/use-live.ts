"use client";

import { useEffect, useRef } from "react";

type Handler = (payload: unknown) => void;

/**
 * Subscribe to one or more server topics via Server-Sent Events.
 * `handlers` is a mapping of topic name → callback. Changes to the callback
 * reference between renders are fine — we always invoke the latest one.
 */
export function useLive(handlers: Record<string, Handler>) {
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    const topics = Object.keys(handlers);
    if (!topics.length) return;
    const es = new EventSource(`/api/sse?topics=${topics.join(",")}`);
    const subs: Array<[string, (e: MessageEvent) => void]> = [];
    for (const t of topics) {
      const fn = (e: MessageEvent) => {
        try {
          latest.current[t]?.(JSON.parse(e.data));
        } catch {
          /* ignore malformed payloads */
        }
      };
      es.addEventListener(t, fn as EventListener);
      subs.push([t, fn]);
    }
    return () => {
      for (const [t, fn] of subs) es.removeEventListener(t, fn as EventListener);
      es.close();
    };
    // Only re-subscribe when the set of topic keys changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(handlers).join(",")]);
}
