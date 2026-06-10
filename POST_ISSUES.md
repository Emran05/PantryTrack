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

### BUG-N13 — ConsumeModal honors a hidden restock checkbox (FIXED 2026-06-10)
**What broke:** Check "Add to shopping list" at full quantity, then lower the amount — the checkbox disappears but `restock` stays `true`. A partial consume then silently added the item to the shopping list and toasted "Removed · added to shopping list" even though the item wasn't removed.

**Root cause:** Checkbox visibility was conditional (`amount === item.quantity`) but the backing state was never reset when the condition stopped holding.

**Location:** `src/components/ConsumeModal.jsx`

**Fix:** `setAmountClamped` clears `restock` whenever the amount moves off full quantity; the restock branch also requires `finished` as a second guard.

**Lesson:** Any state whose UI control can be conditionally hidden must be reset when the control hides. A hidden-but-set flag is a logic bomb.

---

### BUG-N14 — Recipes page burned AI quota on no-op refreshes (FIXED 2026-06-10)
**What broke:** Every realtime event or pantry refetch produced a new `items` array identity, which re-armed the debounced AI fetch — consuming a rate-limit token and a Gemini call even when the pantry contents were identical.

**Root cause:** Effect keyed on array identity, not content.

**Location:** `src/pages/Recipes.jsx`

**Fix:** Compute a content signature (`name|qty|expiry` sorted and joined) before fetching; skip if it matches the last-fetched signature. Retry banners pass `force = true` to bypass the guard.

**Lesson:** Anything that costs money/quota must be keyed on content, not object identity. React data flows re-create arrays constantly.

---

### BUG-N15 — `moveCheckedToPantry` duplicates items on partial failure (FIXED 2026-06-10)
**What broke:** The add phase used `Promise.all` — one failed insert rejected the whole batch, the delete phase never ran, and retrying re-added every item that had already landed in the pantry.

**Root cause:** All-or-nothing promise handling around a non-transactional multi-write.

**Location:** `src/lib/supabaseStorage.js`

**Fix:** `Promise.allSettled` on the adds; only the shopping rows whose pantry insert succeeded get deleted. Returns `{ moved, failed }` and ShoppingList reports both counts.

**Lesson:** Without a server-side transaction, pair each write with its compensating action individually. Never gate cleanup of succeeded writes on the success of unrelated ones.

---

### BUG-N16 — Failure toasts rendered with a success checkmark (FIXED 2026-06-10)
**What broke:** `showToast(message)` defaults to `type = 'success'`. Nearly every error path omitted the type, so "Failed to load pantry items" appeared with a ✓.

**Location:** ~27 call sites across pages/components.

**Fix:** Audited every failure-path `showToast` and added explicit `'error'` (or `'info'` for not-found/mixed outcomes).

**Lesson:** Defaulting a toast type to `success` makes every forgotten argument a lie. When adding a helper with a default, pick the default that fails safe.

---

### BUG-N17 — Theme only applied inside the authenticated shell, and re-applied per navigation (FIXED 2026-06-10)
**What broke:** `applyTheme(getSavedTheme())` lived in `PageTransitionWrapper`, which (a) renders only on authenticated routes, so Landing/Auth flashed the default theme for Arctic users, and (b) remounts on every route change (`key={location.pathname}`), re-running the effect each navigation.

**Location:** `src/App.jsx`

**Fix:** Moved theme application to a one-time effect in the root `App` component.

**Lesson:** Global one-time side effects belong at the root, never inside a component that remounts per route.

---

### BUG-N18 — Editing an item downloaded the entire pantry (FIXED 2026-06-10)
**What broke:** `AddEditItem` called `getPantryItems(pantryId)` and `find()`-ed one row — the whole pantry over the wire to edit a single item.

**Location:** `src/pages/AddEditItem.jsx`, new `getPantryItem(itemId, pantryId)` in `src/lib/supabaseStorage.js`

**Fix:** Single-row `maybeSingle()` fetch scoped to the active pantry (preserves the BUG-N07 stale-URL guard).

---

### BUG-N19 — `refreshPantries` left a stale `activePantry` object (FIXED 2026-06-10)
**What broke:** After refresh, the active pantry kept its old object (stale name) as long as its ID still existed.

**Location:** `src/contexts/PantryContext.jsx`

**Fix:** Re-point `activePantry` at the fresh object when its visible fields changed; identity is preserved otherwise to avoid pointless downstream refetches.

