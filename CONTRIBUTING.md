# Development Workflow and Coding Standards

## Branching (GitHub Flow with a development branch)
```
main          stable, tagged releases only (v0.1.0, v0.2.0 …)
develop       integration branch; always passes tests
feature/*     one feature per branch, e.g. feature/question-model
fix/*         bug fixes
```
1. `git switch develop && git pull`
2. `git switch -c feature/question-model`
3. Commit small, working steps.
4. Push and open a pull request into `develop`. Tests and lint must pass before merging.
5. When a version is complete, merge `develop` into `main` and tag it: `git tag v0.1.0 && git push --tags`.

## Commit messages
Format: `type: short imperative summary` (≤ 72 characters).

| Type | Use for |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `test` | Adding or changing tests |
| `docs` | Documentation |
| `refactor` | Code change with no behaviour change |
| `chore` | Tooling, config, dependencies |

Examples: `feat: add Leitner box scheduler`, `fix: reject question packs with duplicate ids`.

## Coding standards
- JavaScript ES modules; one main responsibility per file.
- `camelCase` for variables and functions, `PascalCase` for classes, `UPPER_SNAKE_CASE` for constants,
  `kebab-case` for content files.
- Meaningful names; no single-letter names except loop indices.
- Document public functions with JSDoc (`@param`, `@returns`).
- Comments explain *why*, not *what*.
- No global mutable state; pass data between functions.
- Validate all external data (question packs, save files) before use.
- Domain code in `src/revision/`, `src/progression/`, `src/persistence/` must not import rendering code.
- Every domain function gets unit tests covering valid, boundary and erroneous data.
- Run `npm test` and `npm run lint` before every commit.
