# Pantry Tracker Audit Fix List

This file is a documentation-only audit. No application code was changed.

## Audit scope

Reviewed the Vite/React client, shared state, Supabase access layer, and the main pantry, shopping, recipes, receipt-scan, auth, and settings flows.

## Validation performed

1. `npm install`
2. `npm run build`
3. `npm audit --json`

## Validation results

1. The app builds successfully in production mode.
2. The production build emits large bundle warnings.
3. `npm audit` reports 2 high-severity dependency issues.
4. The repo currently has no test script, lint script, or type-check script in `package.json`.

## Priority 1 fixes

### 1. Make multi-item writes atomic and idempotent

**Where**
`src/lib/supabaseStorage.js:282-300`
`src/pages/ScanReceipt.jsx:69-92`
`src/pages/Recipes.jsx:79-90`

**Problem**
Moving checked shopping items into the pantry, importing receipt items, and adding missing recipe ingredients all execute one network write at a time. If any request fails midway, the app can leave the pantry and shopping list in a partially updated state.

**User impact**
This can create duplicate items, half-completed imports, or items that exist in both the shopping list and pantry at once. That directly undermines the app's core goal of reducing duplicate purchases and food waste.

**Recommended fix**
Move these flows into a single backend transaction or RPC.
Use bulk insert/delete operations instead of per-item loops.
Add idempotency so a retry does not duplicate already-processed items.
Return per-item success/failure details to the UI.

### 2. Fix the barcode scanner cleanup bug

**Where**
`src/pages/AddEditItem.jsx:61-99`

**Problem**
The effect that starts `html5-qrcode` returns cleanup from inside the `import(...).then(...)` callback instead of returning cleanup from the React effect itself. React never receives that cleanup function.

**User impact**
The camera/scanner can stay active after canceling, navigating away, or toggling scan mode. Re-entering the page can also leave orphaned scanner instances behind.

**Recommended fix**
Store the scanner instance in the effect scope or a ref.
Return a real cleanup function from the effect.
Stop and clear the scanner on cancel, unmount, and successful scan.
Abort the product lookup request if the component unmounts mid-scan.

### 3. Build the invite flow for real, or stop claiming it is complete

**Where**
`src/lib/supabaseStorage.js:91-102`
`src/pages/Settings.jsx:120-132`
`src/pages/Settings.jsx:217-233`

**Problem**
The "invite" action only inserts an email into `pantry_members` and immediately shows `Invitation sent!`. There is no email delivery, invite token, accept flow, link generation, member status UI, or signup-to-invite reconciliation in this repo.

**User impact**
Roommate collaboration appears supported but is not actually operational end to end. Users will assume a teammate was invited when nothing user-visible happened.

**Recommended fix**
Define a real invite model with pending and accepted states.
Generate invite tokens or deep links.
Send actual emails or expose a shareable join link.
Show pending invites, accepted members, and duplicate/self-invite validation in the UI.

### 4. Remove the hidden dependency on a backend-created `profiles` row

**Where**
`src/lib/supabaseStorage.js:6-29`
`src/pages/Settings.jsx:23-40`
`src/pages/Settings.jsx:60-72`
`src/pages/Auth.jsx:33-42`

**Problem**
The client reads `profiles`, tolerates a missing row, and then later tries to `update` that row. If the row was never auto-created by a database trigger, profile saving fails for first-time users.

**User impact**
A new user can sign up successfully but still be unable to save their profile details in Settings.

**Recommended fix**
Use `upsert` instead of `update` for profile persistence.
Create the profile row explicitly after signup/login if it does not exist.
Commit the related schema/trigger setup to the repo so this behavior is not an undocumented backend assumption.

### 5. Implement duplicate detection in add/import flows

**Where**
`src/pages/AddEditItem.jsx:114-143`
`src/pages/ScanReceipt.jsx:69-92`
`src/pages/ShoppingList.jsx:41-70`
`src/lib/supabaseStorage.js:162-188`
`src/lib/supabaseStorage.js:239-255`

**Problem**
None of the core item-creation flows check whether the same item already exists in the current pantry or shopping list.

**User impact**
The product is meant to help students avoid duplicate purchases, but the current implementation silently creates duplicates everywhere.

