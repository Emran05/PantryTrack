# PantrySnap design system — the philosophy, per surface

Curated from research against **live production sites** (fetched, measured, not
recalled): Linear, Vercel, Stripe, Clerk, Supabase, Notion, Raycast, Resend,
Neon, Cursor, Framer, Apple, Cal.com, Duolingo, Splitwise, Obsidian, Kagi,
Proton, Signal, DuckDuckGo, Bitwarden, Cronometer.

Written so any surface can be **rebuilt from this document alone**. Every rule
states *what*, *why*, and *who does it* — a rule with no deployed precedent
behind it is marked as a judgement call.

---

## 0. The through-line

> **The product is the proof. Chrome gets out of the way.**

PantrySnap is a free tool for students who split a kitchen. Every surface earns
attention by showing the thing working, not by decorating around it. Where a
choice is between *expressive* and *legible*, legible wins — this is a utility
someone opens while holding groceries.

Three consequences that recur on every page:

1. **Reading-scale type, not display type.** The pantry is the spectacle.
2. **Colour carries information** (expiry state, category identity) before it
   carries mood.
3. **One filled button per view.** More than one and neither is primary.

---

## 1. Where the evidence contradicted our instincts

Recorded honestly, because these were the owner's ideas and the research says
otherwise. Both remain the owner's call — this is the evidence, not a veto.

### Liquid glass on the header — the evidence says no

Fifteen top-tier product sites checked. **One** (Clerk) ships a detached
floating header, and its defining move is counter-intuitive: **the pill itself
is near-opaque; the glass lives in a separate non-interactive scrim behind it**,
and only the scrim animates on scroll. Linear, Vercel, Cursor, Resend, Neon,
Supabase, Laravel, Framer, Family and Arc all ship a full-bleed bar. Vercel's is
fully opaque with a 1px hairline on scroll. **Apple does not ship Liquid Glass on
apple.com** — it ships `saturate(180%) blur(20px)` on a flat bar with an opaque
0.88–0.92 fallback.

The cost matters more for us than for them: `backdrop-filter` re-rasterizes the
backdrop **every scroll frame, full width**, on the low-end Android hardware a
free student PWA actually runs on. This repo already learned that lesson — the
landing nav's blur was cut from 8px to 3px for exactly this reason.

**Recommendation:** ship the floating island **on desktop only**, near-opaque,
with the blur in a separate scrim; full-bleed bar on mobile. Skip liquid glass.

### Glass on the auth card — the evidence says no, twice

Nine production auth pages measured: **zero** use `backdrop-filter`. Clerk,
Cal.com and Notion get depth from a **1px `rgba(255,255,255,.07–.11)` ring plus
low-alpha white fills over a solid surface**. Glass belongs where real content
scrolls underneath — the floating header and the bottom nav — not on a static
centered card where there is nothing behind it to refract.

### A pricing page — the evidence says build something else

The split is clean: every product with a `/pricing` page has **at least one live
SKU** (Obsidian, Kagi, Proton, Notion, Bitwarden, Raycast, Ente, Cronometer).
Every product that is simply free has **no pricing page at all** — Splitwise's
entire top nav is "Log in" and "Sign up", with Pro demoted to a footer column;
Signal has `/donate`; Duolingo has a blog post; DuckDuckGo has a values page.

A lone `$0` card is the classic empty-page failure: a card is a *comparison*
affordance, so with nothing to compare it reads as a stub.

**Recommendation:** no pricing page. Build **`/why-free`** — which PantrySnap
needs anyway, because it monetizes data with a disclosed opt-out, and that
demands a trust page far more than a price table.

---

## 2. Tokens

The existing token set is sound; these are the additions and corrections the
research and audit produced.

| Token | Value | Why |
|---|---|---|
| `--color-text-muted` | per-theme, AA-checked | Failed 4.5:1 in **all four** themes (Arctic 2.32:1). Now solved per theme along its own hue. |
| `--color-{success,warning,danger}-text` | per-theme | Status hues as *text* failed AA (expiry badges at 2.15:1 in Arctic). Raw tokens still used for fills/borders. |
| `--color-primary` | **deleted — never existed** | Nine call sites resolved to nothing; worst case rendered white-on-white. Use `--color-accent`. |
| `--font-size-xxxl` | **does not exist** | `Auth.css` references it, so the auth H1 silently renders at inherited 16px. Use `--font-size-3xl`. |

**Contrast is enforced, not asserted:** `scripts/qa/check-contrast.mjs` computes
all 40 token/surface pairs and exits non-zero on regression.

**Minimum input font-size is 16px.** Below that, iOS Safari zooms the viewport
on focus and never zooms back. Supabase ships `text-base md:text-sm` precisely
for this. `Auth.css` currently uses `0.9rem` (14.4px) — a real bug.

---

## 3. Header — floating island (desktop), bar (mobile)

**Pattern (Clerk, decomposed).**

- `position: sticky` — *not* fixed. Stays in flow; no page-padding hack.
- Top inset `8–10px`; max-width ~1100px (Clerk 1228px); height `52px`
  (Apple localnav 48–52, Vercel 64, Linear 65).
