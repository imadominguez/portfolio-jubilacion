import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";
import { getSession } from "@/lib/auth-session";
import { isAdminRole } from "@/lib/user-role";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const isAdmin = isAdminRole(session?.user.role);

  return (
    <OnboardingProvider>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar isAdmin={isAdmin} />
          <SidebarInset>{children}</SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </OnboardingProvider>
  );
}
