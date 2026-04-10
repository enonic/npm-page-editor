**@enonic/page-editor** adds page editing capability for externally rendered sites in Enonic XP. Stack: TypeScript, jQuery (legacy), Preact/TSX (new UI), LESS + Tailwind, Vite, Gradle. Published as an npm package.

## Commands

After making changes, run `pnpm check` to verify nothing is broken. If linting fails, run `pnpm fix` to auto-fix before re-checking.

```bash
pnpm check            # typecheck + lint (default verification)
pnpm check:types      # typecheck only
pnpm check:lint       # lint only
pnpm fix              # autofix lint issues
pnpm build:dev        # dev build (JS + CSS)
pnpm build:prod       # production build (JS + CSS)
pnpm build-storybook  # build Storybook
./gradlew build -Penv=dev  # full Gradle build (JS + CSS + Gradle tasks)
./gradlew yolo        # fast Gradle build (skip install, check, test)
```

**Do not run autonomously** (interactive / long-running — only if explicitly asked):
- `pnpm storybook` — dev server, runs until stopped

Only run `./gradlew build -Penv=dev` when the task specifically requires testing the Gradle build. For most changes, `pnpm check` is sufficient.

## Code Structure

- **Legacy** (current codebase): `src/main/resources/assets/js/` — class-based, jQuery, LESS styling
- **New UI** (migration target): Preact/TSX, `@enonic/ui`, Tailwind — isolated inside Shadow DOM
- **Styles**: `src/main/resources/assets/css/` — LESS, global stylesheet

New Preact surfaces must be rendered inside a Shadow DOM boundary to prevent style leakage between editor chrome and the edited page. See `docs/page-editor-preact-migration.md` for migration strategy.

## Git & GitHub

No conventional commit prefixes. Plain descriptive language throughout.

### Issues

Unless asked for specific format by the user, use the default one:

- **Title**: plain descriptive text — e.g. `Add MyComponent to browse view`, `PublishDialog: add schedule button`
- **Body**: concisely explain what and why, skip trivial details
  ```
  <4–8 sentence description: what, what's affected, how to reproduce, impact>

  #### Rationale
  <why this needs to be fixed or implemented>

  #### References        ← optional
  #### Implementation Notes  ← optional

  <sub>*Drafted with AI assistance*</sub>
  ```

### Commits

- **With issue**: use `<Issue Title> #<number>` — e.g. issue `Do fix` #10 becomes `Do fix #10`
- **Without issue**: capitalized plain-English description — e.g. `Add local Git worktrees ignore`, `Fix build`
- **Body** (optional): past tense, one line per change, 2–6 lines, backticks for code refs

### Pull Requests

- **Title**: use the exact same pattern as the commit title when linked to an issue (`<Issue Title> #<number>`)
- **Commit/PR title pair example**: issue `Do fix` #10 → commit `Do fix #10`, PR `Do fix #10`
- **Body**: concisely explain what and why, skip trivial details. No emojis. Separate all sections with one blank line.
  ```
  <summary of changes>

  Closes #<number>

  [Claude Code session](<link>)  ← optional

  <sub>*Drafted with AI assistance*</sub>
  ```
