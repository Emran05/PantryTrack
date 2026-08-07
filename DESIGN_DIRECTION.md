# Landing redesign — decided direction

**Status: PROPOSAL. Nothing here ships to `main` until the owner approves.**
Built on branch `landing-redesign`; the current landing stays live meanwhile.

## Why redo it at all

The current landing is competent and research-backed, but measured against
design-direction discipline it commits three named anti-patterns — and I built
all three:

1. **Decorative blobs + a purple gradient field.** The aurora is four blurred
   indigo/violet radial gradients. It is the single most generated-looking
   pattern on the web right now. It says "someone made a landing page," not
   "this is what PantrySnap is."
2. **Oversized generic hero text.** `clamp(3rem, 8vw, 6rem)` display type is
   the default move, and it pushes the actual product below the fold.
3. **The product is hidden behind marketing.** The first viewport is a headline,
   a stat, and two buttons. The thing the app *does* — a pantry that knows what
   you have and what dies first — appears only as a decorative 3-up mockup that
   used to be hidden entirely on phones.

The strongest thing on the page today is the try-it demo, and it is buried
behind a text link below the fold.

## The direction

**Purpose.** Convince a student in one screen that this app removes a real,
recurring annoyance — buying milk you already have, and throwing out food you
forgot — then let them experience it before an account is asked for.

**Audience.** Phone-first, 18–22, scrolling between classes, allergic to
marketing voice, has used Splitwise and Duolingo and knows what a good free app
feels like.

**Tone.** *Utilitarian with warmth.* Closer to a well-made tool than a launch
page: honest surfaces, real data, tight type, quiet color — with one moment of
delight. Not editorial, not maximal, not another gradient hero.

**Memorable detail (the one idea).** **The hero IS the pantry.** The first
viewport is a live, working pantry card stack seeded with real groceries and
real expiry states — milk 2 days, spinach 5 days, pasta a year. It is the actual
component the app ships (`ItemCard`'s visual language), not a mockup drawing.
Tapping "scan a receipt" runs the existing try-it demo *in place*, and the new
items land in that same stack. The page demonstrates instead of describing, and
the account wall stays where it belongs: at "save this."

**Constraints.** React 19 + Vite, plain CSS with the existing token set, no new
dependencies, LCP under 1.5s on 4G, WCAG 2.2 AA including all four themes,
`prefers-reduced-motion` honored, no horizontal scroll at 390px.

## What changes concretely

| Now | Redesign |
|---|---|
| Aurora blob field | Removed. Background is the app's own surface color plus one subtle depth layer — no purple, no blobs |
| 6rem display headline | ~2.5rem max, tighter, sits *beside* the product on desktop and above it on mobile |
| Decorative 3-up mockup | A real, populated pantry the visitor can actually poke |
| "Try it live" text link below fold | The scan action is a primary control inside the hero |
| Feature bento of claims | Two proof sections that show mechanism (receipt → items; roommate sync), each anchored by real UI |
| Footer CTA + legal bar | Kept — they work |

## Palette discipline

Multi-dimensional, not one-hue: a near-neutral base, a single trustworthy accent
for actions (the existing green), and semantic expiry colors that carry real
meaning (amber = soon, red = today/overdue). The expiry colors are *information*,
which is exactly the skill's point about assets carrying subject matter rather
than acting as filler.

## Success criteria (how the owner judges it)

1. A stranger understands what the app does in one screen, without reading a
   paragraph.
2. They can try it without an account and see their own "pantry" fill.
3. It looks like a tool that respects them, not a template.
4. LCP < 1.5s, CLS < 0.05, no console noise, clean at 390px, AA contrast in all
   four themes.
