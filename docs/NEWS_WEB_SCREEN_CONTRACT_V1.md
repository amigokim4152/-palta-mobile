# Palta News Web Screen Contract v1

## Goal

Palta News should feel like a calm public-interest reading surface, not a dense portal. It helps a person answer four questions quickly:

1. What matters now?
2. What changed near me?
3. What deserves deeper understanding?
4. What can I do next in Palta?

## Permanent public routes

| Route | Purpose | Primary data |
|---|---|---|
| `/` | restrained News home | `GET /v1/cl/news/home` |
| `/comuna/{slug}` | local living-news page | `GET /v1/cl/news/comunas/{slug}` |
| `/region/{slug}` | regional page | `GET /v1/cl/news/regions/{slug}` |
| `/story/{slug}` | standard story / brief detail | `GET /v1/cl/news/stories/{slug}` |
| `/deep-dive/{slug}` | evidence-led long form | `GET /v1/cl/news/stories/{slug}` |
| `/voices` | Local Voices collection | `GET /v1/cl/news/voices` |

## Home

Order is intentional and may end early when little matters.

1. `Lo esencial`: 1–3 items. No filler.
2. `Cerca de ti`: compact briefs tied to the reader's selected place when available.
3. `En tu comuna`: municipal/public-service/local change. Events and benefits link to their canonical Palta surfaces.
4. `Chile`: national stories only when materially relevant.
5. `En profundidad`: at most a few current Deep Dives.
6. `Voces locales`: rotating contribution cards, clearly labeled as voice/experience/opinion.

## Comuna page

The comuna page is not a local newspaper archive. It is a living-area status page.

Top:
- comuna name
- follow / alerts action
- short state line (e.g. "Cambios y temas que afectan la vida local")

Body:
- `Ahora`: current service, road, transport, safety or civic changes
- `Noticias breves`: short factual local briefs
- `En el mapa`: only verified spatial items
- `Temas que seguimos`: recurring issues with evidence of repetition
- `Desde otros espacios de Palta`: Events / Benefits / Trámites / Community references
- `Voces de la comuna`: contributions, separate from factual News

## Story page

Required hierarchy:

- content label (`Noticia`, `Fuente oficial`, `Voz local`, etc.)
- headline
- standfirst
- geography + published time
- factual text
- source attribution and original link for external summaries
- verified map block when it materially improves understanding
- `Por qué importa` only when evidence supports it
- Palta actions
- updates/corrections

External-media stories never reproduce full source articles by default.

## Deep Dive

Deep Dive is not just a longer article. Blocks are explicit:

1. Qué pasó
2. Qué sabemos
3. Qué no sabemos
4. Antecedentes
5. Qué se repite / patrón local (only with evidence)
6. Factores personales, comunitarios and estructurales when supportable
7. Explicaciones o posiciones distintas, attributed
8. Datos / fuentes
9. Qué cambia para la vida cotidiana
10. Qué seguiremos observando

No speculation about a person's motive is promoted to fact.

## Voces Locales

Allowed contribution forms:
- essay
- interview
- field note
- photo essay
- student artwork / community showcase
- local memory
- proposal / reflection

Every card must state its type. A contributor's view is not presented as Palta's view or verified News fact.

## Responsive behavior

- Mobile is the reference layout.
- Desktop expands reading width and side context; it does not add portal density.
- Minimum interactive target follows Palta `44px`, preferred primary `48px`.
- Spacing/radius/typography use shared candidate tokens; brand colors remain semantically referenced and unfrozen.

## Brand binding

Prototype pages reserve a brand asset slot. They must not recreate the official Somos Palta logo or symbol in CSS/text as a substitute for the runtime asset.

## Publication boundary

All pages use mock/public projection data until the News public publication gate is explicitly opened. Raw collector output, review queues, Korean operator copy, risk flags and internal notes are forbidden from this web surface.
