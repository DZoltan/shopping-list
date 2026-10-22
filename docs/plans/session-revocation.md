# Plan: revoke sessions on other devices

Status: planned, not started.

## Problem

Sessions are sealed cookies (nuxt-auth-utils) that live for 180 days and are not
checked against the database. Deleting a user or removing them from a household takes
effect at once, because every query is scoped by household membership. Deleting a
**passkey** does not: a lost phone that is already logged in stays logged in until its
cookie expires.

## Changes

1. **Session version.** Add `users.session_version` (integer, default 0) with a
   migration. Store it in the session at login (`setUserSession`).
2. **Check on every request.** In `server/middleware/auth.ts`, after
   `requireUserSession`, read the user's `session_version`. If it differs from the
   session's version, or the user no longer exists, clear the session and answer 401.
   This costs one indexed primary-key read per API request, well within the D1 free tier.
3. **"Log out everywhere else"** button on `/profile`: increments
   `session_version` and re-issues the current device's session with the new value,
   so only the other devices are logged out.
4. **Deleting a passkey** (`DELETE /api/me/passkeys/:id`) does the same automatically.
5. **Require user verification.** Set `userVerification: 'required'` for registration
   and authentication, so a passkey always needs a fingerprint, face or PIN (a security
   key without a PIN would otherwise pass with a touch).
6. **Client.** On a 401 from the API, refresh the session state and send the user to
   `/login` instead of showing a generic error.

## Tests (tests/auth.e2e.mjs)

- After "log out everywhere else", an older session of the same user gets 401;
  the session that triggered it keeps working.
- After deleting a passkey, another device's session gets 401.
- A deleted user's session gets 401 (today it gets empty results).

## Deploy

Needs the migration on production (`wrangler d1 migrations apply DB --remote`) right
before `wrangler deploy`. Existing sessions have no version yet and should be treated
as version 0, so nobody is logged out by the deploy itself.
