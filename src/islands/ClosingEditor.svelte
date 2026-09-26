<script lang="ts">
import type { Translator } from "../lib/i18n/index";
import { inlineToPlain, rich } from "../lib/model/factory";
import type { ClosingBlock } from "../lib/model/types";
import { parseInline } from "../lib/parser/inline";

interface Props {
  block: ClosingBlock;
  t: Translator;
  onchange: () => void;
}

let { block, t, onchange }: Props = $props();

const signature = $derived((block.signature ?? []).join("\n"));
</script>

<div class="flex flex-col gap-2">
  <div class="flex flex-col gap-1">
    <label class="field-label" for="closing-body-{block.id}">{t("closing.content")}</label>
    <input
      id="closing-body-{block.id}"
      class="field-input"
      value={inlineToPlain(block.content)}
      oninput={(event) => {
  const value = event.currentTarget.value;
  block.content = value.length > 0 ? parseInline(value) : rich("");
  onchange();
}}
    >
  </div>
  <div class="flex flex-col gap-1">
    <label class="field-label" for="closing-signature-{block.id}">{t("closing.signature")}</label>
    <textarea
      id="closing-signature-{block.id}"
      class="field-input"
      rows="3"
      aria-describedby="closing-signature-hint-{block.id}"
      value={signature}
      oninput={(event) => {
  block.signature = event.currentTarget.value.split("\n");
  onchange();
}}
    ></textarea>
    <p id="closing-signature-hint-{block.id}" class="text-xs text-muted">
      {t("closing.signatureHint")}
    </p>
  </div>
</div>
