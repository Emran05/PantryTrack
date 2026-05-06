# Changes and Features — 2026-05-04

This session: bug sweep + fixes for 12 latent issues not in `FIX_LIST.md` or `POST_ISSUES.md`, plus a ranked list of feature opportunities grounded in the app's stated mission (waste reduction for students/households).

---

## Part 1 — Bug Fixes

All 12 fixed in this session. Production build verified (`vite build` — 160 modules, no warnings, no errors). Each fix is also documented in `POST_ISSUES.md` under FIXED with what broke / root cause / location / fix / lesson.

### High priority (functional breakage)

#### BUG-N1 — `updatePantryItem` writes empty strings to date / UUID columns
Editing an item and clearing the expiration date or selecting "No specific area" sent `expiration_date: ''` and `area_id: ''` to Postgres. Both are invalid for date / UUID columns and would throw. `addPantryItem` had defensive null-coercion; `updatePantryItem` did not.

**File:** `src/lib/supabaseStorage.js:223-246`
**Fix:** Coerce empty strings to `null`, trim/reject blank `name`. Mirror the validation surface across add/update.

---

#### BUG-N2 — `ilike` duplicate check is wildcard-vulnerable
The duplicate detection in `addPantryItem` and `addShoppingItem` used `.ilike('name', trimmedName)` with raw user input. Items containing `%` or `_` ("100% Juice", "ice_cream") would match unrelated rows or skip real duplicates because `ilike` treats those as wildcards.

**File:** `src/lib/supabaseStorage.js:185, 281`
**Fix:** New `escapeIlike()` helper backslash-escapes `\`, `%`, and `_` before passing user input into `ilike`.

---

#### BUG-N3 — `Recipes.handleAddMissing` always claims success
"Add N missing to list" toasted "N items added" even when every write rejected. Two compounding mistakes: a `try/catch` around `Promise.allSettled` (which never rejects, so the catch is unreachable), and `skipDuplicateCheck: true` so a second click silently piled up duplicates.

**File:** `src/pages/Recipes.jsx:88-128`
**Fix:** Removed `skipDuplicateCheck`, iterated `results` and bucketed each into `added` / `alreadyOnList` / `failed`. Toast text now reflects the actual outcome ("3 added · 2 already on list", etc.).

---

#### BUG-N4 — `ItemCard.handleAddToList` shows generic error for known duplicate
Swiping a pantry item that was already on the shopping list showed a generic "Error adding to list" instead of the friendly "already on your list" message that `ShoppingList.handleAdd` shows.

**File:** `src/components/ItemCard.jsx:70-87`
**Fix:** Added the `DUPLICATE_ITEM` branch.

---

#### BUG-N5 — Pantry-switch race overwrites with stale data
All four data pages (Pantry, ShoppingList, Dashboard, Recipes) ran `getPantryItems(activePantry.id)` in a useCallback and naively `setItems(data)` on resolve. If the user switched pantries quickly, a slow first response could land *after* a fresh second response, displaying the previous home's items in the new home's UI.

**Files:**
- `src/pages/Pantry.jsx:18-39`
- `src/pages/ShoppingList.jsx:24-46`
- `src/pages/Dashboard.jsx:110-130`
- `src/pages/Recipes.jsx:20-37`

**Fix:** Each page has a `fetchSeqRef`. Each refresh increments the seq and only commits state if its own seq is still the latest. Also `setItems([])` on `activePantry` change so the previous pantry's items don't flash before the fresh fetch lands.

---

#### BUG-N6 — Google OAuth signup leaves `profiles.first_name` blank
Email signup collects first/last name into `auth.user_metadata` but never propagates them to the `profiles` table. Google OAuth users skip the form entirely. Settings showed blank fields, and users had to retype their name manually.

**Files:** `src/contexts/AuthContext.jsx`, `src/lib/supabaseStorage.js`
**Fix:** New `ensureProfileFromMetadata(user)` storage helper reads `user.user_metadata.{first_name|given_name}` and `{last_name|family_name}` and upserts into `profiles` if those fields are blank. AuthContext calls it on every auth change — idempotent, fire-and-forget.

---

#### BUG-N7 — Editing from a stale URL silently targets a different pantry's item
`AddEditItem` loads all items in the active pantry then `find(i => i.id === id)`. If the user opened `/item/abc` for pantry A, then switched to pantry B before mount, the find returned `undefined`. The form rendered blank, and submitting still called `updatePantryItem(id, form)` against the original ID — RLS-rejected loudly, or worse, silently overwritten if the user owns both pantries.

**File:** `src/pages/AddEditItem.jsx:30-68`
**Fix:** When `isEditing` and the item isn't found, toast "Item not found in this home" and `navigate('/', { replace: true })` before the form is interactive. Added `cancelled` flag for the effect.

---

### Medium priority

#### BUG-N8 — `processReceiptImage` throws TypeError on null edge-function response
`data.items || []` throws if `data` is `null` (edge function timeout or non-200 response without an `error`).

**File:** `src/lib/supabaseStorage.js:393-399`
**Fix:** `data?.items ?? []`.

---

#### BUG-N9 — `pantry_active_id` survives sign-out across users
When user A logged out and user B logged in on the same device, B inherited A's `pantry_active_id` from localStorage. PantryContext fell back to `data[0]` if B didn't own it (so it worked), but it was a privacy smell.

**File:** `src/contexts/AuthContext.jsx:32-40`
**Fix:** `signOut` is now wrapped to `localStorage.removeItem('pantry_active_id')` before calling `supabase.auth.signOut()`. try/catch for private-mode browsers.

---

### Low priority

#### BUG-N10 — Dashboard shows fake zeros above empty state
A brand-new user (empty pantry) saw "0 day streak", "$0 saved", "0 added" highlight cards and four 0-valued stat cards before the "No data yet" message at the bottom.

**File:** `src/pages/Dashboard.jsx:191-263`
**Fix:** Added an early return when `items.length === 0` (after the loading check) that renders only the header, quick actions, and empty state — no metric widgets.

---

#### BUG-N11 — Default expiration date drifts by a day in non-UTC timezones
`getDefaultExpirationDate` did local-time `setDate` then `toISOString().split('T')[0]` — which converts to UTC. For a user east of UTC late at night (or west of UTC early morning), the UTC date would be one day off the local date.

**File:** `src/lib/helpers.js:33-49`
**Fix:** New `formatDateLocal(date)` builds the YYYY-MM-DD string from local `getFullYear` / `getMonth` / `getDate`. Reading helpers (`getExpirationStatus`, `getDaysUntilExpiration`, `formatDate`) already parse with local-time `T00:00:00`, so the round-trip is now consistent.

---

#### BUG-N12 — Email-signup users not told to verify email
When the Supabase project requires email confirmation, `signUp` returns `{data: {user, session: null}, error: null}`. The page checked only `error`, so the user clicked Sign Up, saw nothing, and assumed the form was broken.

**Files:** `src/pages/Auth.jsx`, `src/pages/Auth.css`
**Fix:** After signup, if `data.session` is null, show an info banner: "We sent a confirmation link to {email}. Click it to finish signing up, then log in." Added `.auth-info` style alongside `.auth-error`. Banner clears on form toggle and on Google sign-in.

---

## Part 2 — Feature Opportunities

Ranked by impact-to-effort ratio, grounded in the app's stated mission (waste reduction for students/households) and the recent commit trajectory (AI integration, polish, multi-user).

### Top picks (high-impact, builds on existing infrastructure)

#### 1. "I used some" / consume action with quantity decrement
Replace pure swipe-to-delete with a "Used X of Y" prompt. When qty hits 0, remove the item. Closes the consumption loop and feeds real data into the dashboard. **Low effort.**

#### 2. Waste log (mark as expired / donated / used)
When an item is removed, ask why. Stores in a new `consumption_events` table. Powers honest streak + savings calculations and fixes the "fabricated metric" critique from FIX_LIST. **Medium effort.**

#### 3. "Cook this" mode that decrements matched ingredients
On a recipe card, button "I cooked this" opens a confirm modal showing matched pantry items and quantities to deduct. Combines with the consume action above. **Medium effort.**

#### 4. Push notifications for items expiring in N days
PWA + service worker already exist. Add Web Push subscription, Supabase scheduled function fires daily at a configurable time. Directly serves the waste-reduction mission. **Medium effort.**

#### 5. Bill splitting via Venmo deep link
`profile.venmo_handle` is already in the schema and unused. Receipt total → split among home members → each member gets a `venmo://paycharge?txn=charge&recipients=@handle&amount=X&note=...` link. Huge win for student roommates. **Low effort.**

