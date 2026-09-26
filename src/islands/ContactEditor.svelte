<script lang="ts">
import type { Translator } from "../lib/i18n/index";
import { contactEntry } from "../lib/model/factory";
import type { ContactBlock } from "../lib/model/types";

interface Props {
  block: ContactBlock;
  t: Translator;
  onchange: () => void;
}

let { block, t, onchange }: Props = $props();
</script>

<div class="flex flex-col gap-2">
  {#each block.entries as entry, index (entry.id)}
    <div class="grid gap-2 rounded-md border border-hairline p-2 sm:grid-cols-2">
      <div class="flex flex-col gap-1">
        <label class="field-label" for="contact-name-{entry.id}">{t("contact.name")}</label>
        <input
          id="contact-name-{entry.id}"
          class="field-input"
          bind:value={entry.name}
          oninput={onchange}
        >
      </div>
      <div class="flex flex-col gap-1">
        <label class="field-label" for="contact-role-{entry.id}">{t("contact.role")}</label>
        <input
          id="contact-role-{entry.id}"
          class="field-input"
          bind:value={entry.role}
          oninput={onchange}
        >
      </div>
      <div class="flex flex-col gap-1">
        <label class="field-label" for="contact-email-{entry.id}">{t("contact.email")}</label>
        <input
          id="contact-email-{entry.id}"
          class="field-input"
          type="email"
          bind:value={entry.email}
          oninput={onchange}
        >
      </div>
      <div class="flex flex-col gap-1">
        <label class="field-label" for="contact-phone-{entry.id}">{t("contact.phone")}</label>
        <input
          id="contact-phone-{entry.id}"
          class="field-input"
          type="tel"
          bind:value={entry.phone}
          oninput={onchange}
        >
      </div>
      <div class="flex flex-col gap-1">
        <label class="field-label" for="contact-url-{entry.id}">{t("contact.url")}</label>
        <input
          id="contact-url-{entry.id}"
          class="field-input"
          type="url"
          bind:value={entry.url}
          oninput={onchange}
        >
      </div>
      <div class="flex items-end">
        <button
          type="button"
          class="btn-ghost text-xs"
          onclick={() => {
  block.entries.splice(index, 1);
  onchange();
}}
        >
          {t("contact.remove")}
        </button>
      </div>
    </div>
  {/each}

  <div>
    <button
      type="button"
      class="btn-secondary text-sm"
      onclick={() => {
  block.entries.push(contactEntry({}));
  onchange();
}}
    >
      + {t("contact.add")}
    </button>
  </div>
</div>
