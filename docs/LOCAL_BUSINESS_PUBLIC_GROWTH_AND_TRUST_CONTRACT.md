# Local Business Public Growth & Trust Contract

## Purpose

Palta Local Business must grow by making real local businesses easier to understand, find and use. Public growth is not a separate advertising system: it is a projection of the same canonical Business truth used by Palta search, map and owner management.

The intended loop is:

```text
Google / external social / delivery marketplace / direct share
  -> canonical Palta Business page
  -> useful current business information
  -> contact / coupon / save / follow / direct return
  -> fresher relationship and business evidence
  -> better Palta discovery
```

## 1. One Business, one canonical public page

- Canonical path: `/negocios/<public-slug>`.
- A Business must not be cloned under separate comuna/category SEO URLs.
- Draft, duplicate or invalid records are `noindex` and excluded from sitemap output.
- Public HTML and JSON-LD must come from the same canonical Business projection.
- Owner-entered text is escaped before HTML output; JSON-LD must be safe inside a script element.

## 2. Local/category pages are discovery, not doorway pages

A page such as `Cafés en Algarrobo` or `Gasfíter en Vitacura` may be indexable only when it is a real discovery surface:

- it contains distinct real Business results;
- permanently closed businesses are not ordinary results;
- each result links to its canonical Business page;
- it contains useful local context rather than keyword substitution;
- empty/thin generated pages remain `noindex`.

Paid promotion must never rewrite organic truth or canonical relevance.

## 3. Current availability is computed at read time

Operating state is living data.

- Owner configures weekly, seasonal and exception rules.
- Palta computes `open_now`, `closed_now`, `closed_today`, temporary/seasonal closure from those rules.
- The state must be evaluated for the current read time, not frozen at the last owner save.
- Recalculation must not fabricate a new owner-confirmation timestamp.
- IANA timezone rules are used; Chile UTC offsets are not hard-coded.

## 4. Business facts carry provenance

Important facts need source and freshness evidence. Sources are not equivalent:

- `owner`: owner assertion/confirmation;
- `trusted_public_source`: a trusted public/official source;
- `system_import`: collected/imported data;
- `user_report`: correction signal, not automatic truth;
- `business_activity`: may support lifecycle activity only, not unrelated facts such as address or hours.

Freshness thresholds are policy inputs because hours, address, identity and service facts age differently.

A fresh user report must never renew an expired owner confirmation. Conflicting confirming sources are surfaced as a conflict rather than silently resolved.

## 5. Free external links, paid external automation

Free Business Profile may show public links to Instagram, Facebook, TikTok, Google, WhatsApp, website, delivery marketplaces or other useful channels.

Free link display does not require OAuth or external-platform API access.

External account read/publish/operate capabilities require the relevant authorization and entitlement. If a paid entitlement ends, public `LINK_ONLY` presence remains.

## 6. Return links are relationship tools, not identity trackers

Palta may create return/share links for:

- counter;
- packaging;
- receipt;
- social;
- external delivery;
- owner share.

These links may carry a small first-party source and campaign token, but must not embed customer IDs, phone numbers, email addresses, precise location or unrelated personal information.

The SEO canonical URL remains the clean Business URL; attribution parameters never become a second canonical page.

## 7. Free PR assets reuse the same Business truth

Palta can prepare renderer-neutral specs for:

- counter cards;
- packaging stickers;
- receipt footers;
- social-share cards.

The QR payload is the privacy-minimal Palta return URL. QR generation should be local/first-party where practical; the basic asset must not require a paid QR API.

This is part of helping a small merchant become easier to find and understand. It is not a paywall around basic presence.

## 8. Public web can remain provider-neutral

Core produces:

- Business SEO projection;
- safe readable HTML;
- LocalBusiness JSON-LD;
- business sitemap;
- static page bundle.

A hosting adapter may later publish those files through Cloudflare Pages/Workers/R2 or another provider. Local Business domain logic must not depend on Next.js or a specific host.

## 9. Relationship and marketing remain separate

External/public acquisition may lead to:

- save;
- follow;
- coupon visibility;
- direct contact;
- later direct transaction.

None of those actions silently create marketing consent. `follow`, `service relationship`, `marketing consent`, `messaging` and `notification permission` remain separate contracts.

## 10. Cost principle

Default path should be deterministic and cheap:

- static/edge public pages;
- rules-based operational state;
- local QR payload generation;
- cached/public structured data;
- no LLM call for every page/search;
- no third-party social scheduler or QR SaaS required for the free baseline.

AI is added where it removes real ambiguity or work: translation, classification assistance, content assistance and higher-value automation.
