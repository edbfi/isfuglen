import { defineConfig, presetWind4, transformerDirectives, transformerVariantGroup } from "unocss";

/**
 * Design tokens — docs/PLAN.md §12.
 *
 * This file is the single source of truth for the palette. `src/styles/tokens.css`
 * mirrors the same values as CSS custom properties, because the print stylesheet
 * and the document stylesheet need raw values rather than utility classes.
 * If you change a colour here, change it there too — the token parity test in
 * `tests/unit/styles/tokens.test.ts` fails otherwise.
 *
 * `--c-accent` (gold) is 1.88:1 on white. It is a rule, a chip fill and a notice
 * bar. It is never text, never an icon that carries meaning, and never a focus
 * ring. `tests/unit/styles/contrast.test.ts` asserts this as a computed fact.
 */
export const palette = {
  ink: "#1A2340",
  brand: "#253154",
  brandMid: "#3C4E7A",
  muted: "#4A5262",
  accent: "#F2B233",
  surface: "#FFFFFF",
  surfaceSunken: "#F7F8FA",
  hairline: "#DFE3EB",
  infoFill: "#E7EDF7",
  infoBar: "#3C4E7A",
  importantFill: "#FDF3DD",
  importantBar: "#F2B233",
  decisionFill: "#EAF0E9",
  decisionBar: "#0F5132",
  actionFill: "#FBEAE8",
  actionBar: "#B02A1E",
} as const;

export default defineConfig({
  presets: [presetWind4()],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  theme: {
    colors: {
      ink: palette.ink,
      brand: {
        DEFAULT: palette.brand,
        mid: palette.brandMid,
      },
      muted: palette.muted,
      accent: palette.accent,
      surface: {
        DEFAULT: palette.surface,
        sunken: palette.surfaceSunken,
      },
      hairline: palette.hairline,
      info: { fill: palette.infoFill, bar: palette.infoBar },
      important: { fill: palette.importantFill, bar: palette.importantBar },
      decision: { fill: palette.decisionFill, bar: palette.decisionBar },
      action: { fill: palette.actionFill, bar: palette.actionBar },
    },
    font: {
      sans: "'Source Sans 3 Variable', system-ui, -apple-system, Segoe UI, sans-serif",
      serif: "'Source Serif 4 Variable', Georgia, 'Times New Roman', serif",
    },
    radius: {
      sm: "3px",
      md: "6px",
    },
    shadow: {
      chrome: "0 1px 2px rgb(37 49 84 / 0.06), 0 4px 12px rgb(37 49 84 / 0.08)",
      page: "0 2px 8px rgb(37 49 84 / 0.10)",
    },
  },
  shortcuts: {
    "flex-center": "flex items-center justify-center",
    // Focus is a geometric addition, never a colour change (§12.6, §17.3).
    "focus-ring":
      "outline-none focus-visible:(ring-2 ring-offset-2 ring-brand-mid ring-offset-white)",
    btn: "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:(opacity-50 cursor-not-allowed) focus-ring",
    "btn-primary": "btn bg-brand text-white hover:bg-brand-mid",
    "btn-secondary": "btn bg-white text-brand border border-hairline hover:bg-surface-sunken",
    "btn-ghost": "btn text-brand hover:bg-surface-sunken",
    "field-label": "block text-xs font-semibold tracking-wide text-muted",
    "field-input":
      "w-full rounded-md border border-hairline bg-white px-3 py-2 text-sm text-ink focus-ring placeholder:text-muted/70",
  },
  // The semantic block variants are written as full literal class strings and
  // picked with a lookup map (see src/lib/render/html.ts). Nothing in this
  // project assembles a class name at runtime — the `no-dynamic-classes` hook in
  // .pre-commit-config.yaml makes that unpushable. The safelist below covers the document
  // classes that only ever appear inside rendered HTML strings, which UnoCSS's
  // scanner does see, but which are easy to miss when refactoring.
  safelist: [
    "nl-doc",
    "nl-page",
    "nl-notice-info",
    "nl-notice-important",
    "nl-decisions",
    "nl-actions",
  ],
  content: {
    pipeline: {
      include: [/\.(astro|svelte|[jt]sx?|md|html)($|\?)/, "src/**/*.{js,ts}"],
    },
  },
});
