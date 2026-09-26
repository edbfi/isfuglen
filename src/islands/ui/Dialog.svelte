<script lang="ts">
import type { Snippet } from "svelte";

/**
 * A modal dialog that traps focus while open and restores it on close
 * (docs/PLAN.md §17.3). Built on the native `<dialog>` element, so the
 * top layer, the backdrop and inert-ing the rest of the page are the
 * browser's job rather than ours.
 */
interface Props {
  open: boolean;
  title: string;
  closeLabel: string;
  children: Snippet;
  footer?: Snippet;
  onclose: () => void;
}

let { open, title, closeLabel, children, footer, onclose }: Props = $props();

let element = $state<HTMLDialogElement>();
let restoreTo: HTMLElement | null = null;

$effect(() => {
  const dialog = element;
  if (!dialog) return;

  if (open && !dialog.open) {
    restoreTo = document.activeElement as HTMLElement | null;
    dialog.showModal();
  } else if (!open && dialog.open) {
    dialog.close();
    restoreTo?.focus();
    restoreTo = null;
  }
});
</script>

<dialog
  bind:this={element}
  aria-label={title}
  class="w-[min(34rem,calc(100vw-2rem))] rounded-md border border-hairline bg-white p-0 text-ink shadow-chrome backdrop:bg-ink/30"
  oncancel={(event) => {
  event.preventDefault();
  onclose();
}}
  onclose={() => open && onclose()}
>
  <div class="flex items-start gap-4 border-b border-hairline px-5 py-4">
    <h2 class="font-serif text-lg font-semibold text-brand">{title}</h2>
    <button
      type="button"
      class="btn-ghost ml-auto px-2 py-1"
      aria-label={closeLabel}
      onclick={onclose}
    >
      <span aria-hidden="true">✕</span>
    </button>
  </div>

  <div class="px-5 py-4">
    {@render children()}
  </div>

  {#if footer}
    <div class="flex justify-end gap-2 border-t border-hairline px-5 py-3">
      {@render footer()}
    </div>
  {/if}
</dialog>
