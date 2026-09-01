# HADIR — Production-Grade Development Roadmap

**Status:** Active Development Phase 2  
**Last Updated:** 2026-09-01  
**Objective:** Transform HADIR into a production-grade attendance management PWA while preserving all existing features and data integrity.

---

## Core Principle

✅ **NEVER DELETE OR DISABLE EXISTING FEATURES**  
🚨 **PRESERVE ALL DATA AND FUNCTIONALITY**  
🔧 **FIX, ENHANCE, AND OPTIMIZE — DO NOT REWRITE**

---

## Phase Strategy

### Phase 1: ✅ AUDIT (COMPLETE)
- [x] Repository structure analysis
- [x] Feature inventory
- [x] Architecture documentation
- [x] Issue identification (Critical, High, Medium)
- [x] Generate findings report

**Deliverable:** `AUDIT_REPORT.md`

---

### Phase 2: 🔴 STABILITY & CRITICAL FIXES (IN PROGRESS)

**Objective:** Fix blocking issues that could cause data loss or system failure.

#### Block 2.1: System Reset Functionality
**Files:** `src/pages/ManagerSettings.tsx`, `backend/src/index.ts`
**Status:** `🔴 BLOCKED`

**Issues:**
1. Reset UI references `/api/workforce/reset` endpoint
2. Backend endpoint lacks proper implementation
3. No clear data preservation/deletion specification
4. Missing confirmation safety checks

**Action Items:**
- [ ] Implement `/api/workforce/reset` backend endpoint with clear semantics
  - Define what gets deleted (employees, attendance, requests, etc.)
  - Define what gets preserved (owner, settings, locations, schema)
- [ ] Add transaction safety (rollback on error)
- [ ] Add multi-level confirmation dialog in UI
- [ ] Log reset operation in audit trail
- [ ] Document reset behavior in settings UI
- [ ] Test on staging database

**Files to Create/Modify:**
- `backend/src/index.ts` — Add reset endpoint implementation
- `src/pages/ManagerSettings.tsx` — Enhance confirmation UI
- `src/lib/backend.ts` — Add reset API client
- Test files (if added)

**Acceptance Criteria:**
- Reset preserves D1 schema
- Reset preserves owner account
- Reset preserves system settings & locations
- Reset deletes all operational data
- Reset operation is reversible (backup before reset)
- Audit log shows reset with timestamp and actor

---

#### Block 2.2: Attendance Sync Fallback
**Files:** `src/lib/attendance.ts`
**Status:** `🔴 CRITICAL`

**Issue:**
- Lines 40-53: Backend fails silently, falls back to local storage
- User doesn't know data is stale
- No clear offline indicator

**Action Items:**
- [ ] Distinguish between network failure and operational error
- [ ] Add explicit "working offline" flag to attendance result
- [ ] Show user warning when using cached data
- [ ] Implement retry with exponential backoff
- [ ] Update UI to indicate data freshness status

**Files to Modify:**
- `src/lib/attendance.ts` — Enhanced error handling
- `src/pages/EmployeeScanAutoFlow.tsx` — Display offline warning
- `src/types/index.ts` — Add `isOffline` to `RecordResult`

---

#### Block 2.3: Early Checkout Date Validation
**Files:** `src/lib/attendance.ts` (lines 89-102)
**Status:** `🔴 HIGH`

**Issue:**
- Early checkout request only valid on approval date
- Timezone not explicitly handled
- Midnight boundary edge cases

**Action Items:**
- [ ] Validate early checkout requests across timezone boundaries
- [ ] Handle requests approved on previous day
- [ ] Add explicit timezone handling (Asia/Damascus or configurable)
- [ ] Test midnight transitions

**Files to Modify:**
- `src/lib/attendance.ts` — Enhanced date validation
- `src/types/index.ts` — Add timezone field to request

---

#### Block 2.4: Device Rebind Flow Verification
**Files:** `backend/src/index.ts`, `src/lib/backend.ts`
**Status:** `🟡 HIGH`

**Action Items:**
- [ ] Verify complete device rebind flow end-to-end
- [ ] Test rebind request creation
- [ ] Test rebind approval with device clearing
- [ ] Test rebind rejection
- [ ] Verify old device is blocked after rebind
- [ ] Test notification delivery on rebind decision

**Test Scenarios:**
1. Employee on device A sends rebind request
2. Manager approves rebind
3. Device A should reject future login
4. Employee can login on device B
5. Device B is now bound to employee

---

#### Block 2.5: Settings Synchronization
**Files:** `src/pages/ManagerSettings.tsx`, `src/lib/storage.ts`
**Status:** `🟡 HIGH`

**Issue:**
- Settings changes not propagated to active employees
- Employee sees stale settings until next refresh

**Action Items:**
- [ ] Implement settings change broadcast event
- [ ] Add listener in Employee components
- [ ] Refresh schedule/location when settings change
- [ ] Show "Settings Updated" notification

**Files to Modify:**
- `src/lib/storage.ts` — Add settings change event
- `src/pages/EmployeeHome.tsx` — Listen for settings changes
- `src/lib/backend.ts` — Emit change events

---

### Phase 3: 🟡 ARCHITECTURE IMPROVEMENTS (PLANNED)

**Objective:** Reduce duplication, improve maintainability without changing external behavior.

#### Planned Improvements:
- Unified error handling layer
- Consolidated loading state management
- Standardized API response formatting
- Better separation of concerns in large components
- Extraction of duplicate schedule calculations

**Constraint:** Each change must preserve existing API contracts and UI behavior.

---

### Phase 4: 🟡 PERFORMANCE OPTIMIZATION (PLANNED)

**Objective:** Make HADIR fast, especially on slow devices and networks.

