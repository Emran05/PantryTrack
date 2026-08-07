#!/usr/bin/env bash
# Rotate the Supabase personal access token without it ever being displayed,
# logged, or entering an AI transcript.
#
# Why this is a script you run rather than something Claude runs:
#
#   1. Supabase's Management API has NO personal-access-token endpoints. Checked
#      against the live OpenAPI spec (api.supabase.com/api/v1-json, 115 paths):
#      there are project api-keys and signing-keys endpoints, but nothing for
#      account-level PATs. They are dashboard-only, by design — and creating one
#      programmatically would require authenticating with... a PAT.
#
#   2. Even where rotation IS scriptable, an assistant that generates the new
#      secret has put the new secret in a transcript. That is re-disclosure, not
#      rotation. The secret has to enter here, on your machine, and nowhere else.
#
# `read -s` keeps it off the screen; it is piped straight to the CLI, so it never
# lands in shell history, in a file, or in this script's output.
set -euo pipefail

echo "1. Open https://supabase.com/dashboard/account/tokens"
echo "2. REVOKE the existing token (this is the one that leaked into a subagent"
echo "   transcript — assume it is known)."
echo "3. Generate a new one and copy it."
echo
printf 'Paste the new token (input hidden), then press Enter: '
read -rs TOKEN
echo

if [ -z "${TOKEN}" ]; then
  echo "No token entered. Nothing changed." >&2
  exit 1
fi

# --token avoids the browser flow; the value is passed as an argument to a
# single process and never written anywhere by us.
if supabase login --token "${TOKEN}" >/dev/null 2>&1; then
  unset TOKEN
  echo "Stored."
else
  unset TOKEN
  echo "supabase login rejected that token. Nothing else changed." >&2
  exit 1
fi

# Prove the new credential works without printing anything sensitive.
if supabase projects list >/dev/null 2>&1; then
  echo "Verified: the CLI can authenticate with the new token."
else
  echo "WARNING: stored, but 'supabase projects list' failed. Check the token scope." >&2
  exit 1
fi

echo
echo "Done. Remaining, and not scriptable from here:"
echo "  - The two Google API keys in .claude/settings.local.json"
echo "    (gcloud is not installed on this machine; rotate in the Cloud console)."
echo "  - Note the Supabase ANON key does NOT need rotating — it is public by"
echo "    design and ships in the client bundle. Its safety comes from RLS,"
echo "    which is why the profiles policy mattered so much."
