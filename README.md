# CODE//BREACH

A browser-based tactical revision shooter for the **T Level Technical Qualification in Digital Software
Development** (Pearson, 610/5801/4). Revision questions aligned to the specification control doors,
terminals and objectives; an adaptive engine brings weak topics back more often.

> Ranks and content in this game are for revision practice only. Generated questions are clearly labelled
> and are not official exam questions.

## Getting started
```bash
npm install
npm run dev      # start the dev server (open the forwarded port in the browser)
npm test         # run unit tests
npm run lint     # static analysis
npm run build    # production build in dist/
```

## Project structure
```
content/spec/     specification topic map (every question references this)
src/core/         event bus, browser capability checks
tests/unit/       Vitest unit tests
docs/             requirements, spec alignment, risk log, project log
source-material/  your PDFs and past papers (git-ignored, never committed)
```

## Documentation
- [Specification alignment](docs/spec-alignment.md)
- [Requirements](docs/requirements.md)
- [Risk log](docs/risk-log.md)
- [Project log](docs/project-log.md)
- [Workflow and coding standards](CONTRIBUTING.md)
