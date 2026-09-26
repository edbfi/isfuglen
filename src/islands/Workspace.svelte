<script lang="ts">
import { createTranslator, isLang } from "../lib/i18n/index";
import { resolvePath } from "../lib/i18n/routes";
import type { Lang } from "../lib/i18n/types";
import type { DocLang, NewsletterDoc } from "../lib/model/types";
import { parseNewsletter } from "../lib/parser/index";
import {
  clearCurrent,
  isStorageAvailable,
  loadCurrent,
  requestPersistence,
  saveCurrent,
} from "../lib/storage/documents";
import { docLangDefault, settings, uiLang, updateSettings } from "../lib/storage/prefs";
import { DocumentStore } from "../lib/stores/document.svelte";
import { StatusStore } from "../lib/stores/status.svelte";
import AppHeader from "./AppHeader.svelte";
import DraftsPanel from "./DraftsPanel.svelte";
import EditorPane from "./EditorPane.svelte";
import EntryScreen from "./EntryScreen.svelte";
import ExportBar from "./ExportBar.svelte";
import PreviewPane from "./PreviewPane.svelte";
import RawTextView from "./RawTextView.svelte";
import ReviewStrip from "./ReviewStrip.svelte";
import LiveRegion from "./ui/LiveRegion.svelte";
import Tabs from "./ui/Tabs.svelte";

/**
 * The workspace island — docs/PLAN.md §3.2, §6.1.
 *
 * A guided entry screen followed by a unified workspace. A wizard is correct
 * when steps are sequential and non-repeating; here step three is a loop —
 * edit, look at the preview, edit, export, notice a typo, edit, export again —
 * and a wizard would charge navigation cost on every lap.
 *
 * Export is a persistent bar rather than a destination, and tabs appear only
 * below the `lg` breakpoint, where a split view cannot show both panes at a
 * usable width.
 */
interface Props {
  /** The route's locale, which is the first step of the resolution order. */
  initialLang: Lang;
}

let { initialLang }: Props = $props();

const store = new DocumentStore();
const status = new StatusStore();

type Mode = "entry" | "workspace";
type EditorView = "edit" | "raw";
type MobilePane = "edit" | "raw" | "preview";

let mode = $state<Mode>("entry");
let editorView = $state<EditorView>("edit");
let mobilePane = $state<MobilePane>("edit");
let split = $state(true);
let draftsOpen = $state(false);
let resumable = $state<{ name: string; updatedAt: string } | null>(null);
let evictionNotice = $state(false);
let ready = $state(false);

const lang = $derived(($uiLang ?? "da") as Lang);
const t = $derived(createTranslator(lang));

/**
 * First-run resolution order (§9.2):
 *   1. the URL locale prefix — explicit intent from a shared link
 *   2. localStorage
 *   3. "da", always. `navigator.language` is never consulted.
 */
$effect(() => {
  if (typeof window === "undefined") return;
  const fromUrl = resolvePath(window.location.pathname).lang;
  const stored = uiLang.get();
  const resolved = fromUrl !== "da" ? fromUrl : isLang(stored) ? stored : initialLang;
  if (resolved !== stored) uiLang.set(resolved);
  document.documentElement.lang = resolved;
});

/**
 * The document language for a *new* document (§9.1). The coupling to the
 * interface language exists here and nowhere else: once a document exists,
 * switching the interface must not relabel it.
 */
function docLangForNewDocument(): DocLang {
  return $settings.docLangChosen ? (($docLangDefault ?? "da") as DocLang) : (lang as DocLang);
}

$effect(() => {
  if (typeof window === "undefined") return;
  const query = window.matchMedia("(min-width: 1024px)");
  const apply = () => {
    split = query.matches;
  };
  apply();
  query.addEventListener("change", apply);
  return () => query.removeEventListener("change", apply);
});

$effect(() => {
  void (async () => {
    const available = await isStorageAvailable();
    if (!available) {
      status.markUnavailable();
      ready = true;
      return;
    }
    void requestPersistence();

    const current = await loadCurrent();
    if (current.ok) {
      const name = current.doc.meta.title.trim() || t("drafts.nameDefault");
      resumable = { name, updatedAt: current.doc.updatedAt };
    }

    // Safari deletes script-writable storage after seven days without use.
    // Said once, dismissible, and never again (§16.5).
    const isSafari =
      /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent) &&
      !$settings.dismissedEvictionNotice;
    evictionNotice = isSafari;

    ready = true;
  })();
});

