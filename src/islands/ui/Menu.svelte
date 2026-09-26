<script lang="ts">
import type { Snippet } from "svelte";

/**
 * A disclosure menu. Roving focus with the arrow keys, Escape closes and
 * returns focus to the trigger, and a click outside dismisses it — the
 * keyboard contract of docs/PLAN.md §17.2 without a dependency.
 *
 * The `children` snippet receives `close`, so an item's own handler dismisses
 * the menu. That keeps every activation path on a real `<button>` rather than
 * on a click listener attached to the container.
 */
interface Props {
  label: string;
  trigger: Snippet;
  children: Snippet<[{ close: () => void }]>;
  align?: "left" | "right";
  triggerClass?: string;
  /** Names the trigger when its content is a glyph rather than words. */
  triggerLabel?: string;
}

let {
  label,
  trigger,
  children,
  align = "left",
  triggerClass = "btn-secondary",
  triggerLabel,
}: Props = $props();

let open = $state(false);
let root = $state<HTMLElement>();
let triggerEl = $state<HTMLButtonElement>();
let menuEl = $state<HTMLElement>();

const ALIGN: Record<"left" | "right", string> = {
  left: "left-0",
  right: "right-0",
};

function close(focusTrigger = true): void {
  open = false;
  if (focusTrigger) triggerEl?.focus();
}

function items(): HTMLElement[] {
  if (!menuEl) return [];
  return [...menuEl.querySelectorAll<HTMLElement>('[role="menuitem"]')];
}

function onkeydown(event: KeyboardEvent): void {
  const all = items();
  const index = all.indexOf(document.activeElement as HTMLElement);

  if (event.key === "Escape") {
    event.preventDefault();
    close();
    return;
  }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const next = event.key === "ArrowDown" ? index + 1 : index - 1;
    const target = all.at(next >= all.length ? 0 : next);
    target?.focus();
    return;
  }
  if (event.key === "Home") {
    event.preventDefault();
    all[0]?.focus();
  }
  if (event.key === "End") {
    event.preventDefault();
    all.at(-1)?.focus();
  }
}

$effect(() => {
  if (!open) return;
  const onPointerDown = (event: PointerEvent) => {
    if (root && !root.contains(event.target as Node)) close(false);
  };
  document.addEventListener("pointerdown", onPointerDown);
  return () => document.removeEventListener("pointerdown", onPointerDown);
});
</script>

<div class="relative" bind:this={root}>
  <button
    bind:this={triggerEl}
    type="button"
    class={triggerClass}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-label={triggerLabel}
    title={triggerLabel}
    onclick={() => {
  open = !open;
  if (open) queueMicrotask(() => items()[0]?.focus());
}}
    onkeydown={(event) => {
  if (event.key === "Escape" && open) close();
}}
  >
    {@render trigger()}
  </button>

  {#if open}
    <div
      bind:this={menuEl}
      role="menu"
      tabindex="-1"
      aria-label={label}
      class="absolute z-20 mt-1 min-w-56 rounded-md border border-hairline bg-white py-1 shadow-chrome {ALIGN[align]}"
      {onkeydown}
    >
      {@render children({ close })}
    </div>
  {/if}
</div>
