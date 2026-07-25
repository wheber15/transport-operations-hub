import type { Metadata } from "next";

import { ThemeProvider } from "@/components/shared/providers/theme-provider";
import { siteConfig } from "@/config/site";
import { AuthSessionProvider } from "@/features/auth/components/auth-session-provider";
import { assertDevelopmentRuntime } from "@/server/db/development-runtime";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.applicationName} — ${siteConfig.workspaceName}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.applicationName,
  icons: {
    icon: "/brand/favicon.svg",
    apple: "/brand/axon-app-icon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await assertDevelopmentRuntime();
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="min-h-full">
        <AuthSessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            disableTransitionOnChange
            enableSystem={false}
          >
            {children}
            <Toaster richColors />
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
