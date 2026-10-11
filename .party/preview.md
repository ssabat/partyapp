# Preview

This repository is a static site. No install step and no background services.

From the repository root, serve it on localhost only:

```bash
python3 -m http.server "$PORT" --bind 127.0.0.1
```

Open `/audit.html` for the Audit Report page. The report reads `data/applicants.json` from that same origin.

Verify with `node --test` before relying on the figures.
