<script lang="ts">
import type { Translator } from "../lib/i18n/index";
import { actionItem, inlineToPlain, rich } from "../lib/model/factory";
import type { ActionBlock } from "../lib/model/types";
import { parseInline } from "../lib/parser/inline";

interface Props {
  block: ActionBlock;
  t: Translator;
  onchange: () => void;
}

let { block, t, onchange }: Props = $props();

function setTask(index: number, value: string): void {
  const item = block.items[index];
  if (!item) return;
  // The task is `RichText` in the model, so a pasted link still becomes a
  // link — but the field itself stays a plain, labelled input.
  item.task = value.length > 0 ? parseInline(value) : rich("");
  onchange();
}
</script>

<div class="flex flex-col gap-2">
  {#each block.items as item, index (item.id)}
    <div class="flex flex-wrap items-end gap-2 rounded-md border border-hairline p-2">
      <div class="flex min-w-56 flex-[2] flex-col gap-1">
        <label class="field-label" for="action-task-{item.id}">{t("actions.task")}</label>
        <input
          id="action-task-{item.id}"
          class="field-input"
          value={inlineToPlain(item.task)}
          oninput={(event) => setTask(index, event.currentTarget.value)}
        >
      </div>
      <div class="flex min-w-32 flex-1 flex-col gap-1">
        <label class="field-label" for="action-owner-{item.id}">{t("actions.owner")}</label>
        <input
          id="action-owner-{item.id}"
          class="field-input"
          bind:value={item.owner}
          oninput={onchange}
        >
      </div>
      <div class="flex w-44 flex-col gap-1">
        <label class="field-label" for="action-due-{item.id}">{t("actions.due")}</label>
        <input
          id="action-due-{item.id}"
          class="field-input"
          type="date"
          bind:value={item.due}
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
        {t("actions.remove")}
      </button>
    </div>
  {/each}

  <div>
    <button
      type="button"
      class="btn-secondary text-sm"
      onclick={() => {
  block.items.push(actionItem(""));
  onchange();
}}
    >
      + {t("actions.add")}
    </button>
  </div>
</div>