**Recommended fix**
Normalize item names before comparing them.
Check for likely matches before insert.
Offer to merge quantities, update the existing item, or keep both.
Surface duplicate warnings during receipt import and shopping-to-pantry moves.

## Priority 2 fixes

### 6. Fix the broken "Added This Week" dashboard metric

**Where**
`src/lib/supabaseStorage.js:137-159`
`src/pages/Dashboard.jsx:170-174`

**Problem**
`getPantryItems` maps `createdAt: item.created_at` but `created_at` is never selected in the query. As a result, `createdAt` is `undefined` for fetched pantry items.

**User impact**
`Added This Week` is incorrect and will usually stay at `0`.

**Recommended fix**
Include `created_at` in the pantry item query.
Normalize it consistently alongside `expiration_date`.
Add a regression test around the mapping used by the dashboard.

### 7. Fix the race when creating a new pantry and switching to it

**Where**
`src/pages/Settings.jsx:79-82`
`src/contexts/PantryContext.jsx:51-57`
`src/contexts/PantryContext.jsx:59-64`

**Problem**
`handleCreateHome` calls `refreshPantries()` and then immediately calls `switchPantry(pantry.id)`. `switchPantry` looks up the pantry in the old `pantries` state, so the newly created pantry may not be found yet.

**User impact**
The UI can show "New home created!" while leaving the user in the old pantry.

**Recommended fix**
Have `refreshPantries` return the new pantry list and set the active pantry from that fresh data.
Or expose a `setActivePantryById` path that does not depend on stale state.

### 8. Stop showing empty states while data is still loading

**Where**
`src/pages/Pantry.jsx:14`
`src/pages/Pantry.jsx:26-31`
`src/pages/Pantry.jsx:91-121`
`src/pages/ShoppingList.jsx:18`
`src/pages/ShoppingList.jsx:32-37`
`src/pages/ShoppingList.jsx:124-205`
`src/pages/Dashboard.jsx:104`
`src/pages/Dashboard.jsx:118-121`

**Problem**
These pages track `loading`, but the render paths ignore it and fall through to empty-state UI while the first fetch is still in flight.

**User impact**
On slow connections the app briefly tells users their pantry or shopping list is empty even when data exists.

**Recommended fix**
Render a loading skeleton or spinner until the first fetch completes.
Only show empty states once `loading === false`.

### 9. Add proper error handling around core page mutations

**Where**
`src/pages/Pantry.jsx:19-23`
`src/pages/Pantry.jsx:35-40`
`src/pages/ShoppingList.jsx:41-70`
`src/pages/Dashboard.jsx:109-115`

**Problem**
Several read/write flows await Supabase calls without local `try/catch` handling. If a request fails, the UI can remain stale and some actions will fail silently except for console output.

**User impact**
Users can tap delete, toggle, add, or move actions and end up with a stale screen and no actionable explanation.

**Recommended fix**
Wrap these operations in `try/catch`.
Show explicit error toasts.
Disable controls while requests are pending.
Only refresh the list after successful mutations.

### 10. Replace fabricated dashboard metrics with real ones

**Where**
`src/pages/Dashboard.jsx:152-168`

**Problem**
The waste-free streak defaults to `7` days whenever nothing has expired, and the money-saved estimate counts all fresh or soon-to-expire items as if they had already been used successfully.

**User impact**
The dashboard presents unearned streaks and savings numbers, which makes the analytics feel untrustworthy.

**Recommended fix**
Track real consumption, discard, and expiration events.
Base streaks on actual "no waste" periods.
Base savings on observed avoided waste or remove the metric until real event history exists.

### 11. Version the Supabase backend in the repo

**Where**
`src/lib/supabaseStorage.js:303-308`
`src/lib/recipes.js:215-220`

**Problem**
The client depends on `process-receipt`, `suggest-recipes`, schema tables, and RLS behavior, but no Supabase migrations, edge functions, or policy definitions are committed here.

**User impact**
The repo is not fully reproducible. Critical behavior cannot be reviewed, tested locally, or deployed reliably from source control.

**Recommended fix**
Commit Supabase migrations, RLS policies, seed/setup docs, and edge function source.
Document required auth triggers and table constraints.

