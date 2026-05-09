"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  CalendarDays,
  Layers,
  BarChart3,
  Scale,
  ArrowLeftRight,
  Target,
  Settings,
  DollarSign,
  LogOut,
  Activity,
  FileText,
  BookOpen,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const NAV_MAIN = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Performance", href: "/performance", icon: TrendingUp },
  { label: "Historial CCL", href: "/ccl", icon: Activity },
  { label: "Snapshots", href: "/snapshots", icon: CalendarDays },
];

const NAV_ANALYSIS = [
  { label: "Análisis", href: "/analysis", icon: BarChart3 },
  { label: "Rebalanceo", href: "/rebalance", icon: Scale },
  { label: "Transacciones", href: "/transactions", icon: ArrowLeftRight },
  { label: "Jubilación", href: "/retirement", icon: Target },
  { label: "Ganancia Real", href: "/real-gains", icon: DollarSign },
  { label: "Reporte mensual", href: "/portfolio", icon: FileText },
];

const NAV_CONFIG = [
  { label: "Assets", href: "/assets", icon: Layers },
  { label: "Estrategia", href: "/strategy", icon: BookOpen },
  { label: "Configuración", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-2.5 overflow-hidden">
          {/* Brand mark */}
          <div className="size-7 shrink-0 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <span className="text-[10px] font-black text-sidebar-primary-foreground tracking-tight">
              PJ
            </span>
          </div>
          <div className="flex flex-col overflow-hidden min-w-0">
            <span className="text-sm font-bold text-sidebar-foreground truncate leading-tight">
              Portfolio
            </span>
            <span className="text-[10px] font-medium text-sidebar-foreground/50 truncate leading-tight">
              Jubilación
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3">
        {[
          { items: NAV_MAIN, groupLabel: null },
          { items: NAV_ANALYSIS, groupLabel: "Análisis" },
          { items: NAV_CONFIG, groupLabel: "Configuración" },
        ].map(({ items, groupLabel }, groupIdx) => (
          <SidebarGroup key={groupIdx} className="p-0">
            {groupLabel && (
              <SidebarGroupLabel className="px-2 text-[10px] font-semibold tracking-widest uppercase text-sidebar-foreground/30 mt-2">
                {groupLabel}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {items.map(({ label, href, icon: Icon }) => {
                  const isActive =
                    href === "/" ? pathname === "/" : pathname.startsWith(href);

                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={label}
                        className={cn(
                          "rounded-lg border border-transparent",
                          isActive && "sidebar-active-item"
                        )}
                      >
                        <Link href={href}>
                          <Icon
                            className={cn(
                              "size-4 shrink-0",
                              isActive
                                ? "text-sidebar-accent-foreground"
                                : "text-sidebar-foreground/60"
                            )}
                          />
                          <span
                            className={cn(
                              "text-sm",
                              isActive
                                ? "text-sidebar-accent-foreground font-semibold"
                                : "text-sidebar-foreground/70 font-medium"
                            )}
                          >
                            {label}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="px-3 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              tooltip="Cerrar sesión"
              className="rounded-lg border border-transparent text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-4 shrink-0" />
              <span className="text-sm font-medium">Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
