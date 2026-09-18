# Palta Propiedades — Product Architecture V1

## Decision

`Propiedades` is an independent Palta vertical. It is discoverable from `Negocios`, but `Negocios` does not own real-estate inventory or listing state.

This follows the product pattern already used by Palta: shared canonical entities and shared context, with independent vertical ownership.

## User flow

```text
Negocios
  -> Propiedades entry
     -> Propiedades home / map
        -> listing preview
           -> listing detail
              -> property / building / neighborhood context
              -> owner direct OR broker / real-estate Business
```

Reverse navigation must also work:

```text
Business Profile (Corredor / Inmobiliaria)
  -> active property listings
     -> Propiedades listing detail
```

## Ownership boundaries

### Negocios owns

- canonical Business identity
- Business Profile
- verification/trust state for businesses
- reviews/follow/save/contact actions that are business-scoped
- WhatsApp/phone/contact capabilities
- Business location/profile data

### Propiedades owns

- Property identity
- Listing identity and lifecycle
- sale/rent/temporary-rent transaction state
- price and listing publication state
- direct-owner vs broker/agency publisher semantics
- building/condominium relation
- property-specific filters and saved-listing behavior

### Shared Palta cores

- Map / Place context
- Neighborhood context
- Transport context
- Search/deep-link/navigation contracts
- canonical Business references

Propiedades must reference these cores; it must not duplicate their datasets.

## Chile V1 taxonomy

Transactions:
- Venta
- Arriendo
- Arriendo temporal

Property types:
- Departamento
- Casa
- Pieza
- Oficina
- Local comercial
- Terreno
- Parcela
- Bodega

Publisher types:
- Dueño directo
- Corredor
- Inmobiliaria

## Canonical model

```text
Property
  1 -> N PropertyListing
  N -> 0..1 Building/Condominio
  N -> 1 Place/Neighborhood context

PropertyListing
  -> publisherUserId (Dueño directo)
  OR
  -> publisherBusinessId (Corredor/Inmobiliaria)

Business
  -> 0..N PropertyListing
```

A new listing for the same physical home must not create a new Business, and it should not create a duplicate Property when the canonical property is already known.

## Map-first principle

Propiedades uses the existing Palta map stack. The first-class discovery modes are:

- map viewport
- current/selected neighborhood
- comuna
- transaction type
- property type
- price
- direct owner vs broker/agency

The map should be able to enrich a listing with nearby schools, health services, parks, groceries, local businesses and transport without copying those records into the listing.

## Negocios handoff

The Negocios category item labeled `Propiedades` is a vertical handoff, not a Business category query.

Expected behavior:

```text
Tap Propiedades in Negocios
  -> /propiedades?source=negocios_category
```

When entering from a Business Profile:

```text
Tap "Propiedades" / "Ver propiedades"
  -> /propiedades?source=business_profile&businessId=<canonicalBusinessId>
```

## Guardrails

1. Do not model listings as generic Business posts.
2. Do not create a Business per property.
3. Do not store neighborhood POIs inside every listing.
4. Do not fork Map/Place/Neighborhood datasets.
5. Keep owner-direct and professional publishers explicitly distinguishable.
6. Keep listing lifecycle separate from the physical Property lifecycle.
7. Keep the public Spanish product label `Propiedades`; internal code may use `realEstate`.

## Initial implementation sequence

1. canonical TypeScript contracts
2. cross-module entry/handoff resolver
3. Propiedades route shell
4. map/list discovery state
5. listing card + detail
6. Business-to-listings linkage
7. direct-owner listing flow
8. broker/agency listing management
9. persistence/API contracts
10. production data ingestion and verification
