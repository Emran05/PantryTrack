# Pickup — In-Flight Feature Work

Last updated: 2026-05-06

This doc captures what's already wired and what's still left to build for the
10-feature plan in `CHANGES_AND_FEATURES.md`. Read top to bottom — order matters
because later items reuse foundations from earlier items.

---

## What's already shipped (don't redo)

These are merged into the codebase and verified by `npm run build`:

### Storage primitives — `src/lib/supabaseStorage.js`
- **`consumePantryItem(itemId, amountToConsume)`** — decrements quantity; deletes the row if it would hit 0; returns `{ removed, prevQty, newQty, name, category, unit, ... }`. Rounds to 2dp.
- **`getMembersWithProfiles(pantryId)`** — fetches `pantry_members` joined to `profiles` (id, first_name, last_name, venmo_handle). Two queries because the FK isn't declared. Returns `[{ ...member, profile }]`.

### Local prefs / event log — `src/lib/preferences.js` (new)
All localStorage-backed. Single-device only — designed so a future Supabase migration is mechanical (each event has stable `id` and `timestamp`).

| Export | Purpose |
|---|---|
| `logConsumptionEvent(pantryId, event)` | Append `{ itemId, itemName, category, qty, unit, reason, finished }` to the per-pantry consumption log. Capped at 500 events. |
| `getConsumptionLog(pantryId, sinceTs?)` | Read events. |
| `consumptionStatsLastNDays(pantryId, days)` | Aggregates by reason — used for honest dashboard streak/savings. |
| `getPinnedIds(pantryId)`, `isPinned`, `togglePin`, `reconcilePins` | Per-pantry pinned item IDs. |
| `getFavoriteRecipeIds`, `isFavoriteRecipe`, `toggleFavoriteRecipe` | Global recipe favorites. |
| `getDiet`, `setDiet`, `DIETS` | Single string preference: `'all' \| 'vegetarian' \| 'vegan' \| 'glutenfree' \| 'dairyfree'`. |

### Toast — `src/components/ToastContext.jsx` + `Toast.css`
- `showToast(message, type, options?)` now accepts `options = { action: { label, onClick }, duration }`. Action toasts auto-default to 5000ms.
- `.toast-action` CSS button is styled (accent fill, rounded full).

### ConsumeModal — `src/components/ConsumeModal.jsx` + `.css` (new)
Bottom-sheet modal. Used by ItemCard's "Use" button.

Behavior:
- Default amount = full quantity ("I finished it" is the most common case).
- Presets: Some / Half / All.
- Reasons: Used·Cooked / Expired·Wasted / Donated·Gave away.
- "Add to shopping list" checkbox shown only when amount === full quantity.
- After save:
  - If finished and user opted in → adds to shopping list, toasts "Added to shopping list" outcome (handles `DUPLICATE_ITEM`).
  - If finished and user did NOT opt in → toasts "X finished" with an `action: { label: 'Add to list', onClick }` button (smart restock prompt).
  - If newQty ≤ 1 → toasts "Only N left" with the same restock action.
  - Otherwise → "Used X unit of name".
- Logs every consumption event via `logConsumptionEvent` with `finished` boolean.
- Calls `onDone(result)` so the parent can refresh.

### ItemCard — `src/components/ItemCard.jsx` + `.css`
- Swipe row widened to **168px** with three actions: **Use** (green), **List** (blue), **Delete** (red). `SWIPE_THRESHOLD = 100`, reveal = 168.
- New **pin button** at top-left of card (28×28, ~35% opacity when not pinned, full accent when pinned). Toggles via `togglePin(activePantry.id, item.id)`.
- Pinned cards get an inset accent stripe (`box-shadow: inset 3px 0 0 var(--color-accent)`) on the wrapper.
- ItemCard accepts an optional `onPinChange(itemId, nowPinned)` callback. **Not yet wired by Pantry.jsx** — see "Pin sort" below.
- ConsumeModal renders inline after the card surface when `showConsume === true`.
- Existing handleAddToList already gracefully handles `DUPLICATE_ITEM` (from BUG-N4 fix).

---

## Remaining work, in build order

