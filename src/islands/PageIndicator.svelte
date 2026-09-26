<script lang="ts">
import type { Translator } from "../lib/i18n/index";

interface Props {
  t: Translator;
  page: number;
  pages: number;
}

let { t, page, pages }: Props = $props();
</script>

<p class="tabular-nums text-muted">{t("preview.page", { page, pages })}</p>
