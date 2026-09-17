# Specification Alignment

**Source:** Pearson, *T Level Technical Qualification in Digital Software Development (Level 3)*,
qualification number 610/5801/4, specification version 1.0 (May 2025), first teaching September 2025.

Machine-readable topic map: [`content/spec/spec-map.json`](../content/spec/spec-map.json).
Every question in the game must reference a section id from that file (e.g. `2.8`, `8.3`, `ESP.2`).

## 1. Assessment structure

| Component | Content | Assessment | Weighting |
|---|---|---|---|
| Core Paper 1 | CA1 Problem solving, CA2 Introduction to programming, CA3 Emerging issues, CA4 Legislation and regulatory requirements | Written exam, 2h 15m, 90 marks | 30% of core |
| Core Paper 2 | CA5 Business context, CA6 Data, CA7 Digital environments, CA8 Security | Written exam, 2h 15m, 90 marks | 30% of core |
| Employer Set Project | Pre-task + Tasks 1, 2, 3, 4a, 4b | Supervised project, 14h 30m, 100 marks, no internet, no AI | 40% of core |
| Occupational Specialism | OS content areas 1–8 | Project, 50h 30m, 144 marks | 50% of the whole TQ |

Core = 50% of the TQ; Occupational Specialism = 50%.

## 2. Corrections to the original game design

The original design brief listed topics before the spec was available. Checked against the spec:

| Original assumption | What the spec says | Design change |
|---|---|---|
| Stacks/queues (FIFO) questions | Core data structures are only **list, array, dictionary** (2.3.1) | Remove stack/queue from core question pools |
| SQL and normalisation in Core Paper 1/2 | Not in core exam content. SQL appears in OS 6.1/6.3; normalisation to 3NF in OS 4.3 | Move to Occupational Specialism content |
| Big O / complexity questions | "best, worst and average case… using logical reasoning (**Big O not required**)" (2.11.5) | Ask about comparisons, memory and execution time in words, never Big O notation |
| Recursion, OOP, inheritance in core | Only in OS 4.1 (design approaches) | Occupational Specialism content |
| "Black-box / white-box testing" | Spec uses **closed box / open box** (2.12.2.1) | Use spec terminology, mention the alternative names in explanations |
| Networking & security in the "Core 2" map | Correct: CA7 and CA8 are Paper 2 | Keep |
| Testing in "Core 2" | Testing is **2.12, Paper 1** | Move to Core 1 map |
| Questions are mostly multiple choice | Exams use **short, medium and extended open response** items; AO2 (apply to a context) is ~43% of each paper | See section 3 |

## 3. Implications for the question system

1. **Multiple choice is for recall only.** It suits quick objectives (doors, pickups) but does not
   match the exam. Terminals and boss rounds must include open-response questions using the spec's
   command words: *state, identify, describe, explain, explain with additional justification,
   discuss, evaluate, write, draw, complete*.
2. **Open responses are self-marked against mark points.** After typing an answer, the player sees an
   indicative mark-point checklist and ticks what they covered. This records honest partial credit
   without pretending the game can mark free text perfectly.
3. **Scenario-based application (AO2).** Most Paper 1/2 questions should be set in a short business
   context, not asked as bare definitions.
4. **Code is Python 3.10+.** Only use commands listed in Appendix 2 for core questions
   (e.g. `match/case`, `elif`, `range()`, string methods, `open()/readline()`, `datetime`).
5. **Test data vocabulary differs by component:**
   - Core Paper 1 (2.12.4.1): valid, invalid, boundary, erroneous.
   - ESP Task 2 and OS 7.3: valid, valid extreme, invalid, invalid extreme, erroneous.
   Questions must be tagged with the component so the correct vocabulary is used.

## 4. Items to check with a teacher

| Spec reference | Issue |
|---|---|
| 4.1.3 | Spec says Data Protection Act/GDPR "**eight** principles". UK GDPR sets out seven principles; eight was the Data Protection Act 1998. Confirm which list the exam expects before writing verified questions. |
| 7.3.8 | Spec names the fourth TCP/IP layer "network layer" (often called network access/link layer elsewhere). Use the spec's name in verified questions. |

## 5. Employer Set Project evidence supplied

The past paper supplied (Elanp Air, November 2022, paper reference 19538) is from the **predecessor
qualification** (Digital Production, Design and Development, 603/5832/4). The task structure matches the
new specification's ESP (pre-task, Tasks 1, 2, 3, 4a, 4b), so it is useful practice, but it must be
labelled as a **legacy past paper** in the game.

Lead examiner report (Autumn 2022) weaknesses to target in the ESP map:

| Task | Common weakness | Game practice idea |
|---|---|---|
| 1 | Rationale only describes the plan; cost plan multiplies total hours by every rate; ignores current outgoings and multi-year revenue | "Justify this decision" challenges; per-person cost calculations; 3-year profit/loss calculations |
| 1 | Test plans scheduled after testing; all testing at the end | Order-the-Gantt-tasks challenges with dependency rules |
| 2 | Confusing invalid vs erroneous data; no extreme/boundary tests (e.g. 29/30/31 days) | Classify-the-test-data drills; boundary hunts |
| 2 | Only fixing errors the IDE highlights | Logic-error debugging (wrong operator, off-by-one range, wrong field) |
| 4a | Weak pandas/Matplotlib; adding a login screen as "security" | pandas read/filter/sum/plot drills; secure-coding questions (local variables, error handling, no data in error messages) |
| 4b | Descriptive, not evaluative | Evaluate-against-requirements writing prompts with mark-point self-assessment |

## 6. Content provenance labels

| Label | Meaning |
|---|---|
| `verified` | Directly supported by the spec text or a supplied official document, with a reference |
| `generated` | Written for practice; aligned to a spec section but not an official question |
| `legacy-past-paper` | Derived from a supplied past paper for the predecessor qualification |
| `user` | Added by the player |

Past papers and mark schemes are Pearson copyright. They stay in `source-material/` (git-ignored) and are
never committed to a public repository.