### 1. Pin sort + render in Pantry page
**File:** `src/pages/Pantry.jsx`

Right now pinning works (state persists, badge fills, accent stripe appears) but pinned items don't sort to the top. Two changes:

1. After `setItems(data)` in `refresh`, call `reconcilePins(activePantry.id, data.map(i => i.id))` to GC stale pins.
2. In the grouped render, sort each `areaItems` array so pinned IDs come first. Within pinned and unpinned, keep the existing order. Sketch:
   ```js
   import { getPinnedIds, reconcilePins } from '../lib/preferences';

   // After items load:
   const pinnedSet = useMemo(() => new Set(getPinnedIds(activePantry?.id)), [activePantry, items]);

   // In render, replace `areaItems.map(...)` with a sorted version:
   const sorted = [...areaItems].sort((a, b) => {
     const ap = pinnedSet.has(a.id);
     const bp = pinnedSet.has(b.id);
     if (ap === bp) return 0;
     return ap ? -1 : 1;
   });
   ```
3. Wire `onPinChange` on `<ItemCard>` to bump a local "pin tick" state so the sort recomputes:
   ```js
   const [pinTick, setPinTick] = useState(0);
   ...
   <ItemCard ... onPinChange={() => setPinTick(t => t + 1)} />
   ```
   Then include `pinTick` in the `useMemo` deps for `pinnedSet`.

Optional polish: consider a "Pinned" header above the first area when any pinned items exist, but the inset stripe + sort is the meaningful signal.

---

### 2. CookThisModal + Recipes integration
**Files:**
- `src/components/CookThisModal.jsx` + `.css` (new)
- `src/pages/Recipes.jsx` (add button + handler)

UX: "I cooked this" button on each recipe card that has at least one matched ingredient. Opens a modal listing each matched pantry item with a qty stepper (default 1, capped at item.quantity). User confirms; we call `consumePantryItem` for each in parallel and log events.

Implementation sketch:
```jsx
// CookThisModal props: { recipe, items (pantry items), pantryId, onClose, onDone }
// State: per-row qtyMap { [itemId]: number }

const handleCook = async () => {
  // Resolve recipe.matched ingredient names to pantry item IDs
  // (recipes.js's nameMatchesIngredient is the right matcher).
  const targets = items
    .filter(item => recipe.matched.some(ing => nameMatchesIngredient(item.name, ing)))
    .map(item => ({ item, qty: qtyMap[item.id] ?? 1 }));

  const results = await Promise.allSettled(
    targets.map(({ item, qty }) =>
      consumePantryItem(item.id, qty).then(r => {
        logConsumptionEvent(pantryId, {
          itemId: item.id, itemName: item.name, category: item.category,
          qty, unit: item.unit, reason: 'used', finished: r.removed,
          recipeId: recipe.id, recipeTitle: recipe.title,
        });
        return r;
      })
    )
  );

  const removed = results.filter(r => r.status === 'fulfilled' && r.value.removed);
  // Toast: "Cooked Pasta Bolognese · 2 items finished"
  // For each finished item, optionally surface a smart restock action toast.
};
```

Export `nameMatchesIngredient` from `lib/recipes.js` (currently file-private). Add the button to `Recipes.jsx` only when `recipe.matched.length > 0`.

---

### 3. Recipe favorites + Favorites section
**Files:**
- `src/pages/Recipes.jsx`
- `src/pages/Recipes.css`

Wiring:
- Heart button on each recipe card → `toggleFavoriteRecipe(recipe.id)`. Use a `[favTick, setFavTick]` state to recompute filtered/sorted lists on toggle.
- `useMemo` on the list: filter into `favorites` and `others`. Render two sections: "Favorites" first (only if non-empty), then "Suggestions". A favorite recipe should still appear in suggestions if its match% > 0; the favorites section is additive — it pulls in favorites that wouldn't otherwise match (treat them as "matchPct from current pantry, 0% if none").
- Heart icon: outline when not favorite, filled accent when favorite. Place top-right of the recipe card next to the match-ring.
- AI recipes have IDs from the edge function; ensure they're stable enough across calls. If unstable, fall back to favoriting by `title` slug — but we should fix the backend to return stable IDs too.

