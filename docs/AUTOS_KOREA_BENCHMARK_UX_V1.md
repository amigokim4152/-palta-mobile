# Autos Korea Benchmark UX V1

Status: companion guidance for `integration/autos-v1`.

## Purpose

Use mature Korean used-car selling flows as a benchmark for reducing user work without copying their UI or assuming Chile has the same data infrastructure.

Benchmarked patterns:

- HeyDealer: plate-first entry, self vs evaluator-assisted auction, guided selling, dealer competition, seller protection against arbitrary post-bid deductions.
- Encar: price check first, auction vs direct-sale choice, dealer profiles and after-transaction monitoring.
- K Car: plate/owner-first entry, evaluator visits the user, quotation and ownership-transfer handling as one service flow.
- KB ChaChaCha: plate-first vehicle lookup, Self with a very small photo set, Pro evaluator visit, dealer auction and direct-sale alternatives.

## Palta non-negotiables

1. Do not make the seller rebuild data Palta already has or can lawfully retrieve.
2. Start from vehicle identity, preferably an existing `Mis autos` vehicle; otherwise start from patente.
3. Ask for confirmation before asking for manual entry.
4. Guided capture comes before automated recognition.
5. Initial launch must work with zero paid-AI calls.
6. Vehicle photos have explicit capture slots so the user never has to guess what to photograph.
7. Required launch capture set is intentionally small: front, rear, side, interior and odometer. Damage/detail capture is optional but strongly encouraged when relevant.
8. Direct sale and dealer-offer acquisition reuse the same prepared vehicle data. Never make the user register the vehicle twice.
9. Dealer competition must not expose private contact details or exact vehicle location before the user chooses to proceed.
10. A high offer does not become an automatic sale. The user chooses.
11. Any reduction from an offer must later be explainable by evidence and an explicit adjustment reason.
12. Before final acceptance, Palta should show applicable transaction costs and the estimated amount the seller receives.
13. Public listing data and private ownership/identity/location data remain separate.

## Cost strategy

Current launch path:

`guided capture -> manual confirmation -> public/partner data when available -> canonical Vehicle`

Future optional path:

`guided capture -> device OCR / registry partner / paid AI -> proposed values -> user confirmation -> canonical Vehicle`

Paid automation is an enhancement, not a dependency. Failure or disabling of recognition must never block the selling flow.

## Capture contract

Canonical capture definitions live in:

- `src/autos/autosCaptureFlow.ts`

The mobile UI may change presentation, but it should consume the same capture intent and recognition policy rather than inventing a second photo/recognition model.

## Selling flow

Preferred flow:

`Mis autos or patente`
→ `confirm vehicle`
→ `guided photos`
→ `confirm only missing/important facts`
→ `choose direct sale or dealer offers`
→ `show estimated transaction outcome`
→ `user decides`

The product goal is not to create a shorter form. The goal is to remove the form wherever possible.
