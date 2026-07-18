import type { LucideIcon } from "lucide-react";
import {
  Bot,
  ChartColumn,
  ClipboardList,
  LayoutDashboard,
  Settings,
  Truck,
  UserRound,
  Users,
} from "lucide-react";

export type NavigationItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  available: boolean;
};

export const primaryNavigation: readonly NavigationItem[] = [
  {
    href: "/",
    icon: LayoutDashboard,
    label: "Dashboard",
    available: true,
  },
  {
    href: "/orders",
    icon: ClipboardList,
    label: "Orders",
    available: false,
  },
  {
    href: "/shipments",
    icon: Truck,
    label: "Shipments",
    available: false,
  },
  {
    href: "/customers",
    icon: Users,
    label: "Customers",
    available: false,
  },
  {
    href: "/sales-reps",
    icon: UserRound,
    label: "Sales Reps",
    available: false,
  },
  {
    href: "/analytics",
    icon: ChartColumn,
    label: "Analytics",
    available: false,
  },
  {
    href: "/assistant",
    icon: Bot,
    label: "AI Assistant",
    available: false,
  },
  {
    href: "/settings",
    icon: Settings,
    label: "Settings",
    available: false,
  },
];

export function getNavigationItem(pathname: string): NavigationItem | undefined {
  return primaryNavigation.find((item) => item.href === pathname);
}
