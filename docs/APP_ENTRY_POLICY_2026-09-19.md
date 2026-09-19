# Mobile entry policy · 2026-09-19

| Build / mode | Default entry | Auth access |
| --- | --- | --- |
| Development (`__DEV__`, nonproduction) | Inicio | `Auth QA` action on Inicio opens `/dev/auth`; `test:golden:ios` sets `EXPO_PUBLIC_PALTA_ENTRY_MODE=auth_qa` to start at AuthGate. |
| Preview release (`EXPO_PUBLIC_ENV=preview` **and** `EXPO_PUBLIC_PALTA_PREVIEW=1`) | Inicio | `/dev/auth` remains available from Inicio. |
| Production (`EXPO_PUBLIC_ENV=production`) | AuthGate | Session restoration, sign-in and sign-out remain required. Preview and entry-mode flags cannot bypass the gate. |

Other nondevelopment release configurations require AuthGate. The entry decision is tested in `tests/app-entry-policy-tests.ts` and called by the composed root layout. The existing AuthRuntimeProvider continues session restoration in all modes. Development app entry does not count as Apple, Google, or Email Golden User Gate 01 E2E validation.

Simulator five-tab interaction remains a separate runtime check: Inicio → Negocios → Comunidad → Mercado → Panorama. Record loading/error/empty states, actions, detail and back navigation, localization and layout from the installed build; a source or bundle pass does not establish interactive success.