/* ---------- autosave ---------- */

$effect(() => {
  // `$state.snapshot` reads the document deeply, which is what registers this
  // effect against every nested edit. Debounced so a burst of keystrokes is
  // one write, and asynchronous so it never blocks typing.
  const snapshot = $state.snapshot(store.doc) as NewsletterDoc;
  if (mode !== "workspace" || status.saveState === "unavailable") return;

  const timer = setTimeout(async () => {
    status.markSaving();
    try {
      await saveCurrent(snapshot);
      status.markSaved();
    } catch {
      status.markFailed();
    }
  }, 600);

  return () => clearTimeout(timer);
});

/* ---------- transitions ---------- */

function format(raw: string): void {
  const docLang = docLangForNewDocument();
  const result = parseNewsletter(raw, {
    lang: docLang,
    organisation: $settings.organisation,
    footerNote: $settings.footerNote,
  });
  store.load(result.doc, result.report);
  mode = "workspace";
  status.announce(t("a11y.parseDone", { sections: result.report.sectionCount }));
}

function blank(): void {
  store.reset(docLangForNewDocument(), $settings.organisation, $settings.footerNote);
  mode = "workspace";
}

async function resume(): Promise<void> {
  const current = await loadCurrent();
  if (!current.ok) {
    status.error(t("drafts.unreadable"));
    return;
  }
  store.load(current.doc);
  mode = "workspace";
}

async function discardResumable(): Promise<void> {
  await clearCurrent();
  resumable = null;
}

function clearAll(): void {
  if (!confirm(t("workspace.clearConfirm"))) return;
  void clearCurrent();
  store.reset(docLangForNewDocument(), $settings.organisation, $settings.footerNote);
  resumable = null;
  mode = "entry";
}

function setDocLang(next: DocLang): void {
  store.setDocLang(next);
  docLangDefault.set(next);
  updateSettings({ docLangChosen: true });
  status.announce(
    next === "da"
      ? "Dokumentsproget er skiftet til dansk."
      : "Document language changed to English.",
  );
}

function reparse(raw: string): void {
  const result = parseNewsletter(raw, {
    lang: store.doc.docLang,
    organisation: store.doc.meta.organisation ?? $settings.organisation,
    footerNote: store.doc.meta.footerNote ?? $settings.footerNote,
    docLangExplicit: store.doc.docLangExplicit,
  });
  result.doc.docLang = store.doc.docLang;
  store.load(result.doc, result.report);
  editorView = "edit";
  mobilePane = "edit";
  status.announce(t("raw.reverted"));
}

/**
 * A large structured paste, laid out as sections in place of the one it was
 * pasted into (§11.7). The document's own header is left alone: the user was
 * adding to a newsletter, not starting a different one.
 */
function formatPaste(sectionId: string, raw: string): void {
  const index = store.doc.sections.findIndex((section) => section.id === sectionId);
  if (index < 0) return;
  const { doc: parsed } = parseNewsletter(raw, { lang: store.doc.docLang });
  if (parsed.sections.length === 0) return;
  store.doc.sections.splice(index, 1, ...parsed.sections);
  store.touch();
}

/** Clicking a block in the preview focuses the matching editor card (§3.5). */
function selectBlock(blockId: string): void {
  const section = store.sectionOf(blockId);
  if (!section) return;
  if (!split) mobilePane = "edit";
  editorView = "edit";
  queueMicrotask(() => {
    const card = document.querySelector<HTMLElement>(
      `[data-section-card][data-section-id="${section.id}"]`,
    );
    card?.scrollIntoView({ block: "center", behavior: "smooth" });
    card?.focus();
  });
}

function openDraft(doc: NewsletterDoc): void {
  store.load(doc);
  mode = "workspace";
}

const tabs = $derived([
  { id: "edit", label: t("workspace.edit") },
  { id: "raw", label: t("workspace.raw") },
  { id: "preview", label: t("workspace.preview") },
]);
</script>

<LiveRegion
  polite={status.polite}
  assertive={status.assertive}
  politeLabel={t("a11y.liveStatus")}
  errorLabel={t("a11y.liveErrors")}
/>

