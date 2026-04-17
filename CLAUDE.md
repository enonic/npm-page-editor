**@enonic/page-editor** adds page editing capability for externally rendered sites in Enonic XP. Stack: Preact/TSX + Tailwind + `@enonic/ui`, bundled with Vite (via `vite-plus`), type-checked with `tsgo`. Published as an npm package.

## Commands

After making changes, run `pnpm fix` to auto-fix lint/format issues and typecheck in one go.

```bash
pnpm fix              # vp check --fix + typecheck
pnpm check            # vp check (lint + format, read-only)
pnpm typecheck        # tsgo --noEmit
pnpm test             # vitest run
pnpm build            # clean + JS lib build + CSS build
pnpm build:storybook  # build Storybook
```

**Do not run autonomously** (interactive / long-running — only if explicitly asked):

- `pnpm storybook` — dev server, runs until stopped

## Code Structure

- `src/` — Preact/TSX source. Editor UI is rendered inside a Shadow DOM (`src/rendering/overlay-host.ts`) to prevent style leakage between editor chrome and the edited page.
- `src/rendering/editor-ui.css` — Shadow-DOM stylesheet; loaded via `?inline` + `adoptedStyleSheets` in `inject-styles.ts`. OpenSans fonts inline as data URIs at build time.
- `src/assets/fonts/` — bundled OpenSans woff2 files (referenced by `editor-ui.css`).
- `dist/` — published package output (`index.js`, `index.cjs`, `types/index.d.ts`, `main.css`).

See `docs/prd.md` for the target architecture and `docs/SPEC-v2.md` for the v2 design.

## Documentation

All docs live in `docs/`, flat structure. Lowercase kebab-case filenames, no date or number prefixes. Add subdirectories (`design/`, `decisions/`) only when file count makes flat navigation painful. `prd.md` is the product requirements document; other files are technical specs named by topic (e.g., `parser.md`, `persistence.md`).

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
