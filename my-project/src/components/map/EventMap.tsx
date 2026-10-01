"use client";

import { APIProvider, Map, MapProps } from "@vis.gl/react-google-maps";
import { ReactNode } from "react";

export type EventMapProps = {
  center: { lat: number; lng: number };
  zoom?: number;
  children?: ReactNode;
  mapId?: string;
} & Pick<MapProps, "onClick" | "disableDefaultUI" | "gestureHandling">;

const DEFAULT_ZOOM = 17;

export function EventMap({
  center,
  zoom = DEFAULT_ZOOM,
  children,
  mapId,
  onClick,
  disableDefaultUI,
  gestureHandling = "greedy",
}: EventMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-600">
        Missing <code className="mx-1 font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in .env
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={["geometry", "places"]}>
      <Map
        defaultCenter={center}
        defaultZoom={zoom}
        gestureHandling={gestureHandling}
        disableDefaultUI={disableDefaultUI ?? false}
        mapId={mapId ?? "event-management-map"}
        onClick={onClick}
        style={{ width: "100%", height: "100%" }}
      >
        {children}
      </Map>
    </APIProvider>
  );
}
