# Hadir Engineering Audit

This document tracks the production-hardening audit without removing working features.

## Rules
- Preserve all working product features.
- Do not hide failures by weakening CI checks.
- Remove duplicate UI only after verifying route/component ownership.
- Prefer one layout-owned navigation system per role.
- Every change must pass TypeScript, lint, build, and relevant workflow checks.

## Current findings
- Role navigation is now owned by ManagerLayout/EmployeeLayout; the former global ContextWidgets mount has been removed while its session-welcome behavior remains available through the role layouts.
- Navigation labels are rendered by React navigation components; label-visibility CSS is now limited to visibility enforcement and does not inject UI.
- Five obsolete self-modifying repair workflows were removed because they could rewrite source on pushes and duplicate the canonical CI checks.
- Canonical validation is concentrated in ci.yml plus focused read-only verification workflows.

## Workstreams
1. Layout and navigation ownership
2. Route/component duplication and dead code
3. CSS collisions and responsive/RTL behavior
4. TypeScript, ESLint and build
5. Backend/API/D1 correctness
6. Security and dependency review
7. CI/CD and workflow consolidation
8. Functional regression verification
