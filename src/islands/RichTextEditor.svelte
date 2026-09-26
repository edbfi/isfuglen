<script lang="ts">
import type { Editor } from "@tiptap/core";
import type { Translator } from "../lib/i18n/index";
import type { DocLang } from "../lib/model/types";
import { looksStructured } from "../lib/parser/paste";
import { renderInline } from "../lib/render/html";
import { type BodyBlock, blocksToTipTapDoc, tipTapDocToBlocks } from "../lib/render/tiptap";
import EditorToolbar from "./EditorToolbar.svelte";

/**
 * A TipTap instance over one section's body — docs/PLAN.md §7.3.
 *
 * Three rules are encoded here, and each of them is a bug that would otherwise
 * be found late:
 *
 * 1. One `$effect`, with cleanup. TipTap owns real DOM and real event
 *    listeners; failing to `destroy()` on section removal leaks them.
 * 2. The editor is uncontrolled. `NewsletterDoc` is updated *from* it, never
 *    fed back into it — doing so causes cursor jumps and, with runes, an
 *    `effect_update_depth_exceeded` loop.
 * 3. Lazy mount on first focus. Until then the section renders as static HTML
 *    identical to the preview, which keeps a fifteen-section document at one or
 *    two live ProseMirror instances and makes the first paint after a parse
 *    instant.
 *
 * TipTap and its schema are imported at that same moment rather than at module
 * scope. An editor nobody has focused yet has no business costing ~90 KB gz of
 * the initial workspace payload, and the plan's budget is not met without this
 * (§6.4). The type-only import above compiles away entirely.
 */
interface Props {
  blocks: BodyBlock[];
  docLang: DocLang;
  t: Translator;
  labelledBy?: string;
  onchange: (blocks: BodyBlock[]) => void;
  /** Lay a large structured paste out as sections, replacing this one. */
  onformat?: (raw: string) => void;
}

let { blocks, docLang, t, labelledBy, onchange, onformat }: Props = $props();

let host = $state<HTMLElement>();
let editor = $state<Editor | undefined>();
let mounted = $state(false);
let toolbarVersion = $state(0);
/** A large structured paste waiting for the user's choice (§11.7). */
let pendingPaste = $state<string | null>(null);
/**
 * Where the pointer went down on the static stand-in, measured from that
 * element's own top-left rather than the viewport's. The lazy mount is
 * invisible only if the caret lands where the user aimed; sending it to the
 * end of the body instead is the kind of small betrayal that makes an editor
 * feel untrustworthy.
 *
 * Viewport coordinates would be a wrong answer waiting for a slow network.
 * Between the pointer going down and the editor existing there is a real
 * chunk fetch, and for its whole duration the section is an empty box inside
 * a scrolling pane: a scroll clamp, scroll anchoring, or anything else that
 * translates the card vertically leaves an absolute point pointing at a line
 * the user never aimed at. An offset into the box travels with the box, so
 * the question cannot arise.
 */
let entryPoint: { left: number; top: number } | null = null;

/**
 * Static render of the unfocused state — literally the preview's inline
 * renderer, only the block wrappers differ.
 *
 * It is spelled this way because the second copy of that loop was a
 * cross-site scripting hole: it went into `{@html}` with an unescaped `href`,
 * so an imported draft or a pasted `[label](https://x"onmouseover=…)` could
 * add an event handler to this page. `renderInline` escapes the attribute and
 * applies the very predicate the editor schema is configured with, so there is
 * nowhere left for the two to drift apart.
 */
const staticHtml = $derived(renderStatic(blocks));

/**
 * The stand-in and the mounted editor are the same box — same width, same
 * `px-3 py-2`, same border, same place in the same column — so an offset
 * taken from one lands on the matching glyph in the other.
 */
function placeCaret(instance: Editor, element: HTMLElement): void {
  const point = entryPoint;
  entryPoint = null;
  if (point) {
    const box = element.getBoundingClientRect();
    const hit = instance.view.posAtCoords({
      left: box.left + point.left,
      top: box.top + point.top,
    });
    if (hit) {
      instance.chain().focus().setTextSelection(hit.pos).run();
      return;
    }
  }
  instance.commands.focus("end");
}

function renderStatic(source: BodyBlock[]): string {
  return source
    .map((block) => {
      if (block.type === "paragraph") {
        return `<p>${renderInline(block.content) || "&nbsp;"}</p>`;
      }
      const items = block.items.map((item) => `<li>${renderInline(item)}</li>`).join("");
      return block.ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
    })
    .join("");
}

/*
 * `editor` is deliberately absent from this effect's reads. It is written
 * below, and an effect that reads what it writes re-runs itself: the cleanup
 * destroyed the instance it had just created, the guard saw `undefined`
 * again, and the section spun between create and destroy without ever
 * showing a caret. Nothing said so, either — the write lands a microtask
 * later, so every turn is a fresh batch and the runtime's depth guard never
 * counts past one. `mounted` and `host` are the only real inputs, each flips
 * exactly once per mount, and tracking them alone is both correct and
 * sufficient.
 *
 * Everything else the editor is built from — `blocks`, `t`, `labelledBy`,
 * `docLang` — is read *after* the `await` and is therefore untracked. That is
 * load-bearing, not incidental: `onUpdate` hands the parent a fresh `blocks`
 * array on every keystroke, so hoisting `blocksToTipTapDoc(blocks)` above the
 * import would rebuild the editor as fast as the user can type.
 */