#### 6. Shared-home activity feed
"Sarah added 2 milk · 5m ago", "Alex used the eggs · today". Builds on existing realtime + new `consumption_events`. Trust + transparency for multi-user homes. **Low-medium effort.**

### Strong secondary

#### 7. Pinned / favorite items + one-tap re-add to shopping list
"Always running out of milk?" Pin it. Renders at top of pantry; also one-tap chips on the shopping form. **Low effort.**

#### 8. Meal planner (week view)
Drag recipes into weekday slots, auto-add missing ingredients to shopping list, highlight items expiring before that day. **Higher effort, big retention play.**

#### 9. Smart restock suggestions
When an item drops to qty 1 (or is removed via "used"), suggest "Add to shopping list?" toast. **Low effort.**

#### 10. Dietary filter for AI recipes
Vegan / vegetarian / gluten-free / dairy-free toggles passed to the `suggest-recipes` edge function. **Low effort, broader appeal.**

### Polish / reach

#### 11. Voice add via Web Speech API
"Add 2 lbs ground beef." Friction reducer.

#### 12. Item photos
Upload or attach product image. Open Food Facts already returns a product image for barcoded items — currently discarded.

#### 13. Recipe favorites + personal notes
Heart icon, persistent across sessions, freeform user notes per recipe.

#### 14. Auto / system theme
Respect `prefers-color-scheme` alongside the existing four themes.

#### 15. Apple Sign-In
Round out OAuth alongside Google.

#### 16. CSV export of pantry
One-line addition, useful for power users and data portability.

---

### Why these picks fit together

The top three (consume action, waste log, "cook this") are tightly coupled and together solve `FIX_LIST.md` Priority 2 item 10 — the "fabricated dashboard metrics" critique. They turn the dashboard from estimates into honest reporting:

- **Streak** becomes "days since last waste event" using real data.
- **$ saved** becomes "items consumed before expiry × actual cost" if cost is tracked at receipt scan, or "items consumed before expiry × ~$3" if not — but at least the *count* is real.
- **Items used this week** replaces "items added this week" as the real engagement signal.

That foundation makes #4 (push notifications) feel earned: now the app has real consumption data, push reminders can be tuned ("you usually finish milk in 5 days, the new carton expires in 6"). And #5 (bill splitting) leverages an already-collected field (`venmo_handle`) at zero schema cost.

---

## Verification

```
npm run build
# vite v6.4.1 building for production...
# transforming...
# ✓ 160 modules transformed.
# ✓ built in 1.43s
```

No warnings, no errors. All 12 fixes ship cleanly.
