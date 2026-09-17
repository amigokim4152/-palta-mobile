# Palta POS Surface & Device Contract V1

Status: implementation contract  
Reviewed: 2026-09-17

## 1. Core decision

Palta POS is not a separate product stack per device. Phone, tablet, dedicated POS hardware and desktop all operate against the same Commerce Core, Payment Core, Fiscal Core, authorization model and audit trail.

Device differences are presentation and hardware-adapter concerns.

**Screen size or operating system never grants business permission.** Owner/manager/cashier permissions remain authoritative.

## 2. Primary surfaces

### A. Phone — Mobile Quick

Purpose: field work, very small merchants, quick collection and status checking.

Default front-of-screen functions:
- quick amount sale
- small service/product lookup
- payment start/status
- Boleta/Factura status
- receipt share
- today's operational history/status

Complex inventory maintenance, large catalog editing, advanced returns, cash reconciliation and back-office work are secondary/drill-down functions rather than the default phone experience.

Layout rule: single column, large touch targets, minimal persistent chrome.

### B. Tablet / Dedicated Android POS — Touch Register

Purpose: primary professional checkout surface.

Default front-of-screen functions:
- catalog/search/scanner area
- cart and totals kept visible when space allows
- customer selection
- payment
- Boleta/Factura state
- refund/exchange entry
- session/cash status
- inventory lookup
- peripheral health

Preferred layout: two-pane `catalog/search | cart/payment` at medium/wide widths. Compact dedicated devices may fall back to one pane without changing the canonical workflow.

Dedicated POS hardware should show persistent status for attached printer, scanner, cash drawer and payment terminal where those capabilities exist.

### C. PC / Windows / macOS — Desktop Register + Operations

Purpose: professional register and complex business operations.

Default characteristics:
- higher information density
- keyboard shortcuts
- persistent cart
- wide split workspace
- catalog, customer, inventory, refund, fiscal and session operations
- owner/manager operational and back-office access when role permits

A PC may be used as a full register or as a management station. The role and register binding determine what actions are permitted; desktop form factor does not.

## 3. Existing POS hardware

Existing POS machines are supported through capability adapters rather than separate commerce implementations.

### Android POS

Preferred integration order:
1. Palta Android/native shell when the device permits normal Android app installation.
2. Vendor/native SDK adapter for integrated printer/scanner/cash-drawer functions.
3. Network/Bluetooth/USB peripheral adapters when vendor SDK access is unavailable.
4. Browser/PWA fallback for canonical checkout where hardware control is not required.

A vendor-specific SDK must never own Sale, Payment or Fiscal state.

### Windows POS / PC

Preferred integration order:
1. responsive web/PWA or desktop shell for the POS UI.
2. keyboard/HID barcode devices directly where standard input is sufficient.
3. a small local Device Bridge for USB/serial/native printer, drawer or terminal integrations that browsers cannot safely control.
4. network printer/terminal adapters where available.

The Device Bridge is an adapter process only. It cannot become the canonical sales database.

## 4. Device capability model

A registered POS device should eventually expose verified capabilities such as:
- barcode scanner
- receipt printer
- cash drawer
- customer display
- scale
- payment terminal
- camera
- NFC / Tap to Pay

Capabilities are discovered/verified independently from form factor. An Android tablet with no USB support and a dedicated Android POS with integrated printer are both Android, but they are not the same operational device.

The UI should react to verified capability state such as available, disconnected, permission required or unsupported.

## 5. Shared workflow invariant

All surfaces use the same canonical path:

`Intent → Sale/Order context → Checkout → Payment → Sale completion → Fiscal request → Boleta/Factura lifecycle → Receipt/history`

The UI may compress or expand steps, but it may not invent a different transaction lifecycle.

## 6. Offline and failure behavior

- Phone: allow only explicitly permitted local/manual operations when the local journal is healthy.
- Tablet/dedicated register: local durable journal and sync status must be visible because this is a primary selling surface.
- Desktop: same runtime policy; connection loss must not silently duplicate sales or payment attempts.
- Integrated payment outcome `unknown` must reconcile before retry.
- Fiscal pending must remain independent from payment success.
- POS session cannot close with unresolved money operations or unsynced local mutations.

## 7. UI adaptation rules

### Phone
- one column
- 48px minimum primary touch targets
- no permanently pinned cart
- bottom actions
- hide advanced operational density by default

### Tablet / dedicated POS
- 48px minimum touch targets
- two panes when width allows
- pinned cart when width allows
- persistent peripheral health on dedicated hardware
- touch-first controls, optional keyboard/scanner speed paths

### Desktop
- split workspace
- compact density
- persistent cart
- sidebar navigation
- keyboard shortcuts when keyboard is present
- pointer-optimized tables, filters and bulk operations

## 8. Hardware independence

Peripheral adapters must implement narrow commands/events such as:
- `scanBarcode`
- `printReceipt`
- `openCashDrawer`
- `readWeight`
- `showCustomerDisplay`
- `requestTerminalPayment`

Hardware adapters return results to Palta Core. They do not finalize Sale, Payment or Fiscal state themselves.

## 9. Release sequence

1. Surface policy + responsive contracts.
2. Phone quick-sale reference surface.
3. Tablet/dedicated POS register reference surface.
4. Desktop register/operations reference surface.
5. Device enrollment/binding and capability registry.
6. Generic scanner/printer/drawer adapters.
7. Android vendor adapters only as actual target hardware is selected.
8. Windows local Device Bridge only for peripherals that cannot be handled safely through web/HID/network paths.
9. Payment/fiscal state integration on all three reference surfaces.
10. Real-device certification matrix before declaring hardware support.

## 10. Product principle

**One Commerce Core, multiple optimized surfaces.**

Phone should remain simple. Tablet/dedicated POS should sell quickly all day. Desktop should handle complexity without making the tablet or phone complex.
