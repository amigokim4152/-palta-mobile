# Somos Palta PWA · Field Business Registration Runbook

Status: IMPLEMENTED / DEPLOYMENT URL BLOCKED BY PAGES ENABLEMENT

Branch: `integration/pwa-business-onboarding-v1`

## Purpose

Give a business owner in Chile a short web flow that can be completed during an in-person visit without installing a native app first.

Target field flow:

`QR / short link → /registro-negocio → locate + dedupe → confirm services → WhatsApp/phone → registration receipt → verification`

The target is **3 minutes or less for the basic registration**. Photos, schedules, menus, coupons, promotions and other profile enrichment happen after the basic intake.

## Canonical routes

- Field short route: `/registro-negocio`
- Internal equivalent: `/business/quick-register`
- Full/manual fallback: `/business/register`
- Receipt: `/business/registration-received`

`/registro-negocio` and `/business/quick-register` must render the same `BusinessQuickRegistrationScreen`. Do not create another quick-registration screen.

## Step 1 · Business + location

1. Owner enters business name.
2. Palta requests foreground location permission.
3. Nearby canonical businesses are searched within 1.2 km.
4. The owner can select an existing result or state that none matches.
5. Selecting an existing claimed/verified business does **not** grant control. It creates an ownership/access verification intake.

Server-side duplicate protection is authoritative. Even when the client submits `create_new`, `palta_create_business_intake` checks for an exact-name match within 150 m and converts the intake to `claim_existing / matched_existing` when appropriate.

## Step 2 · What the business offers

The owner writes a plain-language description, for example:

- `panadería y cafetería`
- `reparación de celulares`

Palta proposes service IDs from the Chile local service seed. The owner confirms at least one service before continuing.

## Step 3 · Contact

At least one contact is required:

- WhatsApp
- phone

Chile 9-digit numbers are normalized to `+56...` before submission. This step is intentionally minimal; sensitive business controls are not enabled here.

## Intake and verification boundary

Quick registration writes only to the private `business_registration_intake` workflow.

It must **not** directly:

- create an uncontrolled duplicate canonical Business,
- grant owner/admin privileges,
- activate coupons,
- publish promotions,
- unlock sensitive profile changes.

The receipt is always a pending-verification state until Palta completes the responsible-person/business verification flow.

## Public API boundary

Development project: `palta-dev`

Edge function: `palta-public-api`

Browser-facing routes:

- `GET /v1/local/search`
- `POST /v1/business/quick-registration`
- `GET /v1/business/registration/{registrationId}`

The browser uses only the Supabase publishable key. Database/service secrets must never be shipped in the PWA.

Direct browser access to `business_registration_intake` and `palta_create_business_intake` is intentionally blocked. The Edge function is the write boundary.

## Three-minute measurement

Each successful quick registration stores `client_elapsed_seconds` in the private intake record.

For a field pilot, review at least 20–30 completed registrations and measure:

- median elapsed time,
- 90th percentile elapsed time,
- count over 180 seconds,
- common step where assistance was needed.

Initial acceptance target:

- median <= 180 seconds,
- no recurring blocker that requires staff to finish the registration for the owner.

Do not add more required fields to the 3-minute flow unless field evidence shows they are necessary.

## PWA installation

The web/PWA bundle, iOS bundle and web-compatible runtime have CI coverage.

GitHub Pages preview workflow: `.github/workflows/pwa-preview-pages.yml`

The repository currently requires a one-time Pages setting before the preview URL can deploy:

`GitHub → palta-mobile → Settings → Pages → Build and deployment → Source: GitHub Actions`

After that setting is enabled, the existing workflow should deploy the preview without changing application code.

The preview is for physical-device verification only. Production should later use the approved Somos Palta domain, with `/registro-negocio` retained as the stable field/QR route.

## Physical-device gate

Before field rollout, verify on a real iPhone in Santiago:

1. Open the HTTPS PWA URL in Safari.
2. Add Somos Palta to Home Screen.
3. Launch from the Home Screen.
4. Open `/registro-negocio`.
5. Allow foreground location.
6. Search a known nearby business.
7. Verify existing-business selection creates a pending claim rather than a duplicate.
8. Run a new-business test and verify it remains pending verification.
9. Confirm Chile phone normalization.
10. Confirm receipt screen displays the registration code.
11. Confirm `client_elapsed_seconds` is recorded.
12. Delete test intake data after verification.

No production/field rollout is considered complete until this physical-device gate passes.