- Radius `16px`, **not** `9999px`. A full pill at 52px tall reads as a widget,
  not a navigation bar.
- Gutters beside the island are `pointer-events: none` so clicks pass through.
- **The pill is near-opaque** (`0.55` at rest → `0.90` scrolled). Any blur lives
  in a separate scrim layer behind it, and only the scrim animates.
- A 120px inlined SVG noise tile at `opacity 0.035` — rasterized once, no
  network request — is what separates "convincing material" from "flat
  translucent rectangle."
- Fallback: `@supports not (backdrop-filter: blur(1px))` → bump fill to `0.92`.

**Do not:** animate `backdrop-filter` on scroll; use a full-bleed blur bar on
mobile; give the island a shadow heavy enough to read as a floating card.

---

## 4. Footer

> **Two stacked bands on the same background as the page, separated by
> hairlines — not a dark slab.**

**Band 1 — the link grid.** A fixed number of groups on a grid whose *column
count* changes but whose *group width* does not. Vercel's is the cleanest
expression (`grid-cols-4 md:6 lg:8 xl:12` with every child `col-span-2`), so
groups reflow 2→3→4→6 with no per-group media queries. Linear does the same
with explicit 6→4→2.

**Group typography (Linear's numbers, worth copying exactly):** header and link
are the *same* 13px — they differ only by weight (550 vs 400) and colour
(primary vs secondary). Contrast does the work, not size. List gap 2–4px, row
min-height 28–32px, block padding ~56px.

**Band 2 — the bottom bar.** Divided by a 1px hairline plus a large gap (Linear
80px, Supabase `mt-32 pt-8`), then one `flex justify-between` row: copyright,
legal links, theme toggle, socials.

**Scale it to the content we actually have.** PantrySnap has ~nine real
destinations. That is Family.co's footer (14 links, 3 columns) or Emerge Tools'
(9 links, one row) — **not** Raycast's six columns or Stripe's two hundred.
Copy Linear's *typography*, Family's *content volume*.

Concretely: four tracks at ≥641px, two on phones —
1. **Brand** — mark + "PantrySnap" at 15px/600 + one honest 13px positioning
   line ("Free pantry tracking for students. No ads, no subscription.")
2. **Product** — Scan a receipt · Recipes · Shopping list
3. **Support** — Help · Report a bug · Request a feature (`mailto:` is fine)
4. **Legal** — Privacy · EULA · Do Not Sell or Share · Why it's free

**Do not fake a status pill.** Every deployed instance (Dub, Mintlify, Warp,
Neon, Resend) links to a real status subdomain and resolves state client-side —
their SSR HTML literally ships "Loading status…". A hardcoded green dot reading
"All systems operational" on an app with no monitoring is the fastest way to
look cargo-culted, and it becomes an active lie the first time Supabase has an
incident.

---

## 5. Auth pages

> The 2026 auth page is an **opaque ~400px card with a hairline ring, exactly
> one filled button, two fields, and legal as passive prose** — borrowing the
> product's own surface language instead of inventing a login look.

Rules, each held by a majority of nine measured sites:

1. **One primary.** OAuth comes *first in position* but is *secondary in
   weight* — ghost button with an `rgba(255,255,255,.11)` ring. Two filled
   buttons is the most common way this gets copied badly.
2. **Two fields.** Email + password. First/last name belong in onboarding, not
   the gate.
3. **Legal as passive prose, not a checkbox gate.** A required checkbox is a
   conversion tax; the standard is a sentence under the button ("By continuing
   you agree to…"). *Judgement call for us:* our EULA discloses data sale, and
   explicit consent is defensible — decide with the attorney before removing it.
4. **The H1 names the action** ("Create your account"), not the wordmark. The
   logo is already in the header.
5. **Split-screen is desktop-only if used at all** (Cal.com). Below 1024px it
   should not exist.
6. Inputs ≥16px; `min-height: 100dvh` not `100vh`.

---

## 6. Landing

Full direction in `DESIGN_DIRECTION.md`. In one line: **the hero IS the
pantry** — a live, populated pantry in the app's own card language, where
scanning a sample receipt drops items into that same stack and the account wall
sits at "Save this pantry."

Anti-patterns this repo committed and corrected: decorative gradient blobs,
6rem display type, the product hidden behind marketing sections.

---

## 7. `/why-free` (replaces a pricing page)

One reading column. No cards, no grid, no comparison table. Native `<details>`
FAQ, ~4KB CSS, no JS beyond the router.

**"Free is the headline, not a column."** Obsidian's form is the purest:
`Free without limits.` at reading scale as the page's thesis, with no card at
all.

Content spine, in order:
1. The thesis sentence — free, no card, no trial.
2. **How we actually make money**, in plain words, before anyone asks.
3. **Exactly what leaves the account** — item names, categories, quantities,
   store, date; stripped of name, email and account ID. Photos, receipts, notes
   and shopping lists never leave.
4. **The opt-out**, deep-linked to `/settings#data-sharing`, stated as costing
   nothing.
5. FAQ answering the suspicious questions directly ("Will you start charging
   me?", "Can brands find out it was me?").

This page is where a data-monetized free app earns the benefit of the doubt —
or fails to.
