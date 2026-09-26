<script lang="ts">
import type { Translator } from "../lib/i18n/index";
import type { Block, DocLang, Section } from "../lib/model/types";
import type { BodyBlock } from "../lib/render/tiptap";
import { isBodyBlock } from "../lib/render/tiptap";
import ActionItemsEditor from "./ActionItemsEditor.svelte";
import AgendaEditor from "./AgendaEditor.svelte";
import ClosingEditor from "./ClosingEditor.svelte";
import ContactEditor from "./ContactEditor.svelte";
import NoticeEditor from "./NoticeEditor.svelte";
import QuoteEditor from "./QuoteEditor.svelte";
import RichTextEditor from "./RichTextEditor.svelte";
import TextListEditor from "./TextListEditor.svelte";
import Menu from "./ui/Menu.svelte";

/**
 * One section — docs/PLAN.md §5.2, §5.3.
 *
 * Structure is manipulated here: add, delete, reorder, retype. Text is edited
 * inline. The card is an `<article>` labelled by its own heading input, and
 * reordering has no drag-only path: `Alt+↑` / `Alt+↓` and the visible buttons
 * are the primary mechanism, which is also faster for everyone (§17.2).
 */
interface Props {
  section: Section;
  index: number;
  total: number;
  docLang: DocLang;
  t: Translator;
  onchange: () => void;
  onmove: (delta: number) => void;
  onremove: () => void;
  onheading: (value: string) => void;
  onbodychange: (start: number, count: number, blocks: BodyBlock[]) => void;
  onacknowledge: (blockId: string) => void;
  /** The parser split where the writer did not: join this section to the one above. */
  onmergeup: () => void;
  /** The parser read a line as a heading that was never one: put it back in the body. */
  onheadingtotext: () => void;
  /** Lay a large structured paste out as sections, replacing this one. */
  onformatpaste: (raw: string) => void;
}

let {
  section,
  index,
  total,
  docLang,
  t,
  onchange,
  onmove,
  onremove,
  onheading,
  onbodychange,
  onacknowledge,
  onmergeup,
  onheadingtotext,
  onformatpaste,
}: Props = $props();

type Group =
  | { kind: "body"; start: number; blocks: BodyBlock[] }
  | { kind: "block"; start: number; block: Block };

/** Consecutive paragraphs and lists share one editor; everything else gets a form. */
const groups = $derived.by<Group[]>(() => {
  const out: Group[] = [];
  section.blocks.forEach((block, position) => {
    if (isBodyBlock(block)) {
      const last = out.at(-1);
      if (last?.kind === "body") {
        last.blocks.push(block);
        return;
      }
      out.push({ kind: "body", start: position, blocks: [block] });
      return;
    }
    out.push({ kind: "block", start: position, block });
  });
  return out;
});

const uncertain = $derived(
  section.confidence === "low" || section.blocks.some((block) => block.confidence === "low"),
);

/**
 * Naming the guess is worth more than repeating "we were unsure". A list the
 * parser reconstructed from a missing marker is the one case where the user
 * can check the answer at a glance, so it says which guess it made.
 */
const guessedList = $derived(
  section.blocks.some(
    (block) =>
      block.confidence === "low" && (block.sourceRuleId ?? "").endsWith("structure.recoveredList"),
  ),
);

const name = $derived(section.heading?.text.trim() || t("section.untitled"));
const headingId = $derived(`section-heading-${section.id}`);

let card = $state<HTMLElement>();

/**
 * `Alt+↑` / `Alt+↓` reorder from anywhere inside the card. Attached as a real
 * listener rather than a template handler so the element stays an `<article>`:
 * the landmark semantics matter more than the convenience of the shorthand.
 */
$effect(() => {
  const element = card;
  if (!element) return;
  const handler = (event: KeyboardEvent) => {
    if (!event.altKey) return;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      onmove(-1);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      onmove(1);
    }
  };
  element.addEventListener("keydown", handler);
  return () => element.removeEventListener("keydown", handler);
});

function acknowledge(): void {
  for (const block of section.blocks) {
    if (block.confidence === "low") onacknowledge(block.id);
  }
  section.confidence = undefined;
  onchange();
}
</script>

<article
  bind:this={card}
  data-section-card
  data-section-id={section.id}
  tabindex="-1"
  aria-labelledby={headingId}
  class:border-l-4={uncertain}
  class:border-l-muted={uncertain}
  class="rounded-md border border-hairline bg-white p-3 shadow-chrome focus-ring"
