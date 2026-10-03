# EXECUTE / ESCAPE

Minimal offline-first PWA for recording two choices: EXECUTE and ESCAPE.

## Included
- Clean light Blue × Red design
- Home screen with today's counts
- 3-second long press for EXECUTE / ESCAPE
- Today-only decrement controls in Settings
- Cumulative COUNT screen with percentage bars
- IndexedDB local persistence
- Offline PWA service worker
- Delete-all-data confirmation
- Responsive mobile-first layout

## Run locally
Use any static server, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

A service worker generally requires HTTPS or localhost.
