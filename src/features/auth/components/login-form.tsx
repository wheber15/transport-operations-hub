"use client";

import { useActionState } from "react";

import { authenticate, type LoginState } from "@/features/auth/application/login-action";
import { Button } from "@/components/ui/button";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(authenticate, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <div className="space-y-2">
        <label className="text-foreground text-sm font-medium" htmlFor="email">
          Email address
        </label>
        <input
          autoComplete="email"
          className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]"
          id="email"
          name="email"
          required
          type="email"
        />
      </div>
      <div className="space-y-2">
        <label className="text-foreground text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          autoComplete="current-password"
          className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]"
          id="password"
          name="password"
          required
          type="password"
        />
      </div>
      {state.error ? (
        <p aria-live="polite" className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button className="w-full" disabled={isPending} type="submit">
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
