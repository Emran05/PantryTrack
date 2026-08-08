# Rotating the Supabase access token

**Do not paste a token into a chat, an editor, or a shell prompt.** You do not
need to handle the token at all — the CLI can fetch it itself.

## Steps

1. https://supabase.com/dashboard/account/tokens — **revoke every existing token.**
   As of 2026-08-07 three are compromised: the original that leaked into a
   subagent transcript, plus two that were pasted into a chat window while
   trying to rotate it.

2. In a **normal terminal** (Terminal.app / iTerm — not an AI session):

   ```
   supabase login
   ```

   That opens a browser, you approve, and the CLI stores the token directly.
   The value never touches your clipboard, your shell history, or a transcript.

3. Verify:

   ```
   supabase projects list
   ```

## Why not a script with a hidden prompt

That was the first attempt and it was wrong. An AI session does not reliably
forward keystrokes to an interactive `read`, so the prompt appears, the typing
goes to the chat box instead, and the secret ends up in exactly the place the
rotation exists to avoid. `supabase login` sidesteps the whole problem: there is
no step where a human holds the token.

## Not affected

- **The anon key** (`src/lib/supabase.js`) is public by design and ships in the
  client bundle. It does not need rotating. Its safety comes from RLS.
- **The Google API keys** in `.claude/settings.local.json` are gitignored and
  were never committed. Rotate in the Cloud console when convenient.
