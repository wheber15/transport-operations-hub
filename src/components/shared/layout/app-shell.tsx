"use client";

import { useState } from "react";

import { AppSidebar } from "@/components/shared/layout/app-sidebar";
import { TopNavigation } from "@/components/shared/layout/top-navigation";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="bg-background flex min-h-screen">
      <AppSidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onCollapsedChange={() => setSidebarCollapsed((current) => !current)}
        onMobileOpenChange={() => setMobileSidebarOpen((current) => !current)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavigation onMobileMenuToggle={() => setMobileSidebarOpen((current) => !current)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
