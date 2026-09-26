<script lang="ts">
import type { Translator } from "../lib/i18n/index";

interface Props {
  t: Translator;
  value: number;
  onzoom: (delta: number) => void;
}

let { t, value, onzoom }: Props = $props();
</script>

<div class="flex items-center gap-1" role="group" aria-label={t("preview.zoomLevel", { value })}>
  <button
    type="button"
    class="btn-ghost px-2 py-0.5"
    aria-label={t("preview.zoomOut")}
    onclick={() => onzoom(-1)}
  >
    −
  </button>
  <button
    type="button"
    class="btn-ghost px-2 py-0.5 tabular-nums"
    aria-label={t("preview.zoomReset")}
    onclick={() => onzoom(0)}
  >
    {`${value} %`}
  </button>
  <button
    type="button"
    class="btn-ghost px-2 py-0.5"
    aria-label={t("preview.zoomIn")}
    onclick={() => onzoom(1)}
  >
    +
  </button>
</div>
