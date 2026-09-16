# Palta account/service matrix

The purpose of this matrix is to avoid signing up for everything at once.

| Service | Needed to start local development? | When to activate | Role |
|---|---|---|---|
| GitHub | Yes | First session | source, branch, CI |
| Node/npm | Yes | First session | local toolchain |
| Expo account / EAS | No for Core; yes for cloud/native build workflows | after Expo shell runs locally | mobile builds/updates |
| Cloudflare | No for first local UI | when first external API/Worker/R2 path is tested | edge API, cache, R2 |
| Supabase | No for reference screens | when Auth/DB vertical slice begins | Auth/Postgres candidate |
| Apple Developer | No for initial local/Core work | before iOS distribution/signing that requires it | iOS distribution |
| Google Play Console | No | before Android store release | Android distribution |
| Mercado Pago / PSP merchant developer setup | No | Commerce payment pilot | payment adapter |
| Other partner APIs | No | only when a vertical reaches integration stage | partner adapters |

## Rule

A missing optional provider account must produce `NOT CONNECTED`, not block unrelated local development.

Provider setup should happen only when its corresponding vertical reaches a testable slice.
