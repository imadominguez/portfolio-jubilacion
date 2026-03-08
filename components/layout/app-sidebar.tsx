"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, TrendingUp, CalendarDays, Layers } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Performance", href: "/performance", icon: TrendingUp },
  { label: "Snapshots", href: "/snapshots", icon: CalendarDays },
  { label: "Assets", href: "/assets", icon: Layers },
];

export function AppSidebar() {
  const pathname = usePathname();

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
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
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
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="px-4 py-3">
        <span className="text-[9px] font-semibold tracking-widest text-sidebar-foreground/30 uppercase truncate">
          Cocos Capital
        </span>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
