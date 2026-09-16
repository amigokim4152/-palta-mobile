# UI Component System v3.4

## Goal

Build reusable interaction structure without prematurely freezing Palta's final visual brand.

## Frozen now

Interaction semantics:
- minimum touch target: 44
- scalable text
- semantic button hierarchy
- compact filter chips
- reusable section headings
- reusable Business action bar
- reusable Care timeline
- reusable map results sheet

## Not frozen yet

- final brand colors
- final font family
- final icon family
- final shadow/elevation scale
- exact animation durations
- final desktop/tablet layout

## Accessibility

All reusable controls:
- allow Dynamic Type / font scaling
- keep touch target >= 44
- expose button/list semantics
- do not rely only on color for status
- tolerate reduced motion

## Home density

Home never aims for a target card count.

The pure density policy:
- busy Home: discovery = 0
- medium Home: at most 1 discovery card
- quiet Home: at most 2 discovery cards
- quiet end-state is valid

## Business detail

Business actions are capability-driven.

The first supported actions are ordered by usefulness, not by sales priority.

Verified-owner-only controls such as controlled coupons/pricing remain disabled until ownership is verified.

## Care

Care timeline visualizes:

`Discover → Prepare → Act → Wait → Result → Follow-up → Outcome`

`Result` and `Outcome` remain separate.
