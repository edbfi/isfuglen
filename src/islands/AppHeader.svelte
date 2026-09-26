<script lang="ts">
import type { Translator } from "../lib/i18n/index";
import { pathFor } from "../lib/i18n/routes";
import type { Lang } from "../lib/i18n/types";
import LanguageSwitch from "./LanguageSwitch.svelte";

interface Props {
  lang: Lang;
  t: Translator;
  showActions: boolean;
  onlang: (next: Lang) => void;
  announce: (message: string) => void;
  ondrafts: () => void;
  onclear: () => void;
}

let { lang, t, showActions, onlang, announce, ondrafts, onclear }: Props = $props();
</script>

<header
  class="app-chrome flex flex-wrap items-center gap-3 border-b border-hairline bg-white px-4 py-2"
>
  <img src="/brand/ishoej-kreds18.svg" alt="" width="300" height="100" class="h-7 w-auto">
  <span class="font-serif text-base font-semibold text-brand">{t("app.title")}</span>

  <div class="ml-auto flex flex-wrap items-center gap-2">
    <LanguageSwitch {lang} {t} onchange={onlang} {announce} />

    {#if showActions}
      <button type="button" class="btn-secondary text-sm" onclick={ondrafts}>
        {t("drafts.open")}
      </button>
      <button type="button" class="btn-ghost text-sm" onclick={onclear}>
        {t("workspace.clear")}
      </button>
    {/if}

    <a class="btn-ghost text-sm" href={pathFor(lang, "help")}>{t("nav.help")}</a>
  </div>
</header>