---

### 4. Dietary filter
**Files:**
- `src/lib/recipes.js` (add `filterByDiet` + pass diet to AI)
- `src/pages/Recipes.jsx` (chip UI + state)

Add to `recipes.js`:
```js
const DIET_BLOCK = {
  vegetarian: ['ground beef','chicken','beef','pork','bacon','turkey','fish','salmon','tuna','shrimp','meat'],
  vegan:      ['ground beef','chicken','beef','pork','bacon','turkey','fish','salmon','tuna','shrimp','meat','milk','cheese','cheddar','yogurt','butter','cream','egg'],
  glutenfree: ['bread','pasta','flour','tortillas','pita','cereal','noodles'],
  dairyfree:  ['milk','cheese','cheddar','yogurt','butter','cream','sour cream','parmesan','mozzarella'],
};

export function filterRecipesByDiet(recipes, diet) {
  if (!diet || diet === 'all') return recipes;
  const blocked = DIET_BLOCK[diet] || [];
  if (blocked.length === 0) return recipes;
  return recipes.filter(r => !(r.ingredients || []).some(ing => {
    const lower = ing.toLowerCase();
    return blocked.some(b => lower.includes(b));
  }));
}
```

Pass `diet` to the AI edge function:
```js
await supabase.functions.invoke('suggest-recipes', {
  body: { items, prioritizeExpiring: hasExpiring, diet }
});
```
Then also locally filter the AI response with `filterRecipesByDiet` as a defense-in-depth — the edge function may not yet honor the param.

UI: chip row above the recipe list. State synced via `getDiet()` / `setDiet()`. Re-fetch AI on change (`fetchAI` is already a dep-sensitive callback).

---

### 5. System theme
**Files:**
- `src/lib/themes.js`
- `src/components/ThemePicker.jsx`

Add a new theme:
```js
system: {
  id: 'system',
  label: 'System',
  preview: ['#0f172a', '#f0f4f8', '#22c55e'], // dark/light split
  vars: {}, // resolved at apply time
},
```

Refactor `applyTheme` to delegate to a private `applyVars(themeId)` for non-system, and for `system`:
1. Save `'system'` to localStorage.
2. Read `window.matchMedia('(prefers-color-scheme: dark)').matches`.
3. Apply `midnight` vars when dark, `arctic` vars when light.
4. Subscribe to `change` on the media query; call apply again. Keep the listener ref at module scope and remove it on the next `applyTheme` call.

Important: `applyTheme` is called from `App.jsx` on mount and from `ThemePicker` on click. Both paths must clear any prior media-query listener — use a `let activeMediaListener = null;` at module scope as the source of truth.

ThemePicker UI: add the System tile with a half-light/half-dark preview swatch.

---

### 6. CSV export
**File:** `src/pages/Settings.jsx`

Add a card under About, or alongside "My Homes":
```jsx
import { getPantryItems } from '../lib/supabaseStorage';

const handleExportCSV = async () => {
  if (!activePantry) return;
  setLoading(true);
  try {
    const items = await getPantryItems(activePantry.id);
    const headers = ['name','category','quantity','unit','expiration_date','area','notes','created_at'];
    const escape = (v) => {
      if (v == null) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = items.map(it => [
      it.name, it.category, it.quantity, it.unit,
      it.expirationDate || '', it.areaName || '', it.notes || '', it.createdAt || ''
    ].map(escape).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activePantry.name.replace(/[^\w]/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast('Pantry exported');
  } catch (err) {
    console.error(err);
    showToast('Export failed');
  } finally {
    setLoading(false);
  }
};
```

Place the button in a new "Data" section in Settings.

---

### 7. Voice add (ShoppingList)
**File:** `src/pages/ShoppingList.jsx` + minor CSS

Inline mic button to the right of the name input. Hide if `window.SpeechRecognition || window.webkitSpeechRecognition` is unavailable.

