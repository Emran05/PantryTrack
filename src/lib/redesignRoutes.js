// Where the redesigned surfaces send someone who wants an account.
//
// While the redesign is proposal-only its auth page lives at an unlinked
// preview route, so pointing the CTAs at /login would drop the reviewer onto
// the OLD auth page mid-walk — the three previews would never connect and the
// proposal could not be judged end-to-end.
//
// Shipping repoints /login at AuthV2 in App.jsx and deletes /preview-auth. At
// that moment set both of these back to '/login' and '/login?mode=signup'.
// That is the only edit needed here, which is the point of the indirection.

export const AUTH_LOGIN = '/preview-auth';
export const AUTH_SIGNUP = '/preview-auth?mode=signup';
// Where the auth card's wordmark goes. Becomes '/' at ship, same as above.
export const HOME = '/preview-landing';
