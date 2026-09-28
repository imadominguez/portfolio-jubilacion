"use client";

import { NextStep, NextStepProvider } from "nextstepjs";
import { OnboardingCard } from "@/components/onboarding/onboarding-card";
import { TourHighlightSync } from "@/components/onboarding/tour-highlight-sync";
import { TourPositionSync } from "@/components/onboarding/tour-position-sync";
import { TourScrollSync } from "@/components/onboarding/tour-scroll-sync";
import { onboardingSteps } from "@/lib/onboarding/steps";
import { nudgeTourPosition } from "@/lib/onboarding/tour-targets";

type OnboardingProviderProps = {
  children: React.ReactNode;
};

const tourCardTransition = {
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  duration: 0.45,
};

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  function handleFinish() {
    // El estado de onboarding ahora vive en la base (app/actions/setup.ts).
    // El tour es una ayuda contextual opcional, no el onboarding principal.
  }

  function handleStepChange() {
    window.setTimeout(nudgeTourPosition, 350);
    window.setTimeout(nudgeTourPosition, 700);
  }

  return (
    <NextStepProvider>
      <NextStep
        steps={onboardingSteps}
        cardComponent={OnboardingCard}
        cardTransition={tourCardTransition}
        onComplete={handleFinish}
        onSkip={handleFinish}
        onStepChange={handleStepChange}
        scrollToTop={false}
        overlayZIndex={50}
        shadowOpacity="0.55"
      >
        <TourPositionSync />
        <TourScrollSync />
        <TourHighlightSync />
        {children}
      </NextStep>
    </NextStepProvider>
  );
}
