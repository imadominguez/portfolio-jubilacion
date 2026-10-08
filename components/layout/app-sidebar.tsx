"use client";

import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  Database,
  HelpCircle,
  Wallet,
  type LucideIcon,
} from "lucide-react";
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

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const NAV_MAIN: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Snapshots", href: "/snapshots", icon: CalendarDays },
  { label: "Historial CCL", href: "/ccl", icon: Activity },
  { label: "Performance", href: "/performance", icon: TrendingUp },
];

const NAV_ANALYSIS: NavItem[] = [
  { label: "Análisis", href: "/analysis", icon: BarChart3 },
  { label: "Ganancia Real", href: "/real-gains", icon: DollarSign },
  { label: "Rebalanceo", href: "/rebalance", icon: Scale },
  { label: "Plan DCA", href: "/plan", icon: Wallet },
  { label: "Jubilación", href: "/retirement", icon: Target },
];

const NAV_DATA: NavItem[] = [
  { label: "Centro de Datos", href: "/datos", icon: Database },
  { label: "Transacciones", href: "/transactions", icon: ArrowLeftRight },
  { label: "Guía Cocos", href: "/guia", icon: HelpCircle },
];

const NAV_CONFIG: NavItem[] = [
  { label: "Assets", href: "/assets", icon: Layers },
  { label: "Estrategia", href: "/strategy", icon: BookOpen },
  { label: "Configuración", href: "/settings", icon: Settings },
  { label: "Oportunidades", href: "/portfolio", icon: FileText },
];

type AppSidebarProps = {
  // Grupo "Configuración": lo resuelve el servidor según el rol, detrás de su
  // propio <Suspense>, para que el resto del sidebar quede en el static shell.
  adminNav?: ReactNode;
};

export function AppSidebar({ adminNav }: AppSidebarProps) {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-5">
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
            <span className="text-[11px] font-medium text-sidebar-foreground/45 truncate leading-tight">
              Jubilación
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 gap-1">
        <NavGroup label={null} items={NAV_MAIN} />
        <NavGroup label="Análisis" items={NAV_ANALYSIS} separated />
        <NavGroup label="Datos" items={NAV_DATA} separated />
        {adminNav}
      </SidebarContent>

      <SidebarSeparator className="opacity-80" />

      <SidebarFooter className="px-3 py-3">
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              tooltip="Cerrar sesión"
              className="rounded-lg border border-transparent text-sidebar-foreground/60 transition-colors duration-150 hover:text-destructive hover:bg-destructive/12"
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

export function AdminNavGroup() {
  return <NavGroup label="Configuración" items={NAV_CONFIG} separated />;
}

function NavGroup({
  label,
  items,
  separated = false,
}: {
  label: string | null;
  items: NavItem[];
  separated?: boolean;
}) {
  return (
    <div>
      {separated ? <SidebarSeparator className="my-2 opacity-80" /> : null}
      <SidebarGroup className="p-0 gap-1">
        {label ? (
          <SidebarGroupLabel className="px-2 pb-1 text-[10px] font-semibold tracking-[0.2em] uppercase text-sidebar-foreground/38">
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
    <SidebarMenu className="gap-1">
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
                    isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/55"
                  )}
                />
                <span
                  className={cn(
                    "text-sm transition-colors duration-150",
                    isActive
                      ? "text-sidebar-accent-foreground font-semibold"
                      : "text-sidebar-foreground/72 font-medium"
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
