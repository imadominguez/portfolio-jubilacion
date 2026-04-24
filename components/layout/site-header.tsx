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
      <div className="px-3 sm:px-5 h-12 sm:h-14 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <SidebarTrigger className="-ml-1 size-8 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg shrink-0" />
          <Separator orientation="vertical" className="h-4 opacity-40 hidden sm:block" />
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs sm:text-sm font-semibold text-foreground truncate">
              {title}
            </span>
            {description && (
              <span className="text-[10px] sm:text-xs text-muted-foreground truncate hidden md:block">
                {description}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <div className="hidden xs:flex items-center gap-1 sm:gap-1.5">
            {actions}
          </div>
          <ThemeToggle />
        </div>
      </div>
      {/* Mobile actions row */}
      {actions && (
        <div className="xs:hidden px-3 pb-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {actions}
        </div>
      )}
    </header>
  );
}
