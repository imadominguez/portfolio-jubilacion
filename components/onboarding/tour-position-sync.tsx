"use client";

import { useEffect, useRef } from "react";
import { useNextStep } from "nextstepjs";
import { nudgeTourPosition } from "@/lib/onboarding/tour-targets";

/**
 * NextStep calcula posiciones con scrollTop del documento pero no escucha scroll.
 * Forzamos un resize en cada scroll para re-anclar el spotlight y la card.
 */
export function TourPositionSync() {
  const { isNextStepVisible } = useNextStep();
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isNextStepVisible) return;

    const handleScroll = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = requestAnimationFrame(() => {
        nudgeTourPosition();
        frameRef.current = null;
      });
    };

    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      window.removeEventListener("scroll", handleScroll, { capture: true });
      window.removeEventListener("resize", handleScroll);
    };
  }, [isNextStepVisible]);

  return null;
}
