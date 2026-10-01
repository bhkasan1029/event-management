// In-process event bus. Used to push live updates to open SSE connections.
// Fine for a single Next.js server — if we scale out we'll move to Redis
// pub/sub or Pusher.

type Listener = (payload: unknown) => void;

const topics = new Map<string, Set<Listener>>();

export function subscribe(topic: string, listener: Listener): () => void {
  let set = topics.get(topic);
  if (!set) {
    set = new Set();
    topics.set(topic, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) topics.delete(topic);
  };
}

export function publish(topic: string, payload: unknown) {
  const set = topics.get(topic);
  if (!set) return;
  for (const l of set) {
    try {
      l(payload);
    } catch {
      // listener errors shouldn't take out the publisher
    }
  }
}

export const TOPIC = {
  issues: "issues",
  parking: "parking",
  evacuation: "evacuation",
  ambulances: "ambulances",
} as const;
