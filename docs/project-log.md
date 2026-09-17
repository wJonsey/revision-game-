# Project Log

## 2026-09-17 — v0.0 / v0.1a
- Received the Pearson specification (610/5801/4, v1.0) and a legacy ESP past paper with mark scheme and examiner report.
- Mapped the spec into `content/spec/spec-map.json`; recorded design corrections in `docs/spec-alignment.md`.
- Confirmed constraint: game must run in a browser on school PCs.
- Chose tech stack: JavaScript (ES modules) + Vite + Vitest + ESLint; Three.js to be added for 3D in v0.1d.
- Created project skeleton, event bus, browser capability spike, first unit tests.
- Next: run the system check on a school PC; then v0.1b question model and schema validation.

## 2026-09-17 — Clickable menu
- Issue: menu buttons were disabled placeholders, so nothing could be clicked.
- Added a screen router (`src/ui/router.js`) and a screen for every menu option with Back / Esc navigation.
- Testing: new unit test found a defect — if a screen navigated while rendering, `currentScreen` was overwritten with the old screen. Fixed by setting the current screen before rendering. 18/18 tests pass.
- User acceptance: all menu options confirmed working in the browser.

## 2026-09-17 — Full build ("build all of it")
- Built revision engine (Leitner spaced repetition, weakness score, adaptive selection), progression (XP, ranks, levels, streaks), save/export/import, statistics, exam simulation, daily deployment, weekly incident, developer console.
- Wrote 230 spec-referenced questions (Core 1: 108, Core 2: 78, ESP: 44) and 3 weekly incidents; all labelled generated or legacy-past-paper.
- Built 3 maps, 5 classes, 5 weapons, cosmetic skins, match modes (quick, standard, custom), boss rounds.
- Built 3D first-person layer (Three.js) and Terminal Ops fallback sharing the same match rules.
- Accessibility settings, captions for synthesised sounds, keyboard and controller controls.
- Testing: 141 unit tests; automated browser system tests of every mode; 8 defects found and fixed — see `docs/test-report.md`.
- Next: test on a school PC; teacher review of question accuracy; usability test with classmates.
