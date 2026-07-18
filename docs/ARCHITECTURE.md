# Architecture

## 1. System Overview

Transport Operations Hub is a web application built with Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, Prisma ORM, and PostgreSQL. It uses a feature-first codebase with layered backend boundaries.

The application renders server-first by default. Interactive client experiences are introduced only where they are required. PostgreSQL is the persistent data store and Prisma is the application’s database access layer.

## 2. Architectural Principles

- **Feature ownership:** organise product code around the feature that owns it.
- **Clear boundaries:** separate presentation, application orchestration, domain logic, and infrastructure concerns.
- **Inward dependencies:** framework and persistence details depend on application/domain code, never the reverse.
- **Server-first delivery:** prefer React Server Components and server-side work by default.
- **Explicit data access:** access persistence through repositories rather than directly from presentation code.
- **Shared only when shared:** promote code to global locations only when it is genuinely cross-feature and domain-neutral.
- **Simple, maintainable design:** avoid speculative abstractions and keep dependencies intentional.

## 3. Layered Architecture

Backend code follows these conceptual layers:

```text
Presentation / Transport
        ↓
Application / Services
        ↓
Domain
        ↓
Infrastructure / Repositories / Prisma
```

- **Presentation / transport** contains App Router route handlers, Server Actions, and other delivery boundaries. It accepts input, invokes application services, and maps results to transport or UI needs.
- **Application / services** coordinates use cases, transactions, authorisation checks, and repository calls. It does not contain framework or Prisma-specific details.
- **Domain** contains feature-owned types and business logic when it is established. It has no dependency on Next.js, React, Prisma, or PostgreSQL.
- **Infrastructure / repositories** implements persistence concerns and is the only layer that knows Prisma query details.

Dependencies must point inward. A route or component must not query Prisma directly, and domain code must not import Next.js or Prisma.

## 4. Feature-Based Structure

Features are the primary organisational boundary. A feature owns its UI, application services, domain code, infrastructure, validation, and tests unless a concern is genuinely shared.

Suggested feature shape:

```text
src/features/<feature>/
  components/       # Feature-specific UI
  application/      # Use cases and services
  domain/           # Feature types and established business logic
  infrastructure/   # Repository implementations and integrations
  validation/       # Feature input schemas
  hooks/            # Feature-local client hooks
```

The exact contents of a feature should remain proportionate to its complexity; do not create empty layers or folders merely to match this shape.

## 5. Frontend Architecture

- Use the Next.js App Router for routes, layouts, pages, and route-level UI states.
- Use React Server Components by default for route composition and server-side data loading.
- Use Client Components only for browser APIs, interaction state, event handlers, or client-only libraries.
- Keep client boundaries small and pass serializable data across the server/client boundary.
- Keep route files focused on route composition. Feature components own feature presentation; shared components are used only across features.
- Use Tailwind CSS for styling and shadcn/ui as the base component system. Use Framer Motion only where motion is necessary to support the interface.

## 6. Backend Architecture

The backend is delivered through Next.js server capabilities, including route handlers and Server Actions where appropriate. These are transport boundaries, not places for application or persistence logic.

Each use case is coordinated by the service layer. Services depend on repository interfaces or repository contracts; repository implementations encapsulate Prisma and external integration details. This repository pattern keeps application code independent of the persistence mechanism.

## 7. Data Flow

The standard request and mutation flow is:

```text
Route / Server Component / Client interaction
        ↓
Route Handler or Server Action (when a transport boundary is needed)
        ↓
Application Service
        ↓
Repository
        ↓
Prisma ORM
        ↓
PostgreSQL
```

For client-side asynchronous server data, TanStack Query manages request state and cache coordination. Server components may load data directly through the application layer when no client-side cache or interaction is needed.

## 8. Database Access Strategy

- PostgreSQL is accessed through Prisma ORM.
- Prisma access is encapsulated by infrastructure/repository code.
- Application services use repositories rather than Prisma clients directly.
- Keep queries explicit and scoped to the data required by the use case.
- Keep transactions at the application-service boundary when a use case requires atomic persistence work.
- The database schema and migration policy are defined separately in database documentation.

## 9. State Management Strategy

- Prefer server-rendered state through React Server Components.
- Use component-local React state for local, ephemeral interaction state.
- Use TanStack Query for client-side server state, including caching, loading, error, and invalidation behaviour.
- Use URL state for shareable or navigational state when appropriate.
- Avoid introducing a global client state store unless a documented cross-feature client-state requirement cannot be served by these approaches.

## 10. API Design Principles