<div class="flex min-h-screen flex-col">
  <AppHeader
    {lang}
    {t}
    showActions={mode === "workspace"}
    onlang={(next) => uiLang.set(next)}
    announce={(message) => status.announce(message)}
    ondrafts={() => {
  draftsOpen = true;
}}
    onclear={clearAll}
  />

  {#if evictionNotice}
    <div
      class="app-chrome flex items-center gap-3 border-b border-hairline bg-important-fill px-4 py-2 text-sm"
    >
      <p class="flex-1">{t("storage.evictionNotice")}</p>
      <button
        type="button"
        class="btn-ghost text-xs"
        onclick={() => {
  evictionNotice = false;
  updateSettings({ dismissedEvictionNotice: true });
}}
      >
        {t("storage.evictionDismiss")}
      </button>
    </div>
  {/if}

  {#if mode === "entry"}
    <EntryScreen
      {lang}
      {t}
      resumable={ready ? resumable : null}
      onformat={format}
      onblank={blank}
      onresume={resume}
      ondiscard={discardResumable}
    />
  {:else}
    {#if store.report && !store.reviewDismissed}
      <ReviewStrip
        {t}
        report={store.report}
        onwalk={selectBlock}
        ondismiss={() => {
  store.reviewDismissed = true;
}}
      />
    {/if}

    <main id="main" class="flex min-h-0 flex-1 flex-col">
      {#if split}
        <div class="grid min-h-0 flex-1 grid-cols-[minmax(420px,1fr)_auto] overflow-hidden">
          <div class="flex min-h-0 flex-col overflow-hidden border-r border-hairline">
            <div
              class="app-chrome flex items-center gap-2 border-b border-hairline bg-white px-4 py-2"
            >
              <h2 class="text-xs font-semibold uppercase tracking-wide text-muted">
                {t("workspace.editorPane")}
              </h2>
              <div class="ml-auto w-56">
                <Tabs
                  tabs={[
  { id: "edit", label: t("workspace.edit") },
  { id: "raw", label: t("workspace.raw") },
]}
                  selected={editorView}
                  label={t("workspace.editorPane")}
                  onselect={(id) => {
  editorView = id as EditorView;
}}
                />
              </div>
            </div>

            <div class="min-h-0 flex-1 overflow-auto" id="panel-edit">
              {#if editorView === "edit"}
                <EditorPane
                  {store}
                  {t}
                  onchange={() => store.touch()}
                  ondoclang={setDocLang}
                  onformatpaste={formatPaste}
                />
              {:else}
                <RawTextView doc={store.doc} {t} onapply={reparse} />
              {/if}
            </div>
          </div>

          <div class="flex min-h-0 w-[min(50vw,780px)] flex-col overflow-hidden">
            <PreviewPane doc={store.doc} {t} onselectblock={selectBlock} />
          </div>
        </div>
      {:else}
        <div class="app-chrome border-b border-hairline bg-white px-4 py-2">
          <Tabs
            {tabs}
            selected={mobilePane}
            label={t("workspace.editorPane")}
            onselect={(id) => {
  mobilePane = id as MobilePane;
}}
          />
        </div>

        <div class="min-h-0 flex-1 overflow-auto" id="panel-{mobilePane}" role="tabpanel">
          {#if mobilePane === "edit"}
            <EditorPane
              {store}
              {t}
              onchange={() => store.touch()}
              ondoclang={setDocLang}
              onformatpaste={formatPaste}
            />
          {:else if mobilePane === "raw"}
            <RawTextView doc={store.doc} {t} onapply={reparse} />
          {:else}
            <div class="h-full">
              <PreviewPane doc={store.doc} {t} onselectblock={selectBlock} />
            </div>
          {/if}
        </div>
      {/if}
    </main>

    <ExportBar
      doc={store.doc}
      {t}
      {lang}
      saveState={status.saveState}
      savedAt={status.savedAt}
      announce={(message) => status.announce(message)}
      onerror={(message) => status.error(message)}
      onsavedraft={() => {
  draftsOpen = true;
}}
    />
  {/if}
</div>

<DraftsPanel
  open={draftsOpen}
  doc={store.doc}
  {t}
  {lang}
  announce={(message) => status.announce(message)}
  onerror={(message) => status.error(message)}
  onopen={openDraft}
  onclose={() => {
  draftsOpen = false;
}}
/>
