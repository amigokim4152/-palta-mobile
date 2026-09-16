# Local Preflight v3

Run at home from the repository or staging directory:

```bash
bash scripts/preflight-local.sh
```

It performs **read-only checks only**:
- git/node/npm/npx
- Wrangler CLI
- Supabase CLI
- current repo branch/HEAD/remotes/status
- `/Users/user/palta-data`
- engine/work/r2-backup
- visible PMTiles/GTFS/ZIP files
- Wrangler authentication
- Supabase authentication

It does not:
- commit
- push
- deploy
- create buckets
- create projects
- apply migrations
