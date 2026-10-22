# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-22

First release: a shared shopping and to-do list for households, running entirely on
the Cloudflare free tier (Workers + D1).

### Added

- **Lists and items**
  - Separate shopping and to-do lists per household, shown as tiles with open/done
    counts and progress; two-pane view on desktop, scrollable strip on mobile.
  - Items with optional quantity and reason; check off, edit, delete.
  - Done items stay at the bottom of the list until the list is deleted.
  - Reorder open items by dragging (touch-friendly handle).
  - Shows who added an item when it was someone else.
  - Rename and delete lists.
- **Quick add**
  - Suggestions from what the household added before, per list type, ranked by
    use count and recency; dropdown while typing and "frequent" chips.
  - Remembers the last quantity; forget a suggestion with one click.
- **Accounts and households**
  - Passwordless login with passkeys (WebAuthn).
  - Invite-only sign-up: invite links (7 days, single use); the first admin is created
    with a one-time setup token.
  - Households with owner and member roles: invite, rename, promote/demote, remove,
    leave. A household always keeps at least one owner and one member.
  - Log in on another device with a QR code or link (10 minutes, single use);
    24-hour recovery links created by an admin.
  - Manage your passkeys on the profile page.
- **App**
  - Installable PWA with offline fallback for pages and list reads.
  - Light and dark theme, Hungarian UI.
  - Notice in in-app browsers (Messenger, Facebook, Instagram, Android WebViews) where
    passkeys do not work, with "open in Chrome / Safari".
  - Public help page with screenshots.
- **Security**
  - Every list and item query is scoped to the user's households; other households'
    data answers 404.
  - WebAuthn challenges stored server-side and usable once (no replay).
  - Invite and device-link tokens are 256-bit random values stored only as hashes.
- **Development**
  - End-to-end tests for auth, household isolation and the API, using a software
    passkey authenticator, run against a throwaway local database (`npm run test:e2e`).
  - Reproducible help screenshots (`npm run help:screenshots`).
