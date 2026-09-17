# Palta Printing & Device Bridge Contract V1

Status: implementation contract  
Reviewed: 2026-09-17

## 1. Objective

Printing must not become a per-customer maintenance project.

Palta supports printing through a provider-neutral Print Core. Receipt, label, kitchen and A4 output are semantic PrintJobs. Device-specific code lives behind adapters and a local/native Device Bridge where direct hardware control is required.

**The POS UI never talks directly to a printer driver.**

## 2. Printing layers

`POS / Customer Order / Inventory / Fiscal`

→ `Print Core`

→ `Printer Route`

→ `Adapter`

→ `Native/Local Device Bridge when required`

→ `Physical Printer`

Printing never owns Sale, Payment or Fiscal state.

## 3. Output classes

### Receipt / Kitchen
Preferred protocols:
- Epson ePOS / ESC-POS compatible paths
- StarPRNT / Star web-native paths
- OS spooler fallback when direct status/cutter control is not needed

### Label
Preferred protocols:
- Zebra ZPL for professional warehouse/product labels
- Brother Raster / Brother SDK for QL/TD/RJ families
- OS spooler/PDF fallback for low-complexity label use

### A4 / General documents
Preferred path:
- IPP / Mopria / OS print system
- PDF as canonical rendered artifact

Do not write bespoke drivers for ordinary office printers when standard IPP or the OS spooler can handle them.

## 4. Support tiers

### Palta Recommended
A current model that Palta recommends for new purchases because connectivity, Chile availability, documentation and adapter quality are good.

### Palta Certified
A model/firmware/transport combination physically tested by Palta with test receipt/label, reconnect and error handling.

### Compatible
Supported through a known protocol family such as ESC-POS, ZPL, IPP or an existing vendor SDK but not yet physically certified by Palta.

### Legacy Bridge
Existing hardware that needs the operating-system driver, serial/USB bridge, vendor SDK or other local software. Supported when practical, but not the preferred new purchase.

### Unknown
Palta has not verified the device. The setup wizard may run a non-destructive compatibility test and let the user confirm a printed test page. Unknown never means certified.

## 5. New hardware guidance for Chile

Do not publish a large catalog. Maintain a small "known-good" matrix by job.

### Receipt — value/business baseline
- Epson TM-T20 family should be evaluated as the affordable receipt baseline where a current Chile model and desired interface are available.
- Older TM-T20III remains a compatibility target because Epson Chile still provides current support assets, but it is discontinued and should not be the default new-purchase recommendation.

### Receipt — higher-volume baseline
- Epson TM-T88VII is a strong professional candidate because Chile support exists, 220V USB/Ethernet models are locally sold, and Epson supports PC, mobile, web/ePOS and cloud-oriented operation.

### Labels — office/retail
- Brother QL-820NWB is a strong small-business label candidate because Chile officially sells/supports it and it exposes USB, Ethernet, Wi-Fi and Bluetooth plus Brother SDK paths.

### Labels — warehouse/professional
- Zebra ZD421 is a professional candidate where ZPL and durable warehouse/product-label workflows matter.

These are candidate families until Palta physically certifies exact Chile SKUs/firmware/transports.

## 6. Existing printer reuse

Setup flow:
1. Choose purpose: receipt / label / A4 / kitchen.
2. Palta detects printers available through OS, network, Bluetooth or native bridge.
3. Read manufacturer/model/interface where possible.
4. Match the data-only compatibility manifest.
5. Select adapter automatically when confidence is high.
6. Print a safe test artifact.
7. Ask the user one simple confirmation: "Did this print correctly?"
8. Save the verified device profile.

If automatic detection fails, user searches model or chooses `Generic ESC/POS`, `Generic ZPL`, or `System Printer` compatibility test.

No merchant should have to understand driver/protocol terminology during normal setup.

## 7. Device Bridge

### Windows/macOS/Linux
A small signed local process is used only when browser/PWA access is insufficient for USB, serial, vendor SDK, cutter, cash drawer or detailed printer status.

Security rules:
- bind to loopback only by default
- pair to the Palta session/device with a rotating local token
- strict allowed-origin policy
- no inbound public network listener
- executable code updated only through the signed Palta release channel
- compatibility manifest may update remotely, but it is data only
- diagnostic logs never contain receipt body, customer data, fiscal XML or credentials

### Android / dedicated POS
Native adapters may use USB/Bluetooth/network/vendor SDK through the Palta Android shell. Vendor SDKs remain behind narrow adapters.

### iOS
Use IPP/AirPrint for ordinary documents and supported vendor SDK/network paths where specialized receipt/label functions are required. Do not promise arbitrary USB/Bluetooth compatibility without model validation.

## 8. Printer roles and routing

A business/outlet can configure roles:
- receipt
- label
- kitchen
- A4
- packing

Each role may have:
- primary printer
- ordered fallback printers

Automatic fallback is allowed only when Palta has a definitive pre-print/dispatch failure. If the outcome is unknown after bytes/job submission, Palta must not automatically print again because duplicate receipts/labels may result.

## 9. Print outcome model

- queued
- dispatching
- submitted
- printed
- outcome_unknown
- failed
- cancelled

`outcome_unknown` requires operator/device reconciliation before retry.

A physical print does not issue a fiscal document. Boleta/Factura issuance is owned by Fiscal Core. Printing a receipt is rendering an already-known artifact.

## 10. Diagnostics UX

When the merchant says "printer does not work", Palta should collect a privacy-safe diagnostic snapshot automatically:
- Palta app/bridge version
- OS/platform
- printer manufacturer/model if known
- adapter/protocol
- connection type
- printer health code
- last error code
- time of last successful test
- compatibility manifest revision

Then show an actionable user message such as:
- Paper is out. Insert paper and retry.
- Printer is offline. Check power/network.
- Permission is required. Tap Connect.
- This USB printer requires Palta Device Bridge.
- Palta cannot confirm whether the last receipt printed. Check the printer before reprinting.

Do not expose stack traces or protocol names to normal merchants.

## 11. Compatibility updates

Keep two update channels separate:

### Data compatibility manifest
Can be updated frequently from Palta-controlled CDN/R2:
- manufacturer/model match
- supported transports
- adapter key
- paper widths
- known firmware notes
- support tier

The manifest is data only and cannot execute code.

### Adapter/Bridge code
Distributed through normal signed app/bridge releases and CI. Vendor SDK changes are regression-tested before release.

This lets Palta add a newly verified model without shipping a whole application update when no code change is required.

## 12. Maintenance-cost rules

- Prefer standards before vendor-specific SDKs.
- Prefer network/IPP where it removes driver complexity.
- Add vendor SDK only when it provides material POS capability or reliability.
- Do not promise support for a model only because it resembles ESC-POS/ZPL hardware.
- Every certified combination records model + firmware + transport + platform + adapter version.
- Keep the recommended new-purchase list intentionally small.
- Existing-hardware support is best effort by protocol family; certification is earned by test evidence.

## 13. Packaging concept

Palta should eventually offer simple setup bundles rather than dozens of choices:

- **Mobile/No Printer** — digital receipt, optional portable printer later.
- **Small Store** — tablet/dedicated POS + one certified 80mm receipt printer.
- **Retail + Labels** — POS + receipt printer + certified label printer + barcode scanner.
- **Professional Counter** — PC/dedicated POS + high-volume receipt printer + drawer/scanner + optional customer display.

A merchant can still bring existing hardware. The package is a low-support recommended path, not a hardware lock-in.
