<script lang="ts">
import type { Translator } from "../lib/i18n/index";
import { inlineToPlain, rich } from "../lib/model/factory";
import type { DocLang, NewsletterDoc } from "../lib/model/types";
import { parseInline } from "../lib/parser/inline";
import { autosize } from "./ui/autosize.svelte";

/**
 * Document metadata and, deliberately, the document-language control —
 * docs/PLAN.md §4.3.
 *
 * Placing the document language *inside the document*, next to its title, is
 * what makes the two-axis model legible without explanation: one control lives
 * with the app, the other lives with the paper.
 */
interface Props {
  doc: NewsletterDoc;
  t: Translator;
  onchange: () => void;
  ondoclang: (lang: DocLang) => void;
}

let { doc, t, onchange, ondoclang }: Props = $props();

let expanded = $state(true);

const introText = $derived(doc.intro ? inlineToPlain(doc.intro) : "");
</script>

<section
  class="rounded-md border border-hairline bg-white p-3 shadow-chrome"
  aria-labelledby="doc-card-legend"
>
  <div class="flex items-center gap-2">
    <h2 id="doc-card-legend" class="font-serif text-base font-semibold text-brand">
      {t("doc.legend")}
    </h2>
    <button
      type="button"
      class="btn-ghost ml-auto px-2 py-1 text-xs"
      aria-expanded={expanded}
      aria-controls="doc-card-fields"
      onclick={() => {
  expanded = !expanded;
}}
    >
      {expanded ? t("doc.collapse") : t("doc.expand")}
    </button>
  </div>

  <div id="doc-card-fields" class="mt-3 grid gap-3" hidden={!expanded}>
    <div class="flex flex-col gap-1">
      <label class="field-label" for="doc-title">{t("doc.title")}</label>
      <input
        id="doc-title"
        class="field-input font-serif text-lg font-semibold"
        bind:value={doc.meta.title}
        placeholder={t("doc.titlePlaceholder")}
        oninput={onchange}
      >
    </div>

    <div class="flex flex-col gap-1">
      <label class="field-label" for="doc-subtitle">{t("doc.subtitle")}</label>
      <input
        id="doc-subtitle"
        class="field-input"
        bind:value={doc.meta.subtitle}
        placeholder={t("doc.subtitlePlaceholder")}
        oninput={onchange}
      >
    </div>

    <!--
      Title, subtitle, greeting — the three pieces of prose at the top of the
      printed page, in the order they appear there. The greeting is also the
      field most often rewritten after a parse, which is why it grows to fit
      rather than showing a paragraph through a two-row letterbox.
    -->
    <div class="flex flex-col gap-1">
      <label class="field-label" for="doc-intro">{t("doc.intro")}</label>
      <textarea
        id="doc-intro"
        class="field-input resize-y leading-relaxed"
        rows="5"
        placeholder={t("doc.introPlaceholder")}
        value={introText}
        use:autosize={{ min: 5, max: 16, value: () => introText }}
        oninput={(event) => {
  const value = event.currentTarget.value;
  doc.intro = value.length > 0 ? parseInline(value) : rich("");
  onchange();
}}
      ></textarea>
    </div>

    <div class="grid gap-3 sm:grid-cols-3">
      <div class="flex flex-col gap-1">
        <label class="field-label" for="doc-date">{t("doc.date")}</label>
        <input
          id="doc-date"
          class="field-input"
          type="date"
          bind:value={doc.meta.date}
          oninput={onchange}
        >
      </div>
      <div class="flex flex-col gap-1">
        <label class="field-label" for="doc-time-start">{t("doc.timeStart")}</label>
        <input
          id="doc-time-start"
          class="field-input"
          type="time"
          bind:value={doc.meta.timeStart}
          oninput={onchange}
        >
      </div>
      <div class="flex flex-col gap-1">
        <label class="field-label" for="doc-time-end">{t("doc.timeEnd")}</label>
        <input
          id="doc-time-end"
          class="field-input"
          type="time"
          bind:value={doc.meta.timeEnd}
          oninput={onchange}
        >
      </div>
    </div>

    <div class="flex flex-col gap-1">
      <label class="field-label" for="doc-location">{t("doc.location")}</label>
      <input
        id="doc-location"
        class="field-input"
        bind:value={doc.meta.location}
        placeholder={t("doc.locationPlaceholder")}
        oninput={onchange}
      >
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <div class="flex flex-col gap-1">
        <label class="field-label" for="doc-organisation">{t("doc.organisation")}</label>
        <input
          id="doc-organisation"
          class="field-input"
          bind:value={doc.meta.organisation}
          oninput={onchange}
        >
      </div>
      <div class="flex flex-col gap-1">
        <label class="field-label" for="doc-footer">{t("doc.footerNote")}</label>
        <input
          id="doc-footer"
          class="field-input"
          bind:value={doc.meta.footerNote}
          oninput={onchange}
        >
      </div>
    </div>

    <div class="flex flex-col gap-1 border-t border-hairline pt-3">
      <label class="field-label" for="doc-lang">{t("doc.docLang")}</label>
      <select
        id="doc-lang"
        class="field-input w-48"
        aria-describedby="doc-lang-hint"
        value={doc.docLang}
        onchange={(event) => ondoclang(event.currentTarget.value as DocLang)}
      >
        <option value="da">Dansk</option>
        <option value="en">English</option>
      </select>
      <p id="doc-lang-hint" class="text-xs text-muted">{t("doc.docLangHint")}</p>
    </div>
  </div>
</section>
