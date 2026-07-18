"use client";

import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen, Route, X } from "lucide-react";
import { usePathname } from "next/navigation";

import { isNavigationItemActive, primaryNavigation } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onCollapsedChange: () => void;
  onMobileOpenChange: () => void;
};

export function AppSidebar({
  collapsed,
  mobileOpen,
  onCollapsedChange,
  onMobileOpenChange,
}: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <button
        aria-label="Close navigation menu"
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/60 transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onMobileOpenChange}
        type="button"
      />
      <aside
        className={cn(
          "border-border/80 bg-sidebar fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r px-3 py-4 shadow-2xl shadow-slate-950/10 transition-[width,transform] duration-200 lg:static lg:z-auto lg:translate-x-0 lg:shadow-none",
          collapsed && "lg:w-[4.75rem]",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-10 items-center justify-between px-2">
          <Link
            aria-label={siteConfig.name}
            className="text-foreground flex min-w-0 items-center gap-2.5"
            href="/"
            onClick={mobileOpen ? onMobileOpenChange : undefined}
          >
            <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg shadow-sm">
              <Route aria-hidden="true" className="size-4" />
            </span>
            <span
              className={cn(
                "truncate text-sm font-semibold tracking-tight transition-opacity",
                collapsed && "lg:pointer-events-none lg:w-0 lg:opacity-0"
              )}
            >
              Transport Hub
            </span>
          </Link>
          <Button
            aria-label={mobileOpen ? "Close navigation menu" : "Collapse sidebar"}
            className="text-muted-foreground hover:text-foreground lg:hidden"
            onClick={onMobileOpenChange}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
          <Button
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="text-muted-foreground hover:text-foreground hidden lg:inline-flex"
            onClick={onCollapsedChange}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" />
            ) : (
              <PanelLeftClose aria-hidden="true" />
            )}
          </Button>
        </div>

        <nav aria-label="Primary navigation" className="mt-8 flex flex-1 flex-col gap-1">
          {primaryNavigation.map((item) => {
            const Icon = item.icon;
            const active = isNavigationItemActive(item, pathname);
            const content = (
              <>
                <Icon aria-hidden="true" className="size-[18px] shrink-0" />
                <span
                  className={cn(
                    "truncate transition-opacity",
                    collapsed && "lg:pointer-events-none lg:w-0 lg:opacity-0"
                  )}
                >
                  {item.label}
                </span>
              </>
            );

            if (!item.available) {
              return (
                <span
                  aria-disabled="true"
                  className={cn(
                    "text-muted-foreground/60 flex h-10 cursor-not-allowed items-center gap-3 rounded-lg px-3 text-sm font-medium",
                    collapsed && "lg:justify-center lg:px-0"
                  )}
                  key={item.href}
                  title={`${item.label} is not available yet`}
                >
                  {content}
                </span>
              );
            }

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  active && "bg-sidebar-accent text-sidebar-accent-foreground",
                  collapsed && "lg:justify-center lg:px-0"
                )}
                href={item.href}
                key={item.href}
                onClick={mobileOpen ? onMobileOpenChange : undefined}
                title={collapsed ? item.label : undefined}
              >
                {content}
              </Link>
            );
          })}
        </nav>

        <div
          className={cn(
            "border-border/70 bg-background/40 text-muted-foreground rounded-lg border px-3 py-3 text-xs transition-opacity",
            collapsed && "lg:pointer-events-none lg:hidden"
          )}
        >
          <p className="text-foreground font-medium">Operations workspace</p>
          <p className="mt-1 leading-relaxed">Your daily planning workspace.</p>
        </div>
      </aside>
    </>
  );
}
