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

## Note — we deviate from the Python reference; verify features ourselves

The Python projects (`Woyken/py-huckleberry-api`, `bckenstler/py-huckleberry-mcp`)
are a **reference for leads, not a spec to copy**. They are themselves
reverse-engineered and can be wrong, incomplete, or stale, and we have
intentionally diverged (oxc/Vitest toolchain, lenient read models, a different
tool surface, no active-session timers).

**For any new feature, verify the real Huckleberry/Firestore behavior ourselves
before trusting it** — don't port a write shape or field name on the Python
project's word. The loop:

1. Do the action in the official Huckleberry app.
2. Inspect the resulting Firestore document(s) — `npm run inspect:schema`.
3. Build the Zod model + op to the **observed** shape (not the Python one).
4. Prove it with a gated live round-trip (`HUCKLEBERRY_ALLOW_WRITES=1`).

Where the real backend disagrees with the Python port, **follow the backend.**
See **`docs/discovery-plan.md`** for how we map the full API/Firestore surface,
and **`TASKS.md` → B5** for a known live-confirmed deviation (solids food
tracking: the Python `log_solids` stores `foods`/`reactions` and a different
custom-food doc shape than we currently write).
