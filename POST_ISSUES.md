# POST_ISSUES — Pantry Snap

A living record of bugs discovered, their root causes, and the patterns to avoid repeating them.
Update this file whenever a bug is found or fixed. The goal is institutional memory — don't make the same mistake twice.

---

## How to use this file

Each entry has:
- **What broke** — the symptom
- **Root cause** — the actual code problem
- **Location** — file:line
- **Status** — `open` / `fixed` / `wont-fix`
- **Lesson** — the pattern to avoid in future code

---

## OPEN

---

### BUG-001 — Non-atomic receipt import (sequential loop)
**What broke:** Importing receipt items uses a `for...of` loop that awaits each `addPantryItem` call sequentially. If any call fails mid-import, some items are added and some are not, with no rollback and no way to retry only the failed ones.

**Root cause:** Sequential async loop instead of `Promise.all` + no transaction boundary.

**Location:** `src/pages/ScanReceipt.jsx:80–88`

**Status:** fixed — switched to `Promise.allSettled` with per-item error reporting ("8 of 10 added, 2 failed")

**Lesson:** Any multi-item write to the database must use `Promise.all` for parallelism and must account for partial failure. Until Supabase RPC transactions are used, show per-item error counts in the UI so users know what actually landed.

---

### BUG-002 — No duplicate detection on any add flow
**What broke:** The same item can be added to the pantry or shopping list multiple times with no warning. This happens via manual add, barcode scan, receipt import, and shopping→pantry move.

**Root cause:** Zero name-normalization or pre-insert duplicate check anywhere in the stack.

**Location:**
- `src/pages/AddEditItem.jsx:114–143`
- `src/pages/ScanReceipt.jsx:69–92`
- `src/pages/ShoppingList.jsx:41–70`
- `src/lib/supabaseStorage.js:162–188` (`addPantryItem`)
- `src/lib/supabaseStorage.js:243–258` (`addShoppingItem`)

**Status:** fixed — `addPantryItem` and `addShoppingItem` now do a case-insensitive name check and throw `DUPLICATE_ITEM` error. Manual adds surface a confirm dialog; shopping list shows a toast. Batch flows (receipt import, shopping→pantry, recipe "add missing") skip the check intentionally via `skipDuplicateCheck: true`.

**Lesson:** Before any `insert`, normalize the name (lowercase + trim) and check for an existing item with the same name in the same pantry. Offer merge/increment instead of silent duplicate. This is the app's core value prop — protecting it must be a first-class concern.

---

### BUG-003 — Invite flow is a stub that lies to the user
**What broke:** `inviteMemberByEmail` inserts a row into `pantry_members` and the UI immediately shows "Invitation sent!" — but no email is sent, no invite token exists, no accept flow exists, and if the invitee signs up later there is no reconciliation.

**Root cause:** Feature was scaffolded but never implemented end-to-end.

**Location:**
- `src/lib/supabaseStorage.js:90–101`
- `src/pages/Settings.jsx:120–132`
- `src/pages/Settings.jsx:217–233`

**Status:** fixed — replaced fake email invite with honest Home ID share flow. Owner sees their pantry's UUID with a "Copy ID" button. New "Join a Home" section lets recipients paste the ID to self-join via `joinPantryById()`. No more fake "Invitation sent" toast.

**Lesson:** Never show a success state for an action that didn't actually complete. If a feature is a stub, show a "coming soon" state instead of a fake confirmation. Lying to users about collaboration destroys trust.

---

### BUG-004 — `fetchAI` is referenced but never defined in Recipes.jsx
**What broke:** When the AI recipe call fails, a retry banner is shown with `onClick={fetchAI}`. `fetchAI` is not defined anywhere in the component — clicking retry throws a `ReferenceError` and crashes the component.

**Root cause:** The retry handler references a function name that was never extracted or defined.

**Location:** `src/pages/Recipes.jsx:115`

**Status:** fixed — extracted AI fetch logic into a named `fetchAI` useCallback. Also added `useRealtimeSync` subscription so recipes update on pantry changes (fixes BUG-006 simultaneously).

**Lesson:** Always verify that every identifier referenced in JSX event handlers actually exists in scope. Linting with `no-undef` would have caught this at write time.

---

### BUG-005 — Dashboard renders all-zero stats while data is loading
**What broke:** The stats grid, highlight cards, donut chart, and expiry list all render immediately with `items = []`. The loading spinner only appears at the bottom, after all the empty/zero widgets. On a slow connection the user sees a fully rendered dashboard showing 0 for every metric, then data populates.

**Root cause:** The render tree computes stats from `items` unconditionally; the `loading` guard only protects the bottom empty-state, not the metric widgets.

**Location:** `src/pages/Dashboard.jsx:191–396` (stats render before loading check at line 379)

**Status:** fixed — added early return when `loading === true` that shows a full-page spinner before any metric widgets render. The `spin` keyframe was also added to `index.css` so it's available globally.

**Lesson:** Guard all data-dependent UI sections behind the `loading` flag. Either show a skeleton/spinner for the entire content area while `loading === true`, or render each section conditionally. Never show metric widgets with fabricated zeros while the real data is in flight.

---

### BUG-006 — Recipes page has no realtime subscription
**What broke:** The Recipes page fetches pantry items once when `activePantry` changes. If a roommate adds, edits, or removes an item, recipe suggestions are stale until the user navigates away and back.

**Root cause:** The recipes `useEffect` only depends on `activePantry`, with no `useRealtimeSync` hook. All other data pages (Pantry, ShoppingList, Dashboard) subscribe to realtime changes.

**Location:** `src/pages/Recipes.jsx:20–33`

