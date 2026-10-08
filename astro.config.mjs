// @ts-check
import svelte from "@astrojs/svelte";
import { defineConfig } from "astro/config";
import UnoCSS from "unocss/astro";

// There is no adapter, no SSR, no middleware and no API route in this project.
// The absence of a server is a product guarantee (docs/PLAN.md §16), so it has
// to be visible here: `output: "static"` and nothing that could weaken it.
export default defineConfig({
  output: "static",
  // The deployed origin (GitHub Pages, custom domain — see the `deploy` job in
  // .github/workflows/ci.yml). Astro only uses it to build absolute URLs;
  // the site itself is served from the domain root, so no `base` is needed.
  site: "https://isfugl.edb.fi",
  /**
   * The privacy guarantee, enforced rather than asserted (docs/PLAN.md §16.4).
   *
   * Astro generates the policy and hashes its own inline hydration scripts and
   * the one preference-writing script on the static pages, which is why this is
   * configured here rather than hand-written as a `<meta>` tag: a hand-written
   * `script-src 'self'` blocks island hydration outright.
   *
   * `frame-ancestors` is deliberately absent. It is ignored when delivered via
   * `<meta>`, and a directive that silently does nothing is worse than none —
   * it belongs in a response header set by the host.
   */
  security: {
    csp: {
      algorithm: "SHA-256",
      directives: [
        "default-src 'self'",
        "connect-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ],
      /**
       * Scripts stay hash-locked. Styles do not, and cannot: Paged.js injects
       * the stylesheet it has rewritten as a `<style>` element at run time, and
       * no build-time hash can cover output that does not exist until the
       * preview paginates. A CSP that silently disabled pagination would be a
       * worse outcome than a permissive `style-src`, which is not an
       * exfiltration path here — `default-src 'self'` still governs every URL a
       * stylesheet could reference.
       *
       * `'unsafe-inline'` is nonetheless inert, and `build.inlineStylesheets:
       * "never"` does not rescue it: Astro emits its own
       * `astro-island{display:contents}` rule inline for hydration, so a style
       * hash is always present and browsers ignore `'unsafe-inline'` whenever
       * one is. It stays declared because a host that serves this without the
       * island runtime would have no hash and would then need it.
       *
       * The practical consequence, and the reason it is written down here: run
       * time styling has to go through the CSSOM. `element.style.someProperty`
       * and `CSSStyleSheet`/`adoptedStyleSheets` are unaffected;
       * `setAttribute("style", …)` is refused outright and a `<style>` element
       * built in JavaScript is refused with it. `src/lib/export/paint.ts` and
       * the Paged.js polisher redirect in `src/lib/export/pdf.ts` both take the
       * CSSOM route for exactly this reason.
       */
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
    },
  },
  build: {
    inlineStylesheets: "never",
  },
  i18n: {
    defaultLocale: "da",
    locales: ["da", "en"],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [UnoCSS({ injectReset: true }), svelte()],
  vite: {
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          /**
           * Everything named here is dynamically imported and must never enter
           * the initial workspace chunk (docs/PLAN.md §6.4): the paginator, the
           * PDF writer, the DOCX writer, the editor (mounted on first focus)
           * and the draft schema (read only at the storage boundary).
           *
           * Naming them makes that visible in `dist/`, lets
           * `scripts/check-bundle.ts` measure the budget rather than estimate
           * it, and gives the fallback test a stable request to block when it
           * exercises the "Paged.js fails to load" branch of §13.2.
           */
          manualChunks(id) {
            /**
             * Vite's dynamic-import preload helper is shared by every island
             * and belongs with the runtime, not with a payload. Left
             * unassigned, Rollup folds it into whichever manual chunk it
             * likes — it chose the PDF writer, which made the initial
             * workspace chunk statically import a quarter of a megabyte and
             * turned "block the writer" into "break island hydration".
             */
            if (id.includes("preload-helper")) return "client";
            if (id.includes("node_modules/pagedjs")) return "pagedjs";
            /**
             * Named `libpdf` rather than `pdf`: Vite derives a chunk name from
             * the module filename too, and `src/lib/export/pdf.ts` is imported
             * by the preview, so a chunk called `pdf` merges the writer into
             * the initial workspace payload. That is invisible in the built
             * output and fatal at run time — blocking the chunk breaks island
             * hydration rather than just the export.
             *
             * `pako` is deliberately not listed. jszip depends on it too, and
             * claiming it here makes the DOCX chunk import the PDF one, so
             * exporting a Word file would download the PDF writer with it.
             */
            if (
              id.includes("node_modules/@libpdf") ||
              id.includes("node_modules/@noble") ||
              id.includes("node_modules/@scure") ||
              id.includes("node_modules/asn1js") ||
              id.includes("node_modules/pkijs") ||
              id.includes("node_modules/lru-cache")
            ) {
              return "libpdf";
            }
            if (id.includes("node_modules/docx") || id.includes("node_modules/jszip")) {
              return "docx";
            }
            if (id.includes("node_modules/@tiptap") || id.includes("node_modules/prosemirror")) {
              return "editor";
            }
            if (id.includes("node_modules/zod")) return "schema";
            return undefined;
          },
        },
      },
    },
  },
});