$effect(() => {
  if (!mounted || !host) return;

  const element = host;
  let instance: Editor | undefined;
  let cancelled = false;

  void (async () => {
    const [{ Editor: TipTapEditor }, { sectionBodyExtensions, stripAlienStyles }] =
      await Promise.all([import("@tiptap/core"), import("../lib/editor/schema")]);
    if (cancelled) return;

    instance = new TipTapEditor({
      element,
      extensions: sectionBodyExtensions(t("section.bodyPlaceholder")),
      content: blocksToTipTapDoc(blocks),
      editorProps: {
        attributes: {
          class: "nl-editor-surface",
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": t("section.body"),
          ...(labelledBy ? { "aria-labelledby": labelledBy } : {}),
          lang: docLang,
        },
        transformPastedHTML: stripAlienStyles,
        /**
         * A large, structured plain-text paste into an *empty* section is the
         * one case where the user might have meant "lay this out", so it is
         * offered as an inline, non-modal choice. The default is plain text:
         * they asked to paste, not to restructure (§11.7).
         */
        handlePaste: (view, event) => {
          if (!onformat) return false;
          const text = event.clipboardData?.getData("text/plain") ?? "";
          if (text.length === 0) return false;
          if (!view.state.doc.textContent.trim().length && looksStructured(text)) {
            pendingPaste = text;
          }
          return false;
        },
        handleKeyDown: (_view, event) => {
          // Escape leaves the editor rather than trapping the caret (§17.2).
          if (event.key !== "Escape") return false;
          const card = element.closest("[data-section-card]") as HTMLElement | null;
          card?.focus();
          return true;
        },
      },
      onUpdate: ({ editor: current }) => {
        onchange(tipTapDocToBlocks(current.getJSON()));
      },
      onSelectionUpdate: () => {
        toolbarVersion += 1;
      },
      onTransaction: () => {
        toolbarVersion += 1;
      },
    });

    editor = instance;
    placeCaret(instance, element);
  })();

  return () => {
    cancelled = true;
    instance?.destroy();
    editor = undefined;
  };
});
</script>

<div class="flex flex-col gap-2">
  {#if mounted && editor}
    <EditorToolbar {t} {editor} version={toolbarVersion} />
  {/if}

  {#if pendingPaste}
    <div
      class="flex flex-wrap items-center gap-2 rounded-md border border-hairline bg-surface-sunken p-2 text-sm"
    >
      <p class="flex-1">{t("paste.question")}</p>
      <button
        type="button"
        class="btn-secondary text-xs"
        onclick={() => {
  const raw = pendingPaste;
  pendingPaste = null;
  if (raw) onformat?.(raw);
}}
      >
        {t("paste.asSections")}
      </button>
      <button
        type="button"
        class="btn-ghost text-xs"
        onclick={() => {
  pendingPaste = null;
}}
      >
        {t("paste.keepPlain")}
      </button>
    </div>
  {/if}

  {#if mounted}
    <div
      bind:this={host}
      class="nl-editor rounded-md border border-hairline bg-white px-3 py-2"
    ></div>
  {:else}
    <!--
      Unfocused sections are static HTML. `focusin` and a keyboard-reachable
      button both promote them, so the lazy mount is never a keyboard trap.
    -->
    <button
      type="button"
      class="nl-editor w-full rounded-md border border-hairline bg-white px-3 py-2 text-left focus-ring"
      aria-label={t("section.body")}
      onfocusin={() => {
  mounted = true;
}}
      onpointerdown={(event) => {
  const box = event.currentTarget.getBoundingClientRect();
  entryPoint = { left: event.clientX - box.left, top: event.clientY - box.top };
}}
      onclick={() => {
  mounted = true;
}}
    >
      {@html staticHtml}
    </button>
  {/if}
</div>

<style>
.nl-editor :global(p) {
  margin: 0 0 0.5rem;
}

.nl-editor :global(p:last-child) {
  margin-bottom: 0;
}

/*
   * The preflight reset takes the markers off every list. In the editor that
   * would leave a list and two paragraphs looking identical, which is exactly
   * the distinction someone repairing a parse is trying to see.
   */
.nl-editor :global(ul),
.nl-editor :global(ol) {
  margin: 0 0 0.5rem;
  padding-left: 1.4rem;
}

.nl-editor :global(ul) {
  list-style: disc;
}

.nl-editor :global(ol) {
  list-style: decimal;
}

.nl-editor :global(li::marker) {
  color: var(--c-brand);
}

.nl-editor :global(li) {
  margin-bottom: 0.2rem;
}

.nl-editor :global(a) {
  color: var(--c-brand-mid);
  text-decoration: underline;
}

.nl-editor :global(.nl-editor-surface) {
  outline: none;
  min-height: 3.5rem;
}

.nl-editor :global(.nl-editor-surface p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  color: var(--c-muted);
  opacity: 0.7;
  pointer-events: none;
}
</style>
