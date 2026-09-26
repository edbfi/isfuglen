<script lang="ts">
import type { Translator } from "../lib/i18n/index";
import { inlineToPlain, rich } from "../lib/model/factory";
import type { NoticeBlock } from "../lib/model/types";
import { parseInline } from "../lib/parser/inline";

interface Props {
  block: NoticeBlock;
  t: Translator;
  onchange: () => void;
}

let { block, t, onchange }: Props = $props();
</script>

<div class="flex flex-col gap-2">
  <div class="flex flex-wrap gap-2">
    <div class="flex w-48 flex-col gap-1">
      <label class="field-label" for="notice-tone-{block.id}">{t("notice.tone")}</label>
      <select id="notice-tone-{block.id}" class="field-input" bind:value={block.tone} {onchange}>
        <option value="important">{t("notice.toneImportant")}</option>
        <option value="info">{t("notice.toneInfo")}</option>
      </select>
    </div>
    <div class="flex min-w-48 flex-1 flex-col gap-1">
      <label class="field-label" for="notice-title-{block.id}">{t("notice.title")}</label>
      <input
        id="notice-title-{block.id}"
        class="field-input"
        bind:value={block.title}
        oninput={onchange}
        placeholder={block.tone === "important" ? t("notice.toneImportant") : t("notice.toneInfo")}
      >
    </div>
  </div>

  <div class="flex flex-col gap-1">
    <label class="field-label" for="notice-body-{block.id}">{t("notice.content")}</label>
    <textarea
      id="notice-body-{block.id}"
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
</div>
