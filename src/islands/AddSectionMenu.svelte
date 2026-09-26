<script lang="ts">
import type { MessageKey, Translator } from "../lib/i18n/index";
import { SECTION_TYPES, type SectionTypeKey } from "../lib/model/types";
import Menu from "./ui/Menu.svelte";

/**
 * Ten types. Not eleven, not twenty — docs/PLAN.md §5.4.
 *
 * Each maps to exactly one visual treatment in the template, so this menu *is*
 * the design system as far as the user is concerned. Adding an entry is a
 * design decision, not a feature request (§22 risk 11).
 */
interface Props {
  t: Translator;
  onadd: (type: SectionTypeKey) => void;
}

let { t, onadd }: Props = $props();

const TYPE_KEYS: Record<SectionTypeKey, MessageKey> = {
  heading: "sectionType.heading",
  agenda: "sectionType.agenda",
  decisions: "sectionType.decisions",
  actions: "sectionType.actions",
  notice: "sectionType.notice",
  quote: "sectionType.quote",
  bullets: "sectionType.bullets",
  numbers: "sectionType.numbers",
  contact: "sectionType.contact",
  closing: "sectionType.closing",
};
</script>

<Menu label={t("section.addMenu")} triggerClass="btn-secondary">
  {#snippet trigger()}
    + {t("section.add")}
  {/snippet}

  {#snippet children({
  close,
})}
    {#each SECTION_TYPES as type (type)}
      <button
        type="button"
        role="menuitem"
        tabindex="-1"
        class="block w-full px-4 py-2 text-left text-sm text-ink hover:bg-surface-sunken focus-ring"
        onclick={() => {
  close();
  onadd(type);
}}
      >
        {t(TYPE_KEYS[type])}
      </button>
    {/each}
  {/snippet}
</Menu>
