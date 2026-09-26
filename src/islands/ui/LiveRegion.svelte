<script lang="ts">
/**
 * One polite region for status, one assertive region for errors, and nothing
 * else — docs/PLAN.md §17.6.
 *
 * Both are always present in the DOM. A live region inserted at the moment it
 * has something to say is frequently missed by assistive technology, which
 * only observes regions it already knows about.
 */
interface Props {
  polite: string;
  assertive: string;
  politeLabel: string;
  errorLabel: string;
}

let { polite, assertive, politeLabel, errorLabel }: Props = $props();
</script>

<div class="visually-hidden" role="status" aria-live="polite" aria-label={politeLabel}>
  {polite}
</div>
<div class="visually-hidden" role="alert" aria-live="assertive" aria-label={errorLabel}>
  {assertive}
</div>