**Status:** fixed — as part of BUG-004 fix, `fetchItems` extracted to `useCallback`, `useRealtimeSync` added. Pantry changes now trigger fresh item fetch and AI re-evaluation.

**Lesson:** Any page that reads pantry items must subscribe to realtime updates via `useRealtimeSync`. Inconsistency between pages causes confusing UX — items show up in pantry but recipes suggest you're missing them.

---

### BUG-007 — Duplicate default "My Home" pantry on first login
**What broke:** If two app instances (or two tabs) both load for a brand-new user at the same time, both see `data.length === 0` and both call `createPantry('My Home')`, producing two identical default pantries.

**Root cause:** The "create default pantry if none exists" guard is a client-side read-then-write with no atomicity or server-side uniqueness constraint.

**Location:** `src/contexts/PantryContext.jsx:29–31`

**Status:** fixed (client-side) — module-level `defaultPantryBeingCreated` flag prevents two renders in the same JS context from racing. Cross-tab race requires a server-side unique constraint (documented, not yet implemented).

**Lesson:** "Create if not exists" logic must live server-side (RPC or trigger with a unique constraint). Client-side TOCTOU races are unavoidable when multiple tabs or devices share the same user session.

---

### BUG-008 — Invite success toast fires even when insert fails
**What broke:** The `inviteMemberByEmail` call can succeed at the DB level but produce no useful outcome for the user (no email sent). Conversely, if the email is already a member, the insert fails but the UI toast handling may swallow the error.

**Root cause:** Success/failure handling tied only to DB insert outcome, not to the actual end-to-end invite action.

**Location:** `src/pages/Settings.jsx:120–132`

**Status:** open (linked to BUG-003)

**Lesson:** Toast messages must reflect real-world outcomes, not just DB side effects.

---

## FIXED

---

### BUG-F01 — Barcode scanner cleanup not called by React (FIXED)
**What broke:** The scanner effect originally returned cleanup from inside `.then()`, which React cannot call. Camera stayed active after unmount.

**Root cause:** Async dynamic import — the cleanup function was returned inside the promise callback, invisible to React.

**Location:** `src/pages/AddEditItem.jsx:61–114`

**Fix:** Introduced `aborted` flag + `scannerInstance` ref in effect scope. Cleanup function returned synchronously sets `aborted = true` and calls `scannerInstance.clear()`. React can call this immediately on unmount.

**Lesson:** React effect cleanup must be a synchronous return value from the effect function. Any teardown inside `.then()` callbacks is invisible to React. Use an `aborted` ref or `AbortController` to bridge async work.

---

### BUG-F02 — Profile `update` fails if profiles row doesn't exist (FIXED)
**What broke:** New users who signed up without a DB trigger to create their profile row could not save profile details — `update` on a missing row is a no-op or error.

**Root cause:** Used `.update()` instead of `.upsert()`.

**Location:** `src/lib/supabaseStorage.js:19–27`

**Fix:** Changed `updateProfile` to use `.upsert({ id: userId, ...updates })`.

**Lesson:** Always upsert user-owned singleton rows. Never assume the row was created by a trigger — the trigger may not exist or may have failed silently.

---

### BUG-F03 — "Added This Week" always showed 0 (FIXED)
**What broke:** The dashboard metric for items added in the last 7 days was always 0 because `created_at` was not included in the Supabase query, so `item.createdAt` was always `undefined`.

**Root cause:** `createdAt: item.created_at` mapping in `getPantryItems` but `created_at` missing from the `.select()` string.

**Location:** `src/lib/supabaseStorage.js:133–160`

**Fix:** Added `created_at` to the select query.

**Lesson:** Whenever you map a field in the return object, verify it's actually selected in the query. A missing field returns `undefined` silently — no error, no warning.

---

### BUG-F04 — Waste-free streak hardcoded to 7 (FIXED)
**What broke:** The streak defaulted to 7 days when no items were expired, making it look like every new user had a week-long streak.

**Root cause:** Fabricated default value in the stats calculation.

**Location:** `src/pages/Dashboard.jsx:158–168`

**Fix:** Streak starts at 0 when no expired items exist. Streak is calculated as days since the most recently expired item.

**Lesson:** Never display a metric with a fabricated default. Show 0 or "—" until real data produces a real value.

---

### BUG-F05 — All authenticated pages eagerly imported (FIXED)
**What broke:** Every page component was imported at module load time, bloating the initial JS bundle (~884 KB total).

**Root cause:** Direct `import` statements for all pages in `App.jsx`.

**Fix:** All authenticated pages wrapped in `React.lazy()` with `Suspense`.

**Lesson:** Use `React.lazy()` for any route not needed on initial load. Landing and Auth are the only pages that need to be eagerly loaded.

---

## Won't Fix

---

### BUG-W01 — Supabase credentials hardcoded as fallback
**Details:** `src/lib/supabase.js` has the project URL and anon key hardcoded as fallback values if env vars are missing.

**Why not fixing:** The anon key is safe to expose in client-side code by design (Supabase's security model relies on RLS, not key secrecy). The env var is always set in production. The fallback only matters in dev.

**Lesson:** Supabase anon keys are intentionally public. RLS policies are the real security layer. Don't treat anon key exposure the same as secret key exposure.

---

### BUG-W02 — No test suite
**Details:** No unit, integration, or e2e tests exist.

**Why not fixing now:** The app is in active development. Test coverage will be added once core features stabilize. Priority is fixing functional bugs first.

**Lesson:** Add tests for any fixed bug immediately after fixing — regression tests are most valuable when written right after you understand the failure mode.
