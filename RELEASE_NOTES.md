**Trail** tracks your active-tab time across focused Chrome windows and shows the trail it left — all data stays on your device (`chrome.storage.local`). Nothing is ever sent anywhere.

This is the **Observatory** release. Same tracker as 1.0. New lens.

### Install
1. Download **`trail-extension-v1.1.0.zip`** below and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the unzipped **`trail-extension`** folder.
4. Pin the Trail icon, browse for a bit, then click it → **Open the observatory**.

Already on 1.0? Reload the extension card after swapping the folder. Your existing on-device log is unchanged.

Works in any Chromium browser (Chrome, Brave, Edge, Arc).

Open `dashboard.html` directly to preview with sample data, without installing.

### What’s new
- **The thread** — presence over time. Thickness = seconds in that minute. Colour = category.
- **Minute lattice** — one cell per minute, from first presence.
- **Places** — ranked hosts with ink bars and letter seals. Click to isolate on the thread.
- **Pigment** — category share as a stacked ribbon, not a donut.
- **Journal** — visits in order, newest first. Nearby stays on the same host merge (8-minute gap).
- **Ink / Paper / System** themes. Grain. Serif narrative headlines.
- Sub-minute visits show as seconds — never rounded to “0 min”.

Tracking, idle pause, 3-day local history, and the 5-minute flush cap are unchanged from 1.0.
