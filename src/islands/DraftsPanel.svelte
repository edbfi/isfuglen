<script lang="ts">
import { formatSavedAt } from "../lib/i18n/format";
import type { Translator } from "../lib/i18n/index";
import type { Lang } from "../lib/i18n/types";
import { newId } from "../lib/model/factory";
import type { NewsletterDoc } from "../lib/model/types";
import { backupFilename, collectBackup, importBackup } from "../lib/storage/backup";
import {
  type DraftMeta,
  deleteDraft,
  deleteEverything,
  listDrafts,
  loadDraft,
  renameDraft,
  saveDraft,
} from "../lib/storage/documents";
import { clearPreferences } from "../lib/storage/prefs";
import Dialog from "./ui/Dialog.svelte";

/**
 * Drafts — docs/PLAN.md §5.6, §16.
 *
 * The file export/import pair is not a nice-to-have. It is the mitigation for
 * Safari's seven-day eviction of script-writable storage and the only durable
 * backup the user has, so it is a v1 requirement.
 */
interface Props {
  open: boolean;
  doc: NewsletterDoc;
  t: Translator;
  lang: Lang;
  announce: (message: string) => void;
  onerror: (message: string) => void;
  onopen: (doc: NewsletterDoc) => void;
  onclose: () => void;
}

let { open, doc, t, lang, announce, onerror, onopen, onclose }: Props = $props();

let drafts = $state<DraftMeta[]>([]);
let fileInput = $state<HTMLInputElement>();

async function refresh(): Promise<void> {
  drafts = await listDrafts();
}

$effect(() => {
  if (open) void refresh();
});

async function saveCurrent(): Promise<void> {
  const suggested = doc.meta.title.trim() || t("drafts.nameDefault");
  const name = prompt(t("drafts.namePrompt"), suggested);
  if (!name) return;
  await saveDraft(newId(), name, doc);
  await refresh();
  announce(t("drafts.saved"));
}

async function open_(meta: DraftMeta): Promise<void> {
  const result = await loadDraft(meta.id);
  if (!result.ok) {
    onerror(result.reason === "too-new" ? t("drafts.tooNew") : t("drafts.unreadable"));
    return;
  }
  onopen(result.doc);
  onclose();
}

async function rename(meta: DraftMeta): Promise<void> {
  const name = prompt(t("drafts.namePrompt"), meta.name);
  if (!name) return;
  await renameDraft(meta.id, name);
  await refresh();
}

async function remove(meta: DraftMeta): Promise<void> {
  if (!confirm(t("drafts.removeConfirm", { name: meta.name }))) return;
  await deleteDraft(meta.id);
  await refresh();
}

async function download(): Promise<void> {
  const backup = await collectBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = backupFilename();
  anchor.click();
  URL.revokeObjectURL(url);
}

async function load(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const result = await importBackup(await file.text());
  input.value = "";
  if (!result.ok) {
    onerror(t("drafts.importFailed"));
    return;
  }
  await refresh();
  announce(t("drafts.imported", { n: result.imported.length }));
}

async function wipe(): Promise<void> {
  if (!confirm(t("drafts.deleteAllConfirm"))) return;
  await deleteEverything();
  clearPreferences();
  window.location.reload();
}
</script>

<Dialog {open} title={t("drafts.title")} closeLabel={t("a11y.dialogClose")} {onclose}>
  <p class="text-sm text-muted">{t("drafts.intro")}</p>

  {#if drafts.length === 0}
    <p class="mt-4 text-sm text-ink">{t("drafts.empty")}</p>
  {:else}
    <ul class="mt-4 flex flex-col gap-2">
      {#each drafts as meta (meta.id)}
        <li class="rounded-md border border-hairline p-2">
          <div class="flex flex-wrap items-baseline gap-2">
            <span class="font-medium text-ink">{meta.name}</span>
            <span class="text-xs text-muted">{formatSavedAt(meta.updatedAt, lang)}</span>
          </div>
          <div class="mt-1 flex gap-1">
            <button type="button" class="btn-ghost px-2 py-0.5 text-xs" onclick={() => open_(meta)}>
              {t("drafts.openDraft")}
            </button>
            <button
              type="button"
              class="btn-ghost px-2 py-0.5 text-xs"
              onclick={() => rename(meta)}
            >
              {t("drafts.rename")}
            </button>
            <button
              type="button"
              class="btn-ghost px-2 py-0.5 text-xs"
              onclick={() => remove(meta)}
            >
              {t("drafts.remove")}
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="mt-4 flex flex-wrap gap-2 border-t border-hairline pt-4">
    <button type="button" class="btn-secondary text-sm" onclick={saveCurrent}>
      {t("drafts.saveCurrent")}
    </button>
    <button type="button" class="btn-secondary text-sm" onclick={download}>
      {t("drafts.download")}
    </button>
    <button type="button" class="btn-secondary text-sm" onclick={() => fileInput?.click()}>
      {t("drafts.load")}
    </button>
    <input
      bind:this={fileInput}
      type="file"
      accept="application/json,.json"
      class="visually-hidden"
      aria-label={t("drafts.load")}
      onchange={load}
    >
  </div>

  <div class="mt-4 border-t border-hairline pt-4">
    <button type="button" class="btn-ghost text-sm text-action-bar" onclick={wipe}>
      {t("drafts.deleteAll")}
    </button>
  </div>
</Dialog>