---

### BUG-N20 — `parseInt` truncated fractional quantities (FIXED 2026-06-10)
**What broke:** Receipt review and shopping list quantity inputs parsed with `parseInt`, but the AI returns quantities like `0.5` (lbs) and the pantry supports floats — editing "0.5" snapped it to 1.

**Location:** `src/pages/ScanReceipt.jsx`, `src/pages/ShoppingList.jsx`

**Fix:** `parseFloat` with `step="0.5"` / `min="0.5"`, matching AddEditItem.

---

### IMPROVEMENT — Honest dashboard metrics via consumption log (2026-06-10)
The "Est. Saved" card no longer counts un-expired items as money saved. Streak = days since the last `wasted` consumption event (falls back to days-since-last-expired when no log exists); saved = real `used` events in the last 30 days × $3; new Activity section shows the last 5 consumption events. Completes PICKUP item 11 / FIX_LIST item 10.

### IMPROVEMENT — Pin sort wired in Pantry (2026-06-10)
Pinned items now float to the top of their area group, pins are GC'd against live items on every refresh, and toggling a pin re-sorts immediately. Completes PICKUP item 1.

### IMPROVEMENT — Restock nudge on +/- decrement (2026-06-10)
Decrementing an item to ≤1 via the card's − button now shows the same "Add to list" action toast as the ConsumeModal. Completes PICKUP item 9.

### IMPROVEMENT — Dependencies patched (2026-06-10)
`npm audit fix`: react-router-dom 7.17.0 (RCE/open-redirect/DoS advisories), vite 6.4.3 (path traversal/arbitrary file read), ws (memory disclosure). `npm audit` now reports 0 vulnerabilities. Gemini calls now request `responseMimeType: 'application/json'` for reliable JSON output.

---

### BUG-N01 — `updatePantryItem` writes empty strings to date / UUID columns (FIXED)
**What broke:** Editing an item and clearing the expiration date or selecting "No specific area" in the area dropdown caused a Supabase error. The form sends `expirationDate: ''` and `area_id: ''`, and `updatePantryItem` passed both straight through. Postgres rejects `''` as a date or as a UUID.

**Root cause:** `addPantryItem` defensively coerces `item.expirationDate || null` and `item.area_id && item.area_id !== '' ? item.area_id : null` before insert, but `updatePantryItem` had no equivalent guard.

**Location:** `src/lib/supabaseStorage.js:223-246`

**Fix:** `updatePantryItem` now coerces empty `expirationDate` to `null`, coerces empty `area_id` to `null`, and trims/rejects blank `name` to mirror `addPantryItem`'s validation.

**Lesson:** Mirror the validation surface between `add*` and `update*` storage functions. Anything `add` defends against, `update` must defend against too — forms can produce the same bad inputs in either flow.

---

### BUG-N02 — `ilike` duplicate check is wildcard-vulnerable (FIXED)
**What broke:** The duplicate detection in `addPantryItem` and `addShoppingItem` used `.ilike('name', trimmedName)` with raw user input. Items containing `%` or `_` (e.g., "100% Juice", "ice_cream") would match unintended rows or skip real duplicates.

**Root cause:** `ilike` treats `%` as "any string" and `_` as "any single char". Trimmed user input was inserted without escaping.

**Location:** `src/lib/supabaseStorage.js:185, 281`

