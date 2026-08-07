# PantrySnap

Know what's in your fridge and pantry at all times. Add groceries by typing,
scanning a barcode, or snapping a receipt; share a pantry with housemates;
get a push reminder before food expires; ask AI what to cook with what you
have. Built for students, works for anyone.

**Stack:** React 19 + Vite PWA · Supabase (auth, Postgres, realtime) ·
Netlify (hosting + functions) · Gemini (recipes/receipt AI) · client-side
OCR (tesseract.js) and barcode scanning (html5-qrcode).

## Local development

```bash
npm install
cp .env.example .env        # fill in Supabase URL + anon key at minimum
npm run dev                 # plain app (no serverless functions)
# — or —
npx netlify dev             # app + functions (AI proxy, delete-account)
npm test                    # vitest suite
npm run build               # production build to dist/
```

## Supabase setup

1. Create a project at supabase.com, copy URL + anon key into `.env`.
2. Apply the SQL in `supabase/migrations/` (SQL editor → run each file in
   filename order). This creates preferences, consumption log, invites,
   push subscriptions, AI usage quotas, and the `do_not_sell` privacy flag.
3. Auth → Providers: enable Email. "Confirm email" ON is supported (the
   signup form explains the confirmation step) but OFF is the lower-friction
   choice for launch.

## Netlify deploy

Connect the repo (build command and publish dir are already in
`netlify.toml`), then set Site configuration → Environment variables:

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | client → Supabase |
| `GEMINI_API_KEY` | server-side AI proxy (never `VITE_`-prefixed) |
| `SUPABASE_SERVICE_ROLE_KEY` | expiry notifications + account deletion |
| `VITE_VAPID_PUBLIC_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | web push (`npx web-push generate-vapid-keys`) |

Functions deploy automatically from `netlify/functions/`:
`/api/gemini` (AI proxy with per-user quotas), `/api/delete-account`
(privacy-policy deletion), and a daily 15:00 UTC scheduled run of
`expiry-notifications`.

## Legal — read before launch

`public/legal/` contains the EULA, Privacy Policy, and the
Do-Not-Sell-or-Share opt-out page. They are **DRAFTS — attorney review
required**. Before going live:

1. Have a lawyer review all three pages; fill in the legal entity name,
   governing law, and venue placeholders.
2. The privacy policy discloses sale/sharing of user data. Whatever the
   final monetization terms are, the in-app reality must match the words:
   the Settings → Privacy opt-out toggle, the GPC signal, consent
   receipts at signup, JSON/CSV export, and account deletion are all
   already implemented — do not remove them without amending the policy.
3. Set a real effective date and remove the DRAFT banners only after review.

## Repo map

```
src/pages/       Landing, Auth, Dashboard, Pantry, AddEditItem, ScanReceipt,
                 Recipes, ShoppingList, Settings, JoinPantry, ResetPassword
src/contexts/    Auth, Pantry (active home + realtime), Transition
src/lib/         supabase client, storage, preferences (incl. do-not-sell),
                 push, gemini, invites, rate limits
netlify/functions/  gemini proxy, expiry notifications (cron), delete-account
supabase/migrations/  schema, RLS policies, privacy flag
public/legal/    EULA, privacy policy, do-not-sell (DRAFTS)
```
