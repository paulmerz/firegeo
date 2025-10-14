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
- `pnpm test:e2e` to start end-to-end tests to cover the use of the plateform

## Coding Style & Naming Conventions
TypeScript is strict; enable editors to use the repo `tsconfig.json`. Rely on Prettier defaults (2-space indent, semicolons) and Next linting. Components and hooks use PascalCase and `useCamelCase` respectively; route folders stay lower-case kebab. Keep database files snake_case with numeric prefixes (`001_*`). Import with the `@/` alias instead of deep relative paths. Update localization keys consistently across `messages/` locales.

## Type Safety & no-any Policy

We do not use any. Prefer precise types, unknown + narrowing, or generics.

Treat external inputs (request params, JSON, env, 3rd-party libs) as unknown and validate.

If a legacy edge truly needs any, isolate it in a boundary file with a documented ESLint ignore.

### Function Parameters & Returns
```// Bad
function handle(x: any): any { /* ... */ }```

```// Good: unknown + narrowing
function handle(x: unknown): string | null {
  if (typeof x === "string") return x.trim();
  return null;
}```

### JSON / API Results
```// Define a schema + parse (Zod recommended)
import { z } from "zod";
const User = z.object({ id: z.string(), name: z.string() });
type User = z.infer<typeof User>;

const dataUnknown = (await res.json()) as unknown;
const user = User.parse(dataUnknown); // typed User```

### URL & Search Params (Next.js / Web)
```// Works for Request and NextRequest
const url = new URL(request.url);
const raw = url.searchParams.get("mockMode");

const MockMode = ["off", "lite", "full"] as const;
type MockMode = typeof MockMode[number];
const isMockMode = (v: string | null): v is MockMode => v !== null && MockMode.includes(v as MockMode);

const mockMode = isMockMode(raw) ? raw : null; // MockMode | null```

### Records, Maps, and Reducers
```// Bad
const dict: any = {};```

```// Good
const dict: Record<string, number> = {};

type Item = { id: string; value: number };
const byId = items.reduce<Record<string, Item>>((acc, it) => {
  acc[it.id] = it; return acc;
}, {});```

### Generics
```// Bad
function first(arr: any[]) { return arr[0]; }```

```// Good
function first<T>(arr: T[]): T | undefined { return arr[0]; }```

### React / DOM Events (common cases)
```const onChange = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... */ };
const onSubmit = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); };
const onClick  = (e: React.MouseEvent<HTMLButtonElement>) => { /* ... */ };
const ref = React.useRef<HTMLDivElement | null>(null);```

### Library Boundaries (last resort)
```// boundary/legacy.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromLegacy(x: any): DomainType {
  // convert + validate before returning DomainType
}```

### Lint & TS Settings

- TS: "strict": true, "noImplicitAny": true, "strictNullChecks": true.

- ESLint (keep strict, but avoid noise in rest arg wrappers):

```{
  "rules": {
    "@typescript-eslint/no-explicit-any": ["error", { "ignoreRestArgs": true }]
  }
}```

### Review Checklist (PRs touching types)

- No any introduced (search for : any, any[], as any).
- External data validated (schema or type guard).
- Functions typed at the boundary (params & returns).
- Reducers/records use Record<K,V> or mapped types.
- Event handlers use concrete React/DOM types.

## Development Guidelines
1. **Document every change**  
   - Update relevant `README`, comments, or inline docs when modifying or creating features.  
   - When in doubt, explain *why* the code exists.

2. **No hard-coded strings**  
   - Always use `next-intl` and the `i18n` system.  
   - Add/modify entries in `/messages` and ensure all locales are updated.  
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
