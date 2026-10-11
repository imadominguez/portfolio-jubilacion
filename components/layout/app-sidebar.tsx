"use client";

import { Suspense, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { KeyRound, LogOut } from "lucide-react";
import { ADMIN_NAV_GROUP, NAV_GROUPS, type NavItem } from "@/components/layout/nav-config";
import { signOut } from "@/lib/auth-client";
import { ChangePasswordDialog } from "@/components/layout/change-password-dialog";
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

type AppSidebarProps = {
  // Grupo "Administración": lo resuelve el servidor según el rol, detrás de su
  // propio <Suspense>, para que el resto del sidebar quede en el static shell.
  adminNav?: ReactNode;
};

export function AppSidebar({ adminNav }: AppSidebarProps) {
  const router = useRouter();
  const [passwordOpen, setPasswordOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-3">
        <div className="flex items-center gap-3 overflow-hidden">
          <div
            className="size-8 shrink-0 rounded-xl bg-sidebar-primary shadow-sm ring-2 ring-sidebar-primary/35 ring-offset-2 ring-offset-sidebar flex items-center justify-center transition-shadow hover:shadow-md"
          >
            <span className="text-[11px] font-black text-sidebar-primary-foreground tracking-tight">
              PJ
            </span>
          </div>
          <div className="flex flex-col overflow-hidden min-w-0">
            <span className="text-sm font-bold text-sidebar-foreground truncate leading-snug tracking-tight">
              Portfolio
            </span>
            <span className="text-[11px] font-medium text-sidebar-foreground/80 truncate leading-tight">
              Jubilación
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 gap-1.5">
        {NAV_GROUPS.map((g) => (
          <NavGroup key={g.label ?? "inicio"} label={g.label} items={g.items} />
        ))}
        {adminNav}
      </SidebarContent>

      <SidebarSeparator className="opacity-80" />

      <SidebarFooter className="px-3 py-3">
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setPasswordOpen(true)}
              tooltip="Cambiar contraseña"
              className="rounded-lg border border-transparent text-sidebar-foreground/80 transition-colors duration-150 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <KeyRound className="size-4 shrink-0" />
              <span className="text-sm font-medium">Cambiar contraseña</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              tooltip="Cerrar sesión"
              className="rounded-lg border border-transparent text-sidebar-foreground/80 transition-colors duration-150 hover:text-destructive hover:bg-destructive/12"
            >
              <LogOut className="size-4 shrink-0" />
              <span className="text-sm font-medium">Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </Sidebar>
  );
}

export function AdminNavGroup() {
  return <NavGroup label={ADMIN_NAV_GROUP.label} items={ADMIN_NAV_GROUP.items} />;
}

function NavGroup({ label, items }: { label: string | null; items: NavItem[] }) {
  return (
    // Los títulos de grupo ya separan; sin separadores entra todo en 900 px de alto.
    <div>
      <SidebarGroup className="p-0 gap-0.5">
        {label ? (
          <SidebarGroupLabel className="h-5 px-2 text-xs font-medium text-sidebar-foreground/65">
            {label}
          </SidebarGroupLabel>
        ) : null}
        <SidebarGroupContent>
          {/* usePathname() se suspende al prerenderizar rutas con params
              dinámicos (/snapshots/[id]): el fallback dibuja los mismos links
              sin ítem activo, así el sidebar igual entra al static shell. */}
          <Suspense fallback={<NavMenu items={items} pathname={null} />}>
            <ActiveNavMenu items={items} />
          </Suspense>
        </SidebarGroupContent>
      </SidebarGroup>
    </div>
  );
}

function ActiveNavMenu({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return <NavMenu items={items} pathname={pathname} />;
}

const TOUR_IDS: Record<string, string> = {
  "/snapshots": "tour-nav-snapshots",
  "/guia": "tour-nav-guia",
  "/transactions": "tour-nav-transacciones",
};

function NavMenu({ items, pathname }: { items: NavItem[]; pathname: string | null }) {
  return (
    <SidebarMenu className="gap-0.5">
      {items.map(({ label, href, icon: Icon }) => {
        const isActive =
          pathname !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));

        return (
          <SidebarMenuItem key={href}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={label}
              className={cn(
                "rounded-lg border border-transparent transition-colors duration-150",
                !isActive &&
                  "hover:bg-sidebar-accent/50 hover:border-sidebar-border/40 hover:text-sidebar-foreground",
                isActive && "sidebar-active-item"
              )}
            >
              <Link href={href} id={TOUR_IDS[href]}>
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors duration-150",
                    isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/70"
                  )}
                />
                <span
                  className={cn(
                    "text-sm transition-colors duration-150",
                    isActive
                      ? "text-sidebar-accent-foreground font-semibold"
                      : "text-sidebar-foreground/85 font-medium"
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
  );
}
