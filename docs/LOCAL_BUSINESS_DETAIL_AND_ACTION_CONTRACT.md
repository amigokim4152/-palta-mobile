# Local Business Detail & Action Contract
Version: v1.2
Status: FIRST VERTICAL SLICE

## Purpose

Business detail must answer quickly:
- What is this place?
- Is it open?
- How far is it?
- Can I trust the information?
- What can I do now?

## Detail hierarchy

1. Name + category
2. open/closed/current-status
3. distance/location
4. compact trust/currentness signal
5. primary actions
6. photos / description / services
7. hours
8. contact
9. reviews/history when available

Do not put owner/admin controls into the public customer view.

## Public facts before owner verification

May be visible when supported by source:
- business name
- category
- location/address
- public hours
- public phone/WhatsApp
- public service description

## Verified-owner-only controls

Owner verification required for:
- coupons/discounts
- paid offers
- pricing published as business-controlled data
- reservation settings
- quote rules
- POS/financial actions
- staff permissions

## Primary actions

Action availability depends on business capability:
- Call
- WhatsApp
- Save / Regular
- Request quote
- Reserve
- Join queue
- Send inquiry

Do not show all actions if the business cannot support them.

## Quote flow

User:
1. chooses Request quote
2. enters minimum necessary description
3. optional photo
4. Palta routes request to eligible businesses
5. request creates Care track
6. responses update the same Care track
7. Home shows waiting/responded state
8. contact details are exposed according to the selected workflow

## Safety / trust

- Unverified business cannot create fake 90% discounts.
- User-generated correction does not instantly become a verified business fact.
- Public corrections enter review/source validation.
- Sensitive user context is not sent to businesses unless necessary and consented.

## Completion

The flow ends when:
- the user selects a business or ends the request
- work is completed/cancelled
- follow-up is complete

Then Home stops surfacing stale action cards.
