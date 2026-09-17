# Palta Print & Peripheral Architecture V1

Status: implementation contract
Reviewed: 2026-09-17

## 1. Purpose

Palta must support receipt printers, label printers, general document printers and later adjacent POS peripherals without turning each model into a bespoke maintenance burden.

The objective is not “support every printer by name”. The objective is:

- one provider-neutral Print Core;
- protocol/capability based adapters;
- a small number of Palta-tested reference devices;
- reuse of existing devices whenever a safe path exists;
- self-service onboarding and diagnostics;
- deterministic multi-printer routing;
- no printer-specific logic inside Commerce, Payment or Fiscal Core.

## 2. Non-negotiable rule

A printer failure must not corrupt a sale, payment or fiscal document.

Printing is a projection/output of canonical business state.

`Sale / Payment / Fiscal -> canonical document -> PrintJob -> Device Adapter`

A failed printer does not roll back an accepted payment or issued DTE. The UI shows printing as a separate recoverable state.

## 3. Device classes

### Receipt thermal
Typical use:
- customer receipt copy;
- kitchen/comanda ticket;
- pickup ticket;
- cash drawer pulse where supported.

Primary compatibility family:
- ESC/POS compatible raw printing;
- Epson ePOS/ESC-POS;
- Star vendor/network protocols.

Preferred media baseline: 80 mm. 58 mm is compatibility mode, not the primary design baseline.

### Label
Typical use:
- SKU/barcode;
- shelf/price label;
- shipping label;
- product/warehouse label.

Primary compatibility families:
- ZPL/ZPL II;
- EPL;
- TSPL/TSPL-EZ;
- Brother raster/SDK for selected devices;
- vendor raster/SDK where unavoidable.

### General document
Typical use:
- A4 PDF;
- reports;
- accounting/fiscal export copies;
- purchase/order documents.

Primary path:
- OS print spooler / native system print using PDF;
- do not force raw thermal protocols for general documents.

## 4. Connection architecture

The browser must not be the universal hardware driver.

### Desktop / Windows / macOS
Preferred order:
1. LAN/network printer where a stable network protocol exists.
2. Palta Device Bridge for USB/serial/raw printing.
3. OS spooler for PDF/A4/general documents.
4. Vendor bridge/SDK only when protocol-neutral paths are unavailable.

A web POS may talk to Palta Device Bridge over a locally authenticated channel. The browser never receives unrestricted raw device access.

### Android tablet / Android POS terminal
Preferred order:
1. native network adapter;
2. vendor/native SDK where needed;
3. native USB host adapter;
4. native Bluetooth adapter.

Do not assume every Android POS terminal exposes the same USB/Bluetooth capabilities. Hardware capability is discovered and stored per device.

### Phone
Printing is secondary. Phone POS may:
- print to a previously paired network/Bluetooth receipt printer;
- request a receipt print from a configured store register;
- share/send a digital receipt instead.

A field-service provider must never be forced to own a printer to complete a sale.

### iOS/iPadOS
Do not rely on Web Bluetooth/WebUSB as a universal path. Use:
- network/vendor SDK for supported thermal printers;
- AirPrint/system print for general documents;
- digital receipt fallback.

## 5. Device Bridge

Palta Device Bridge is a replaceable local adapter host, not a second POS.

Responsibilities:
- discover local USB/serial/network printers;
- generate sanitized/hash-only connection fingerprints;
- expose capabilities;
- execute signed PrintJobs;
- report normalized health/error codes;
- never own Sale, Payment or Fiscal state;
- maintain no business credential beyond local pairing material.

Initial desktop protocol adapters:
- ESC/POS raw;
- ZPL;
- EPL/TSPL where feasible;
- OS spooler/PDF.

Vendor adapters are plugins:
- Epson ePOS;
- Zebra/Link-OS style adapter;
- Star SDK/CloudPRNT where useful;
- Brother raster/SDK for selected label devices.

## 6. Support tiers

### `palta_recommended`
A preferred purchase family for a defined use case. Recommendation can change as local availability, support and testing change.

### `palta_certified`
Palta has a known-good model/firmware/transport test profile.

Promise:
- setup wizard;
- test print;
- documented paper/label settings;
- monitored adapter regressions.

### `compatible`
Protocol/capability matches a tested family, but the exact model is not continuously tested.

Promise:
- guided setup and diagnostics;
- best-effort compatibility;
- not a model-specific guarantee.

### `legacy_bridge`
Existing hardware can be reused only through a local/system bridge or limited compatibility path.

### `unknown`
Support has not yet been proven. Palta must not silently present it as supported.

## 7. Chile initial recommendation policy

Do not recommend the cheapest printer merely because it prints a test page.

### Receipt printer reference class
Preferred purchase characteristics:
- 80 mm direct thermal;
- auto cutter;
- Ethernet + USB preferred;
- ESC/POS or stable vendor SDK;
- locally available paper;
- Chile service/support or easy replacement.

Initial reference candidate family:
- Epson TM-T20IV/TM-T20IIIL Ethernet-capable variants.

Older TM-T20III can remain a compatibility target because existing Chile businesses may already own one.

### Low-cost existing receipt printers
Many Chile-market generic 80 mm printers advertise ESC/POS and USB/Ethernet. Treat them as `compatible` or `unknown` until actual capability tests pass; marketplace claims alone do not make a device certified.

Onboarding must probe:
- 80/58 mm width;
- cutter;
- QR/barcode;
- accented Spanish characters;
- cash drawer pulse;
- network/USB stability;
- status feedback if available.

