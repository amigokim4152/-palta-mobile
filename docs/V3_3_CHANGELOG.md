# v3.3 Changelog — 2026-09-16

Added safe at-home execution tooling:
- repository safety gate
- Expo mobile bootstrap script
- integration readiness verifier
- local data asset inventory script
- deterministic at-home execution order

All write-capable scripts refuse `main/master`.
No script commits, pushes, deploys, creates Cloudflare resources or applies DB migrations automatically.
