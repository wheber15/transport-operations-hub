import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { RoleName } from "@/features/auth/domain/roles";
import { findActiveUserById } from "@/features/auth/infrastructure/user-repository";

export type AuthenticatedUser = {
  id: string;
  displayName: string;
  email: string;
  role: string | null;
};

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const user = await findActiveUserById(userId);

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    role: user.role?.name ?? null,
  };
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function hasRole(roleName: RoleName): Promise<boolean> {
  const user = await getCurrentUser();

  return user?.role === roleName;
}

export async function requireRole(roleName: RoleName): Promise<AuthenticatedUser> {
  const user = await requireAuthenticatedUser();

  if (user.role !== roleName) {
    throw new Error("The authenticated user does not have the required role.");
  }

  return user;
}
