# Palta News Web Architecture v1

## 1. Product boundary

Palta News is a **separate public destination** inside the Somos Palta ecosystem.

- Public surface: `news.somospalta.cl`
- Operator surface: local-only News Desk in `palta-engine`
- Data/editorial source of truth: `palta-engine` News Core
- Shared visual system: Palta design system from `-palta-mobile`
- Public website must never read raw editorial inbox/review files directly.

The public site is independent as a user experience and deployment unit, but it is **not a duplicated news system**.

## 2. Language policy

- Chile public site default: **Spanish (es-CL)**
- Operator/review UI default: **Korean (ko)**
- Korean operator translations are presentation-only and are not public editorial copy.
- Additional public languages may be added later without changing canonical facts.

## 3. Canonical flow

`Sources → News Core → verification/editorial → owner review → approved public projection → edge API/cache → Palta News Web`

No direct path exists from collected source material to public publication.

Public publication remains fail-closed until the legal/editorial publication gate is explicitly enabled.

## 4. Deployment model

### Frontend

Create the News public frontend on branch `integration/news-web-v1`, based on the Palta design-system branch.

Preferred deployment:

- Cloudflare Pages for the public web shell/static assets
- Cloudflare Worker for public News API/projection
- Cloudflare cache for public article/list responses
- R2 only for Palta-owned or rights-cleared media assets

The News site does not require a separate application server for v1.

### Domain

Primary: `news.somospalta.cl`

This keeps News recognizable as its own destination while preserving Somos Palta identity and cross-navigation.

## 5. Public information contract

The website consumes only a public projection, never internal editorial objects.

Example public endpoints:

- `GET /v1/cl/news/home`
- `GET /v1/cl/news/latest`
- `GET /v1/cl/news/regions/{region_slug}`
- `GET /v1/cl/news/comunas/{comuna_slug}`
- `GET /v1/cl/news/stories/{story_slug}`
- `GET /v1/cl/news/deep-dives`
- `GET /v1/cl/news/voices`

Public story projection should contain only publishable fields such as:

- `story_id`
- `slug`
- `title`
- `summary`
- `body` when Palta owns/originally produces it
- `content_class`
- `published_at`
- `updated_at`
- `geography`
- `topic`
- `source_label`
- `source_url`
- `source_attribution`
- `map_context` when verified
- `palta_actions`
- `correction_state` / `updated_notice` when applicable

Internal risk flags, reviewer notes, AI notes, raw extraction metadata, and private workflow state are never exposed publicly.

## 6. Information architecture

### Public home

Keep the home intentionally restrained. It should answer: **What matters now, what is near me, and what should I understand more deeply?**

Primary blocks:

1. `Lo esencial` — a small number of important current stories
2. `Cerca de ti` — location/comuna relevant briefs
3. `Chile` — national context only when materially relevant
4. `En tu comuna` — local public-service/news stream
5. `En profundidad` — Deep Dive work
6. `Voces locales` — clearly labeled essays/interviews/local contributions

Do not fill the page simply because content exists.

### Local pages

Routes:

- `/comuna/{slug}`
- `/region/{slug}`

A comuna page can combine, without duplicating canonical content:

- local briefs
- municipal/public service changes
- transport/road impacts
- safety alerts
- current local issues
- links to separate Palta Events/Benefits/Community surfaces
- recurring-topic context

Events, benefits and procedures remain canonical in their respective Palta modules; News only references them when editorially relevant.

### Story page

The standard story page should show:

- clear headline
- short standfirst
- location + time
- concise factual account
- source attribution
- original-source link for external summaries
- verified map context when useful
- `Why this matters` only when supported by facts, not speculation
- Palta action links
- update/correction history when relevant

For external media summaries, do not reproduce full text or source photography without permission.

### Deep Dive

A Deep Dive may include:

- what happened
- documented background
- local/community pattern
- structural context
- competing explanations
- what is known / unknown
- available evidence
- possible collective learning or practical implications
- follow-up signals

High-risk claims require authoritative verification and careful attribution.

### Local Voices

Separate factual News from contributed opinion/experience.

Possible contributors:

- residents
- students
- teachers
- local workers
- artists
- volunteers
- specialists

Content types can include essays, interviews, photo essays, student artwork and local observations.

Every contribution must be clearly labeled as contribution/opinion/experience rather than reported fact.

## 7. Palta integration

News should lead naturally into useful actions rather than becoming an isolated newspaper.

Possible story actions:

- `Ver en el mapa`
- `Seguir esta comuna`
- `Recibir avisos`
- `Guardar`
- `Ver evento`
- `Ver beneficio`
- `Ver trámite`
- `Ver transporte afectado`
- `Conversar en Comunidad`

The News site may be opened directly from the web and from the Palta app. A logged-in Palta user may carry preferences and follows across both surfaces, but reading News must not require login.

## 8. Design direction

News uses the Palta design system but should feel calmer and more editorial than the main app.

Principles:

- mobile first
- fast first paint
- strong typography and hierarchy
- sparse home page
- no portal-like content wall
- compact local briefs
- maps when location materially improves understanding
- no decorative image requirement for every story
- rights-cleared imagery only
- clear distinction between fact, analysis, local voice and sponsored content

## 9. Media rights

Default external-media treatment:

- independent Palta summary
- source attribution
- original link
- no copied full article
- no source photo unless rights permit

Preferred visuals:

- Palta-owned maps
- official/public assets when reuse rights are clear
- Palta-created diagrams/illustrations
- contributor-owned work with explicit permission

## 10. Authentication

Public reading: no login.

Login adds only user-value features such as:

- follow comuna/topic
- bookmarks
- personal local feed
- notification preferences
- community participation

News publication/editorial permissions are completely separate from normal user accounts.

## 11. Performance / SEO

The public site should support:

- crawlable server/edge-rendered story pages
- stable canonical URLs
- Open Graph metadata
- structured NewsArticle/Article metadata where appropriate
- sitemap by story/locality
- RSS/Atom output for Palta-published public stories later
- cache-first lists
- minimal JavaScript for reading paths

## 12. v1 launch scope

Build before public publication is enabled:

1. public shell and navigation
2. home layout
3. comuna/region layout
4. story layout
5. Deep Dive layout
6. Local Voices layout
7. public News projection contract + mock fixtures
8. Palta actions/components
9. source attribution and correction UI
10. public publication gate integration

Do **not** connect the UI directly to raw collected news while the publication gate remains disabled.

## 13. Source-of-truth rule

- `palta-engine`: News facts, collection, dedupe, verification, editorial state, public projection
- `-palta-mobile / integration/news-web-v1`: public News presentation and interaction
- Palta design system: shared tokens/primitives/components
- Palta app: personalized Home projections and cross-module actions

One canonical story can appear in multiple Palta surfaces through references/projections, never by creating multiple independent copies.