**Fix:** Added an `escapeIlike()` helper that backslash-escapes `\`, `%`, and `_`. Both duplicate checks now call `.ilike('name', escapeIlike(trimmedName))`.

**Lesson:** Anything that lands in a `LIKE` / `ILIKE` pattern needs explicit escaping of `%`, `_`, and the escape character itself. PostgREST does not escape these for you.

---

### BUG-N03 — `Recipes.handleAddMissing` always claims success (FIXED)
**What broke:** Clicking "Add N missing to list" on a recipe card always toasted "N items added to shopping list" — even if every write rejected (network error, RLS denial, etc.). The handler used `Promise.allSettled` but never inspected the results, and the `try/catch` around `allSettled` was unreachable (allSettled never rejects). The handler also passed `skipDuplicateCheck: true`, so a second click silently piled up duplicates.

**Root cause:** Two compounding mistakes — dead `try/catch` around an always-resolving promise, and a fire-and-forget `Promise.allSettled` whose results were discarded.

**Location:** `src/pages/Recipes.jsx:88-102`

**Fix:** Removed `skipDuplicateCheck` so the underlying `addShoppingItem` rejects with `DUPLICATE_ITEM` for items already on the list. Iterate `results` and bucket each into `added`, `alreadyOnList`, or `failed`. Toast text reflects the actual outcome (e.g., "3 added · 2 already on list").

**Lesson:** `Promise.allSettled` never rejects — a `try/catch` around it cannot catch anything. If you use `allSettled`, you must inspect each result; otherwise use `Promise.all` and let it reject. And never silently `skipDuplicateCheck` on user-triggered actions where the user might click twice.

---

### BUG-N04 — `ItemCard.handleAddToList` shows generic error for known duplicate (FIXED)
**What broke:** Swiping a pantry item to add it to the shopping list, when that item was already on the shopping list, showed a generic "Error adding to list" toast — confusing because the swipe ostensibly succeeded.

**Root cause:** The `catch` block didn't branch on `err.code === 'DUPLICATE_ITEM'`. `ShoppingList.handleAdd` already had this branch; it was just missing here.

**Location:** `src/components/ItemCard.jsx:70-87`

**Fix:** Added the same `DUPLICATE_ITEM` branch — surfaces "X is already on your list" instead of a generic error.

**Lesson:** When the storage layer throws a coded error, every caller must handle the code (or explicitly fall through with a comment). A grep for `'DUPLICATE_ITEM'` after introducing a new code is a cheap audit.

---

### BUG-N05 — Pantry-switch race overwrites with stale data (FIXED)
**What broke:** All four data pages (Pantry, ShoppingList, Dashboard, Recipes) ran `getPantryItems(activePantry.id)` in a useCallback and naively `setItems(data)` on resolve. If the user switched pantries quickly, a slow first response could land *after* a fresh second response, overwriting current-pantry items with previous-pantry items.

**Root cause:** Classic async race — no sequence/abort guard between the awaited fetch and the state setter.

**Location:**
- `src/pages/Pantry.jsx:19-36`
- `src/pages/ShoppingList.jsx:25-42`
- `src/pages/Dashboard.jsx:111-127`
- `src/pages/Recipes.jsx:21-31`

**Fix:** Added a `fetchSeqRef` to each page. Each refresh increments the seq and only commits state if its own seq is still the latest. Also `setItems([])` on `activePantry` change so the previous pantry's items don't flash before the fresh fetch lands.

**Lesson:** Any async work that ends in `setState` and depends on a parameter that can change must guard against late arrivals. A monotonic ref counter is the cheapest way; `AbortController` is cleaner when the underlying transport supports it.

---

### BUG-N06 — Google OAuth signup leaves `profiles.first_name` blank (FIXED)
**What broke:** Email signup collects first/last name and stores them in `auth.user_metadata`, but they were never propagated to the `profiles` table. Google OAuth users skipped the form entirely and had no chance to provide a name. Settings showed blank fields, and the user had to retype their name manually.

**Root cause:** No client-side reconciliation between `auth.users.user_metadata` and `profiles`. The repo-versioned client assumes a `handle_new_user` DB trigger that may or may not exist.

**Location:** `src/contexts/AuthContext.jsx`, new `ensureProfileFromMetadata` in `src/lib/supabaseStorage.js`

**Fix:** New `ensureProfileFromMetadata(user)` storage helper reads `user.user_metadata.{first_name|given_name}` and `{last_name|family_name}`. If `profiles` is missing those fields, it upserts. AuthContext calls this on every auth change — idempotent, fire-and-forget.

**Lesson:** Don't trust hidden DB triggers. Reconcile auth metadata to your own profile table from the client when the user lands. `given_name` / `family_name` are the standard OIDC claim names — most OAuth providers use them.

---

### BUG-N07 — Editing an item from a stale URL silently targets a different pantry's item (FIXED)
**What broke:** `AddEditItem` loads all items in the active pantry then `find(i => i.id === id)`. If the user opened `/item/abc` for pantry A, then switched to pantry B before the page mounted, the find returned `undefined`. The form rendered blank, and submitting still called `updatePantryItem(id, form)` against the original ID — which RLS may reject loudly or, if the user owns both pantries, silently overwrite.

**Root cause:** Missing guard between "item not found in current pantry" and "form is interactive".

**Location:** `src/pages/AddEditItem.jsx:30-58`

**Fix:** When `isEditing` and the item isn't in the active pantry's items, toast "Item not found in this home" and `navigate('/', { replace: true })` before the form ever mounts. Also added a `cancelled` flag for the effect so a late fetch can't update state after unmount.

**Lesson:** When a route param implies "edit X", verify X exists in the current authorization context before allowing a write against it. "Not found" should redirect, not silently render an empty form pointed at a stranger's row.

---

### BUG-N08 — `processReceiptImage` throws TypeError on null edge-function response (FIXED)
**What broke:** `data.items || []` throws `TypeError: Cannot read properties of null (reading 'items')` when the edge function returns `null` — which happens on timeout or non-200 response without an `error`.

**Root cause:** Missing optional chain on `data`.

**Location:** `src/lib/supabaseStorage.js:360-366`

**Fix:** Use `data?.items ?? []`.

**Lesson:** `supabase.functions.invoke` can return `{data: null, error: null}` for some failure modes. Always optional-chain before reading fields off `data`.

---

### BUG-N09 — `pantry_active_id` survives sign-out across users (FIXED)
**What broke:** When user A logged out and user B logged in on the same device, B's session inherited A's `pantry_active_id` from localStorage. PantryContext then tried to set that as the default active pantry. If B didn't own it, the find quietly fell back to `data[0]` — but it's a privacy smell and one stale localStorage cycle from leaking the previous user's pantry ID via console / devtools.

**Root cause:** `signOut` was a one-line passthrough that didn't clear per-user local state.

**Location:** `src/contexts/AuthContext.jsx`

**Fix:** Wrapped `signOut` to `localStorage.removeItem('pantry_active_id')` before calling `supabase.auth.signOut()`. Wrapped in try/catch for private-mode browsers.

**Lesson:** Anything stored in localStorage scoped to the current user must be cleared on sign-out. Treat localStorage like a session — its lifetime should match the session it represents.

---

### BUG-N10 — Dashboard shows fake zeros above empty state (FIXED)
**What broke:** When the pantry was genuinely empty (new user), the dashboard rendered "0 day streak", "$0 saved", "0 added" highlight cards plus four 0-valued stat cards, then "No data yet" at the bottom. The fake metrics undermined the empty state.

**Root cause:** The render path computed stats from `items = []` unconditionally; the empty-state guard was at the bottom of the layout, after the widgets.

**Location:** `src/pages/Dashboard.jsx`

**Fix:** Added an early return when `items.length === 0` (after the loading check) that renders only the header, quick actions, and empty state — no metric widgets.

**Lesson:** Empty states belong above any widget that derives from the empty data. Computing stats from nothing produces noise that buries the actual empty signal.

---

### BUG-N11 — Default expiration date drifts by a day in non-UTC timezones (FIXED)
**What broke:** `getDefaultExpirationDate` did `setDate(getDate() + days)` in local time, then `toISOString().split('T')[0]` — which converts to UTC. For a user east of UTC in the very early morning (or west of UTC late at night), the UTC date would be one day off the local date, so the saved expiration date drifted.

**Root cause:** Mixing local-time math with UTC serialization. `toISOString` returns the UTC date, not the local date.

**Location:** `src/lib/helpers.js:33-38`

**Fix:** Added a `formatDateLocal(date)` helper that formats `getFullYear` / `getMonth` / `getDate` directly into a YYYY-MM-DD string. The reading helpers (`getExpirationStatus`, `getDaysUntilExpiration`, `formatDate`) already parse with `dateStr + 'T00:00:00'` (local), so the round-trip is now consistent.

**Lesson:** Never use `toISOString()` to format a "local date". Build the YYYY-MM-DD string from the date's local components. ISO dates are UTC by definition.

---

### BUG-N12 — Email-signup users not told to verify email (FIXED)
**What broke:** When the Supabase project requires email confirmation, `supabase.auth.signUp` returns `{ data: {user, session: null}, error: null }`. The Auth page checked only `error`, so the user clicked Sign Up, saw nothing happen, and assumed the form was broken.

**Root cause:** Missing branch on `data.user && !data.session` (the "needs confirmation" signal).

**Location:** `src/pages/Auth.jsx`

**Fix:** After signup, if `data.session` is null, show an info banner: "We sent a confirmation link to {email}. Click it to finish signing up, then log in." Added an `.auth-info` style alongside `.auth-error`. Banner clears on form toggle and Google sign-in.

**Lesson:** Auth flows have three outcomes, not two — error, success-with-session, and success-without-session (pending verification). Handle all three explicitly.

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
