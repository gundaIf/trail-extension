# Trail: Track your trail

A privacy-first Chrome extension that tracks **active-tab time** across focused
Chrome windows and shows the trail it left — a handmade presence thread, a
minute lattice, ranked places, and a visit journal.

**All data stays on your device** (`chrome.storage.local`). Nothing is ever sent anywhere.

> Open `dashboard.html` directly to preview the observatory with sample data,
> without installing.

## Install (unpacked)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top-right)
3. Click **Load unpacked** and select this `trail-extension` folder
4. Pin the Trail icon, browse normally for a bit, then click it → **Open the observatory**

If you already have Trail loaded, click **Reload** on the extension card after pulling this version.

## How tracking works

Unchanged from 1.0:

- Counts time only for the **active tab in the focused window**.
- Pauses automatically when you're **idle** (60s), the window loses focus, the
  screen locks, or you're on a `chrome://` / non-web page.
- Time is stored in **per-minute buckets** per site, kept for ~3 days.
- A 1-minute alarm + a 5-minute per-flush cap keep long sessions accurate and
  guard against overcounting after sleep.

## Observatory

The dashboard is an instrument, not a card layout.

| Surface | What it shows |
|---|---|
| **The thread** | Presence over time. Thickness = seconds in that minute. Colour = category. |
| **Present / idle** | Clock time vs observed active-tab time, vs the previous range. |
| **Places** | Ranked hosts with ink bars. Click a place to isolate it on the thread. |
| **Minute lattice** | One cell per minute, from first presence. |
| **Pigment** | Category share as a stacked ribbon. |
| **Journal** | Visits in chronological order, newest first. Nearby stays on the same host merge (8-minute gap). |

Themes: **Ink** / **Paper** / **System**. Ranges: last hour, last 3 hours, today.
Sub-minute visits show as seconds — never rounded to “0 min”.

## Files

| File | Role |
|------|------|
| `manifest.json` | MV3 config, permissions (`tabs`, `storage`, `idle`, `alarms`) |
| `background.js` | Service worker — the tracking engine |
| `dashboard.html/css/js` | Observatory UI (SVG thread, no libraries) |
| `trail-lib.js` | Categories, aggregation, demo data, formatting |
| `popup.html/css/js` | Toolbar popup — last-hour summary |
| `generate-icons.js` | Regenerates the hand-drawn spiral logo (`node generate-icons.js`) |

## Customize

- **Categories:** edit the `RULES` array in `trail-lib.js`.
- **History length / idle threshold:** constants at the top of `background.js`.
- **Colors / themes:** the `:root` token blocks at the top of `dashboard.css`.
  Theme choice is remembered in `localStorage['trail-theme']` (`ink` / `paper` / `system`).
  Older `dark` / `default` values migrate automatically.

Opening `dashboard.html` outside the extension shows **demo data** so you can
preview the design without installing.

## License

[MIT](LICENSE) © 2026 Deen David
