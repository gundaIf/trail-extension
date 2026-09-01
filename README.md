# Trail — Where your browser time went

A privacy-first Chrome extension that tracks **active-tab time** across your
focused Chrome windows and shows where your browser time actually goes —
places visited, a time-over-hour chart, and a category breakdown. Warm,
Anthropic-inspired palette with **Dark / Default / System** theme modes.

**All data stays on your device** (`chrome.storage.local`). Nothing is ever sent anywhere.

![Trail dashboard](docs/hero.svg)

> _Dashboard shown with demo data. Open `dashboard.html` directly to preview it without installing._

## Install (unpacked)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top-right)
3. Click **Load unpacked** and select this `trail-extension` folder
4. Pin the Trail icon, browse normally for a bit, then click it → **Open full dashboard**

## How tracking works

- Counts time only for the **active tab in the focused window**.
- Pauses automatically when you're **idle** (60s), the window loses focus, the
  screen locks, or you're on a `chrome://` / non-web page.
- Time is stored in **per-minute buckets** per site, kept for ~3 days.
- A 1-minute alarm + a 5-minute per-flush cap keep long sessions accurate and
  guard against overcounting after sleep.

## Files

| File | Role |
|------|------|
| `manifest.json` | MV3 config, permissions (`tabs`, `storage`, `idle`, `alarms`) |
| `background.js` | Service worker — the tracking engine |
| `dashboard.html/css/js` | Full dashboard (charts drawn on `<canvas>`, no libraries) |
| `popup.html/css/js` | Toolbar popup — last-hour summary |
| `generate-icons.js` | Regenerates the hand-drawn spiral logo — PNG icons + `logo.svg` (`node generate-icons.js`, no deps) |

## Customize

- **Categories:** edit the `RULES` array in `dashboard.js`.
- **History length / idle threshold:** constants at the top of `background.js`.
- **Colors / themes:** the `:root` theme-token blocks at the top of `dashboard.css`.
  Theme choice is remembered per-browser in `localStorage['trail-theme']`.

Opening `dashboard.html` outside the extension shows **demo data** so you can
preview the design without installing.

## License

[MIT](LICENSE) © 2026 Deen David
