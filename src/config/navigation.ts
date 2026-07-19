import type { LucideIcon } from "lucide-react";
import {
  Bot,
  ChartColumn,
  ClipboardList,
  Database,
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
    href: "/data-management",
    icon: Database,
    label: "Data Management",
    available: true,
  },
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
    available: true,
  },
  {
    href: "/shipments",
    icon: Truck,
    label: "Shipments",
    available: true,
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
  return primaryNavigation.find(
    (item) => item.href === pathname || (item.href !== "/" && pathname.startsWith(`${item.href}/`))
  );
}

export function isNavigationItemActive(item: NavigationItem, pathname: string) {
  return item.href === pathname || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
}
