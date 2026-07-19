import { LoginForm } from "@/features/auth/components/login-form";
import Image from "next/image";

export const metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <main className="bg-muted/30 flex min-h-screen items-center justify-center px-4 py-12">
      <section className="border-border bg-card w-full max-w-md rounded-2xl border p-6 shadow-xl shadow-slate-950/10 sm:p-8">
        <div className="flex items-center gap-3">
          <Image alt="AXon" height={40} priority src="/brand/axon-mark.svg" width={40} />
          <div>
            <p className="text-foreground text-lg font-semibold tracking-tight">AXon</p>
            <p className="text-primary text-xs font-medium tracking-[0.16em] uppercase">
              Operations Intelligence Platform
            </p>
          </div>
        </div>
        <h1 className="text-foreground mt-3 text-2xl font-semibold tracking-tight">
          Sign in to your workspace
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          Use your AXon account to access Transport Operations Hub.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
