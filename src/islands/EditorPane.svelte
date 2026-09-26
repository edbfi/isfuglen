<script lang="ts">
import type { Translator } from "../lib/i18n/index";
import type { DocLang, SectionTypeKey } from "../lib/model/types";
import type { BodyBlock } from "../lib/render/tiptap";
import type { DocumentStore } from "../lib/stores/document.svelte";
import AddSectionMenu from "./AddSectionMenu.svelte";
import DocumentHeaderCard from "./DocumentHeaderCard.svelte";
import SectionCard from "./SectionCard.svelte";

interface Props {
  store: DocumentStore;
  t: Translator;
  onchange: () => void;
  ondoclang: (lang: DocLang) => void;
  /** Replace one section with the result of laying a pasted text out (§11.7). */
  onformatpaste: (sectionId: string, raw: string) => void;
}

let { store, t, onchange, ondoclang, onformatpaste }: Props = $props();

function replaceBody(sectionId: string, start: number, count: number, blocks: BodyBlock[]): void {
  const section = store.doc.sections.find((candidate) => candidate.id === sectionId);
  if (!section) return;
  section.blocks.splice(start, count, ...blocks);
  onchange();
}

function add(type: SectionTypeKey): void {
  const created = store.addSection(type);
  onchange();
  queueMicrotask(() => {
    document.querySelector<HTMLElement>(`[data-section-id="${created.id}"] input`)?.focus();
  });
}

/**
 * Focus follows the section the content ended up in, so the next repair is one
 * keystroke away rather than a scroll and a hunt.
 */
function mergeUp(id: string): void {
  const index = store.doc.sections.findIndex((candidate) => candidate.id === id);
  const target = store.doc.sections[index - 1]?.id;
  if (!store.mergeSectionUp(id)) return;
  onchange();
  queueMicrotask(() => {
    document
      .querySelector<HTMLElement>(`[data-section-card][data-section-id="${target}"]`)
      ?.focus();
  });
}

function headingToText(id: string): void {
  if (!store.headingToText(id)) return;
  onchange();
}

function move(id: string, delta: number): void {
  if (!store.moveSection(id, delta)) return;
  onchange();
  // Focus follows the card, so a keyboard user can move a section repeatedly.
  queueMicrotask(() => {
    document.querySelector<HTMLElement>(`[data-section-card][data-section-id="${id}"]`)?.focus();
  });
}
</script>

<div class="flex flex-col gap-4 p-4">
  <DocumentHeaderCard doc={store.doc} {t} {onchange} {ondoclang} />

  {#each store.doc.sections as section, index (section.id)}
    <SectionCard
      {section}
      {index}
      total={store.doc.sections.length}
      docLang={store.doc.docLang}
      {t}
      {onchange}
      onmove={(delta) => move(section.id, delta)}
      onremove={() => {
  store.removeSection(section.id);
  onchange();
}}
      onheading={(value) => {
  store.setSectionHeading(section.id, value);
  onchange();
}}
      onbodychange={(start, count, blocks) => replaceBody(section.id, start, count, blocks)}
      onacknowledge={(blockId) => {
  store.clearConfidence(blockId);
  onchange();
}}
      onmergeup={() => mergeUp(section.id)}
      onheadingtotext={() => headingToText(section.id)}
      onformatpaste={(raw) => onformatpaste(section.id, raw)}
    />
  {/each}

  <div>
    <AddSectionMenu {t} onadd={add} />
  </div>
</div>
