# Palta Brand Asset Binding
Checked against Drive: 2026-09-16

Source of Truth:
`Somos Palta / 00_Foundation / 01_Brand_Design_System / 01_Master_Brand_Mark / 02_CURRENT_DERIVATIVES`

Folder ID:
`1yM3jOtu1G1JjjyHM4l6I3Ts3R-OQ1sXx`

## Runtime assets to bind first

| Runtime use | Official derivative | Drive file ID |
|---|---|---|
| Compact header / small brand wordmark | `PALTA_WORDMARK_ONLY.png` | `1Kzvix0bN7WASsc6M492EWX2a_paR7xae` |
| Symbol / app small-space mark | `PALTA_SYMBOL_ONLY.png` | `1p68ImJPD--me9niJkj-ZJz3RdeU1RhDb` |
| Full brand introduction | `SOMOS_PALTA_FULL_MASTER_LOGO.png` | `11niuR3ww8l1_hPEzyNRULkEUZSFsfVze` |
| Horizontal brand lockup | `SOMOS_PALTA_HORIZONTAL_LOCKUP.png` | `14L60MPgmh6UPwwRxCfTwW1-Cy_csSwWN` |
| Tagline only | `TU_VIDA_MAS_CERCA_TAGLINE_ONLY.png` | `1_LTNGnB5GKPhjCziEqI3Fa0eK7iEwKf0` |
| Favicon 64 | `PALTA_FAVICON_64X64.png` | `1gQ6nNRca8xgXBU6J5TSNkWz1wItRdqKH` |

## Rules

- Do not recreate logo text with HTML/CSS/React Native text.
- Do not redraw the symbol in code.
- Copy only official current derivatives into the repository at bootstrap.
- The Drive folder remains the canonical master.
- The app repository contains runtime copies, not a competing brand master.
- If Drive master changes, update the runtime copies through an explicit asset-update change.

## Color / typography status

Do **not** freeze a Palta brand color token from visual sampling.

The active Brand Master still lists:
- color-code finalization
- light/dark variants
- minimum-size/clear-space rules
- app icon/splash/header specs

as remaining brand work.

Therefore the scaffold defines semantic token interfaces only.
Actual brand values must be injected after the design system freezes them.

## Mobile asset mapping target

At repository bootstrap:

```text
assets/
  brand/
    palta-symbol.png
    palta-wordmark.png
    somos-palta-full.png
    somos-palta-horizontal.png
```

These files are runtime derivatives. Their names may be app-friendly, but their bytes must originate from the official current derivatives above.
