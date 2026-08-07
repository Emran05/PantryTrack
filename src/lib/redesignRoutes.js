// Where the public surfaces send someone who wants an account, or wants out.
//
// These existed because the redesign lived on unlinked preview routes while it
// was a proposal — pointing the CTAs at /login would have dropped a reviewer
// onto the OLD auth page mid-walk. The redesign shipped 2026-08-07, so they now
// name the real routes. Kept as constants rather than inlined: three components
// share them, and the preview indirection is exactly what made the swap a
// two-line change instead of a hunt.

export const AUTH_LOGIN = '/login';
export const AUTH_SIGNUP = '/login?mode=signup';
export const HOME = '/';
