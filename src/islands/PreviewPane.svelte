<script lang="ts">
import { paginate } from "../lib/export/pdf";
import type { Translator } from "../lib/i18n/index";
import { labelsFor } from "../lib/labels/index";
import type { NewsletterDoc } from "../lib/model/types";
import { footerParts, renderDocumentBody, renderDocumentHtml } from "../lib/render/html";
import pagedCss from "../styles/paged.css?raw";
import PageIndicator from "./PageIndicator.svelte";
import ZoomControl from "./ZoomControl.svelte";

/**
 * The A4 preview — docs/PLAN.md §4.4, §13.2.
 *
 * The preview is laid out at a true 210 mm and scaled with `transform`, and it
 * is read-only. That is not a shortcut: ProseMirror computes caret and
 * selection coordinates from `getBoundingClientRect`, and inside a
 * `transform: scale()` ancestor the drag handles, gap cursors and floating UI
 * drift. Keeping the editable surface at scale 1 in the editor pane sidesteps
 * an entire class of bugs on every browser, permanently, and the click-through
 * mapping below recovers the directness that gives up.
 *
 * Paged.js runs debounced, on a detached clone, and never on the editor's DOM,
 * so typing never fights the paginator.
 */
interface Props {
  doc: NewsletterDoc;
  t: Translator;
  onselectblock: (blockId: string) => void;
}

let { doc, t, onselectblock }: Props = $props();

const PAGE_WIDTH_MM = 210;
const MM_TO_PX = 96 / 25.4;
const PAGE_WIDTH_PX = PAGE_WIDTH_MM * MM_TO_PX;
const DEBOUNCE_MS = 400;

let viewport = $state<HTMLElement>();
let sheet = $state<HTMLElement>();
let scaler = $state<HTMLElement>();
let availableWidth = $state(PAGE_WIDTH_PX);
let zoomStep = $state(0);
let paginated = $state<string | null>(null);
let pageCount = $state(1);
let fallback = $state(false);
let currentPage = $state(1);

const renderOptions = { logoSrc: "/brand/ishoej-kreds18.svg", interactive: true } as const;
const labels = $derived(labelsFor(doc.docLang));

/** The continuous document, used on screen and by the fallback path. */
const html = $derived(renderDocumentHtml(doc, labels, renderOptions));

/**
 * The same content as siblings rather than inside one `<article>`. Paged.js
 * splits a single root across every page, and doing so duplicates the first
 * sections; a flat sequence is the case it handles well.
 */
const flow = $derived(renderDocumentBody(doc, labels, renderOptions));

const fitScale = $derived(Math.min(1, availableWidth / PAGE_WIDTH_PX));
const scale = $derived(Math.max(0.35, Math.min(1.5, fitScale + zoomStep * 0.1)));

$effect(() => {
  const element = viewport;
  if (!element) return;
  const observer = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width;
    if (width) availableWidth = width - 32;
  });
  observer.observe(element);
  return () => observer.disconnect();
});

/**
 * The scale is applied through the CSSOM rather than a `style` attribute.
 * The Content Security Policy hashes Astro's own inline styles and permits
 * nothing else, and an HTML `style` attribute would be blocked outright;
 * assigning to `element.style` is not inline execution and is unaffected.
 */
$effect(() => {
  const element = scaler;
  if (!element) return;
  element.style.width = `${PAGE_WIDTH_PX}px`;
  element.style.transform = `scale(${scale})`;
  // The wrapper's own box must shrink with the scaled content, or the pane
  // scrolls past empty space below a reduced preview.
  const height = element.firstElementChild?.scrollHeight ?? 0;
  element.style.height = height > 0 ? `${height * scale}px` : "";
});

// Re-pagination is debounced after the last edit, runs against a detached
// fragment, and swaps in on completion.
$effect(() => {
  const source = flow;
  let cancelled = false;

  const timer = setTimeout(async () => {
    const result = await paginate({ html: source, css: pagedCss });
    if (cancelled) return;
    if (result.ok) {
      paginated = result.html;
      pageCount = Math.max(1, result.pages);
      fallback = false;
    } else {
      paginated = null;
      pageCount = 1;
      fallback = true;
      // One line, on failure only. Without it, "why is there no page number"
      // is unanswerable from a user's browser (§22 risk 1).
      console.warn(`Pagination unavailable (${result.reason}): ${result.detail}`);
    }
  }, DEBOUNCE_MS);

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
});

/**
 * The running footer's two variable inputs. Paged.js's own `string-set` and
 * `counter(pages)` do not survive the paginated markup being moved into the
 * preview, and both are facts this app already knows.
 */
$effect(() => {
  const element = sheet;
  if (!element) return;
  element.style.setProperty("--nl-footer", JSON.stringify(footerParts(doc).join(" \u00b7 ")));
  element.style.setProperty("--nl-pages", JSON.stringify(String(pageCount)));
});

$effect(() => {
  const element = sheet;
  if (!element) return;
  const onClick = (event: MouseEvent) => {
    const target = (event.target as HTMLElement | null)?.closest("[data-block-id]");
    const id = target?.getAttribute("data-block-id");
    if (id) onselectblock(id);
  };
  element.addEventListener("click", onClick);
  return () => element.removeEventListener("click", onClick);
});

function onscroll(event: Event): void {
  if (pageCount <= 1) return;
  const element = event.currentTarget as HTMLElement;
  const ratio = element.scrollTop / Math.max(1, element.scrollHeight - element.clientHeight);
  currentPage = Math.min(pageCount, Math.max(1, Math.round(ratio * (pageCount - 1)) + 1));
}
</script>

<div class="flex h-full min-h-0 flex-col">
  <div
    class="app-chrome flex items-center gap-3 border-b border-hairline bg-white px-4 py-2 text-xs"
  >
    <h2 class="font-semibold uppercase tracking-wide text-muted">{t("workspace.preview")}</h2>
    <div class="ml-auto flex items-center gap-3">
      <ZoomControl
        {t}
        value={Math.round(scale * 100)}
        onzoom={(delta) => {
  zoomStep = delta === 0 ? 0 : zoomStep + delta;
}}
      />
      <PageIndicator {t} page={currentPage} pages={pageCount} />
    </div>
  </div>

  {#if fallback}
    <!--
      The mandatory degradation path (§13.2). Content is intact and printable;
      in-content page numbers and uniform widow control are what is lost.
    -->
    <p class="app-chrome border-b border-hairline bg-important-fill px-4 py-2 text-xs text-ink">
      {t("preview.fallback")}
    </p>
  {/if}

  <section
    bind:this={viewport}
    aria-label={t("a11y.previewRegion")}
    tabindex="-1"
    class="min-h-0 flex-1 overflow-auto bg-surface-sunken p-4"
    {onscroll}
  >
    <div bind:this={scaler} class="preview-scaler mx-auto">
      <div bind:this={sheet} class="preview-sheet" lang={doc.docLang}>
        {#if paginated}
          {@html paginated}
        {:else}
          {@html html}
        {/if}
      </div>
    </div>
  </section>
</div>

<style>
/* Paged.js emits its own page furniture; the sheet shadow belongs to each
     page rather than to the stack of them. */
.preview-sheet :global(.pagedjs_page) {
  background: var(--c-surface);
  box-shadow: var(--shadow-page);
  margin: 0 auto 1rem;
}

.preview-sheet :global(.nl-doc) {
  box-shadow: none;
}
</style>