### 12. Move Supabase configuration into environment variables

**Where**
`src/lib/supabase.js:3-6`

**Problem**
The client is hardcoded to one Supabase URL and anon key.

**User impact**
Every local or preview build points at the same backend. That makes safe staging, testing, and production isolation much harder.

**Recommended fix**
Use `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
Keep separate projects or credentials for local, staging, and production.

## Priority 3 fixes

### 13. Bring recipe suggestions into the realtime/data-consistency model

**Where**
`src/pages/Recipes.jsx:19-61`

**Problem**
The recipes page fetches once when the pantry changes and then never subscribes to realtime updates. It also does not guard against stale AI responses overwriting newer results.

**User impact**
Recipe suggestions can lag behind pantry edits made elsewhere, including edits from other members.

**Recommended fix**
Subscribe to pantry item changes with `useRealtimeSync`.
Cancel or ignore stale AI requests when the pantry item set changes.
Key the response to a request id or snapshot hash.

### 14. Harden receipt import validation before insert

**Where**
`src/pages/ScanReceipt.jsx:35-45`
`src/pages/ScanReceipt.jsx:69-82`
`src/lib/supabaseStorage.js:163-171`

**Problem**
OCR-parsed items are selectable even if the name or quantity is bad. `addPantryItem` trims the name but does not reject blank strings at the storage layer.

**User impact**
Users can import empty or malformed pantry rows from noisy receipts.

**Recommended fix**
Reject blank names before enabling confirmation.
Validate quantity and unit ranges.
Highlight low-confidence OCR rows that need review.
Enforce the same validation rules in the storage layer, not only in page-level forms.

### 15. Make default-pantry bootstrapping idempotent

**Where**
`src/contexts/PantryContext.jsx:23-32`

**Problem**
If two app instances both see zero pantries at the same time, each can try to create a default `My Home` pantry.

**User impact**
New users can end up with duplicate default pantries.

**Recommended fix**
Move default-pantry creation server-side.
Or enforce a one-default-pantry invariant with a unique constraint or RPC that is safe to call repeatedly.

### 16. Add route-level code splitting and trim the initial bundle

**Where**
`src/App.jsx:10-18`

**Problem**
All pages are imported eagerly. The validated production build produced large JS chunks.

**Validated build output**
`dist/assets/index-uBppas93.js` = 516 KB
`dist/assets/index-xo2VHHin.js` = 368 KB

**User impact**
Students on mobile devices or campus Wi-Fi will pay a heavier first-load cost than necessary.

**Recommended fix**
Lazy-load routes with `React.lazy`.
Defer heavyweight landing-page visuals and AI-adjacent features until needed.
Re-run bundle analysis after splitting to confirm the improvement.

### 17. Upgrade vulnerable build dependencies

**Where**
`package.json:18-20`

**Validated audit findings**
`vite@6.4.1` is flagged by `GHSA-p9ff-h696-f583` and `GHSA-4w7w-66w2-5vf9`.
Transitive `picomatch@4.0.3` is flagged by `GHSA-c2c7-rcm5-vvqj` and `GHSA-3v7f-55p6-f55p`.

**User impact**
These are development-tooling issues, but they still affect the local dev server and supply-chain risk posture.

**Recommended fix**
Upgrade Vite to a patched release.
Refresh the lockfile.
Re-run `npm audit` after the upgrade.

### 18. Add missing quality gates

**Where**
`package.json:6-20`

**Problem**
The repo only exposes `dev`, `build`, and `preview` scripts. There is no automated linting, testing, or type checking.

**User impact**
Regressions like the broken `createdAt` mapping can ship unnoticed.

**Recommended fix**
Add at least:
`lint`
`test`
`test:e2e` for core pantry/shopping flows
Optional `typecheck` if the project moves to TypeScript or adds JSDoc checking

## Open questions that affect severity

1. Is there a database trigger that auto-creates a `profiles` row for each new auth user?
2. Is invite delivery handled by a webhook or service outside this repo?
3. Are the Supabase edge functions stored in a different repository?

If the answer to any of the above is yes, some findings move from "broken in repo" to "not versioned in repo", but they still need documentation and deployment provenance.
