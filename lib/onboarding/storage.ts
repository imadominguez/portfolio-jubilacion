export const ONBOARDING_STORAGE_KEY = "pj_onboarding_v1_completed";

export function isOnboardingCompleted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function markOnboardingCompleted(): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
  } catch {
    // Ignorar en modo privado o storage deshabilitado
  }
}
