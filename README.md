# CODE//BREACH

A browser-based tactical revision shooter for the **T Level Technical Qualification in Digital Software
Development** (Pearson, 610/5801/4). Revision questions aligned to the specification control doors,
terminals and objectives; an adaptive engine brings weak topics back more often.

> Ranks are fictional game progression. Generated questions are labelled as practice and are not official
> exam questions. Questions based on the supplied past paper are labelled as legacy (DPDD qualification).

## Run it
```bash
npm install
npm run dev      # open the forwarded port 5173
npm test         # 141 unit tests (content tests run every Python output question through python3)
npm run lint
npm run build    # static site in dist/ – can be hosted on GitHub Pages
```

## Modes
| Menu | What it does |
|---|---|
| Play | 3 operations (Core 1, Core 2, ESP) × Quick / Standard / Custom matches. **Deploy (3D)** first-person, or **Terminal Ops** with no graphics (same rules) for PCs without WebGL |
| Revision | Revision Memory (Leitner boxes, due, weak, strong, recently learned, mastered) + developer console (`scan topic data`, `weak`, `due`…) |
| Practice Range | Filter by operation, content area, section, difficulty, type; adaptive or random |
| Exam Simulation | Timed paper, no feedback until the end, self-marked written answers, analysis by content area (never predicts grades) |
| Daily Deployment | 10 questions/day mixing weak and due topics, 7-day calendar |
| Weekly Incident | Multi-step scenario that rotates each ISO week |
| Arsenal | 5 classes (passive/basic/tactical/ultimate), weapons, rank-unlocked cosmetic skins, revision focus |
| Profile | Rank, level, streak, **export/import save file**, import your own question packs (JSON template provided) |
| Statistics | Accuracy by area/difficulty, response time, streaks, accuracy/XP over time, consistency heatmap |
| Settings | Text size, high contrast, colour-blind palette, readable font, reduced motion, captions, volume, sensitivity, graphics, combat difficulty, controls (keyboard + controller) |

## Content
| Pack | Questions |
|---|---|
| `content/questions/core1.json` | 108 – CA1–CA4 (Paper 1) |
| `content/questions/core2.json` | 78 – CA5–CA8 (Paper 2) |
| `content/questions/esp.json` | 44 – ESP pre-task and Tasks 1–4b |
| `content/incidents/incidents.json` | 3 weekly incidents (23 steps) |

Types: multiple choice, true/false, predict the output (Python 3.10), fill the blank, ordering, matching and written answers self-marked against mark points with spec command words.

## Architecture
```
src/core/          event bus, seeded RNG, dates, browser capability checks
src/content/       spec index, question schema/validation, question bank
src/revision/      answer checking, Leitner scheduler, weakness score, adaptive selector,
                   revision service, stats, exam service, daily/weekly challenges, console
src/progression/   XP rules, ranks/levels, streaks
src/persistence/   save store (localStorage + export/import, validation, migration)
src/game/          classes, arsenal, match modes, MatchSession (all match rules, UI-independent)
src/maps/          ASCII maps, zones, pathfinding
src/game3d/        Three.js first-person layer (loaded only when a 3D match starts)
src/ui/            router, DOM helpers, components (questions, quiz runner, charts), screens
src/audio/         synthesised original sound effects with captions
src/settings/      accessibility settings
tests/unit/        Vitest tests
docs/              spec alignment, requirements, risk log, project log, test report
```
All rules live in pure, tested modules; the 3D layer and Terminal Ops both drive the same `MatchSession`.

## Documentation
- [Specification alignment](docs/spec-alignment.md)
- [Requirements](docs/requirements.md)
- [Test report](docs/test-report.md)
- [Risk log](docs/risk-log.md)
- [Project log](docs/project-log.md)
- [Workflow and coding standards](CONTRIBUTING.md)
