# API Architecture

Application API contracts beyond authentication have not yet been implemented.

## Authentication Architecture

Authentication uses Auth.js v5 with the Next.js App Router. The Auth.js route handlers are exposed only through `/api/auth/[...nextauth]` and use a credentials provider backed by the persisted `User` identity records in PostgreSQL. Passwords are stored only as hashes.

The Prisma adapter is configured for Auth.js compatibility. The identity schema includes Auth.js account, session, and verification-token tables for supported current and future providers. Credentials sign-in uses JWT sessions; authentication cookies are created and invalidated by Auth.js. The adapter `Session` table is not used by the current JWT strategy, but remains part of the supported identity model for future database-session or external-provider requirements.

## Session Flow

1. A user submits credentials to the `/login` server action.
2. Auth.js validates the credentials against the active, database-backed user record.
3. On success, Auth.js issues its signed JWT session cookie.
4. The Next.js `proxy.ts` route guard permits authenticated requests and redirects unauthenticated requests to `/login`. It permits only `/login`, `/api/auth/*`, and required static or metadata assets. Authenticated users visiting `/login` are redirected to the application root.
5. Server Components and server-side application services use the `auth()` helper and the reusable current-user helpers. Client Components access non-sensitive session display data through `SessionProvider`.
6. Signing out invalidates the Auth.js session cookie and redirects the user to `/login`.

## Authorization Approach

Roles are loaded from the database as part of identity lookup and are carried in the authenticated session for display and route protection. Authentication and current-user helpers require an active, non-deleted user with an active role. The shared authorization helpers provide authentication, role-check, and role-requirement operations for future feature services.

The JWT contains only the user identifier and role alongside Auth.js's standard display identity fields; it does not contain password hashes or complete database records. Auth.js's documented JWT expiry defaults apply because no product-specific session duration has been approved. A role change can remain visible in an existing JWT until the session is refreshed or expires. Sensitive server-side operations must therefore call the current-user or role helpers, which re-read the active user and role from the database; a deleted user or deleted role is rejected immediately at those boundaries.

No permissions are hardcoded. Future feature modules must define and enforce their approved authorization requirements at server-side boundaries before invoking protected work. Client-side role checks are presentation-only and never replace server-side authorization.

## Seed Security

Development seed execution is refused in production. Seed user emails and passwords must be supplied through environment variables; the script rejects missing values, placeholder passwords, known obvious defaults, and passwords shorter than 16 characters. It stores only bcrypt hashes and intentionally updates those hashes when seed credentials change. Seed output never includes credentials.

## Future API Contracts

When non-authentication API boundaries are introduced, they will follow [ARCHITECTURE.md](ARCHITECTURE.md): request validation at the boundary, business orchestration in services, and persistence through repositories. Contracts, authorization requirements, error responses, and versioning decisions must be documented before an API is exposed.
