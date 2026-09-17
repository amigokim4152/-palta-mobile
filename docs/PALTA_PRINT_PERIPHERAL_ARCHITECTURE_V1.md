# Palta Print & Peripheral Architecture V1

Status: implementation contract
Reviewed: 2026-09-17

## 1. Purpose

Palta must support receipt printers, label printers, general document printers and later adjacent POS peripherals without turning each model into a bespoke maintenance burden.

The objective is not “support every printer by name”. The objective is:

- one provider-neutral Print Core;
- protocol/capability based adapters;
- a small number of certified reference devices;
- reuse of existing devices whenever a safe path exists;
- self-service onboarding and diagnostics;
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
- request a receipt print from a store register;
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
- expose sanitized device fingerprints and capabilities;
- execute signed PrintJobs;
- report status/health/error codes;
- never own Sale, Payment or Fiscal state;
- maintain no business credential beyond local pairing material.

Initial desktop protocol adapters:
- ESC/POS raw;
- ZPL;
- EPL/TSPL where feasible;
- OS spooler/PDF.

Vendor adapters are plugins:
- Epson ePOS;
- Zebra Browser/Link-OS style bridge;
- Star SDK/CloudPRNT where useful;
- Brother raster/SDK for selected label devices.

## 6. Support tiers

### Certified
Palta has a known-good model/firmware/transport test profile.

Promise:
- setup wizard;
- test print;
- documented paper/label settings;
- monitored adapter regressions.

### Compatible
Protocol/capability matches a tested family, but exact model is not continuously tested.

Promise:
- guided setup and diagnostics;
- best-effort compatibility;
- not a model-specific guarantee.

### Generic
Device can probably operate through OS spooler or generic ESC/POS/ZPL route, but status feedback/cutter/drawer details may be incomplete.

### Unsupported
Known unsafe/incompatible device or transport. Do not allow silent printing claims.

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

Initial certified candidate family:
- Epson TM-T20IV/TM-T20IIIL Ethernet-capable variants.

Reason: Epson Chile exposes local support and ePOS SDK/network/mobile support. Older TM-T20III can remain a compatibility target even when discontinued because many businesses may already own one.

### Low-cost existing receipt printers
Many Chile-market generic 80 mm printers advertise ESC/POS and USB/Ethernet. Treat them as `compatible` or `generic`, never `certified` solely from marketplace claims.

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
   - Prefer ZPL-compatible path for long-term multi-vendor portability.

Palta must not collapse these two use cases into one “label printer” recommendation.

## 8. Existing printer onboarding

Business owner flow:

1. `Connect a printer`
2. Palta discovers candidates or asks connection type: Network / USB / Bluetooth / System Printer.
3. Palta identifies fingerprint: manufacturer, model if available, VID/PID, network service, language hints.
4. Capability test runs.
5. Palta prints one diagnostic page/label.
6. User confirms physical result.
7. Palta stores a `PrinterDeviceProfile` and support tier.

The owner should not manually choose ESC/POS/ZPL unless advanced troubleshooting is needed.

## 9. Diagnostic contract

Each device exposes a small normalized health vocabulary:
- `ready`
- `offline`
- `paper_out`
- `cover_open`
- `busy`
- `permission_required`
- `bridge_unreachable`
- `driver_missing`
- `unsupported_language`
- `network_unreachable`
- `unknown`

User-facing guidance must translate the code into an action:

`paper_out -> Add paper and try again.`

`bridge_unreachable -> Open/restart Palta Device Bridge.`

`permission_required -> Allow USB/Bluetooth access on this device.`

Support staff should see model/transport/firmware/error diagnostics, not raw customer business data.

## 10. Print job safety

Every PrintJob has:
- businessId;
- printerId;
- document kind;
- payload/content reference;
- content hash;
- idempotency key;
- status and attempts.

Rules:
- `unknown` is not automatically reprinted when duplicate physical output would be harmful;
- fiscal/payment canonical state is never inferred from printer success;
- a printed fiscal copy is not the canonical DTE itself;
- kitchen/receipt copies may have a configurable safe reprint policy;
- every manual reprint is auditable.

## 11. Cross-device behavior

Phone:
- quick sale / field use;
- digital receipt first;
- optional paired printer;
- printer errors must not dominate the workflow.

Tablet / Android POS:
- primary checkout station;
- printer/cash-drawer/payment-terminal health visible in compact status area;
- one-tap diagnostic/reconnect.

PC / Windows:
- professional checkout + management;
- Device Bridge handles USB/serial/raw printers;
- OS spooler handles PDF/A4;
- keyboard-first printer selection/reprint/history tools.

## 12. Maintenance strategy

The support burden is controlled by maintaining:

1. Protocol adapters, not per-customer code forks.
2. A remote compatibility registry keyed by manufacturer/model/fingerprint/firmware/transport.
3. A small certified-device matrix.
4. Automated adapter conformance tests using protocol fixtures/emulators.
5. Device diagnostics uploaded as sanitized technical telemetry only with permission.
6. Adapter/version rollout flags so a broken printer update can be disabled without redeploying the POS.

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

### Retail with labels
- small fixed shop package;
- plus label printer selected by use case: office/light label vs durable barcode/shipping.

### Existing POS hardware
Reuse first. Run Palta compatibility wizard before proposing replacement.

## 14. Product principle

The owner must experience:

`Connect -> Palta finds it -> print test -> ready.`

If that fails:

`Palta tells the owner exactly what to do next.`

The owner should not need to understand drivers, printer languages, ports or SDKs for normal setup.
