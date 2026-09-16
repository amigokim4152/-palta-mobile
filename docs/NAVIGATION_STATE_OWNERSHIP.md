# PALTA Navigation & State Ownership
Version: v1.2

## Rule

Routes decide **where the user is**.
Feature state decides **what the user is doing**.
Canonical/Care state decides **what is true**.

Do not make route params the primary database.

## State ownership

### Router
Owns:
- route
- modal/sheet route
- deep-link target

### Home feature state
Owns:
- visible candidate IDs
- scroll position
- refresh state
- local hide/correction optimistic state

### Neighborhood spatial state
Owns:
- viewport
- selected entity
- filters
- query
- result IDs
- sheet snap

### Care state
Owns:
- workflow status
- waiting state
- expected time
- next action
- result
- outcome

### Canonical data
Owns:
- business/place/service identity
- verified facts
- source/currentness metadata

## Return-state requirement

Before pushing detail:
capture only the minimal recoverable browsing state.

On Back:
restore from feature state, not by reconstructing from defaults.

## App termination

Persist selectively:
- active Care tracks
- recent browsing return state when useful
- cached canonical data
- current user-selected locality

Do not persist every transient UI value forever.
