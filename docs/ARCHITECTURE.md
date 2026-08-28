# Hadir architecture

## Source layout

- `src/features/` — feature-owned UI and workflows. New feature pages belong here instead of growing the flat `src/pages/` directory.
- `src/pages/` — existing route-level screens that have not yet been migrated.
- `src/components/` — reusable presentation and guard components.
- `src/lib/` — shared browser services, API clients, storage and device utilities.
- `src/types/` — shared domain types.
- `backend/src/` — Cloudflare Worker API implementation.
- `backend/migrations/` — D1 schema migrations.
- `docs/` — deployment and architecture documentation.

## Import stability

Use the `@/*` alias for application imports (`@/lib/...`, `@/components/...`, `@/features/...`). Do not use `../../` paths between source modules. This keeps imports stable when a feature folder is moved.

The alias is defined in `tsconfig.json` and is already supported by the Vite build configuration.

## Employee authentication

The only supported employee authentication path is:

`EmployeeLogin -> lib/backend -> Cloudflare Worker /api/auth/login -> D1 employees -> PBKDF2 PIN verification -> JWT -> employee session`

Employee login must not depend on browser fingerprint loading before the authentication request. Device identification is best-effort and must never make the login form appear stuck.

## Safe refactoring rule

When moving a feature:

1. Move the feature into `src/features/<domain>/<feature>/`.
2. Keep imports rooted at `@/`.
3. Update route imports in `src/App.tsx` (or the owning router).
4. Run `bun run typecheck` and `bun run build` before merging.
5. Never duplicate the same route component in two directories.
