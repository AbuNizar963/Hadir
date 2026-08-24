# Hadir Engineering Audit

This document tracks the production-hardening audit without removing working features.

## Rules
- Preserve all working product features.
- Do not hide failures by weakening CI checks.
- Remove duplicate UI only after verifying route/component ownership.
- Prefer one layout-owned navigation system per role.
- Every change must pass TypeScript, lint, build, and relevant workflow checks.

## Current findings
- Manager navigation and ContextWidgets both provide fixed/top-level UI controls.
- ManagerLayout still contains text-symbol icons instead of the project's SVG icon system.
- Navigation-label CSS injects labels through pseudo-elements, creating a second presentation layer.
- The repository contains many narrowly scoped repair workflows that require consolidation review.

## Workstreams
1. Layout and navigation ownership
2. Route/component duplication and dead code
3. CSS collisions and responsive/RTL behavior
4. TypeScript, ESLint and build
5. Backend/API/D1 correctness
6. Security and dependency review
7. CI/CD and workflow consolidation
8. Functional regression verification
