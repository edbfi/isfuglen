<script lang="ts">
/**
 * A tab list following the WAI-ARIA authoring pattern: arrow keys move
 * selection, Home and End jump to the ends, and only the selected tab is in
 * the tab order.
 *
 * Keyboard handling lives on each tab rather than on the list, because with a
 * roving tabindex the focus is always on a tab — and a `tablist` that takes
 * focus itself is a step nobody wants in their way.
 */
interface Tab {
  id: string;
  label: string;
}

interface Props {
  tabs: Tab[];
  selected: string;
  label: string;
  onselect: (id: string) => void;
}

let { tabs, selected, label, onselect }: Props = $props();

let list = $state<HTMLElement>();

function onkeydown(event: KeyboardEvent): void {
  const index = tabs.findIndex((tab) => tab.id === selected);
  let next = index;
  if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
  else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = tabs.length - 1;
  else return;

  event.preventDefault();
  const target = tabs[next];
  if (!target) return;
  onselect(target.id);
  queueMicrotask(() => list?.querySelector<HTMLElement>(`#tab-${target.id}`)?.focus());
}
</script>

<div
  bind:this={list}
  role="tablist"
  aria-label={label}
  class="flex gap-1 rounded-md bg-surface-sunken p-1"
>
  {#each tabs as tab (tab.id)}
    <button
      id="tab-{tab.id}"
      type="button"
      role="tab"
      aria-selected={tab.id === selected}
      aria-controls="panel-{tab.id}"
      tabindex={tab.id === selected ? 0 : -1}
      class:bg-white={tab.id === selected}
      class:text-brand={tab.id === selected}
      class:shadow-chrome={tab.id === selected}
      class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium text-muted focus-ring"
      onclick={() => onselect(tab.id)}
      {onkeydown}
    >
      {tab.label}
    </button>
  {/each}
</div>
