**Trail** tracks your active-tab time across focused Chrome windows and shows the trail it left. All data stays on your device (`chrome.storage.local`). Nothing is ever sent anywhere.

A small maintenance release. The installed extension behaves identically to 1.1.0. The download is about 24% lighter.

### Install
1. Download **`trail-extension-v1.1.1.zip`** below and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the unzipped **`trail-extension`** folder.
4. Pin the Trail icon, browse for a bit, then click it → **Open the observatory**.

Already on 1.1.0? Reload the extension card after swapping the folder. Your existing on-device log is unchanged.

Works in any Chromium browser (Chrome, Brave, Edge, Arc).

Open `dashboard.html` directly to preview with sample data, without installing.

### What changed
- Release zip is trimmed to the files Chrome actually loads. Dev-only files (`generate-icons.js`), the GitHub README asset (`docs/hero.svg`), the unused `icons/logo.svg`, and `CHANGELOG.md` are no longer bundled.
- Result: about 24% smaller download, no functional change.

Tracking, idle pause, 3-day local history, and the 5-minute flush cap are unchanged.
