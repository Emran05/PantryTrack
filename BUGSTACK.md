# Bug stack — continuous QA (mission 2)

Bugs found by browser-QA walks land here. Fixed most-severe-first, one commit
per fix, checked off with the commit hash. QA agents: append, never delete.

**Test account:** nasseriemran+pantrytest@gmail.com (user-approved 2026-08-07).
Password in `~/.claude/autonomous/qa-test-account` (NOT in the repo). Create on
first QA run via the signup flow (consent checkbox must be checked); reuse
thereafter. Test data stays in this account's own pantry.

## Open

<!-- QA walk 2026-08-07 (agent: pantrysnap-qa2). Auth reached: UNAUTHENTICATED only —
     signup succeeded but is pending email confirmation, so the in-app walk is unwalked. -->

- [ ] **[HIGH]** Signup consent row collapses and overflows the viewport at 390px — `/login?mode=signup` at 390x844; repro: open signup at a 390px-wide viewport and look at the consent row under PASSWORD; expected: checkbox and its consent sentence sit side by side inside the card, fully readable; actual: the checkbox is stranded alone in the centre and the consent sentence is squeezed into a ~1-word-wide column that starts at the card's right edge and runs off-screen, so words are cut mid-string ("Privac[y]", "sale/sharin[g]", "can opt ou[t]") and the EULA / Privacy Policy / opt-out links are only partly readable; it also leaves ~500px of dead vertical space between the checkbox and the Sign up button. Evidence: page content measures 399 CSS px wide in a 390px viewport (fullPage capture 1024px @DPR 2.56 vs 1000px on `/` and `/login`, which have no overflow), so this row is the sole source of horizontal overflow. This is the legally-required consent gate on the primary mobile breakpoint.

- [ ] **[MEDIUM]** Landing hero mockup quantities grow without bound and never reset — `/` (desktop); repro: load the landing page and leave it alone, watching the "Pantry List" card in the hero; expected: the demo pantry loops or settles on plausible quantities; actual: quantities only ever increment — observed x1/x1/x2 immediately after load climbing to Apple x17, Milk x14, Cheese x13, Carrot x9 after roughly two minutes on the same page, with no reset. A visitor who lingers (or leaves the tab open) sees an absurd fake pantry. The rows also reorder as counts change, so the card visibly jitters.

- [ ] **[MEDIUM]** Hero `<h1>` exposes every rotator variant at once to assistive tech — `/`; repro: inspect the accessibility tree for the hero heading (or listen with a screen reader); expected: the accessible name matches the one line currently rendered, e.g. "Never buy the same milk twice — in your dorm."; actual: the accessible name is the concatenation of all rotator variants — "Never buy the same milk twice — in your dorm, with your roommates, on a student budget." — and it stays that way across reloads and across every rotator position, so a screen-reader user hears one run-on sentence. Evidence: value stable in a11y snapshots at three separate rotator states and after a full reload, while only one line is ever painted.

- [ ] **[MEDIUM]** Auth form fields have no associated labels, no id/name, and no autocomplete — `/login` and `/login?mode=signup`; repro: open either page and read the console Issues panel; expected: each input has a real `<label for>` and an autocomplete token; actual: DevTools reports "No label associated with a form field (count: 5)" and "A form field element should have an id or name attribute (count: 5)", plus "Input elements should have autocomplete attributes (suggested: current-password)". The visible "EMAIL"/"PASSWORD"/"FIRST NAME"/"LAST NAME" captions are not wired to their inputs, so each field's accessible name falls back to its placeholder ("Jane", "Doe", "hello@example.com") — which disappears the moment the user types. Also blocks password managers from filling reliably.

- [ ] **[MEDIUM]** UX: disabled "Sign up" button looks fully enabled — `/login?mode=signup`; repro: open signup without touching the consent checkbox; expected: the button reads as unavailable (dimmed/greyed) so it is obvious why nothing happens; actual: it renders as a fully saturated green pill with a glow — visually identical to the enabled state — while being `disabled`. Users tap it, get no response and no message, and are left to guess that the consent checkbox is the gate. The gating logic itself is correct (checking the box does enable it).

- [ ] **[MEDIUM]** UX: sticky top nav has no backdrop, so "Log In" becomes unreadable over the receipt mockup — `/` at 390x844; repro: load the landing page on mobile and scroll slowly so the white receipt mockup passes behind the fixed header; expected: header stays legible over any content (solid or blurred backdrop); actual: the header is transparent and the white receipt slides directly behind it, washing out the grey "Log In" label to near-invisible. "Pantry Snap" and the white "Start Free" pill survive; "Log In" is the casualty.

- [ ] **[LOW]** Auth pages are branded "Pantry Tracker" instead of "Pantry Snap" — `/login` and `/login?mode=signup`; repro: open either page and read the card heading; expected: "Pantry Snap", matching the nav wordmark, the document title, the landing copy and the receipt mockup; actual: the `<h1>` reads "Pantry Tracker". First screen after clicking any CTA, so it reads as a wrong-site / phishing cue at the exact moment trust matters most.

- [ ] **[LOW]** UX: "Snap the receipt" demo duplicates rows instead of stacking quantities — `/` (the Pantry Database panel beside the receipt); repro: scroll to the "Snap the receipt. Done." section and watch the panel fill; expected: repeated items collapse into one row with a count, which is what the product claims; actual: it lists "APPLES +1 Added", "APPLES +1 Added", "MILK +1 Added", "MILK +1 Added" as four separate rows. Directly contradicts the adjacent copy "every item lands in your pantry, sorted and counted" — the one demo meant to prove the feature shows it failing. Reproduced at both 1440px and 390px.

- [ ] **[LOW]** Hero rotator leaves the headline blank mid-cycle, dangling on an em-dash — `/`; repro: load the landing page and sample the hero repeatedly; expected: the outgoing line is still fading as the incoming one arrives, so the sentence is never empty; actual: the crossfade has a gap where no variant is painted at all, leaving the h1 reading "Never buy the same milk twice —" with an empty line beneath it. Caught in roughly one of every three screenshots, so the dead beat is long enough to be seen rather than a sub-frame artifact. Layout height is reserved correctly (no reflow jump) — this is purely the text disappearing.

## Fixed

(none yet)
