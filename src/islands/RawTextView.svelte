<script lang="ts">
import type { Translator } from "../lib/i18n/index";
import { labelsFor } from "../lib/labels/index";
import type { NewsletterDoc } from "../lib/model/types";
import { renderPlainText } from "../lib/render/plaintext";

/**
 * The third view — docs/PLAN.md §7.5.
 *
 * This earns its place for one specific and common workflow: the user pastes,
 * the parse is 70 % right, and it is faster to fix the raw text and re-run than
 * to correct eight cards. It is also the honest escape hatch for when the
 * parser is simply wrong.
 *
 * The serialisation is the same one the clipboard's plain-text flavour uses, so
 * the two round-trip; anything the model can express that the syntax cannot is
 * written in a stable, human-readable form the parser reads back.
 */
interface Props {
  doc: NewsletterDoc;
  t: Translator;
  onapply: (raw: string) => void;
}

let { doc, t, onapply }: Props = $props();

const serialised = $derived(renderPlainText(doc, labelsFor(doc.docLang)));
let draft = $state<string | null>(null);

const value = $derived(draft ?? serialised);
</script>

<div class="flex h-full flex-col gap-2 p-4">
  <div class="flex flex-wrap items-center gap-3">
    <h2 class="font-serif text-base font-semibold text-brand">{t("raw.label")}</h2>
    <p class="flex-1 text-xs text-muted">{t("raw.hint")}</p>
    <button
      type="button"
      class="btn-primary text-sm"
      onclick={() => {
  onapply(value);
  draft = null;
}}
    >
      {t("raw.apply")}
    </button>
  </div>

  <label class="visually-hidden" for="raw-text">{t("raw.label")}</label>
  <textarea
    id="raw-text"
    class="field-input h-full min-h-96 flex-1 resize-none font-mono text-sm leading-relaxed"
    spellcheck="false"
    {value}
    oninput={(event) => {
  draft = event.currentTarget.value;
}}
  ></textarea>
</div>
