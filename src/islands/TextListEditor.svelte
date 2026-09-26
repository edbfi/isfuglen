<script lang="ts">
import { inlineToPlain, rich } from "../lib/model/factory";
import type { RichText } from "../lib/model/types";
import { parseInline } from "../lib/parser/inline";

/**
 * One labelled input per item, for a list of `RichText` values — the shape
 * shared by decisions, bulleted lists and numbered lists.
 *
 * Kept as separate inputs rather than one rich-text surface because the item
 * boundaries are structural. A user who presses Enter in a decisions block
 * means "another decision", not "a line break", and a form makes that
 * unambiguous for the keyboard and for assistive technology alike.
 */
interface Props {
  items: RichText[];
  itemLabel: string;
  addLabel: string;
  removeLabel: string;
  idPrefix: string;
  onchange: () => void;
}

let { items, itemLabel, addLabel, removeLabel, idPrefix, onchange }: Props = $props();
</script>

<div class="flex flex-col gap-2">
  {#each items as item, index (index)}
    <div class="flex items-end gap-2">
      <div class="flex flex-1 flex-col gap-1">
        <label class="field-label" for="{idPrefix}-{index}">
          {itemLabel}
          {index + 1}
        </label>
        <input
          id="{idPrefix}-{index}"
          class="field-input"
          value={inlineToPlain(item)}
          oninput={(event) => {
  const value = event.currentTarget.value;
  items[index] = value.length > 0 ? parseInline(value) : rich("");
  onchange();
}}
          onkeydown={(event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    items.splice(index + 1, 0, rich(""));
    onchange();
  }
}}
        >
      </div>
      <button
        type="button"
        class="btn-ghost text-xs"
        onclick={() => {
  items.splice(index, 1);
  onchange();
}}
      >
        {removeLabel}
      </button>
    </div>
  {/each}

  <div>
    <button
      type="button"
      class="btn-secondary text-sm"
      onclick={() => {
  items.push(rich(""));
  onchange();
}}
    >
      + {addLabel}
    </button>
  </div>
</div>
