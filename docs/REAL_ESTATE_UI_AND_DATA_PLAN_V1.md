# Palta Propiedades — UI + Data Plan V1

## Product rule

Propiedades is an independent Palta vertical inspired by the useful interaction patterns of neighborhood-first real-estate products, especially Daangn/Karrot real estate, without copying branding or visual identity.

Build the complete user flow first. When production data is missing, use explicitly isolated demo fixtures and a capability status of `demo` or `awaiting_source`. Replace data behind the contract later without redesigning the screen.

## V1 surface map

```text
Negocios
  -> Propiedades handoff

Propiedades Home
  -> Guardados
  -> Mis propiedades
  -> Publicar
  -> Buscar zona/edificio/dirección
  -> Venta / Arriendo / Temporal
  -> Tipo de propiedad
  -> Precio / superficie / dormitorios / baños / estacionamiento
  -> Dueño directo
  -> Lista <-> Mapa
  -> Zonas exploradas
  -> Edificios / condominios
  -> Vivir aquí
  -> Traslado
  -> Guardar búsqueda
  -> Comparar zonas
  -> Listing card

Listing detail
  -> Fotos
  -> Precio + gastos comunes
  -> Datos físicos
  -> Guardar / alerta
  -> Edificio / condominio
  -> Ubicación y entorno
  -> Transporte / colegios / salud / parques / comercio
  -> Tiempo de traslado
  -> Vivir aquí / reseñas
  -> Publicador: dueño directo OR Business
  -> Consultar / compartir
```

## Daangn patterns deliberately adapted

Observed useful patterns:

- independent real-estate home rather than a generic business category
- map-first property discovery
- transaction/property filters
- direct-owner and professional inventory together
- building/complex profile separated from individual listing
- saved/interest state and alerts
- lived-experience reviews by address/building/neighborhood
- nearby transport/school/lifestyle context
- commute-oriented discovery
- market/reference information and useful calendar/news modules when trustworthy data exists

Chile adaptation:

- `Venta`, `Arriendo`, `Arriendo temporal`
- `Departamento`, `Casa`, `Pieza`, `Oficina`, `Local comercial`, `Terreno`, `Parcela`, `Bodega`
- CLP and UF price display
- `Gastos comunes`
- `Dueño directo`, `Corredor`, `Inmobiliaria`
- Metro + Red bus + Palta Journey context
- comuna/barrio/building-centered discovery

## Data readiness matrix

| Surface | Current mode | Production connection target |
|---|---|---|
| Listing inventory | demo | direct-owner publishing + broker/agency inventory API |
| Map pins | demo listing coordinates on live Palta map | production listing coordinates |
| Nearby businesses/POIs | live/shared | Palta Map + Neighborhood + canonical Business |
| Building/condominium profile | demo | authoritative/verified Chile building source |
| Market/reference price | awaiting_source | verified traceable market/transaction source; never fabricate official prices |
| Resident/lived reviews | demo | verified Palta community contribution |
| Commute time | awaiting_source | Palta Journey/Transport Core |
| Saved properties/searches | route ready | Palta account persistence |
| New-listing alerts | UI ready | Palta Event/Notification Core |
| Publisher Business | canonical contract ready | Local Business canonical Business |
| Direct-owner trust | awaiting integration | Auth/Profile/Trust Core |
| Property calendar | awaiting_source | verified Chile government/municipal sources only |

## Filter contract to support

V1 visible now:

- transaction type
- property type
- direct owner
- price
- surface
- bedrooms
- bathrooms
- parking

Next filter contract:

- furnished
- pets allowed
- floor
- building age / reception date when trustworthy
- storage/bodega
- balcony/terrace
- accessibility
- condominium amenities
- approximate commute time to saved places

## No-fake-data guardrails

1. Demo listings stay in isolated fixture files.
2. Demo text must not be presented as a verified real listing or real resident review.
3. Official/market price labels require a traceable source.
4. Shared nearby POIs are referenced from Palta cores, never copied into each listing.
5. Business publishers reference canonical Business IDs.
6. Direct-owner identity stays separate from Business identity.
7. Listing lifecycle stays separate from physical Property identity.
8. UI readiness does not imply data readiness; use capability status contracts.

## Implementation state

Implemented on `integration/propiedades-v1`:

- `/propiedades`
- `/propiedades/map`
- `/propiedades/listing/[listingId]`
- `/propiedades/saved`
- `/propiedades/mine`
- `/propiedades/create`
- Negocios -> Propiedades handoff
- list/map discovery
- Chile taxonomy and filters
- property cards
- expanded listing detail
- building/context/review demo slots
- data readiness contract

Next implementation slice:

1. real filter sheet state (price/surface/rooms/etc.)
2. listing repository/API port replacing fixtures
3. saved-property/search persistence
4. publisher contact/message handoff
5. verified building source adapter
6. Journey Core commute integration
7. verified resident review flow
8. listing publication form and media upload
