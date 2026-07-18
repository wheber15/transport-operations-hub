import type { NextAuthConfig } from "next-auth";

function isPublicRoute(pathname: string) {
  return pathname === "/login" || pathname === "/api/auth" || pathname.startsWith("/api/auth/");
}

const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      if (isPublicRoute(nextUrl.pathname)) {
        return true;
      }

      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
