# Redesign proposal — read this before approving

You asked for every public surface redone to industry standard, researched from
currently-deployed sites, and held back until you approve it. This is the
approval document. `DESIGN_SYSTEM.md` holds the per-surface philosophy and the
evidence behind it; `DESIGN_DIRECTION.md` holds the landing-page argument. This
file is only about the decision in front of you.

## The one fact that should shape your decision

**The redesign adds 1,765 lines and deletes none.** Not one byte of the live
site was modified. The old landing page, the old auth page, the old header and
the old footer are all still there, still wired up, still shipping.

Everything new lives on unlinked preview routes. Nobody can reach them unless
they type the URL. So:

- Approving costs one small commit that repoints two routes.
- Rejecting costs a `git branch -D`. Nothing to unwind.
- Approving *part* of it is fine too — the surfaces are independent.

## How to look at it

Branch `landing-redesign`, pushed to GitHub:
<https://github.com/Emran05/PantryTrack/tree/landing-redesign>

Run `npm run dev` on that branch and open:

| URL | What it is | Replaces |
|---|---|---|
| `/preview-landing` | The redesigned landing page | `/` |
| `/preview-auth` | The redesigned login/signup | `/login` |
| `/why-free` | New page. No equivalent today | — |

The header and footer are components, so they appear on all three.

## What actually changes for a visitor

**The hero is a working pantry, not a picture of one.** The old hero showed a
decorative receipt mockup. The new one is a populated pantry where expiry is
rendered as information — urgent, soon, and calm items are visually distinct —
and the "scan" button really drops three new items into the same stack. The
account wall appears at "save this", after the visitor has already seen the
product work. This is the single biggest change and the one most likely to move
signups.

**The header detaches into a floating island on desktop.** This is the
liquid-glass idea you raised, built the way the evidence said to rather than the
way it is usually copied — see the honesty section below.

**The footer became a real footer.** Four navigable tracks instead of a dead
band, with the legal documents and the do-not-sell link reachable from every
public page. For an app that monetizes data, burying those inside a signup
checkbox was a genuine liability.

**There is no pricing page, on purpose.** See below.

## Where the research contradicted the brief

I want these on the record rather than buried, because in each case I built
something other than what was asked for.

**Liquid glass on the header.** You suggested a center floating header with a
liquid-glass feel. Across 22 live sites, only Clerk actually floats one — and
its pill is *near-opaque*, with the blur living in a separate scrim layer
behind it. Apple does not ship Liquid Glass on apple.com. A see-through blurred
pill is what the cheap imitations do, and it reads as flat plastic. So the
floating island is built, but the glass is decomposed the way Clerk builds it.
It will look more solid than you may have pictured. That is deliberate.

**Glass on the auth card.** Zero of nine researched auth pages use
`backdrop-filter`. The new auth card is opaque.

**A pricing page.** You asked for pricing to be brought to industry standard.
The product is free and monetized through data. A pricing page for a free
product either says "$0" — which invites the question of how you make money and
answers it badly — or invents tiers that do not exist. Every comparable free
product builds a trust page instead. So I built `/why-free`, which states
plainly what leaves the app and what never does, links the do-not-sell control,
and honors Global Privacy Control. **If you want a literal pricing page anyway,
say so and I will build one** — this is a judgment call I made on your behalf
and you may disagree.

## Known deviations and open risks

**The signup consent checkbox is kept**, even though the research says
market-leading signup forms do not gate on one. Your business model sells user
data; the consent has to be affirmative and provable. This is a deliberate
legal deviation from the design research, not an oversight.

**The legal documents are still drafts.** `privacy.html`, `eula.html` and
`do-not-sell.html` are written and linked, but they have not been reviewed by a
lawyer. Selling user data to the highest bidder is exactly the fact pattern
where a self-drafted policy is a bad idea. This is the largest outstanding risk
on the project and it is not a thing I can close for you.

**QA is still running as of this writing.** A fresh-eyes browser agent is
walking all three preview routes for keyboard, mobile, console and contrast
problems. Findings will land in `BUGSTACK.md` and get fixed on the branch before
any merge.

**Verification caveat, stated plainly.** I found and fixed a bug in this
redesign where the floating header never actually stuck — it scrolled off the
page at every breakpoint, taking the primary CTA with it. My earlier
verification pass had confirmed the header's *styling* responded to scroll,
which it did, and never measured its *position*. Treat the surfaces as
reviewed, not as proven; look at them yourself before approving.

## What shipping means mechanically

Merging the branch changes nothing user-visible on its own — the preview routes
stay unlinked. A second commit does the actual switch: point `/` at `LandingV2`
and `/login` at `AuthV2`, and drop the two preview routes. That is roughly
fourteen lines in `src/App.jsx`.

The old `Landing` and `Auth` components stay in the tree either way, so a
rollback is repointing the same two routes back.

## What is not in this proposal

The authenticated app — pantry, scan, recipes, shopping, settings — is
untouched here. Those surfaces got correctness and accessibility work on `main`
(contrast, atomic writes, crash reporting, the emoji-to-custom-icon sweep), but
no visual redesign. If you want the same treatment applied inside the app, that
is a separate and considerably larger piece of work.
