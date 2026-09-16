# Native adapters v2.7 — 2026-09-16

## Expo Location

Implemented adapter:
- foreground permission check/request
- recent last-known location first
- current balanced-accuracy fallback
- no background tracking

Reason:
Neighborhood needs location while in use. Background location is not justified for v1.

## Expo SQLite

Implemented:
- `SQLiteProvider`
- WAL journal mode
- persistent `offline_mutation_queue`
- bound SQL parameters for user data
- deterministic created-at ordering
- upsert by stable mutation ID

## MapLibre

Implemented UI adapter surface with:
- `Map`
- `Camera`
- `GeoJSONSource`
- `Layer`
- clustering
- source-level entity press handling
- user-moved-map signal

MapLibre still requires an Expo development build; Expo Go is not sufficient.

## Deliberate limitations

NOT YET CONNECTED:
- final R2/PMTiles map style URL
- current-location puck
- route lines
- viewport bounds fed back into `/v1/local/search`
- offline map packs
- Expo network reachability listener

The screen-level MapLibre adapter exists, but native runtime validation remains NOT VERIFIED until the real Expo project is installed and built.
