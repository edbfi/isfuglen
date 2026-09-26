# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Browser-only newsletter generator: paste Danish/English meeting notes, get a laid-out A4
newsletter with PDF/DOCX/clipboard export. Astro 7 static site + one Svelte 5 island + UnoCSS, on Bun.

## Commands

Bun only. The `no-npm` hook in `prek.toml` rejects `npm`/`pnpm`/`yarn`/`npx` in `package.json`,
`bunfig.toml`, `scripts/` and workflows; use `bun run` / `bunx --bun`.

| Task | Command |
| --- | --- |
| Dev server | `bun run dev` |
| Build | `bun run build` (runs `build:assets` first) |
| Typecheck | `bun run check` (`astro check` + `svelte-check` + native `--tsgo` pass; plain `tsc` sees no `.astro`/`.svelte`) |
| Format + lint (write) | `bun run format` |
| Lint (read-only, as CI) | `bunx --bun biome ci .` |
| Unit tests | `bun test` (root is `tests/unit` via `bunfig.toml`) |
| One unit file / case | `bun test tests/unit/parser/dates.test.ts -t "day-first"` (`-t` is a regex) |
| Deploy-script tests (Python) | `python3 -B -m unittest discover -s tests -p 'test_*.py'` |
| E2E | `bun run build`, then `bun run test:e2e` |
| One E2E file / case | `bunx --bun playwright test tests/e2e/core-flow.spec.ts -g "title regex"` |
| Bundle budget | `bun run check:bundle` |
| Everything CI's quality lane runs | `bash .github/scripts/check.sh` |

- Run unit tests from the repo root: several read files by cwd-relative path (`Bun.file("src/styles/tokens.css")`).
- On a clean checkout run `bun run build:assets` before `bun test`; `tests/unit/export/docx.test.ts`
  reads the gitignored `public/brand/ishoej-kreds18@300.png`.
- Playwright serves the built `dist/` via `scripts/serve-dist.ts` on port 4321, never the dev
  server, so rebuild before E2E or you test stale output. `pdf-cross-browser.spec.ts` needs
  Chromium, Firefox and WebKit installed.

## Generated files (gitignored, never hand-edit)

Rebuilt by `bun run build:assets`:

- `public/brand/*@300.png` from `scripts/build-logo-png.ts`
- `public/fonts/pdf/` from `scripts/build-pdf-fonts.ts` (static TTFs; the PDF writer cannot embed variable fonts)

## Invariants

- **`docs/PLAN.md` was deleted; its citations were not.** About 180 comments cite it by section
  (`§6.4`, `§16.3`, ...). Don't look for it or treat a missing section as unwritten; the comment
  around the citation is the surviving spec.
- **`.agents/rules/astro-svelte5-islands.md` describes the generic stack, not this repo.** There is
  no adapter, Actions, sessions, middleware, content collections, shadcn-svelte or Vitest here.
  Tests are `bun test` + Playwright, and imports are relative (the `$lib`/`@/` tsconfig aliases are unused).
- **No server.** `output: "static"`, no adapter, no API route. `tests/e2e/privacy.spec.ts` fails on
  any request beyond the app's own static assets. Bundle everything locally (fonts come from the
  `@fontsource*` packages); no CDNs, analytics or remote fetches.
- **Runtime styling must go through the CSSOM.** The CSP from `security.csp` in `astro.config.mjs`
  refuses `setAttribute("style", ...)` and `<style>` elements built in JS. Use `el.style.prop` or
  `CSSStyleSheet` + `adoptedStyleSheets` (see `redirectPolisherToCssom` in `src/lib/export/pdf.ts`).
- **Initial workspace JS budget: 160 KB gz.** `pagedjs`, `@libpdf/*`, `docx`/`jszip`, `@tiptap`,
  `zod` and the local `export/paint.ts`, `export/write.ts`, `model/schema.ts`, `model/migrate.ts`
  are reached only via `await import(...)` from the workspace path. A static import merges the
  chunk and fails `bun run check:bundle`. Chunk names live in `manualChunks` in `astro.config.mjs`
  and `LAZY` in `scripts/check-bundle.ts`; change both together. `import type` is fine.
- **Two language systems.** `src/lib/i18n/` is UI text keyed by `$uiLang`
  (`src/lib/storage/prefs.ts`). `src/lib/labels/` is the words printed *inside* the newsletter,
  keyed by the document's `docLang`. `render/` and `export/` import `labels/` and
  `i18n/format.ts` only, never the message catalogs. `i18n/da.ts` defines the message shape and
  `en.ts` must match it. The app never reads `navigator.language`; UI defaults to Danish.
- **Dates, times, lists and sorting go through `src/lib/i18n/format.ts`**, not ad-hoc `Intl` or
  `new Date("YYYY-MM-DD")` (Danish uses `15.30`, Æ Ø Å sort after Z, ISO dates parse as local).
