# Risk Log

Likelihood and impact: 1 (low) to 3 (high). Score = likelihood × impact.

| ID | Risk | L | I | Score | Mitigation | Status |
|---|---|---|---|---|---|---|
| R1 | School PC browser blocks WebGL, so the 3D game cannot run | 2 | 3 | 6 | System-check spike in v0.1a; revision engine built independently of 3D; terminal-mode fallback (FR14) | Open — run spike on a school PC |
| R2 | Browser storage wiped at logout, losing progress | 3 | 3 | 9 | Export/import save file in MVP (FR12); later cloud save | Open |
| R3 | School network blocks CDNs or Codespaces | 2 | 3 | 6 | Bundle all dependencies with Vite; test Codespaces access from school early | Open |
| R4 | Inaccurate revision content teaches wrong answers | 2 | 3 | 6 | Spec references on every question; provenance labels; teacher review of verified questions | Open |
| R5 | Scope creep (three maps, classes, bosses) delays a playable build | 3 | 2 | 6 | Strict MVP; revision engine before 3D; time-boxed phases | Open |
| R6 | Copyrighted past-paper content published on GitHub | 2 | 2 | 4 | `source-material/` git-ignored; only paraphrased, referenced questions committed | Mitigated |
| R7 | Game time replaces revision time before exams | 2 | 3 | 6 | Build revision engine and practice range first so the tool is useful early | Open |
| R8 | Codespaces monthly usage allowance runs out | 2 | 2 | 4 | Stop codespaces when not in use; check GitHub billing page | Open |
