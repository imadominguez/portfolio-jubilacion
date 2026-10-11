import {
  LayoutDashboard,
  Briefcase,
  TrendingUp,
  CalendarDays,
  Layers,
  PieChart,
  ArrowLeftRight,
  Target,
  Settings,
  DollarSign,
  Activity,
  Bell,
  Coins,
  FileText,
  BookOpen,
  Database,
  HelpCircle,
  Receipt,
  Wallet,
  Upload,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

// Fuente única de la navegación: el sidebar y ⌘K se arman de acá. Grupos de a
// 4 como máximo, por tarea (resumen, análisis, cuenta, datos) y no por tipo
// de pantalla. Las rutas de admin tienen que coincidir con ADMIN_PATH_PREFIXES
// de proxy.ts.

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  // null: el primer grupo va sin título.
  label: string | null;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Cartera", href: "/cartera", icon: Briefcase },
      { label: "Plan DCA", href: "/plan", icon: Wallet },
      { label: "Jubilación", href: "/retirement", icon: Target },
    ],
  },
  {
    label: "Análisis",
    items: [
      { label: "Rendimiento", href: "/performance", icon: TrendingUp },
      { label: "Ganancia real", href: "/real-gains", icon: DollarSign },
      { label: "Concentración", href: "/analysis", icon: PieChart },
      { label: "Historial CCL", href: "/ccl", icon: Activity },
    ],
  },
  {
    label: "Cuenta",
    items: [
      { label: "Transacciones", href: "/transactions", icon: ArrowLeftRight },
      { label: "Flujo de caja", href: "/flujo", icon: Coins },
      { label: "Impuestos", href: "/impuestos", icon: Receipt },
    ],
  },
  {
    label: "Datos",
    items: [
      { label: "Centro de Datos", href: "/datos", icon: Database },
      { label: "Snapshots", href: "/snapshots", icon: CalendarDays },
      { label: "Alertas", href: "/alertas", icon: Bell },
      { label: "Guía Cocos", href: "/guia", icon: HelpCircle },
    ],
  },
];

// Solo para ADMIN (proxy.ts redirige al resto).
export const ADMIN_NAV_GROUP: NavGroup = {
  label: "Administración",
  items: [
    { label: "Oportunidades", href: "/portfolio", icon: FileText },
    { label: "Activos", href: "/assets", icon: Layers },
    { label: "Estrategia", href: "/strategy", icon: BookOpen },
    { label: "Configuración", href: "/settings", icon: Settings },
  ],
};

// Atajos de ⌘K para el ritual mensual; navegan a la pantalla donde se hace.
export const COMMAND_ACTIONS: NavItem[] = [
  { label: "Importar CSVs de Cocos", href: "/datos", icon: Upload },
  { label: "Actualizar precios y CCL", href: "/datos", icon: RefreshCw },
  { label: "Ver los gastos del mes", href: "/transactions", icon: Receipt },
];
