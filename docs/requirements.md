# Requirements Specification

Status: implemented in full build, 2026-09-17. FR1–FR14 are implemented; NFR1–NFR2 still need measuring on a school PC (see test-report.md).

## 1. Purpose
CODE//BREACH is a single-player, browser-based tactical shooter in which revision questions aligned to the
T Level Technical Qualification in Digital Software Development control gameplay progress. See
[spec-alignment.md](spec-alignment.md).

## 2. Stakeholders
| Stakeholder | Interest |
|---|---|
| Student (primary user and developer) | Revise effectively; portfolio evidence |
| Teacher | Accuracy of content; possible future class use |
| School IT | Software must run within a locked-down school browser |

## 3. Constraints
| ID | Constraint | Source |
|---|---|---|
| C1 | Must run in a web browser on school PCs; no installation | User |
| C2 | Development happens in GitHub Codespaces (browser) | Environment |
| C3 | Browser storage may be wiped at logout on school PCs | Typical school profile policy — to verify |
| C4 | WebGL, pointer lock or CDNs may be blocked by school IT | To verify with the system-check spike |
| C5 | Core code examples must be Python 3.10+ using Appendix 2 commands | Spec |
| C6 | Past papers and mark schemes must not be published | Copyright |

## 4. Functional requirements (MVP)
| ID | Requirement | Priority |
|---|---|---|
| FR1 | Show a main menu and a system-check screen reporting browser capabilities | Must |
| FR2 | Load question packs from JSON and reject packs that fail schema validation | Must |
| FR3 | Every question references a section id in `spec-map.json` and a provenance label | Must |
| FR4 | Support multiple choice, true/false, predict-the-output and open response with mark-point self-assessment | Must |
| FR5 | Record every attempt: question id, answer, correct/marks, response time, timestamp | Must |
| FR6 | Schedule questions with Leitner boxes (New, Learning, Familiar, Strong, Mastered) | Must |
| FR7 | Weight question selection towards weak spec sections | Must |
| FR8 | Show feedback after every wrong answer: correct answer, explanation, common mistake | Must |
| FR9 | First-person movement, one weapon, drone enemies on one small map | Must |
| FR10 | Doors/terminals/defuse objectives trigger questions | Must |
| FR11 | Award XP scaled by accuracy; show fictional ranks | Should |
| FR12 | Save progress in the browser **and** export/import a save file (JSON) | Must (because of C3) |
| FR13 | Statistics screen: accuracy by spec section, weakest sections | Must |
| FR14 | "Terminal mode": play revision objectives without 3D if WebGL is unavailable | Should (because of C4) |

## 5. Non-functional requirements
| ID | Requirement | Measure |
|---|---|---|
| NFR1 | Performance on school PCs | ≥ 30 FPS on integrated graphics at 1080p on the MVP map |
| NFR2 | Load time | First playable screen in < 5 s on a school network |
| NFR3 | No external runtime requests | All assets bundled; works if CDNs are blocked |
| NFR4 | Accessibility | Keyboard-operable menus; adjustable text size; colour not the only indicator of state |
| NFR5 | Robustness | Invalid save files or question packs show a clear message and never crash the game |
| NFR6 | Maintainability | Domain logic (revision engine) has no dependency on rendering code; unit test coverage for all domain modules |
