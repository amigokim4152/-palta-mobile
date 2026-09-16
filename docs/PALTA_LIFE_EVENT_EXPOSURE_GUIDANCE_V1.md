# Palta Life Event Exposure Guidance v1

## Purpose

Palta should not require complete personal data before it can help.

When a life event occurs, Palta should combine:

1. **Known facts**
2. **User-confirmed facts**
3. **Verified external information**
4. **Common-sense risk prompts**
5. **Action bridges**

The objective is not to predict the future with certainty.
The objective is to help the user notice reasonable downstream risks they may overlook while stressed.

## Core rule

> Known information enables direct action.
> Missing information triggers a relevant check, not a fabricated assumption.

Example:

Bad:
- "Your garage remote was in the stolen car."

Good:
- "If a garage or building-access remote was in the vehicle, consider disabling it. Was one in the car?"

## Four action levels

### Palta can do
Examples:
- revoke a Palta device session
- retrieve the user's stored insurance reference
- update an internal Care state

### Palta can connect
Examples:
- official reporting page
- insurer
- telecom carrier
- municipal/building contact
- verified service provider

### User must confirm
Examples:
- whether house keys were in the vehicle
- whether an address-bearing document was exposed
- whether a work access card was lost

### User must do
Examples:
- ask building administration to deactivate a remote
- physically change a lock
- submit documents to an insurer

Palta should still track these user-owned actions as Care steps when useful.

## Evidence labels

Every recommendation/risk carries one of:

- known_from_profile
- user_confirmed
- verified_external
- common_risk_prompt
- unknown

The UI must never present a `common_risk_prompt` as if it were a known fact.

## Urgency

Recommendations are grouped into:

- Immediate
- Today
- Soon
- Later

Do not show a giant checklist all at once.
Show the highest-value next actions first.

## Example — stolen vehicle

Immediate:
- official vehicle-theft reporting path
- ask about home/garage access remote
- ask about phone/wallet/ID/work-access items

Today:
- check address exposure through documents
- insurer follow-up

Then continue only with confirmed/relevant branches.

## Expansion

The same engine can support:

- stolen vehicle
- lost phone
- lost keys
- lost wallet
- stolen bicycle
- lost passport during travel
- home burglary
- fire/flood
- compromised account
- lost pet

This is a Care Core capability, not a separate app surface.
