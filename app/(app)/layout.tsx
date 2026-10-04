import { Suspense } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AdminNav } from "@/components/layout/admin-nav";
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";

// No lee la sesión en el top-level: el sidebar y los providers entran al static
// shell, y solo el grupo admin espera al request (ADR-0017).
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <OnboardingProvider>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar
            adminNav={
              <Suspense fallback={null}>
                <AdminNav />
              </Suspense>
            }
          />
          <SidebarInset>{children}</SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </OnboardingProvider>
  );
}
