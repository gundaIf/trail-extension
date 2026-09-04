# Trail (Chrome extension)

Privacy-first MV3 extension. Tracks active-tab time on-device. Dashboard is a handmade observatory.

## Do not break

- `background.js` is the tracker. Do not add network, accounts, or remote storage.
- Data shape: `buckets[minute][host] = seconds`, `meta[host] = { title, favicon }`.
- Dashboard must work two ways:
  1. As `chrome-extension://…/dashboard.html` reading `chrome.storage.local`
  2. As a plain `dashboard.html` file (demo data, no Chrome APIs)
- Keep `niceName()` / SLD suffix handling so `deeeen.xyz` shows **Deeeen**, not **Xyz**.
- Sub-minute time must never round to “0 min”.
- Load unpacked — no build step. Vanilla HTML/CSS/JS only.

## Design

Instrument, not SaaS. Ink (`#12100e`) / Paper (`#e9e3d6`) / clay (`#c96a45`).
The thread is the hero (thickness = presence, colour = category). Do not put a
generic line chart or donut back as the primary viz.

## Files

- `background.js` — service worker
- `dashboard.*` — observatory
- `popup.*` — last-hour toolbar
- `generate-icons.js` — spiral PNG/SVG (`node generate-icons.js`)