- **The palette lives in two files that must agree:** `palette` in `uno.config.ts` and the custom
  properties in `src/styles/tokens.css`. `tests/unit/styles/tokens.test.ts` asserts parity.
  `--c-accent` (gold) is a rule/chip/notice fill only, never text, a meaningful icon or a focus ring.
- **No runtime-assembled class names.** UnoCSS only generates classes it can scan, and the
  `no-dynamic-classes` hook rejects `text-${x}`-style interpolation. Pick full literal class
  strings with a conditional or map, or add them to `safelist` in `uno.config.ts`.
- **Zod runs only at the storage boundary** (`src/lib/model/schema.ts`). The parse/render path does
  not validate. A change to the persisted shape needs `SCHEMA_VERSION` bumped in
  `src/lib/model/types.ts` and a step in `steps` in `src/lib/model/migrate.ts`, keyed by the
  version it migrates *from*.
- Biome lints `.astro`/`.svelte` script blocks but does not format them (see `biome.json`
  overrides), and it ignores Markdown. Format template markup by hand.

## Where state lives

| Question | Runes class in `src/lib/stores/*.svelte.ts` | nanostores `persistentAtom` in `src/lib/storage/prefs.ts` | IndexedDB via `src/lib/storage/documents.ts` |
| --- | --- | --- | --- |
| Live document/UI state inside the workspace island? | ✅ | | |
| A user preference that must be readable synchronously at first paint? | | ✅ | |
| A saved draft or its index? | | | ✅ |

`src/layouts/Static.astro` also writes the `nl.uiLang` localStorage key directly from an inline
script. If you rename a key in `prefs.ts`, rename it there too.

## Canonical patterns

Class names chosen from literals, from `src/lib/render/html.ts`:

```ts
// Full literal class strings, chosen by a lookup — never assembled at runtime.
const wrapper = block.tone === "important" ? "nl-notice-important" : "nl-notice-info";
```

Lazy-loading a budgeted module, from `src/lib/storage/documents.ts`:

```ts
const raw = await get(INDEX_KEY);
const { draftIndexSchema } = await import("../model/schema");
const parsed = draftIndexSchema.safeParse(raw ?? []);
```

## Workflows

**New block type** (use an existing one such as `quote` as the template):

1. Type in `src/lib/model/types.ts`, schema in `blockSchema` in `src/lib/model/schema.ts`
   (plus the version/migration rule above), constructor in `src/lib/model/factory.ts`.
2. Render it in all four outputs: `src/lib/render/html.ts` (preview, print and PDF source),
   `src/lib/render/plaintext.ts`, `src/lib/export/docx.ts`, `src/lib/export/clipboard.ts`.
   Style it in `src/styles/document.css`.
3. Printed labels in `src/lib/labels/types.ts`, `da.ts` and `en.ts`.
4. Editor: a `src/islands/<Name>Editor.svelte`, wired in `src/islands/SectionCard.svelte`.
   UI strings go in `src/lib/i18n/da.ts` and `en.ts`.
5. Parser: `src/lib/parser/assemble.ts` and `repair.ts`, cues in `src/lib/parser/rules/`.
   Update `tests/unit/helpers/outline.ts` and the parser tests.

**New static page:** add both `src/pages/<danish-slug>.astro` and `src/pages/en/<slug>.astro`
(routes are translated, not just prefixed), content in `src/content/<Name>Content.astro`, a
`PageKey` plus both paths in `src/lib/i18n/routes.ts` (the only place that knows the mapping),
nav links in `src/components/SiteHeader.astro`, and the paths in `.github/scripts/smoke.sh`,
`tests/e2e/accessibility.spec.ts` and `tests/unit/i18n/routes.test.ts`.

## Git and CI

- Conventional Commits are enforced at `commit-msg`, and `no-commit-to-branch` blocks commits
  to `main`. Branch, then open a PR. Hooks fire only after `prek install`.
- Run `bun run format` before committing and `bash .github/scripts/check.sh` for local validation.

## Reference

- `docs/pdf-export-options.md`: why the PDF export paints over the Paged.js-paginated DOM, and
  what `@libpdf/core` can't do (§8). Read before touching `src/lib/export/pdf.ts`, `paint.ts`,
  `write.ts` or `fonts.ts`. §1 describes the retired print-dialog path; §8 is what shipped.
- `public/brand/README.md`: logo geometry and the SVG drop-in contract that
  `src/lib/export/svg-path.ts` enforces (only `<path>`, no `transform`, no arcs). Read before
  changing brand assets or the logo pipeline.
- `.agents/rules/astro-svelte5-islands.md`: Svelte 5 runes and Astro island conventions. Read
  before writing a new island or `.astro` page, subject to the caveat under Invariants.
