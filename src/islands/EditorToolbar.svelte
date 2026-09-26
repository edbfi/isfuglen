<script lang="ts">
import type { Editor } from "@tiptap/core";
import type { Translator } from "../lib/i18n/index";

/**
 * The complete formatting surface — docs/PLAN.md §7.4.
 *
 * Bold, italic, link, two list types, clear formatting, undo and redo. That is
 * the whole set, and the scarcity is deliberate: formatting choice is what
 * lets a user produce an ugly document.
 */
interface Props {
  t: Translator;
  editor: Editor;
  /** Bumped by the parent on every transaction so the pressed states refresh. */
  version: number;
}

let { t, editor, version }: Props = $props();

let linkOpen = $state(false);
let linkHref = $state("");
let linkError = $state("");

const active = $derived.by(() => {
  void version;
  return {
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    link: editor.isActive("link"),
    bulletList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
  };
});

function openLink(): void {
  linkHref = (editor.getAttributes("link").href as string | undefined) ?? "";
  linkError = "";
  linkOpen = true;
}

function applyLink(): void {
  const value = linkHref.trim();
  if (value.length === 0) {
    editor.chain().focus().unsetLink().run();
    linkOpen = false;
    return;
  }
  if (!/^(https?:\/\/|mailto:|tel:)/i.test(value)) {
    linkError = t("validation.urlFormat");
    return;
  }
  editor.chain().focus().extendMarkRange("link").setLink({ href: value }).run();
  linkOpen = false;
}
</script>

<div class="flex flex-wrap items-center gap-1" role="group" aria-label={t("editor.toolbar")}>
  <button
    type="button"
    class="btn-ghost px-2 py-1 text-sm font-bold"
    aria-pressed={active.bold}
    title="{t("editor.bold")} (Ctrl+B)"
    aria-label={t("editor.bold")}
    onclick={() => editor.chain().focus().toggleBold().run()}
  >
    B
  </button>
  <button
    type="button"
    class="btn-ghost px-2 py-1 text-sm italic"
    aria-pressed={active.italic}
    title="{t("editor.italic")} (Ctrl+I)"
    aria-label={t("editor.italic")}
    onclick={() => editor.chain().focus().toggleItalic().run()}
  >
    I
  </button>
  <button
    type="button"
    class="btn-ghost px-2 py-1 text-sm"
    aria-pressed={active.link}
    title="{t("editor.link")} (Ctrl+K)"
    aria-label={t("editor.link")}
    onclick={openLink}
  >
    🔗
  </button>

  <span class="mx-1 h-4 w-px bg-hairline" aria-hidden="true"></span>

  <button
    type="button"
    class="btn-ghost px-2 py-1 text-sm"
    aria-pressed={active.bulletList}
    title={t("editor.bulletList")}
    aria-label={t("editor.bulletList")}
    onclick={() => editor.chain().focus().toggleBulletList().run()}
  >
    •
  </button>
  <button
    type="button"
    class="btn-ghost px-2 py-1 text-sm"
    aria-pressed={active.orderedList}
    title={t("editor.orderedList")}
    aria-label={t("editor.orderedList")}
    onclick={() => editor.chain().focus().toggleOrderedList().run()}
  >
    1.
  </button>
  <button
    type="button"
    class="btn-ghost px-2 py-1 text-xs"
    title={t("editor.clearFormatting")}
    aria-label={t("editor.clearFormatting")}
    onclick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
  >
    ⌫
  </button>

  <span class="mx-1 h-4 w-px bg-hairline" aria-hidden="true"></span>

  <button
    type="button"
    class="btn-ghost px-2 py-1 text-sm"
    disabled={!active.canUndo}
    title="{t("editor.undo")} (Ctrl+Z)"
    aria-label={t("editor.undo")}
    onclick={() => editor.chain().focus().undo().run()}
  >
    ↺
  </button>
  <button
    type="button"
    class="btn-ghost px-2 py-1 text-sm"
    disabled={!active.canRedo}
    title="{t("editor.redo")} (Ctrl+Shift+Z)"
    aria-label={t("editor.redo")}
    onclick={() => editor.chain().focus().redo().run()}
  >
    ↻
  </button>
</div>

{#if linkOpen}
  <div
    class="flex flex-wrap items-end gap-2 rounded-md border border-hairline bg-surface-sunken p-2"
  >
    <div class="flex min-w-56 flex-1 flex-col gap-1">
      <label class="field-label" for="link-href">{t("editor.linkUrl")}</label>
      <input
        id="link-href"
        class="field-input"
        type="url"
        bind:value={linkHref}
        aria-describedby={linkError ? "link-error" : undefined}
        aria-invalid={linkError.length > 0}
        placeholder="https://"
        onkeydown={(event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    applyLink();
  }
  if (event.key === "Escape") linkOpen = false;
}}
      >
      {#if linkError}
        <p id="link-error" class="text-xs font-medium text-action-bar">{linkError}</p>
      {/if}
    </div>
    <button type="button" class="btn-primary" onclick={applyLink}>{t("editor.linkSave")}</button>
    <button
      type="button"
      class="btn-ghost"
      onclick={() => {
  editor.chain().focus().unsetLink().run();
  linkOpen = false;
}}
    >
      {t("editor.linkRemove")}
    </button>
  </div>
{/if}
