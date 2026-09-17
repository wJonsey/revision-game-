# Test Report — v0.9 full build (2026-09-17)

## 1. Automated unit and integration tests (Vitest)
Command: `npm test` — **13 files, 141 tests, all passing.**

| File | What it proves |
|---|---|
| `content.test.js` | All 3 packs pass schema validation; unique ids; every content area covered; incidents valid; **every predict-the-output answer matches real `python3` output (25 questions)** |
| `answerChecker.test.js` | Marking for all 7 question types, including whitespace/line-ending normalisation, partial credit, erroneous responses |
| `leitner.test.js` | Box promotion/demotion, guesses don't promote, mastered cap, due-time boundary |
| `adaptive.test.js` | Weakness score rises with mistakes, slowness and staleness; **weak sections picked >65% of 1,000 seeded selections**; no repeats; mastered questions rarely repeat; harder questions for strong sections |
| `progression.test.js` | XP rules (no XP for wrong, ½ for guesses, ¼ for repeats), bonus boundaries 70%/90%, rank and level boundaries, streak increment/reset |
| `persistence.test.js` | Save round-trip, blocked storage falls back to memory, corrupt data handled, attempt cap, import validation rejects bad files |
| `matchSession.test.js` | Doors/terminals/defuse effects, door override, wrong answers never crash the player, shield cap, ultimate charging, class passive, full match completion recorded |
| `services.test.js` | Invalid packs rejected whole, exam coverage of all areas, analysis never mentions pass/grade, daily set stable all day, weekly rotation, date boundaries, console commands |
| `maps.test.js` | All maps enclosed, one spawn/core, every objective reachable, doors between floors, every zone has questions |
| `router.test.js`, `eventBus.test.js`, `capabilities.test.js`, `specMap.test.js` | Navigation, cleanup, event delivery, capability detection, spec map integrity |

## 2. System tests (automated headless Chromium, Playwright)
| Test | Expected | Actual |
|---|---|---|
| Main menu loads | 10 menu items, no console errors | Pass |
| Practice Range, 5 mixed questions incl. written answer | Feedback after each, results summary, revise-next list | Pass |
| Revision console `scan topic programming` | Accuracy, weak section, recommended difficulty | Pass |
| Statistics | 7 charts with table views | Pass |
| Exam Simulation short paper | 25 questions / 30 marks, analysis screen | Pass |
| Daily Deployment | 10 questions then completion + bonus | Pass |
| Terminal Ops quick match | Only spawn zone unlocked at start; 3 rounds incl. boss; operation report | Pass |
| 3D match (WebGL via SwiftShader) | Briefing, movement, HUD, minimap; 4 terminal questions → round summary → round 2 | Pass |
| Progress saved | XP present in localStorage after session | Pass |

## 3. Defects found and fixed during testing
| # | Defect | Found by | Fix |
|---|---|---|---|
| 1 | Router recorded the wrong current screen if a screen navigated while rendering | Unit test | Set current screen before rendering |
| 2 | Shield clamp allowed wrong answers to reduce shield to 0 in an edge case | Code review | Simplified clamp: wrong answers stop at 1 |
| 3 | Zone filtering read a non-existent `areaId` on questions, so zones ignored topics | Code review | Look up area from spec section |
| 4 | Terminal Ops showed the same door in two zones | Code review | Doors listed once, in the reachable zone, labelled with destination |
| 5 | Statistics page printed "null" | Screenshot review | Render empty string instead of null |
| 6 | Consistency heatmap drawn oversized | Screenshot review | Max width on calendar chart |
| 7 | **Camera jumped (pitch 0.6 rad) when pointer lock engaged** | Camera state inspection in browser test | Ignore mouse input for 150 ms after lock changes and discard implausible single movements |
| 8 | Weapon model filled a third of the screen | Screenshot review | Scaled and repositioned model |

## 4. Not yet tested (requires a person / real hardware)
- Performance (NFR1 ≥30 FPS) and load time on a **real school PC** — headless tests use a software renderer.
- Pointer lock and storage policies on the school network (run Settings → System check).
- Controller support with a physical gamepad.
- Usability testing with other students; screen reader testing.
- **Educational accuracy review by a teacher** — especially items flagged in `spec-alignment.md` §4 (GDPR principles count, TCP/IP layer naming).
