# Repository Guidelines

## Project Structure & Module Organization
- `app/` hosts Next.js 15 routes, server actions, and layouts; keep features grouped by route segment.
- `components/` contains shared UI; export reusable pieces via `index.ts` barrels where helpful and name files in PascalCase.
- `lib/` centralizes utilities (`auth`, `clients`, `validators`); prefer the `@/` alias when importing.
- `config/`, `hooks/`, `i18n/`, and `messages/` hold environment loaders, React hooks, and localization strings; sync locale changes with `pnpm i18n:check`.
- `supabase/`, `migrations/`, and `better-auth_migrations/` track SQL; commit generated files and keep IDs aligned with drizzle migrations.
- `public/` stores static assets; `scripts/` houses automation TSX scripts; `.github/workflows/` defines CI/CD.

## 

## Build, Test, and Development Commands
- `pnpm run setup` bootstraps the project (installs deps, seeds auth tables).
- `pnpm dev` runs the Turbopack dev server on localhost.
- `pnpm build` produces the production bundle; `pnpm start` serves the compiled app.
- `pnpm lint` enforces ESLint+Next rules; run before every PR.
- `pnpm db:generate`, `pnpm db:migrate`, and `pnpm db:push` manage drizzle migrations; `pnpm db:studio` opens the schema explorer.
- `pnpm debug:env` prints resolved environment variables for troubleshooting.

## Coding Style & Naming Conventions
TypeScript is strict; enable editors to use the repo `tsconfig.json`. Rely on Prettier defaults (2-space indent, semicolons) and Next linting. Components and hooks use PascalCase and `useCamelCase` respectively; route folders stay lower-case kebab. Keep database files snake_case with numeric prefixes (`001_*`). Import with the `@/` alias instead of deep relative paths. Update localization keys consistently across `messages/` locales.

## Development Guidelines
1. **Document every change**  
   - Update relevant `README`, comments, or inline docs when modifying or creating features.  
   - When in doubt, explain *why* the code exists.

2. **No hard-coded strings**  
   - Always use `next-intl` and the `i18n` system.  
   - Add/modify entries in `/messages` and ensure both locales are updated.  
   - Run `pnpm i18n:check` before committing.

3. **Prefer reuse over duplication**  
   - Before writing new code, check if a utility, hook, or component already implements similar behavior.  
   - Extend existing logic rather than duplicating functionality.

4. **Avoid rigid static logic**  
   - Do not over-rely on long `if/else` or `switch` blocks with hard-coded cases.  
   - Prefer flexible patterns, data-driven configs, or leverage an **LLM-powered function** when appropriate for broader coverage and adaptability.

## Testing Guidelines
Automated tests are not yet wired; guard changes with `pnpm lint`, manual verification in `pnpm dev`, and database smoke tests via `pnpm db:studio`. When adding tests, colocate `*.test.ts(x)` beside the feature and stub network calls to keep runs deterministic. Extend CI to run new test suites before merging.

## Commit & Pull Request Guidelines
Write imperative, concise commit messages (~60 chars). Follow the current history by prefacing fixes with `fix:` when appropriate and omitting prefixes for general additions. Each PR should include: a short summary, linked issue or ticket, screenshots/GIFs for UI changes, notes on env vars or migrations, and a checklist of commands run (`pnpm lint`, relevant db tasks). Request review once CI passes and docs/config updates land in the same branch.

## Environment & Secrets
Copy `.env.example` to `.env.local` and fill the required keys: `DATABASE_URL`, `BETTER_AUTH_SECRET`, email providers, and AI API keys as needed. Use `pnpm debug:env` to confirm values. Never commit `.env.local`; rely on Vercel project settings for deployment.
