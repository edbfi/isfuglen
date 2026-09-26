<script lang="ts">
import type { Translator } from "../lib/i18n/index";
import { resolvePath, siblingPath } from "../lib/i18n/routes";
import type { Lang } from "../lib/i18n/types";

/**
 * The interface-language switch — docs/PLAN.md §9.3.
 *
 * A two-option segmented control rather than a `<select>`: with two languages
 * a dropdown costs an extra interaction for nothing.
 *
 * The order of operations matters and is the whole point of this component.
 * `document.documentElement.lang` is updated *before* the announcement text
 * changes, so a screen reader has already switched voice by the time it reads
 * "Interface language changed to English" — announcing that in Danish would be
 * incomprehensible. And the URL is kept in sync with `replaceState`, not
 * `pushState`: a language switch is not a navigation the Back button should
 * undo, and `replaceState` does not reload, so no editor state is lost and no
 * re-parse occurs.
 */
interface Props {
  lang: Lang;
  t: Translator;
  onchange: (next: Lang) => void;
  announce: (message: string) => void;
}

let { lang, t, onchange, announce }: Props = $props();

const options: Lang[] = ["da", "en"];

function select(next: Lang): void {
  if (next === lang) return;

  // Resolved before `onchange`: `lang` is a prop, so reading it afterwards
  // returns the *new* language and `siblingPath` would point back where we
  // came from.
  const target =
    typeof window === "undefined"
      ? undefined
      : siblingPath(lang, resolvePath(window.location.pathname).page);

  onchange(next);

  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
  }
  if (target !== undefined) {
    window.history.replaceState(null, "", target + window.location.search);
  }

  // Rendered in the new language, after <html lang> has already changed.
  announce(
    next === "da"
      ? "Brugerfladens sprog er skiftet til dansk."
      : "Interface language changed to English.",
  );
}
</script>

<div
  role="group"
  aria-label="Sprog / Language"
  class="flex overflow-hidden rounded-md border border-hairline"
>
  {#each options as option (option)}
    <!--
      `lang` on the button so "English" is pronounced in English inside a Danish
      page. `hreflang` belongs on links, not buttons, so it is not here — this
      control switches in place rather than navigating.
    -->
    <button
      type="button"
      lang={option}
      aria-pressed={option === lang}
      class:bg-brand={option === lang}
      class:text-white={option === lang}
      class:bg-white={option !== lang}
      class:text-brand={option !== lang}
      class="px-3 py-1 text-sm font-medium focus-ring"
      title={t("lang.switchUi")}
      onclick={() => select(option)}
    >
      {option === "da" ? "Dansk" : "English"}
    </button>
  {/each}
</div>
