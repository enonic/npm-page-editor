**@enonic/page-editor** adds page editing capability for externally rendered sites in Enonic XP. Stack: TypeScript, Preact/TSX, nanostores, Tailwind + co-located CSS, built with vite-plus (Rolldown + oxlint/oxfmt) and tsgo. Published as a standalone pnpm package.

## Commands

After making changes, run `pnpm check` to verify nothing is broken (oxlint + oxfmt check + tsgo typecheck). If it reports formatting or autofixable lint issues, run `pnpm check:fix` before re-checking.

```bash
pnpm check            # oxlint + oxfmt check + tsgo typecheck (default verification)
pnpm check:fix        # autofix formatting + lint, then typecheck
pnpm typecheck        # tsgo typecheck only
pnpm lint             # oxlint only
pnpm format           # oxfmt (write changes)
pnpm test             # unit tests (vite-plus-test)
pnpm build            # production build to dist/ (clean + build:prod)
pnpm build:dev        # development build
pnpm build:storybook  # build Storybook
pnpm size             # bundle-size budgets (size-limit)
```

**Do not run autonomously** (interactive / long-running — only if explicitly asked):

- `pnpm dev` — Storybook dev server, runs until stopped

The package builds and publishes as a standard pnpm package; releases are tag-driven (`pnpm publish` via `.github/workflows/release.yml`).

## Code Structure

- **Source**: `src/` — Preact/TSX UI (`@enonic/ui`), state via nanostores. Entry points are `src/index.ts`, `src/index.ssr.ts`, and `src/protocol.ts`; implementation lives under `src/page-editor/`.
- **Shadow DOM**: New Preact surfaces render inside a Shadow DOM boundary to prevent style leakage between editor chrome and the edited page.
- **Styles**: Tailwind, plus a few co-located stylesheets under `src/page-editor/editor/rendering/` imported with `?inline`.

## Documentation

All docs live in `docs/`, flat structure. Lowercase kebab-case filenames, no date or number prefixes. Add subdirectories (`design/`, `decisions/`) only when file count makes flat navigation painful. Files are technical specs named by topic (e.g., `protocol.md` documents the exported host-to-editor message contract).

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
