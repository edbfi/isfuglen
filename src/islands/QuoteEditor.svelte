<script lang="ts">
import type { Translator } from "../lib/i18n/index";
import { inlineToPlain, rich } from "../lib/model/factory";
import type { QuoteBlock } from "../lib/model/types";
import { parseInline } from "../lib/parser/inline";

interface Props {
  block: QuoteBlock;
  t: Translator;
  onchange: () => void;
}

let { block, t, onchange }: Props = $props();
</script>

<div class="flex flex-col gap-2">
  <div class="flex flex-col gap-1">
    <label class="field-label" for="quote-body-{block.id}">{t("quote.content")}</label>
    <textarea
      id="quote-body-{block.id}"
      class="field-input"
      rows="3"
      value={inlineToPlain(block.content)}
      oninput={(event) => {
  const value = event.currentTarget.value;
  block.content = value.length > 0 ? parseInline(value) : rich("");
  onchange();
}}
    ></textarea>
  </div>
  <div class="flex flex-col gap-1">
    <label class="field-label" for="quote-attribution-{block.id}">{t("quote.attribution")}</label>
    <input
      id="quote-attribution-{block.id}"
      class="field-input"
      bind:value={block.attribution}
      oninput={onchange}
    >
  </div>
</div>
