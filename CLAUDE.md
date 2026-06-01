# CLAUDE.md

See **[AGENTS.md](./AGENTS.md)** — the canonical contributor guide for this repo
(architecture, conventions, how to pick up tasks, secrets/safety).

Quick orientation:

- **`TASKS.md`** — the roadmap and source of truth for what to build, in what
  order, and which model tier to use per task.
- **`docs/architecture.md`** — the verified auth/data mechanism, live Firebase
  config, Firestore schema, and the T0.2 decision (use the Firebase JS SDK).

Toolchain: **TypeScript + oxc (oxlint + oxfmt) + Vitest** — not ESLint/Prettier/Jest.
Before committing run `npm run build`, `npm run lint`, `npm run format`, and
`npm test` (all must pass). See AGENTS.md → Toolchain for details.
