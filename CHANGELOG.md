# Changelog

All notable changes to Trail are documented here.

## [Unreleased]

## [1.1.1] - 2026-09-06

### Changed

- Release zip is smaller. About 24% lighter. Trimmed non-runtime files (`generate-icons.js`, `docs/`, `icons/logo.svg`, `CHANGELOG.md`) from the packaged bundle. Chrome never loaded these; the installed extension is identical.
- Copy: no em dashes in product UI, comments, or docs.

## [1.1.0] - 2026-09-04

### Observatory

The dashboard is an instrument, not a card layout. Tracking, storage, and the popup are the same as 1.0.

- **The thread**: SVG presence ribbon. Thickness is seconds in that minute, colour is category. Hover for a tooltip; click a place to isolate it.
- **Minute lattice**: one cell per minute from first presence. Leading idle is cropped.
- **Places**: ranked hosts with ink bars and letter seals.
- **Pigment**: category share as a stacked ribbon (the donut is gone).
- **Journal**: chronological visits, newest first. Nearby stays on the same host merge across an 8-minute gap.
- **Narrative headline**: “A morning of making.” instead of a KPI stack.
- **Themes**: Ink / Paper / System. Grain, vignette, Instrument Serif + Sans. Older `dark` / `default` values migrate.
- **Durations**: sub-minute visits render as seconds. Never “0 min”.
- **Demo mode**: opening `dashboard.html` outside the extension shows a scripted sample morning.

### Changed

- Manifest version `1.0.0` → `1.1.0`.
- Popup restyled to match the observatory (Ink/Paper, “Open the observatory”).
- Shared aggregation, categories, and copy live in `trail-lib.js`.

## [1.0.0] - 2026-09-03

First public release.

- Active-tab time tracking that pauses on idle, window blur, and lock.
- Dashboard: places list, time-over-hour chart, category donut.
- Last hour / last 3 hours / today.
- Dark / Default / System themes.
- Hand-drawn spiral logo. Zero dependencies. 100% local.

[1.1.1]: https://github.com/gundaIf/trail-extension/releases/tag/v1.1.1
[1.1.0]: https://github.com/gundaIf/trail-extension/releases/tag/v1.1.0
[1.0.0]: https://github.com/gundaIf/trail-extension/releases/tag/v1.0.0