>
  <div class="flex flex-wrap items-end gap-2">
    <div class="flex min-w-48 flex-1 flex-col gap-1">
      <label class="field-label" for={headingId}>{t("section.heading")}</label>
      <input
        id={headingId}
        class="field-input font-serif text-base font-semibold text-brand"
        value={section.heading?.text ?? ""}
        placeholder={t("section.headingPlaceholder")}
        oninput={(event) => onheading(event.currentTarget.value)}
      >
    </div>

    <div class="flex items-center gap-1">
      <button
        type="button"
        class="btn-ghost px-2 py-1 text-sm"
        disabled={index === 0}
        aria-label={t("section.moveUp")}
        title="{t("section.moveUp")} (Alt+↑)"
        onclick={() => onmove(-1)}
      >
        ↑
      </button>
      <button
        type="button"
        class="btn-ghost px-2 py-1 text-sm"
        disabled={index === total - 1}
        aria-label={t("section.moveDown")}
        title="{t("section.moveDown")} (Alt+↓)"
        onclick={() => onmove(1)}
      >
        ↓
      </button>

      <!--
        Reordering is inline because it is constant and has a keyboard twin.
        Repairing a section — undoing a split the parser invented, demoting a
        heading it invented, deleting the whole thing — is rare, needs words
        rather than glyphs to be understood, and one of the three is
        irreversible. All three live behind the same disclosure.
      -->
      <Menu
        label={t("section.more")}
        triggerLabel={t("section.more")}
        align="right"
        triggerClass="btn-ghost px-2 py-1 text-sm"
      >
        {#snippet trigger()}
          ⋯
        {/snippet}

        {#snippet children({
  close,
})}
          {#if section.heading}
            <button
              type="button"
              role="menuitem"
              tabindex="-1"
              class="block w-full px-4 py-2 text-left text-sm text-ink hover:bg-surface-sunken focus-ring"
              onclick={() => {
  close();
  onheadingtotext();
}}
            >
              {t("section.headingToText")}
            </button>
          {/if}
          <!--
            Absent rather than disabled on the first card: a disabled button
            cannot take focus, and the menu's arrow-key walk would appear to
            stall on it.
          -->
          {#if index > 0}
            <button
              type="button"
              role="menuitem"
              tabindex="-1"
              class="block w-full px-4 py-2 text-left text-sm text-ink hover:bg-surface-sunken focus-ring"
              onclick={() => {
  close();
  onmergeup();
}}
            >
              {t("section.mergeUp")}
            </button>
          {/if}
          <button
            type="button"
            role="menuitem"
            tabindex="-1"
            class="block w-full border-t border-hairline px-4 py-2 text-left text-sm text-ink hover:bg-surface-sunken focus-ring"
            onclick={() => {
  close();
  if (confirm(t("section.removeConfirm", { name }))) onremove();
}}
          >
            {t("section.remove")}
          </button>
        {/snippet}
      </Menu>
    </div>
  </div>

  {#if uncertain}
    <!--
      Never colour alone: a dotted rule, the word itself, and a way to clear it.
    -->
    <div class="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-surface-sunken px-2 py-1">
      <span class="text-xs font-semibold uppercase tracking-wide text-muted">
        {t("review.uncertain")}
      </span>
      <span class="flex-1 text-xs text-muted">
        {guessedList ? t("review.recoveredListHint") : t("review.uncertainHint")}
      </span>
      <button type="button" class="btn-ghost px-2 py-0.5 text-xs" onclick={acknowledge}>
        ✓ {t("review.acknowledge")}
      </button>
    </div>
  {/if}

  <div class="mt-3 flex flex-col gap-3">
    {#each groups as group (group.start)}
      {#if group.kind === "body"}
        <RichTextEditor
          blocks={group.blocks}
          {docLang}
          {t}
          labelledBy={headingId}
          onchange={(blocks) => onbodychange(group.start, group.blocks.length, blocks)}
          onformat={onformatpaste}
        />
      {:else if group.block.type === "agenda"}
        <AgendaEditor block={group.block} {t} {onchange} />
      {:else if group.block.type === "actions"}
        <ActionItemsEditor block={group.block} {t} {onchange} />
      {:else if group.block.type === "decisions"}
        <TextListEditor
          items={group.block.items}
          itemLabel={t("decisions.item")}
          addLabel={t("decisions.add")}
          removeLabel={t("decisions.remove")}
          idPrefix="decision-{group.block.id}"
          {onchange}
        />
      {:else if group.block.type === "notice"}
        <NoticeEditor block={group.block} {t} {onchange} />
      {:else if group.block.type === "quote"}
        <QuoteEditor block={group.block} {t} {onchange} />
      {:else if group.block.type === "contact"}
        <ContactEditor block={group.block} {t} {onchange} />
      {:else if group.block.type === "closing"}
        <ClosingEditor block={group.block} {t} {onchange} />
      {:else if group.block.type === "heading"}
        <div class="flex flex-col gap-1">
          <label class="field-label" for="subheading-{group.block.id}">
            {t("section.heading")}
          </label>
          <input
            id="subheading-{group.block.id}"
            class="field-input text-sm font-semibold uppercase tracking-wide"
            bind:value={group.block.text}
            oninput={onchange}
          >
        </div>
      {/if}
    {/each}
  </div>
</article>
