# Palta Image-First Print & Bridge V1

Status: implementation contract  
Reviewed: 2026-09-17

## 1. Product decision

Palta labels are designed visually first and rendered by Palta before they reach the printer.

The default target is **image-first output**, not device-font/text-command layout.

This is required so a label can have consistent typography, spacing, logo, QR code, barcode, borders and visual hierarchy across supported printers.

A printer protocol may still receive ZPL, Brother Raster, ESC/POS raster or vendor SDK commands, but those commands transport an already-rendered layout. They must not become the canonical design engine.

## 2. Canonical rendering flow

`Business data`
→ `Palta label template`
→ `physical canvas (mm + DPI)`
→ `rendered monochrome bitmap / PDF`
→ `printer adapter conversion`
→ `physical output`

Typical raster targets:
- 203 dpi: economical receipt/label hardware
- 300 dpi: preferred small retail/product labels where visual quality matters
- 600 dpi: special/high-resolution use only

The renderer must know the exact target DPI before final rasterization. Do not silently rescale a 300 dpi bitmap to a 203 dpi printer at transport time.

## 3. Why image-first

Benefits:
- consistent Korean/Spanish/English typography
- no dependence on printer-resident fonts
- predictable logo and QR rendering
- consistent brand identity
- one template engine for Brother/Zebra/Epson/IPP paths
- preview shown to merchant can match the printed result more closely

Trade-off:
- image printing transfers more bytes than plain text
- therefore local network/USB is preferred for larger raster jobs
- BLE may be used for small jobs or setup, but should not be the default transport for large image labels when Wi-Fi/Ethernet is available

## 4. iPad / iPhone strategy

Do not attempt to make every arbitrary legacy printer directly accessible from iPadOS.

Use this ordered decision tree:

1. **System print path** — AirPrint/IPP for ordinary image/PDF/A4 output where appropriate.
2. **Native vendor path** — supported Epson/Brother/Zebra iOS SDK for specialized receipt/label printing.
3. **Network printer path** — direct LAN printing where the printer/vendor officially supports it.
4. **Palta Print Bridge** — for USB, Serial, unsupported Bluetooth Classic, legacy drivers or printers whose direct iPad integration would create high support cost.

Professional iPad POS deployments that depend on a Bridge should use the native Palta app rather than relying only on a browser/PWA, because local-network discovery and accessory interaction need reliable OS-level capabilities.

## 5. Apple constraints are treated as platform contracts

Apple accessory rules are not bypassed.

- MFi/ExternalAccessory paths are used only where the printer manufacturer supports/authorizes them.
- BLE/Wi-Fi setup may use current Apple accessory/network frameworks where appropriate.
- ordinary Apple printing can accept image/PDF-ready content.
- if a printer's iPad path requires brittle hacks or unsupported protocols, Palta routes through the Bridge instead.

The objective is lower support cost, not maximum direct-hardware cleverness.

## 6. Palta Print Bridge appliance

Target concept: a small preconfigured local appliance supplied only when direct printer integration is unsuitable.

### Required interfaces
- Wi-Fi
- optional Ethernet
- USB host
- Bluetooth where hardware requires it
- optional serial via adapter

### Client discovery
- Bridge advertises `_palta-print._tcp` using Bonjour/mDNS.
- Palta app discovers it on the local network.
- Pairing verifies bridge identity/fingerprint and a one-time setup secret.
- public Internet discovery/listening is disabled by default.

### Printer side
The Bridge loads Palta adapters for:
- OS/CUPS/IPP printers
- USB ESC/POS
- serial ESC/POS
- supported Brother raster/SDK paths
- supported Zebra/ZPL paths
- vendor-specific adapters only when necessary

### Important rule
The Bridge is **not a POS server and not a sales database**. If it is replaced, the merchant's Commerce/Payment/Fiscal history remains untouched.

## 7. BLE role

BLE is valuable for:
- first-time discovery
- pairing
- Wi-Fi provisioning
- small control/status messages
- printing only where the printer officially supports a reliable BLE image path

For a Bridge, prefer:
- Ethernet first when available
- local Wi-Fi second
- Bluetooth fallback only when neither local network option is available

This avoids sending large PNG/raster jobs through a constrained radio path unnecessarily.

## 8. Existing-printer installation experience

The merchant flow should be:

1. `Add printer`
2. choose `Receipt / Label / A4 / Kitchen`
3. Palta scans known routes automatically
4. Palta shows simple result: `Found Brother QL-820NWB`
5. `Print test`
6. merchant answers only `Printed correctly / Problem`
7. Palta saves device profile and role

If direct connection is unsuitable:

`This printer can be reused with Palta Print Bridge.`

Then:
1. connect printer USB/Bluetooth/Serial to Bridge
2. power Bridge
3. Palta discovers Bridge automatically
4. pair once
5. print test
6. done

No driver/protocol selection should be required from ordinary merchants.

## 9. Support and remote diagnostics

Palta must be able to identify, without exposing customer print content:
- bridge/app version
- printer manufacturer/model
- firmware when readable
- connection transport
- adapter version
- target DPI/paper size
- last successful print timestamp
- current health/error code
- compatibility manifest revision

The first support response should be generated from diagnostics rather than asking the merchant to describe technical details.

Examples:
- `Printer power is off or network connection is unavailable.`
- `Paper size 62 mm does not match the saved 29 mm label template.`
- `The printer received the job but Palta cannot confirm the output. Check before reprinting.`
- `This legacy USB model requires the Palta Print Bridge.`

## 10. Bridge software update strategy

The Bridge software must update with minimal field service.

- signed Palta releases only
- stable and rollback-capable release channels
- automatic health check after update
- previous working version retained for rollback
- compatibility manifest updated separately as data
- adapter code changes go through CI/regression tests

A technician should not normally visit a merchant just to update a printer adapter.

## 11. Certification matrix

Exact support is recorded by evidence:

`platform + Palta version + bridge version + printer model + firmware + transport + adapter version + paper + test result`

A protocol family may be broadly `Compatible`; an exact combination becomes `Palta Certified` only after physical verification.

## 12. Initial technical priorities

1. Canonical image/raster artifact contract.
2. 203/300 dpi rendering pipeline.
3. PNG monochrome preview and checksum.
4. Brother image/raster adapter reference implementation.
5. Zebra image/ZPL-graphic adapter reference implementation.
6. Epson receipt raster/ePOS reference implementation.
7. IPP/PDF general-print adapter.
8. Local Print Bridge protocol + Bonjour discovery.
9. Bridge reference appliance proof of concept.
10. physical printer certification matrix in Chile.

## 13. Principle

**The merchant chooses what to print. Palta handles how it reaches the printer.**

The merchant should not need to know Bluetooth profile names, ESC/POS, ZPL, raster commands, drivers, IP addresses or Apple accessory policy in normal operation.
