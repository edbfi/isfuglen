<script lang="ts">
import { formatSavedAt } from "../lib/i18n/format";
import type { Translator } from "../lib/i18n/index";
import { pathFor } from "../lib/i18n/routes";
import type { Lang } from "../lib/i18n/types";
import { normaliseValue } from "../lib/parser/normalise";

/**
 * The first screen is a paste target, not a dashboard — docs/PLAN.md §3.1.
 *
 * The textarea is focused on load, so a user who lands here and presses
 * Ctrl/⌘+V then Enter gets a formatted newsletter with zero clicks. On a
 * genuine first run the draft-resume row is absent, which leaves exactly three
 * elements on screen.
 */
interface Props {
  lang: Lang;
  t: Translator;
  resumable: { name: string; updatedAt: string } | null;
  onformat: (raw: string) => void;
  onblank: () => void;
  onresume: () => void;
  ondiscard: () => void;
}

let { lang, t, resumable, onformat, onblank, onresume, ondiscard }: Props = $props();

let raw = $state("");
let showEmptyError = $state(false);
let textarea = $state<HTMLTextAreaElement>();

const characters = $derived(raw.length);

$effect(() => {
  textarea?.focus();
});

function submit(): void {
  // NFC at every text ingress point, so a macOS clipboard's decomposed å does
  // not reach the rule packs (§8.7).
  const value = normaliseValue(raw).trim();
  if (value.length === 0) {
    showEmptyError = true;
    textarea?.focus();
    return;
  }
  showEmptyError = false;
  onformat(value);
}

function onkeydown(event: KeyboardEvent): void {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    submit();
  }
}
</script>

<main id="main" class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
  <div>
    <h1 class="font-serif text-4xl font-semibold text-ink">{t("app.title")}</h1>
    <p class="mt-2 text-lg text-muted">{t("app.tagline")}</p>
  </div>

  <div class="flex flex-col gap-2">
    <label class="field-label" for="entry-text">{t("entry.label")}</label>
    <textarea
      bind:this={textarea}
      bind:value={raw}
      id="entry-text"
      rows="14"
      spellcheck="false"
      aria-describedby={showEmptyError ? "entry-error entry-count" : "entry-count"}
      aria-invalid={showEmptyError}
      placeholder={t("entry.placeholder")}
      class="field-input resize-y font-sans text-base leading-relaxed"
      {onkeydown}
    ></textarea>
    <div class="flex items-center gap-3">
      <p id="entry-count" class="text-xs text-muted">
        {t("entry.charCount", { n: characters })}
      </p>
      {#if showEmptyError}
        <p id="entry-error" class="text-xs font-medium text-action-bar">{t("entry.empty")}</p>
      {/if}
    </div>
  </div>

  <div class="flex flex-wrap items-center gap-3">
    <button type="button" class="btn-primary text-base" onclick={submit}>
      {t("entry.format")}
    </button>
    <span class="text-sm text-muted">{t("entry.or")}</span>
    <button type="button" class="btn-secondary" onclick={onblank}>{t("entry.blank")}</button>
  </div>

  {#if resumable}
    <div class="rounded-md border border-hairline bg-white p-4 shadow-chrome">
      <h2 class="text-sm font-semibold text-brand">{t("entry.resumeHeading")}</h2>
      <p class="mt-1 text-sm text-muted">
        {t("entry.resumeMeta", {
  name: resumable.name,
  when: formatSavedAt(resumable.updatedAt, lang),
})}
      </p>
      <div class="mt-3 flex gap-2">
        <button type="button" class="btn-secondary" onclick={onresume}>
          {t("entry.resumeOpen")}
        </button>
        <button type="button" class="btn-ghost" onclick={ondiscard}>
          {t("entry.resumeDelete")}
        </button>
      </div>
    </div>
  {/if}

  <p class="border-t border-hairline pt-4 text-sm text-muted">
    {t("entry.privacyLine")}
    <a class="ml-1 text-brand-mid underline" href={pathFor(lang, "privacy")}>
      {t("entry.privacyLink")}
    </a>
  </p>
</main>
