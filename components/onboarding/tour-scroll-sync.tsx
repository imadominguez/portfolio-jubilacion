"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useNextStep } from "nextstepjs";
import { PRIMER_USO_TOUR, onboardingSteps } from "@/lib/onboarding/steps";
import {
  SIDEBAR_TOUR_SELECTORS,
  TOUR_STEP_GUIDE_SNAPSHOTS,
  TOUR_STEP_GUIDE_TRANSACCIONES,
  scrollGuideTourTarget,
  scrollSidebarTourTarget,
} from "@/lib/onboarding/tour-targets";

export function TourScrollSync() {
  const pathname = usePathname();
  const { currentStep, currentTour, isNextStepVisible } = useNextStep();
  const lastSyncedStep = useRef<number | null>(null);

  useEffect(() => {
    if (currentTour !== PRIMER_USO_TOUR || !isNextStepVisible) return;
    if (lastSyncedStep.current === currentStep) return;

    lastSyncedStep.current = currentStep;

    const step = onboardingSteps[0]?.steps[currentStep];
    const selector = step?.selector;
    if (!selector) return;

    if (SIDEBAR_TOUR_SELECTORS.has(selector)) {
      scrollSidebarTourTarget(selector);
      return;
    }

    if (pathname !== "/guia") return;

    if (currentStep === TOUR_STEP_GUIDE_SNAPSHOTS) {
      scrollGuideTourTarget("tour-guide-snapshots");
      return;
    }

    if (currentStep === TOUR_STEP_GUIDE_TRANSACCIONES) {
      scrollGuideTourTarget("tour-guide-transacciones");
    }
  }, [pathname, currentStep, currentTour, isNextStepVisible]);

  useEffect(() => {
    if (!isNextStepVisible) {
      lastSyncedStep.current = null;
    }
  }, [isNextStepVisible]);

  return null;
}
