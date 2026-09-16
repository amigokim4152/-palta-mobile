# Palta Computer First Setup v1

## Principle

Do **not** install every tool that Palta may use in the future.

Install everything required for the first development phase once, then install provider-specific tools only when that phase begins.

This avoids:
- repeated random setup interruptions
- unused accounts and credentials
- unnecessary machine clutter
- premature provider lock-in

---

## Phase 0 — Inspect the computer first

Before installing anything:

```bash
bash scripts/machine-readiness-check.sh
```

This detects:
- OS / architecture
- Git
- Node / npm / npx
- editor CLI
- GitHub CLI/auth
- macOS Xcode tools
- Android tools
- disk availability
- optional provider CLIs

Do not guess what is missing.

---

## Phase 1 — Required before Palta development starts

These are the only hard requirements for Core + web/reference/mobile-JS preparation:

1. Git
2. Node.js 22+
3. npm / npx
4. Code editor
5. GitHub repository access
6. Browser
7. Latest Palta prep package / repository

Recommended:
- VS Code
- GitHub CLI

On macOS, install Xcode Command Line Tools before native iOS work.

---

## Phase 2 — Install once before mobile native testing

Install/configure only after Core verification succeeds:

- Expo mobile shell dependencies
- full Xcode + iOS Simulator if iOS simulator will be used
- Android Studio + SDK + emulator if Android simulator will be used
- Watchman on macOS if needed
- CocoaPods when native iOS dependency installation requires it

A physical iPhone can be used later for device verification, but store distribution credentials are not needed yet.

---

## Phase 3 — Accounts that should NOT block initial coding

Do not create these merely because they may be used eventually:

- Supabase project
- Cloudflare resources
- Mercado Pago developer integration
- Transbank integration
- Flow integration
- Apple Developer paid membership
- Google Play Console
- insurer/municipality/school partner accounts

Create each when its real vertical reaches integration.

---

## Phase 4 — First computer session order

1. Run machine readiness check.
2. Install only missing hard requirements.
3. Re-run readiness check until `CORE DEVELOPMENT READY`.
4. Open/clone GitHub repository.
5. Verify `main`; do not modify it.
6. Create/use `integration/foundation-authorization-policy-v1`.
7. Confirm clean working tree.
8. Apply latest prep package carefully.
9. `npm ci`
10. `npm run verify`
11. Run reference UI/mobile shell.
12. Only then start product development.

---

## Phase 5 — First development slice

Do not start all Palta modules at once.

Start with:

**Home → Neighborhood → Business → Care**

Why:
- proves canonical entity flow
- proves location flow
- proves user/private Home
- proves local business
- proves Care/Event state
- gives a real surface for UI/accessibility testing

After this works, continue module by module.

---

## Hard rule

When a future dependency is missing:

**Do not change Palta architecture to work around it.**

Use:
- a mock adapter
- a fixture
- a local implementation
- `NOT VERIFIED`

Then replace the adapter when the provider/account becomes available.
