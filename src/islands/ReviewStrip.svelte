<script lang="ts">
import type { Translator } from "../lib/i18n/index";
import type { ParseReport } from "../lib/parser/types";

/**
 * The review affordance — docs/PLAN.md §3.4.
 *
 * This is the mechanism that makes a deterministic parser acceptable: it is
 * allowed to be wrong, as long as it is honest about where. Only low-confidence
 * blocks are counted; flagging medium confidence would flood the strip and
 * train the user to ignore it.
 */
interface Props {
  t: Translator;
  report: ParseReport;
  onwalk: (blockId: string) => void;
  ondismiss: () => void;
}

let { t, report, onwalk, ondismiss }: Props = $props();

let cursor = $state(0);
let strip = $state<HTMLElement>();

const uncertain = $derived(report.lowConfidence.length);
/**
 * Two counts, each in its own sentence so each can be grammatical: the plural
 * machinery selects on one `n` at a time. The agenda and action tallies used
 * to be here too and are gone — "0 dagsorden og 0 handlinger" reads as a
 * failure report on a newsletter that never asked for either, and neither
 * number tells the reader to do anything.
 */
const summary = $derived(
  `${t("review.found", { n: report.sectionCount })} ${
    uncertain === 0 ? t("review.clean") : t("review.doubts", { n: uncertain })
  }`,
);

// Focus moves here after the parse transition so keyboard and screen-reader
// users are not stranded at the top of a page that has just changed (§17.3).
$effect(() => {
  strip?.focus();
});

function walk(): void {
  const entry = report.lowConfidence[cursor % uncertain];
  cursor += 1;
  if (entry) onwalk(entry.blockId);
}
</script>

<div
  bind:this={strip}
  tabindex="-1"
  class="app-chrome flex flex-wrap items-center gap-3 border-b border-hairline bg-info-fill px-4 py-2 text-sm text-ink focus-ring"
>
  <p class="flex-1">{summary}</p>
  {#if uncertain > 0}
    <button type="button" class="btn-secondary py-1 text-xs" onclick={walk}>
      {cursor === 0 ? t("review.show") : t("review.next")}
    </button>
  {/if}
  <button
    type="button"
    class="btn-ghost py-1 text-xs"
    onclick={ondismiss}
    aria-label={t("review.dismiss")}
  >
    {t("review.dismiss")}
  </button>
</div>
