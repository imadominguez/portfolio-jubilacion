"use client";

import { Suspense } from "react";
import { NextStep, NextStepProvider } from "nextstepjs";
import { OnboardingCard } from "@/components/onboarding/onboarding-card";
import { TourHighlightSync } from "@/components/onboarding/tour-highlight-sync";
import { TourPositionSync } from "@/components/onboarding/tour-position-sync";
import { TourScrollSync } from "@/components/onboarding/tour-scroll-sync";
import {
  PathnameReporter,
  useTourNavigationAdapter,
} from "@/components/onboarding/tour-navigation-adapter";
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
        navigationAdapter={useTourNavigationAdapter}
      >
        {/* Leen usePathname(): van en <Suspense> para no bloquear el static
            shell de rutas con params (ver tour-navigation-adapter.tsx). */}
        <Suspense fallback={null}>
          <PathnameReporter />
          <TourScrollSync />
        </Suspense>
        <TourPositionSync />
        <TourHighlightSync />
        {children}
      </NextStep>
    </NextStepProvider>
  );
}
