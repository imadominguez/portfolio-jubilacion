"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  Coins,
  ArrowLeftRight,
  BarChart3,
  CalendarDays,
  Database,
  DollarSign,
  HelpCircle,
  Receipt,
  LayoutDashboard,
  Scale,
  Search,
  Target,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";

type CommandEntry = {
  label: string;
  href: string;
  group: string;
  icon: LucideIcon;
};

const COMMANDS: CommandEntry[] = [
  { label: "Dashboard", href: "/", group: "Principal", icon: LayoutDashboard },
  { label: "Snapshots", href: "/snapshots", group: "Principal", icon: CalendarDays },
  { label: "Historial CCL", href: "/ccl", group: "Principal", icon: Activity },
  { label: "Performance", href: "/performance", group: "Principal", icon: TrendingUp },
  { label: "Análisis", href: "/analysis", group: "Análisis", icon: BarChart3 },
  { label: "Ganancia Real", href: "/real-gains", group: "Análisis", icon: DollarSign },
  { label: "Rebalanceo", href: "/rebalance", group: "Análisis", icon: Scale },
  { label: "Plan DCA", href: "/plan", group: "Análisis", icon: Wallet },
  { label: "Jubilación", href: "/retirement", group: "Análisis", icon: Target },
  { label: "Flujo de caja", href: "/flujo", group: "Análisis", icon: Coins },
  { label: "Impuestos", href: "/impuestos", group: "Análisis", icon: Receipt },
  { label: "Centro de Datos", href: "/datos", group: "Datos", icon: Database },
  { label: "Alertas", href: "/alertas", group: "Datos", icon: Bell },
  { label: "Transacciones", href: "/transactions", group: "Datos", icon: ArrowLeftRight },
  { label: "Guía Cocos", href: "/guia", group: "Datos", icon: HelpCircle },
];

const GROUPS = ["Principal", "Análisis", "Datos"] as const;

export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function run(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 text-xs text-muted-foreground pr-1.5"
      >
        <Search className="size-3.5" />
        <span className="hidden sm:inline">Buscar…</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Buscar"
        description="Navegá a cualquier sección de la app"
      >
        <Command>
          <CommandInput placeholder="Buscar una sección…" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            {GROUPS.map((group) => (
              <CommandGroup key={group} heading={group}>
                {COMMANDS.filter((c) => c.group === group).map((c) => (
                  <CommandItem
                    key={c.href}
                    value={`${c.label} ${c.href}`}
                    onSelect={() => run(c.href)}
                    className="gap-2"
                  >
                    <c.icon className="size-4 text-muted-foreground" />
                    {c.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
