import { AppShell } from "@/components/shared/layout/app-shell";
import { requireAuthenticatedUser } from "@/features/auth/application/session";

export default async function ApplicationLayout({ children }: { children: React.ReactNode }) {
  await requireAuthenticatedUser();

  return <AppShell>{children}</AppShell>;
}
