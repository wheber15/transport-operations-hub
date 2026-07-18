# AXon — Transport Operations Hub

AXon is a commercial-quality operational workspace for transport planners. It replaces spreadsheet-based work and repetitive SAP navigation with a focused, modern SaaS application while SAP remains the ERP system of record.

## Project Status

The production foundation is in place: product and architecture documentation, the application shell, an empty-state operations dashboard, and the initial Prisma database foundation. Business features, integrations, and operational workflows are implemented only when explicitly approved.

## Technology Stack

- Next.js App Router and React 19
- TypeScript
- Tailwind CSS v4 and shadcn/ui
- Prisma ORM and PostgreSQL
- TanStack Query and TanStack Table
- Framer Motion

## Prerequisites

- Node.js 22.12 or later
- npm
- PostgreSQL-compatible connection details for local Prisma development

## Installation

```bash
npm install
Copy-Item .env.example .env
npx prisma generate
```

Set the required local connection values in `.env`. Never commit this file.

## Environment Configuration

Use [`.env.example`](.env.example) as the template. It defines the following variables with safe placeholders:

- `DATABASE_URL` for application runtime access
- `DIRECT_URL` for Prisma CLI operations and migrations

## Database Commands

```bash
npx prisma generate
npx prisma validate
npx prisma migrate status
npx prisma migrate dev --name <migration_name>
```

Only create a migration for an approved schema change.

## Development Commands

```bash
npm run dev
npm run lint
npx prettier --check .
npx prettier --write .
npm run build
```

## Project Structure

```text
docs/                 Product, architecture, data, and delivery documentation
prisma/               Prisma schema, configuration, and migrations
src/app/              Next.js routes, root layout, and global styles
src/components/       Shared UI, layout, and operations components
src/config/           Application configuration
src/server/           Server-side infrastructure, including Prisma access
src/generated/        Generated Prisma client output (ignored; regenerate locally)
scripts/              Development and maintenance scripts
public/               Static public assets
```

## Documentation

- [Product Vision](docs/PRODUCT_VISION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Business Rules](docs/BUSINESS_RULES.md)
- [Logical Data Model](docs/DATABASE.md)
- [Production Database Blueprint](docs/DATABASE_V2.md)
- [API Architecture](docs/API.md)
- [Roadmap](docs/ROADMAP.md)

## Current Development Phase

The project is ready to begin approved feature implementation on top of the established application and database foundations.

## Contributing

Follow the project documentation and keep changes scoped to an approved task. Use Conventional Commits:

```text
type(scope): concise summary
```

Examples of common types are `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, and `build`. Run the relevant validation commands before committing.
