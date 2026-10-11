"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { COMMAND_ACTIONS, NAV_GROUPS } from "@/components/layout/nav-config";
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

// Las secciones salen de la misma config que el sidebar (nav-config.ts); las
// de admin quedan afuera porque el header no conoce el rol.
const SECTION_GROUPS = NAV_GROUPS.map((g) => ({ heading: g.label ?? "Resumen", items: g.items }));

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
        description="Navegá a una sección o empezá una tarea"
      >
        <Command>
          <CommandInput placeholder="Buscar una sección o acción…" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup heading="Acciones">
              {COMMAND_ACTIONS.map((c) => (
                <CommandItem key={c.label} value={c.label} onSelect={() => run(c.href)} className="gap-2">
                  <c.icon className="size-4 text-muted-foreground" />
                  {c.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {SECTION_GROUPS.map((group) => (
              <CommandGroup key={group.heading} heading={group.heading}>
                {group.items.map((c) => (
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