```jsx
function VoiceMicButton({ onTranscript }) {
  const [listening, setListening] = useState(false);
  const ref = useRef(null);
  const SpeechRecognition = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;
  if (!SpeechRecognition) return null;

  const start = () => {
    const r = new SpeechRecognition();
    r.lang = 'en-US';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e) => onTranscript(e.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    ref.current = r;
    r.start();
    setListening(true);
  };
  const stop = () => { ref.current?.stop(); setListening(false); };
  return (
    <button type="button" className={`voice-mic ${listening ? 'active' : ''}`} onClick={listening ? stop : start} aria-label="Voice input">
      <svg /* mic icon */ />
    </button>
  );
}
```

Parse the transcript:
```js
function parseVoice(text) {
  const t = text.trim().replace(/^(add|put|get)\s+/i, '');
  const qm = t.match(/^(\d+(?:\.\d+)?)\s+/);
  const quantity = qm ? parseFloat(qm[1]) : 1;
  const rest = qm ? t.slice(qm[0].length) : t;
  const um = rest.match(/^(pcs|lbs?|oz|kg|g|liters?|l|ml|cups?|bags?|boxes?|cans?|bottles?)\s+/i);
  const UNIT_MAP = { lb:'lbs', liter:'L', liters:'L', l:'L', ml:'mL', cup:'cups', bag:'bags', box:'boxes', can:'cans', bottle:'bottles' };
  const rawUnit = um ? um[1].toLowerCase() : 'pcs';
  const unit = UNIT_MAP[rawUnit] || rawUnit;
  const name = (um ? rest.slice(um[0].length) : rest).trim();
  return { quantity, unit, name };
}
```

