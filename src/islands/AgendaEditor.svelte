<script lang="ts">
import type { Translator } from "../lib/i18n/index";
import { agendaItem } from "../lib/model/factory";
import type { AgendaBlock } from "../lib/model/types";

/**
 * Metadata is a labelled form field, never a rich-text region — docs/PLAN.md
 * §5.3. This is the concrete payoff of the hybrid editor architecture:
 * `Oplægsholder` gets a real `<label for>` and a real `<input>`, none of which
 * a ProseMirror node view would give for free.
 */
interface Props {
  block: AgendaBlock;
  t: Translator;
  onchange: () => void;
}

let { block, t, onchange }: Props = $props();
</script>

<div class="flex flex-col gap-2">
  {#each block.items as item, index (item.id)}
    <div class="flex flex-wrap items-end gap-2 rounded-md border border-hairline p-2">
      <div class="flex min-w-48 flex-[2] flex-col gap-1">
        <label class="field-label" for="agenda-text-{item.id}">
          {t("agenda.item")}
          {index + 1}
        </label>
        <input
          id="agenda-text-{item.id}"
          class="field-input"
          bind:value={item.text}
          oninput={onchange}
        >
      </div>
      <div class="flex min-w-32 flex-1 flex-col gap-1">
        <label class="field-label" for="agenda-presenter-{item.id}">{t("agenda.presenter")}</label>
        <input
          id="agenda-presenter-{item.id}"
          class="field-input"
          bind:value={item.presenter}
          oninput={onchange}
        >
      </div>
      <div class="flex w-24 flex-col gap-1">
        <label class="field-label" for="agenda-minutes-{item.id}">{t("agenda.minutes")}</label>
        <input
          id="agenda-minutes-{item.id}"
          class="field-input"
          type="number"
          min="0"
          max="600"
          bind:value={item.minutes}
          oninput={onchange}
        >
      </div>
      <button
        type="button"
        class="btn-ghost text-xs"
        onclick={() => {
  block.items.splice(index, 1);
  onchange();
}}
      >
        {t("agenda.remove")}
      </button>
    </div>
  {/each}

  <div>
    <button
      type="button"
      class="btn-secondary text-sm"
      onclick={() => {
  block.items.push(agendaItem(""));
  onchange();
}}
    >
      + {t("agenda.add")}
    </button>
  </div>
</div>