### Label reference classes
Two distinct needs:

1. Office/light retail labels:
   - Brother QL-820NWB class.
   - Useful for addresses, product labels, continuous DK media, Wi-Fi/Ethernet/Bluetooth/USB.

2. Durable warehouse/shipping/barcode labels:
   - Zebra ZD421 class or equivalent ZPL-capable business label printer.
   - Prefer ZPL-compatible paths for long-term multi-vendor portability.

Palta must not collapse these two use cases into one “label printer” recommendation.

## 8. Existing printer onboarding

Business owner flow:

1. `Connect a printer`
2. Palta discovers candidates or asks connection type: Network / USB / Bluetooth / System Printer.
3. Palta identifies manufacturer/model when available and locally derives a SHA-256 connection fingerprint.
4. Compatibility manifest + protocol hints select the adapter.
5. Capability test runs.
6. Palta prints one diagnostic page/label.
7. User confirms physical result.
8. Palta stores the PrinterIdentity/support tier and reconnect fingerprint hash.

The owner should not manually choose ESC/POS/ZPL unless advanced troubleshooting is needed.

### 8.1 Multiple printers: fixed assignment first

Many stores have two or more printers. Palta must prevent output confusion.

Default behavior:

- `Caja 1 + receipt -> Printer A`
- `Caja 2 + receipt -> Printer B`
- `Kitchen + kitchen ticket -> Printer C`
- `Label workstation + label -> Printer D`

The route is deterministic and may be scoped by business, outlet and register/POS station.

Resolution priority:

1. exact register + outlet route;
2. exact register route;
3. outlet route;
4. business/default route.

A specifically assigned printer going offline does **not** silently cause output on another physical printer.

`failover_mode = disabled` is the default.

A fallback printer is used only when the owner/manager explicitly configures `failover_mode = explicit` for that route. Even then, an `outcome_unknown` print never fails over automatically because the original printer may already have produced paper.

The user-facing setup should say:

`Caja 1 receipt printer: Epson TM-T20IV`

rather than exposing routing/protocol terminology.

## 9. Diagnostic contract

Normalized health vocabulary includes:
- `ready`
- `offline`
- `busy`
- `paper_low`
- `paper_out`
- `cover_open`
- `cutter_error`
- `permission_required`
- `driver_required`
- `bridge_unreachable`
- `network_unreachable`
- `unknown`

User-facing guidance translates the code into an action:

`paper_out -> Add paper and try again.`

`bridge_unreachable -> Open/restart Palta Device Bridge.`

`permission_required -> Allow device access.`

Support diagnostics may contain device family, firmware, protocol, transport, adapter version and normalized error code. They must not contain customer data, receipt text, business ID, raw IP/MAC, raw serial number or raw device paths.

## 10. Print job safety

Every PrintJob has:
- businessId;
- printerId;
- document kind;
- content/artifact reference;
- idempotency key;
- status/revision.

Rules:
- `outcome_unknown` is not automatically reprinted or failed over;
- fiscal/payment canonical state is never inferred from printer success;
- a printed fiscal copy is not the canonical DTE itself;
- every manual reprint is auditable;
- physical routing is resolved before dispatch and the selected printer ID is persisted on the PrintJob.

## 11. Cross-device behavior

Phone:
- quick sale / field use;
- digital receipt first;
- optional paired/configured printer;
- printer errors must not dominate the workflow.

Tablet / Android POS:
- primary checkout station;
- assigned receipt printer shown in compact status area;
- printer/cash-drawer/payment-terminal health visible;
- one-tap diagnostic/reconnect.

PC / Windows:
- professional checkout + management;
- each POS/register can have a fixed receipt printer;
- Device Bridge handles USB/serial/raw printers;
- OS spooler handles PDF/A4;
- keyboard-first printer selection/reprint/history tools.

## 12. Maintenance strategy

The support burden is controlled by maintaining:

1. Protocol adapters, not per-customer code forks.
2. A remote compatibility registry keyed by manufacturer/model/firmware/transport/protocol.
3. A small certified/recommended device matrix.
4. Automated adapter conformance tests using protocol fixtures/emulators.
5. Sanitized technical diagnostics only with permission.
6. Adapter/version rollout flags so a broken printer update can be disabled without redeploying the POS.
7. Hashed reconnect identity so a configured printer can be recognized again without storing raw network/device identifiers.

One newly validated model should improve compatibility for every Palta business using the same model/family.

## 13. Initial purchase packages

These are reference packages, not mandatory hardware bundles.

### Micro / mobile provider
- no printer required;
- digital receipt;
- optional portable receipt printer later.

### Small fixed shop
- Android tablet or existing PC;
- 80 mm Ethernet/USB receipt printer;
- optional cash drawer;
- optional barcode scanner.

### Multi-caja shop
- each register explicitly assigned its own receipt printer;
- shared label/A4 printers assigned by role;
- automatic fallback off by default.

### Retail with labels
- fixed shop package;
- plus label printer selected by use case: office/light label vs durable barcode/shipping.

### Existing POS hardware
Reuse first. Run Palta compatibility wizard before proposing replacement.

## 14. Product principle

The owner should experience:

`Connect -> Palta finds it -> print test -> choose where it will be used -> ready.`

For multiple printers:

`Caja 1 -> Printer A`

and that assignment remains stable until an authorized user changes it.

If printing fails:

`Palta tells the owner exactly what to do next.`

The owner should not need to understand drivers, printer languages, ports or SDKs for normal setup.
