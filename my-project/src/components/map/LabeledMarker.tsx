"use client";

import { AdvancedMarker, Pin } from "@vis.gl/react-google-maps";
import { ReactNode } from "react";

type Props = {
  position: { lat: number; lng: number };
  background: string;
  glyphColor?: string;
  borderColor?: string;
  title?: string;
  glyph?: ReactNode | string;
  onClick?: () => void;
};

export function LabeledMarker({
  position,
  background,
  glyphColor = "#ffffff",
  borderColor,
  title,
  glyph,
  onClick,
}: Props) {
  return (
    <AdvancedMarker position={position} title={title} onClick={onClick}>
      <Pin
        background={background}
        glyphColor={glyphColor}
        borderColor={borderColor ?? background}
        glyph={typeof glyph === "string" ? glyph : undefined}
      />
    </AdvancedMarker>
  );
}
