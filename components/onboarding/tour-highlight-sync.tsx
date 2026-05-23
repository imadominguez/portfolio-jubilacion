"use client";

import { useEffect } from "react";
import { useNextStep } from "nextstepjs";
import { onboardingSteps } from "@/lib/onboarding/steps";
import { PRIMER_USO_TOUR } from "@/lib/onboarding/steps";

export function TourHighlightSync() {
  const { currentStep, currentTour, isNextStepVisible } = useNextStep();

  useEffect(() => {
    document
      .querySelectorAll("[data-tour-highlight]")
      .forEach((node) => node.removeAttribute("data-tour-highlight"));

    if (!isNextStepVisible || currentTour !== PRIMER_USO_TOUR) return;

    const selector = onboardingSteps[0]?.steps[currentStep]?.selector;
    if (!selector) return;

    document.querySelector(selector)?.setAttribute("data-tour-highlight", "true");
  }, [currentStep, currentTour, isNextStepVisible]);

  useEffect(() => {
    return () => {
      document
        .querySelectorAll("[data-tour-highlight]")
        .forEach((node) => node.removeAttribute("data-tour-highlight"));
    };
  }, []);

  return null;
}
