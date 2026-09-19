# Home runtime recovery · 2026-09-19

## Source review

| Branch | Reviewed HEAD | Finding |
| --- | --- | --- |
| `integration/home-functional-foundation-v1` | `9e9cac7f59a0ce5de03de66c757284499072b443` | Broadest functional Home contract and existing life-card and entry inventories; selected as canonical source. |
| `integration/home-life-inbox-priority-v1` | `640b4e98d5e77cec6582fd35109a1f0a2f8c4e25` | Earlier prioritization and demo entries, without later public-data Home integration. |
| `integration/home-runtime-v1` | `50029cb6267da5ed982e6f0ff2615868613f3cc4` | Earlier runtime wiring, fewer Home source files. |
| `integration/home-source-runtime-recovery-v1` | `9dc92d944b74aae3455df0ed27593f15533fa257` | Separate source recovery work, but lacks much of the functional foundation contract. |
| `integration/home-visual-baseline-v1` | `c6d21b807232e91b9469ffadcc5870cf27f4e77b` | Visual experiment with fewer Home fixtures and source contracts. |

## Root cause

The runtime already contained the reviewed functional Home screen and both demo inventories. The Home tab route still rendered `HomeScreen`. The missing capability view was caused by display gating: `HomeScreen` inferred demo mode from the API payload's `demo_mode` or any item's `data_mode`. A partial payload without a demo marker therefore skipped the existing life-card inventory. When the Home API failed before returning data, the screen rendered only an error. The demo entry inventory existed but was not rendered by `HomeScreen`. The snapshot SHA pin alone was not the cause; the selected foundation source had the same gating.

## Recovery

The canonical source remains `integration/home-functional-foundation-v1`, now pinned by `manifest/mobile-runtime-composition.json` to its recovery commit. Existing functional Home Core, API contracts, life-card fixtures and entry inventory remain in place. `development` explicitly enables demo coverage and a usable local Home when the API is unavailable. `preview` and `production` render personalized API data and discard demo items. Real API items take precedence over demo items with the same capability key.

The first screen shows a small set of urgent and useful items, with the rest and product entries behind `Ver todo`. The existing adaptive layout is retained; hidden glance items can be expanded at large text sizes. Entries without implemented routes remain visible as information rather than buttons.

## Verification boundary

Automated guards cover demo completeness, production filtering, partial and unavailable API data, the Home route, adaptive source wiring, and the exact reviewed Home source file hashes. Composed typecheck and iOS bundle verify compilation. A simulator review is still needed for first-viewport density, large text wrapping, data refresh after returning to Home, and the `Ver todo` interaction.
