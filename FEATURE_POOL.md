# Feature Pool — Pantry Snap

Last updated: 2026-06-10

The canonical backlog of future features, prioritized. Pull from the top unless
a lower item unblocks something you need. Implementation sketches for the
"carried over" items live in PICKUP.md — they're still accurate.

Legend: **Effort** S (<½ day) · M (½–2 days) · L (2+ days / needs backend work)

---

## Tier 1 — Highest value, ready to build

| # | Feature | Effort | Why it matters |
|---|---------|--------|----------------|
| 1 | **"I cooked this" modal** (PICKUP 2) | M | Closes the loop between recipes and inventory: confirm a recipe, decrement matched pantry items, log consumption events. Show which items will be decremented and let the user deselect — `nameMatchesIngredient` is fuzzy ("almond milk" matches "milk"). Needs `nameMatchesIngredient` exported from `lib/recipes.js`. |
| 2 | **Dietary filter** (PICKUP 4) | S | Chip row on Recipes (All / Vegetarian / Vegan / Gluten-free / Dairy-free). `preferences.js` already has `getDiet`/`setDiet`/`DIETS`; `getAIRecipeSuggestions` already forwards `diet` to the prompt. Add local `filterRecipesByDiet` as defense-in-depth. |
| 3 | **Recipe favorites** (PICKUP 3) | S | Heart button on recipe cards, Favorites section on top. `toggleFavoriteRecipe` already exists in `preferences.js`. Watch out: AI recipe IDs need to be stable — fall back to title slug. |
| 4 | **Expiry push notifications** | L | The single biggest waste-reduction lever: "Your milk expires tomorrow." Needs a server-side scheduled function (Supabase cron + web push), so blocked on backend access. The PWA shell + service worker already exist. |
| 5 | **Tour refresh** (PICKUP 10) | S | Tour doesn't mention the Use/consume flow or pinning — the two newest core interactions. Add 1–2 steps after `recipes`. Do this whenever feature work lands. |

## Tier 2 — Strong quality-of-life wins

| # | Feature | Effort | Why it matters |
|---|---------|--------|----------------|
| 6 | **System theme** (PICKUP 5) | S | `prefers-color-scheme`-driven theme that maps dark→midnight, light→arctic, follows OS changes live. Sketch in PICKUP.md including the media-query listener lifecycle. |
| 7 | **CSV export** (PICKUP 6) | S | "Data" section in Settings; full pantry → CSV download. Code sketch ready in PICKUP.md. Pairs naturally with a future CSV *import*. |
| 8 | **Voice add on Shopping List** (PICKUP 7) | M | Mic button using the Web Speech API ("two pounds ground beef" → qty/unit/name). Hide when the API is unavailable (Firefox). Populate the form, don't auto-submit. |
| 9 | **Venmo bill split** (PICKUP 8) | M | The Venmo handle field already exists on profiles and `getMembersWithProfiles` is built. Modal: total → even split across selected members → `venmo://paycharge` deep links (web fallback on desktop) + copy-summary. |
| 10 | **Duplicate merge instead of confirm** | M | When adding a duplicate, today's UX is a confirm dialog ("Add anyway?"). Better: offer "Merge (+2 to existing)" / "Keep both" / "Cancel". The storage layer already returns `err.existing` with id/qty — the UI just doesn't use it. |
| 11 | **Sort options on Pantry** | S | Sort by expiration date (soonest first), name, recently added. Currently fixed at created-at desc within areas. Expiring-first is the natural default for a waste-reduction app. |

## Tier 3 — Backend / infrastructure (needed before "real product")

| # | Feature | Effort | Why it matters |
|---|---------|--------|----------------|
| 12 | **Version the Supabase backend in-repo** | M | Commit migrations, RLS policies, and the `handle_new_user` trigger. The repo currently can't reproduce its own backend (FIX_LIST 11). Also add the unique constraint preventing duplicate default pantries (BUG-007 cross-tab race). |
| 13 | **Gemini proxy edge function** | M | Today the project Gemini key ships in the client bundle (documented tradeoff). Before any public deployment, move calls behind a Supabase edge function holding the key server-side. `gemini.js` is structured so this is mostly a body swap of `callGemini`. |
| 14 | **Migrate localStorage prefs to Supabase** | L | Pins, favorites, diet, and the consumption log are single-device. Every event already has a stable `id` + `timestamp`, so migration is mechanical. Unlocks cross-device sync and roommate-visible waste stats. |
| 15 | **Real invite flow** | L | Current Home-ID sharing is honest but clunky. Proper version: invite tokens / deep links (`/join/<token>`), pending/accepted states, member list with roles, remove-member. |
| 16 | **Test suite + CI** | M | Zero tests today (BUG-W02). Start with vitest unit tests for `helpers.js`, `rateLimit.js`, `recipes.js` matching, and the storage-layer validation rules — the bugs fixed so far cluster exactly there. Add `lint` with eslint (`no-undef` would have caught BUG-004). |
| 17 | **Server-side atomic moves** | M | `moveCheckedToPantry` and receipt import are best-effort client loops. A Postgres RPC would make them transactional and idempotent (FIX_LIST 1). |

## Tier 4 — Bigger product bets

| # | Feature | Effort | Why it matters |
|---|---------|--------|----------------|
| 18 | **Price tracking** | L | Capture prices from receipts (the OCR already sees them — they're currently discarded). Real "money saved" math, spend-per-week stats, price history per item. |
| 19 | **Smart shopping suggestions** | M | "You buy milk every ~9 days; it's been 8" — derive purchase cadence from the consumption log + created_at history. |
| 20 | **Barcode enrichment** | M | OpenFoodFacts lookup already fills the name; also map its category + typical shelf life so a scan fills the whole form. |
| 21 | **Item photos** | M | Snap a photo per item (Supabase storage bucket). Helps shared households ("which sauce did you mean?"). |
| 22 | **Meal planning calendar** | L | Plan recipes for the week, auto-generate the shopping list diff, decrement on cook day. Builds on "I cooked this". |
| 23 | **Household stats & leaderboard** | L | Per-member consumption/waste stats once prefs live server-side (depends on 14). Gentle gamification: household streak, "most improved". |
| 24 | **Offline mutation queue** | L | The PWA caches the shell but writes fail offline. Queue mutations in IndexedDB and replay on reconnect — useful in stores with bad reception (the core shopping use case!). |
| 25 | **Unit conversion** | S | "500 g" vs "0.5 kg" duplicate detection and consume math. A small conversion table for g/kg, mL/L, oz/lbs would cover most cases. |

---

## Recently shipped (do not re-add)

- Pin-to-top sorting in Pantry (2026-06-10)
- Honest dashboard streak/savings from the consumption log + Activity feed (2026-06-10)
- Restock nudge on +/- quantity decrement (2026-06-10)
- Consume/Use flow with reasons + consumption log (2026-05)
- Two-tier Gemini key fallback with client-side rate limiting (2026-05)
- Browser OCR receipt pipeline with Vision fallback + scan resume (2026-05)
- Home-ID based pantry sharing (2026-05)