#### Key Areas:
- Reduce manager dashboard polling from 5s → 30s interval
- Add request deduplication
- Optimize component re-renders
- Lazy load heavy components (reports, charts)
- Implement pagination for large employee lists
- Cache frequently accessed data (settings, locations)

**Tools:**
- React DevTools Profiler
- Lighthouse CI
- Network throttling tests

---

### Phase 5: 🟡 PWA ENHANCEMENTS (PLANNED)

**Objective:** Full production PWA support.

#### Improvements:
- Implement proper service worker lifecycle
- Add update notification UI
- Improve offline-first data handling
- Optimize asset caching
- Test on low-end devices
- iOS compatibility verification

---

### Phase 6: 🟡 UI/UX POLISH (PLANNED)

**Objective:** Professional, consistent, accessible interface.

#### Focus Areas:
- Consistent component styling
- Better mobile touch targets
- Accessible form labels
- Empty state illustrations
- Loading skeleton screens
- Error state clarity
- RTL consistency (Arabic)

**Constraint:** Keep existing HADIR visual identity.

---

### Phase 7: 🟡 SETTINGS PAGE REDESIGN (PLANNED)

**Objective:** Production-grade settings interface.

#### Improvements:
- Better section organization
- Clearer descriptions
- Input validation feedback
- Unsaved changes protection
- Dangerous action confirmations
- Success/error notifications

**Constraint:** Preserve all existing settings and functionality.

---

### Phase 8: 🟡 SECURITY HARDENING (PLANNED)

**Objective:** Audit and improve security posture.

#### Areas:
- Session token lifecycle
- Rate limiting implementation
- Login attempt throttling
- SQL injection prevention (already good)
- XSS protection verification
- CSRF token handling
- Password hashing review (add pepper)

---

### Phase 9: 🟡 DATABASE OPTIMIZATION (PLANNED)

**Objective:** D1 performance and reliability.

#### Actions:
- Verify index coverage on frequently queried columns
- Review migration order and reversibility
- Implement explicit schema initialization on deploy
- Add query performance monitoring
- Optimize N+1 queries

---

### Phase 10: 🟡 TESTING & DOCUMENTATION (PLANNED)

**Objective:** Comprehensive test coverage and clear documentation.

#### Items:
- Unit tests for critical functions (attendance, schedule)
- Integration tests for API flows
- E2E tests for user journeys
- Documentation of API contracts
- Database schema documentation
- Architecture decision records

---

## Execution Rules

### For Each Change:
1. **Read** the entire file/feature before modifying
2. **Understand** all dependencies and usages
3. **Make** minimal, targeted changes
4. **Test** locally (typecheck, lint, build)
5. **Verify** no existing features were broken
6. **Commit** with clear, descriptive message
7. **Document** any behavioral changes

### Review Checklist:
- [ ] All existing imports/exports preserved
- [ ] No deleted functions/components
- [ ] No API contract changes
- [ ] No database schema breaking changes
- [ ] TypeScript errors: 0
- [ ] ESLint errors: 0
- [ ] Build completes successfully
- [ ] Service worker updates work
- [ ] No console errors on page load

### Git Safety:
- Use feature branches for significant work
- Create small, reviewable commits
- Never force push to main
- Tag releases explicitly
- Maintain complete git history

---

## Success Metrics

By end of all phases, HADIR should achieve:

| Metric | Target | Current |
|--------|--------|---------|
| **TypeScript Errors** | 0 | ✓ 0 |
| **Runtime Crashes** | 0 | ? |
| **Attendance Accuracy** | 100% | ? |
| **Sync Consistency** | 100% | ? |
| **Offline Recovery** | 100% | ⚠️ Partial |
| **Settings Propagation** | <1s | ⚠️ Manual refresh |
| **Dashboard Load Time** | <2s | ? |
| **Mobile Performance** | Lighthouse 90+ | ? |
| **PWA Install** | 1-click | ✓ Yes |
| **Security Rating** | A+ | ? |
| **Test Coverage** | 70%+ | ❌ ~5% |

---

## Timeline Estimate

- **Phase 2:** 2-3 weeks (critical fixes)
- **Phase 3:** 1 week (architecture)
- **Phase 4:** 1-2 weeks (performance)
- **Phase 5:** 1 week (PWA)
- **Phase 6:** 2 weeks (UI/UX)
- **Phase 7:** 1 week (settings)
- **Phase 8:** 1 week (security)
- **Phase 9:** 1 week (database)
- **Phase 10:** 2 weeks (testing & docs)

**Total:** ~12-14 weeks for full production-grade system

---

## Critical Files to Watch

**Never modify without careful review:**
- `backend/src/index.ts` — Database schema, auth, API contracts
- `src/lib/storage.ts` — Data persistence, sync logic
- `src/lib/attendance.ts` — Core business logic
- `src/lib/schedule.ts` — Schedule calculations (highly interconnected)
- `src/types/index.ts` — Type contracts

---

## Escalation Path

If a proposed change:
- Requires database schema migration
- Removes any API endpoint
- Changes authentication logic
- Affects attendance recording
- Requires breaking change to types

**Action:** Document the change in issue/PR with:
1. Current behavior
2. Proposed behavior
3. Risk assessment
4. Rollback plan
5. Testing strategy

---

## Questions to Ask Before Every Change

1. ✓ Is this change backward compatible?
2. ✓ Does this preserve all existing data?
3. ✓ Are there other places that depend on this?
4. ✓ Could this break offline functionality?
5. ✓ Does this affect attendance recording?
6. ✓ Is there a migration path for existing users?
7. ✓ Have I tested this thoroughly?
8. ✓ Is error handling complete?
9. ✓ Does this change improve the user experience?
10. ✓ Is the code maintainable and documented?

---

**Last Status Update:** Phase 1 complete. Phase 2 beginning.
