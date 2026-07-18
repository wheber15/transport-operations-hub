import { LoginForm } from "@/features/auth/components/login-form";

export const metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <main className="bg-muted/30 flex min-h-screen items-center justify-center px-4 py-12">
      <section className="border-border bg-card w-full max-w-md rounded-2xl border p-6 shadow-xl shadow-slate-950/10 sm:p-8">
        <p className="text-primary text-sm font-medium">AXon</p>
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