- Use route handlers only when an HTTP API boundary is needed; use Server Actions for application mutations where they are the appropriate App Router boundary.
- Validate untrusted input at every transport boundary before invoking services.
- Keep handlers thin: translate input, call a service, and map the result to a response.
- Return consistent, safe response shapes and do not expose persistence, infrastructure, or internal error details.
- API contracts must be explicit and versioned when external consumers require versioning; the versioning approach is not yet defined.

## 11. UI Component Strategy

- Build shared primitives with shadcn/ui and style them with Tailwind CSS.
- Keep `src/components/ui` for shadcn/ui primitives and `src/components/shared` for reusable, cross-feature components.
- Keep feature-specific components in their owning feature.
- Use TanStack Table for data-rich tabular interfaces and keep table configuration close to the feature that owns it.
- Use Framer Motion sparingly and purposefully; motion must not obscure content, control flow, or accessibility.
- Prefer composition and variants over creating duplicate components or one-off styling systems.

## 12. Authentication Strategy

Authentication and identity are enforced at server-side boundaries before protected application services perform work. Client-side checks may improve the user experience but must not be treated as authorisation.

The authentication provider, session model, identity source, and role/permission design are not defined by this document and must be documented separately before implementation decisions are made.

## 13. Error Handling Strategy

- Validate input at boundaries and return or render actionable, safe validation feedback.
- Handle expected failures in the application layer with explicit result or error behaviour.
- Use App Router error and not-found conventions for route-level UI states.
- Do not disclose secrets, stack traces, database details, or internal implementation details to users.
- Preserve sufficient contextual information for server-side diagnosis through the selected logging approach.

## 14. Logging Strategy

Server-side code must produce structured, safe logs for failures and operationally relevant events. Logs must avoid credentials, tokens, personally sensitive information, and unnecessary request payloads.

The logging provider, event taxonomy, retention period, and alerting policy are not defined by this document and require separate operational decisions.

## 15. Performance Strategy

- Prefer server rendering and Server Components to minimise unnecessary client JavaScript.
- Keep Client Components and their dependencies as small as practical.
- Load only the data required for a route or use case; avoid N+1 database access patterns.
- Use TanStack Query only when client-side server state is needed, with deliberate cache invalidation after mutations.
- Use pagination, filtering, and other data-shaping approaches where interface requirements call for them; detailed performance budgets are not yet defined.

## 16. Security Principles

- Treat all external input as untrusted and validate it at server boundaries.
- Enforce authentication and authorisation on the server before protected work occurs.
- Keep secrets in environment configuration and never expose them to client code, responses, or logs.
- Use least-privilege access for application infrastructure and database credentials.
- Do not allow client components to bypass application services or repository boundaries for protected data access.
- Security controls, retention requirements, and compliance obligations not specified here must be defined separately.

## 17. Testing Strategy

Testing follows architectural boundaries:

- test domain and application logic independently of Next.js and Prisma where practical;
- test repository implementations against the data-access behaviour they own;
- test route handlers, Server Actions, and UI at their respective boundaries; and
- add integration or end-to-end coverage for important user journeys as requirements and tooling are established.

Test tooling, coverage thresholds, and CI quality gates are not defined by this document.

## 18. Deployment Strategy

The deployment platform, environment topology, release process, and infrastructure provisioning approach are not defined by this document. Any deployment implementation must preserve the application’s server/runtime requirements and provide Prisma-compatible PostgreSQL connectivity.

## 19. Scalability Strategy

Scalability is supported by the architecture’s clear boundaries, server-first rendering, efficient database access, and feature ownership. Changes intended to address load, data volume, concurrency, or operational growth must be based on measured requirements and documented separately; this document does not prescribe scaling topology.

## 20. Folder Ownership Rules

- `src/app` owns routing, layouts, route handlers, and route-level presentation only.
- `src/features/<feature>` owns feature-specific UI, services, domain code, repositories, validation, hooks, and tests.
- `src/components/ui` owns shadcn/ui primitives only.
- `src/components/shared` owns reusable, cross-feature presentation components.
- `src/lib` owns shared framework/tool integrations and domain-neutral utilities.
- `src/hooks`, `src/types`, `src/constants`, and `src/validation` contain only genuinely shared concerns; otherwise keep code in its feature.
- `prisma` owns the Prisma schema and migrations; generated artifacts are not hand-edited.
- `tests` owns test code that is not co-located with its feature; preserve feature ownership in its path and naming.

When ownership is unclear, keep the code with the feature that currently owns the requirement. Promote it only after a concrete reuse need emerges.
