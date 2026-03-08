import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

interface SiteHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function SiteHeader({ title, description, actions }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-xl">
      <div className="px-5 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <SidebarTrigger className="-ml-1 size-8 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg" />
          <Separator orientation="vertical" className="h-4 opacity-40" />
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-foreground truncate">
              {title}
            </span>
            {description && (
              <span className="text-xs text-muted-foreground truncate hidden sm:block">
                {description}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {actions}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