On transcript: populate the form fields (don't auto-submit — the user might want to tweak). Show a toast hinting "Heard: 2 lbs ground beef".

---

### 8. Venmo bill split
**Files:**
- `src/components/SplitBillModal.jsx` + `.css` (new)
- `src/pages/ShoppingList.jsx` (button to open the modal)

Behavior:
- Button "Split a bill" near the "Move to Pantry" button, or in its own row when there's a checked-items section (most natural moment to settle up).
- Modal contents:
  1. Total amount input (`$`).
  2. List of home members from `getMembersWithProfiles(activePantry.id)`. Each row has a checkbox (default all checked), shows their first_name + last_name + (venmo_handle or "no Venmo").
  3. Live "Each pays $X.XX" computed from total / checked count. Use `Math.round(total*100/n)/100`; assign the rounding remainder pennies to the last person so it sums exactly.
  4. For each *included other-than-self* member with a venmo_handle, render a button "Charge {name} $X.XX" → opens `venmo://paycharge?txn=charge&recipients=<handle>&amount=<X.XX>&note=Pantry+groceries`. For members without a handle, show their share but disable the button with a hint.
  5. A "Copy summary" button that puts a line per member into the clipboard, useful for non-Venmo settle-ups.

Notes:
- Don't include the current user in chargeable rows — they're paying, not charging themselves.
- Strip leading `@` from `venmo_handle` if present.
- The `venmo://` scheme works on mobile only; provide a fallback web URL `https://venmo.com/?txn=charge&audience=public&recipients=<handle>&amount=<X>&note=...` for desktop. Detect with `/iPhone|iPad|Android/.test(navigator.userAgent)`.

---

### 9. Smart restock outside ConsumeModal
The modal already triggers smart restock. But the existing +/- qty buttons in `ItemCard.handleQtyChange` don't. Add a check after a successful decrement:
```js
if (newQty <= 1 && delta < 0) {
  showToast(`Only ${newQty} ${item.unit} left`, 'info', {
    action: { label: 'Add to list', onClick: async () => { /* addShoppingItem */ } }
  });
}
```
Lift the action handler out (it's duplicated in ConsumeModal — consider extracting to a hook `useRestockPrompt(item, pantryId)`).

---

### 10. Tour update
**File:** `src/components/Tour.jsx`

Add 1–2 new steps after `recipes`:
- **"Track what you use"** — explain the swipe → Use button + reasons.
- **"Pin staples"** — show that pinning floats items to the top.
Update step counter and dots accordingly.

---

### 11. Dashboard upgrade — honest streak via consumption log
**File:** `src/pages/Dashboard.jsx`

The existing fabricated streak already became "days since last expired item" (BUG-F04). With the consumption log in place, upgrade further:
- **Streak** = days since the most recent `wasted` event in `getConsumptionLog(pantryId)`.
- **Money saved** = `consumptionStatsLastNDays(pantryId, 30).used * 3` — replaces the "fresh + soon" estimate with real "used before expiry" data.
- **Used this week** = a new highlight card replacing or supplementing "Added this week".
- Surface a small "Activity" section near the bottom listing the last ~5 events ("Used 2 milk · today", "Wasted 1 lettuce · yesterday").

This is the payoff for the consume action — it makes the dashboard honest.

---

## Verification checklist

After each feature, run:
```bash
npm run build
```
And spot-check in the browser:
```bash
npm run dev   # opens 5173 automatically
```
Targets to test for each feature:
- **Use action:** Open pantry, swipe an item, tap Use. Try Some/Half/All. Try each reason. Confirm: item qty decremented (or removed at zero), waste log entry added (devtools localStorage `pantry_consumption_log_<pantryId>`), restock toast appears with action button. Tap the action button — confirm shopping item is added.
- **Pin:** Tap the pin badge on any item — confirm the badge fills and the wrapper gets the accent stripe. Reload — pin survives. (Sort to top requires step 1 above.)
- **Cook this:** From a recipe with matched ingredients, tap "I cooked this", adjust quantities, confirm. Multiple items decrement; toast summarizes.
- **Recipe favorites:** Heart a recipe, navigate away, come back. Heart still filled. Hearted recipe appears in Favorites section.
- **Dietary filter:** Pick Vegan, confirm Pasta Bolognese disappears (has ground beef).
- **System theme:** Pick System; toggle OS dark mode; theme follows.
- **CSV export:** Tap export, confirm CSV downloads with correct header and rows.
- **Voice add:** Mic icon visible only on supported browsers. Speak "two pounds ground beef" → form populates `2`, `lbs`, `ground beef`.
- **Venmo split:** Open modal, enter $30 with 3 members → each $10. Tap charge → confirm `venmo://paycharge?...` opens (or web fallback opens venmo.com).

---

## Dependencies between remaining features

```
Pin sort (1) ─── independent
Cook this (2) ── needs nameMatchesIngredient export from recipes.js
Favorites (3) ── independent (uses preferences.js already in place)
Dietary (4) ──── independent (preferences.js + recipes.js)
System theme (5) — independent
CSV export (6) ── independent
Voice add (7) ── independent
Venmo split (8) ─ needs getMembersWithProfiles (already in place)
Restock for +/- (9) — depends on Toast action support (already in place)
Tour update (10) — best done last so all features exist when tour mentions them
Dashboard upgrade (11) — best done last; depends on actual consumption events
```

---

## Decisions already made (don't relitigate)

- **localStorage for waste log + pinned + favorites + diet.** Server tables would be better but aren't versioned in this repo. Each entry has stable id/timestamp so migration is mechanical.
- **Pin button at top-left of card, persistent.** Not in swipe row — discoverable without swiping, doesn't crowd the existing 3-button swipe row.
- **Default consume amount = full quantity.** "I finished it" is the most common case; presets (Some/Half/All) cover the rest.
- **Smart restock as toast action button, not a modal.** Less interruptive; auto-dismisses if ignored.
- **Diet enforced on local list AND passed to AI.** Defense in depth — edge function may not honor it yet.
- **System theme uses midnight/arctic for dark/light.** They're the existing tokens; lavender/sunset are stylistic and shouldn't auto-trigger.

---

## Known gaps when this is all done

- **Multi-device drift on localStorage data.** Pin/favorites/diet/waste log don't sync across devices. Acceptable for student MVP; flag for v4 if cross-device ships.
- **Cook-this confidence.** `nameMatchesIngredient` is fuzzy; "almond milk" matches "milk" both ways. Cook-this should show users which pantry items it picked and let them deselect, not just blindly decrement.
- **Web Push.** Still not done (needs server-side scheduled function). PICKUP doesn't include this — add separately when backend access is restored.
