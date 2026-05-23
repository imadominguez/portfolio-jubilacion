"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useNextStep } from "nextstepjs";
import {
  isOnboardingCompleted,
} from "@/lib/onboarding/storage";
import { PRIMER_USO_TOUR } from "@/lib/onboarding/steps";

export function OnboardingTrigger() {
  const pathname = usePathname();
  const { startNextStep, isNextStepVisible } = useNextStep();
  const hasAutoStarted = useRef(false);

  useEffect(() => {
    if (pathname !== "/") return;
    if (hasAutoStarted.current) return;
    if (isNextStepVisible) return;
    if (isOnboardingCompleted()) return;

    hasAutoStarted.current = true;

    const timer = window.setTimeout(() => {
      startNextStep(PRIMER_USO_TOUR);
    }, 600);

    return () => window.clearTimeout(timer);
  }, [pathname, startNextStep, isNextStepVisible]);

  return null;
}
