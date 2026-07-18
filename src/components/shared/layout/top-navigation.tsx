"use client";

import { Bell, ChevronRight, Menu, Plus, Search } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getNavigationItem } from "@/config/navigation";
import { ThemeToggle } from "@/components/shared/layout/theme-toggle";
import { UserMenu } from "@/components/shared/layout/user-menu";

type TopNavigationProps = {
  onMobileMenuToggle: () => void;
};

export function TopNavigation({ onMobileMenuToggle }: TopNavigationProps) {
  const pathname = usePathname();
  const currentItem = getNavigationItem(pathname);
  const pageName = currentItem?.label ?? "Workspace";

  return (
    <header className="border-border/80 bg-background/80 flex h-16 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-xl sm:px-6">
      <Button
        aria-label="Open navigation menu"
        className="lg:hidden"
        onClick={onMobileMenuToggle}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <Menu aria-hidden="true" />
      </Button>

      <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 text-sm sm:flex">
        <span className="text-muted-foreground font-medium">Workspace</span>
        <ChevronRight aria-hidden="true" className="text-muted-foreground/70 size-3.5" />
        <span className="text-foreground truncate font-medium">{pageName}</span>
      </nav>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <Button
          aria-label="Open global search"
          className="text-muted-foreground hidden min-w-56 justify-between sm:inline-flex"
          size="sm"
          type="button"
          variant="outline"
        >
          <span className="flex items-center gap-2">
            <Search aria-hidden="true" />
            Search
          </span>
          <kbd className="border-border bg-muted text-muted-foreground hidden rounded border px-1.5 py-0.5 text-[10px] font-medium md:inline-flex">
            Ctrl K
          </kbd>
        </Button>
        <Button
          aria-label="Open global search"
          className="sm:hidden"
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Search aria-hidden="true" />
        </Button>
        <Button className="hidden sm:inline-flex" size="sm" type="button">
          <Plus aria-hidden="true" />
          Quick action
        </Button>
        <Button aria-label="Quick action" className="sm:hidden" size="icon-sm" type="button">
          <Plus aria-hidden="true" />
        </Button>
        <ThemeToggle />
        <Button aria-label="Notifications" size="icon-sm" type="button" variant="ghost">
          <Bell aria-hidden="true" />
        </Button>
        <UserMenu />
      </div>
    </header>
  );
}
