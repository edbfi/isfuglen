---
type: "agent_requested"
description: "Bun + Astro 7 + Svelte 5 + UnoCSS + shadcn-svelte + Biome coding guidelines"
---
# Islands on Bun: Astro 7 + Svelte 5 + UnoCSS Production Reference

This stack is a static-first, islands-architecture web framework: Astro 7 renders HTML at build time (or on demand behind an adapter), ships zero JavaScript by default, and hydrates individual Svelte 5 components only where you ask. Optimize for shipping the least client JS possible — reach for a `client:*` directive only when a component genuinely needs interactivity, keep everything else as server-rendered `.astro`, and move data work into Actions, content collections, and server islands rather than client fetches. Bun is the runtime, package manager, and script runner; UnoCSS is the atomic-CSS engine; shadcn-svelte supplies owned, copy-in component source; Biome is the formatter and linter.

The biggest way agents write wrong-but-plausible code here is importing habits from SvelteKit and from Tailwind-based shadcn. This is **not** SvelteKit: there is no `$app/state`, no `+page.server.ts`, no form actions in the SvelteKit sense, no `$lib` filesystem magic — routing, data loading, and server logic are Astro's (`src/pages`, Actions, content layer, middleware). And shadcn-svelte's own docs assume Tailwind v4; on this stack styling is UnoCSS, so the Tailwind CLI init path does not apply and you wire shadcn's tokens through `unocss-preset-shadcn` instead. Second: agents write Svelte 4 (`export let`, stores, `on:click`, `$:`, `createEventDispatcher`, `new Component()`) — none of that belongs in new code here. Third: agents forget that each island hydrates in isolation, so `.svelte.ts` rune state is not automatically shared between two separate islands on a page.

## Project layout and Bun toolchain

Bun is the whole toolchain: `bun install` (writes the text `bun.lock`), `bun run <script>`, `bunx` for one-off binaries, and `bun test` for plain-TypeScript unit tests. Run Astro's CLI through Bun's own runtime with the `--bun` flag so Astro executes on Bun rather than Node.

`package.json` scripts:

```json
{
  "name": "acme-web",
  "type": "module",
  "scripts": {
    "dev": "bun --bun astro dev",
    "build": "bun --bun astro build",
    "preview": "bun --bun astro preview",
    "check": "astro check && bunx svelte-check --tsconfig ./tsconfig.json",
    "format": "biome check --write .",
    "lint": "biome check .",
    "test": "vitest run",
    "test:unit": "bun test src/lib",
    "e2e": "playwright test"
  }
}
```

`bunfig.toml` — keep it minimal; the defaults are good. Set frozen installs in CI via the flag, not config:

```toml
[install]
exact = false

[test]
# Only plain-TS unit tests run under bun test; Svelte/Astro components go through Vitest.
root = "./src/lib"
```

Commit `bun.lock` (text, reviewable in PRs). CI installs with `bun install --frozen-lockfile` so a stale lockfile fails the build instead of silently drifting.

**Bun as a package manager gotcha:** `bun run test` can fail with `vitest: command not found` because Bun does not always put `node_modules/.bin` on `PATH` for nested scripts — invoke test binaries with `bunx` (`bunx vitest run`) or through a `package.json` script, which Bun resolves correctly.

## Astro configuration, output modes, and the Bun adapter question

`astro.config.mjs` is the single source of truth for integrations and rendering mode. Default output is static (`output: 'static'`); add an adapter only when you need on-demand rendering (SSR routes, Actions that mutate, sessions, or server islands). You can keep a static site and still opt individual routes into on-demand rendering with `export const prerender = false`, or use server islands (below) — you do not need to flip the whole site to `server`.

**Adapter on Bun:** there is no current, maintained official Bun adapter for Astro 7. The community Bun adapters pin to older Astro majors, so on Astro 7 the correct answer is the Node adapter running under the Bun runtime — Bun is Node-API compatible, so `@astrojs/node` builds a standalone server that you launch with `bun ./dist/server/entry.mjs`. This gives you Bun's fast install/run without depending on an unmaintained adapter.

```js
// astro.config.mjs
import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';
import svelte from '@astrojs/svelte';
import UnoCSS from 'unocss/astro';

export default defineConfig({
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [
    UnoCSS({ injectReset: true }),
    svelte(),
  ],
  env: {
    schema: {
      PUBLIC_SITE_URL: envField.string({ context: 'client', access: 'public' }),
      DATABASE_URL: envField.string({ context: 'server', access: 'secret' }),
      SESSION_SECRET: envField.string({ context: 'server', access: 'secret' }),
    },
  },
  session: {
    driver: 'fs', // dev-friendly; swap for a real driver in production
  },
});
```

**Integration order matters:** register `UnoCSS()` before `svelte()` so the UnoCSS Vite plugin processes class output ahead of the Svelte compiler. `injectReset: true` is required because `@unocss/astro` does not inject a browser reset by default, and shadcn's tokens assume a Tailwind-style reset is present.

Astro 7 requires Node 22.12 or newer for its build-time tooling even when you deploy on Bun — this comes from Vite 8, which requires Node.js 20.19+ or 22.12+ so `require(esm)` works without a flag. Astro 7 runs on Vite 8, whose Rolldown (a Rust-based bundler) replaces both esbuild and Rollup with a single unified bundler that is 10–30× faster than Rollup in benchmarks while supporting the same Rollup and Vite plugin APIs. Vite 8 ships a compatibility layer that auto-converts existing `esbuild` and `rollupOptions` configuration to their Rolldown equivalents, so the plugins above need no config changes.

### Routing

File-based routing lives in `src/pages`. `src/pages/index.astro` → `/`, `src/pages/blog/[slug].astro` → dynamic segment, `src/pages/[...path].astro` → rest/catch-all. For static builds, dynamic pages export `getStaticPaths()`; for on-demand pages, read `Astro.params` directly. API routes are `.ts` files exporting HTTP-method functions (`export function GET(context) {}`).

```astro
---
// src/pages/blog/[slug].astro
import { getCollection, render } from 'astro:content';
import Layout from '../../layouts/Layout.astro';

export async function getStaticPaths() {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}

const { post } = Astro.props;
const { Content } = await render(post);
---
<Layout title={post.data.title}>
  <article class="prose mx-auto max-w-2xl">
    <h1>{post.data.title}</h1>
    <Content />
  </article>
</Layout>
```

## Content layer and collections

Define collections in `src/content.config.ts` (the current location — not `src/content/config.ts`). Use the built-in `glob()` and `file()` loaders for local content, validate frontmatter with a Zod schema, and query with `getCollection`/`getEntry`. Render Markdown/MDX with the top-level `render(entry)` function and the returned `<Content />` component. The old per-entry `entry.render()` method and `entry.slug` are gone — entries have `id`, and you call `render(entry)`.

```ts
// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
  }),
});

const authors = defineCollection({
  loader: file('src/content/authors.json'),
  schema: z.object({ id: z.string(), name: z.string(), url: z.string().url().optional() }),
});

export const collections = { blog, authors };
```

The data store is immutable in production and only rebuilt at build time — a deployed static site cannot mutate a collection without a rebuild. In `astro dev` you can force a re-sync with the `s`+`Enter` hotkey. For large Markdown collections whose rendered HTML dwarfs the source, pass `deferRender: true` to `glob()` so rendering happens on demand per page instead of holding all HTML in memory during sync.

Note that Astro 7's default Markdown/MDX pipeline is native (Rust-powered) and no longer includes the remark/rehype pipeline by default; GFM, smart punctuation, heading IDs, footnotes, and frontmatter are built in. If a project depends on specific remark/rehype plugins, that pipeline must be reinstalled and configured explicitly — do not assume remark plugins are available out of the box.

## Actions: type-safe server functions

Actions are the idiomatic way to run server logic from the client without hand-writing API routes. Define them in `src/actions/index.ts` under a `server` export, validate input with Zod (`z` from `astro:schema`), and call them from client code or wire them straight to an HTML `<form>` with `accept: 'form'`. Actions require an adapter (on-demand rendering).

```ts
// src/actions/index.ts
import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import { db } from '../lib/server/db';

export const server = {
  createComment: defineAction({
    accept: 'form',
    input: z.object({
      postId: z.string(),
      body: z.string().min(1, 'Comment cannot be empty').max(2000),
    }),
    handler: async ({ postId, body }, context) => {
      const userId = context.session ? await context.session.get('userId') : undefined;
      if (!userId) {
        throw new ActionError({ code: 'UNAUTHORIZED', message: 'Sign in to comment.' });
      }
      const comment = await db.comment.create({ data: { postId, body, userId } });
      return comment;
    },
  }),
};
```

Calling from a Svelte island — the result is a discriminated `{ data, error }` object; check `error` before using `data`, and narrow with `isInputError`:

```svelte
<!-- src/components/CommentForm.svelte -->
<script lang="ts">
  import { actions, isInputError } from 'astro:actions';

  let { postId }: { postId: string } = $props();
  let pending = $state(false);
  let errorMsg = $state<string | null>(null);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const formEl = event.currentTarget as HTMLFormElement;
    pending = true;
    errorMsg = null;
    const form = new FormData(formEl);
    form.set('postId', postId);
    const { data, error } = await actions.createComment(form);
    pending = false;
    if (error) {
      errorMsg = isInputError(error) ? 'Check your input.' : error.message;
      return;
    }
    formEl.reset();
  }
</script>

<form onsubmit={submit} class="flex flex-col gap-2">
  <textarea name="body" required class="rounded border p-2"></textarea>
  <button type="submit" disabled={pending} class="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">
    {pending ? 'Posting…' : 'Post comment'}
  </button>
  {#if errorMsg}<p class="text-sm text-destructive">{errorMsg}</p>{/if}
</form>
```

For pure progressive enhancement, point a plain form at the action (`<form method="POST" action={actions.createComment}>`) and read the result from `Astro.getActionResult()` in the page frontmatter — no client JS required.

## Server islands

A server island is a server-rendered component that Astro defers: the page ships immediately with fallback content, then the island's real HTML is fetched and swapped in. Mark any component with `server:defer` and provide a `slot="fallback"`. Props must be serializable (plain objects, numbers, strings, `Array`, `Map`, `Set`, `Date`, `URL`, `BigInt`, typed arrays — **not** functions or circular structures). Use this for a small dynamic slice of an otherwise static, cacheable page — a personalized greeting, a live count — so you avoid making the whole route on-demand. Server islands require an adapter.

```astro
---
// src/pages/index.astro
import Layout from '../layouts/Layout.astro';
import LatestActivity from '../components/LatestActivity.astro';
---
<Layout title="Home">
  <h1>Welcome</h1>
  <LatestActivity server:defer>
    <p slot="fallback" class="text-muted-foreground">Loading recent activity…</p>
  </LatestActivity>
</Layout>
```

The island itself reads cookies, the session, or a database directly, because it runs on the server:

```astro
---
// src/components/LatestActivity.astro
import { db } from '../lib/server/db';
const items = await db.activity.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
---
<ul class="space-y-1">
  {items.map((i) => <li>{i.label}</li>)}
</ul>
```

## Typed environment variables (`astro:env`)

Declare env vars in the `env.schema` block of `astro.config.mjs` (shown above) using `envField`, then import them from `astro:env/client` or `astro:env/server`. This gives you validation at build/startup and prevents leaking secrets to the client: importing a `secret` server var from `astro:env/client` is a build error, and a missing required var fails loudly instead of surfacing as `undefined`.

```ts
// server-only module
import { DATABASE_URL, getSecret } from 'astro:env/server';
const db = connect(DATABASE_URL);            // typed string, guaranteed present
const optional = getSecret('FEATURE_FLAG');  // string | undefined, for vars outside the schema
```

Prefer `astro:env` over raw `import.meta.env` in new code — you get types, validation, and the client/server boundary enforced for you. Public client vars still must be prefixed `PUBLIC_`.

## Sessions, middleware, and auth

Sessions are server-stored state keyed by a cookie, serialized with `devalue` (same supported types as Actions and content: strings, numbers, `Date`, `Map`, `Set`, `URL`, arrays, plain objects). Access via `Astro.session` in `.astro` files and `context.session` in Actions, API routes, and middleware. Configure a `session.driver` in `astro.config.mjs`; sessions require an adapter and are not available in edge middleware.

```ts
// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';
import { auth } from './lib/server/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const result = await auth.api.getSession({ headers: context.request.headers });
  context.locals.user = result?.user ?? null;
  return next();
});
```

Type `context.locals` and session data by declaring the `App` namespace interfaces in `src/env.d.ts`:

```ts
// src/env.d.ts
declare namespace App {
  interface Locals {
    user: { id: string; name: string; email: string } | null;
  }
  interface SessionData {
    userId: string;
    cart: string[];
  }
}
```

The stack does not name an auth or database library, so do not invent one; Astro's own sessions, Actions, middleware, and content layer cover most needs. If a project adds authentication, a current Svelte/Astro-friendly choice is Better Auth wired through middleware as above — but that is a project decision, not a stack requirement.

## Svelte 5 islands

Write runes-mode Svelte 5 exclusively. Runes are compiler keywords (not imports) valid only in `.svelte`, `.svelte.ts`, and `.svelte.js` files.

- `$state` holds mutable reactive values; `$derived` computes from them (always consistent, lazy); `$effect` is for side effects only (DOM, network, subscriptions) and runs after DOM updates with cleanup. **Reach for `$derived` before `$effect`** — using an effect to copy one value into another is the single most common Svelte 5 mistake; the reactivity gets tangled and can loop.
- `$props()` replaces `export let`; destructure with defaults and types. `$bindable()` marks a prop as two-way.
- Event handlers are plain attributes: `onclick={...}`, not `on:click`. There is no `createEventDispatcher` — pass callback props instead.
- Snippets (`{#snippet}` / `{@render}`) replace slots. The default slot is the `children` prop.
- Mount programmatically with `mount`/`unmount`, never `new Component()`.
- `$state.raw` for large immutable structures you replace wholesale (no deep proxying); `$state.snapshot` to hand a plain non-proxied copy to external code; `$derived.by(() => {...})` for multi-statement derivations; `$effect.pre` to run before DOM update; `untrack` to read reactive state without subscribing.

A component that survives changing props, empty data, and cleanup:

```svelte
<!-- src/components/SearchList.svelte -->
<script lang="ts">
  interface Item { id: string; name: string; }
  let { items, initialQuery = '' }: { items: Item[]; initialQuery?: string } = $props();

  let query = $state(initialQuery);
  const filtered = $derived(
    query.trim() === ''
      ? items
      : items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
  );

  $effect(() => {
    const id = setTimeout(
      () => history.replaceState(null, '', `?q=${encodeURIComponent(query)}`),
      300
    );
    return () => clearTimeout(id); // cleanup on query change / unmount
  });
</script>

<input bind:value={query} placeholder="Search…" class="w-full rounded border p-2" />

{#if filtered.length === 0}
  <p class="p-4 text-center text-muted-foreground">No matches for “{query}”.</p>
{:else}
  <ul class="divide-y">
    {#each filtered as item (item.id)}
      <li class="p-2">{item.name}</li>
    {/each}
  </ul>
{/if}
```

Always key `{#each}` blocks with a stable id `(item.id)` so reordering and removal update the DOM correctly rather than by index.

### Shared reactive state in `.svelte.ts`

Extract reusable reactive logic into a `.svelte.ts` module. A class-based store keeps state and behavior together:

```ts
// src/lib/cart.svelte.ts
class Cart {
  items = $state<string[]>([]);
  readonly count = $derived(this.items.length);

  add(id: string) { this.items.push(id); }
  clear() { this.items = []; }
}

export const cart = new Cart();
```

### Islands inside Astro: hydration and state boundaries

In `.astro` files, a Svelte component renders to static HTML unless you add a client directive:

- `client:load` — hydrate immediately (interactive above the fold).
- `client:idle` — hydrate when the browser is idle (default choice for non-urgent widgets).
- `client:visible` — hydrate when scrolled into view (below the fold, heavy components).
- `client:only="svelte"` — skip SSR, render only on the client (for components that touch browser-only APIs).
- `client:media="(min-width: 768px)"` — hydrate at a breakpoint.

```astro
---
import SearchList from '../components/SearchList.svelte';
import ThemeToggle from '../components/ThemeToggle.svelte';
const items = await getItems();
---
<ThemeToggle client:load />
<SearchList items={items} client:visible />
```

**The island boundary is the biggest Svelte-in-Astro gotcha.** Each `client:*` component hydrates as an independent root. Props passed from `.astro` are serialized (JSON-compatible values only — no functions, no class instances). A `.svelte.ts` rune module shared between two *separate* islands on the same page is **not** guaranteed to be one shared instance, because islands are hydrated from separate entry points. For state that must be shared across islands (or across frameworks), use a framework-agnostic store like nanostores (`@nanostores/persistent` for cross-reload persistence); reserve `.svelte.ts` rune singletons for state shared *within a single island's* component tree. To compose an interactive shadcn widget whose trigger and content must talk to each other (dialogs, dropdowns), put the whole composed unit in one `.svelte` file and hydrate that as a single island, rather than island-wrapping the parts separately.

## UnoCSS

Install the `unocss` package and import the Astro integration from `unocss/astro` (this avoids version drift between the meta-package and the standalone integration). Use `presetWind4` — the current Tailwind-v4-compatible preset. Per the UnoCSS Wind4 docs, "we use the oklch color model to support better color contrast and color perception. Therefore, it is not compatible with presetLegacyCompat and is not recommended for use together." Wind4 also aligns its reset with Tailwind 4 and integrates it internally.

```ts
// uno.config.ts
import { defineConfig, presetWind4, presetIcons, presetWebFonts, transformerVariantGroup } from 'unocss';
import extractorSvelte from '@unocss/extractor-svelte';
import { presetShadcn } from 'unocss-preset-shadcn';
import presetAnimations from 'unocss-preset-animations';

export default defineConfig({
  presets: [
    presetWind4(),
    presetAnimations(),
    presetShadcn({ color: 'zinc' }),
    presetIcons({ scale: 1.2 }),
    presetWebFonts({ provider: 'google', fonts: { sans: 'Inter:400,500,600,700' } }),
  ],
  transformers: [transformerVariantGroup()],
  extractors: [extractorSvelte()],
  content: {
    pipeline: {
      include: [
        /\.(vue|svelte|[jt]sx|mdx?|astro|html)($|\?)/,
        '(components|src)/**/*.{js,ts}',
      ],
    },
  },
});
```

Two content-pipeline additions are mandatory on this stack:

1. **`@unocss/extractor-svelte`** — UnoCSS does not extract classes from Svelte's `class:foo={bar}` directive by default. Without this extractor those conditional classes are silently missing from the generated CSS.
2. **`.ts`/`.js` in the include list** — shadcn-svelte re-exports component styling from `index.ts`/`index.js` barrels, and UnoCSS does not scan JS/TS by default. Without `'(components|src)/**/*.{js,ts}'`, shadcn component classes are dropped.

Use `shortcuts` for repeated class clusters and `theme` for design tokens rather than duplicating long class strings across components. `transformerVariantGroup()` lets you write `hover:(bg-primary text-white)` instead of repeating the prefix.

## shadcn-svelte on UnoCSS

shadcn-svelte gives you owned component source (copied into your repo, built on `bits-ui` for accessible behavior), not a dependency you import. Its official docs assume Tailwind v4; on this stack you bridge its design tokens through `unocss-preset-shadcn` (added above), which as of its 1.0 line targets `presetWind4` by default. Because you are not using Tailwind, **do not run the shadcn-svelte `init` CLI's Tailwind path** — set the project up manually:

1. Install the runtime deps the components use: `bun add bits-ui clsx tailwind-merge tailwind-variants @lucide/svelte`.
2. Add the `cn` helper (shadcn-svelte's own utility — `tailwind-merge` + `clsx`, not `tailwind-variants`, for class merging):

```ts
// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

3. Create `components.json` manually (the CLI uses it to place added components and resolve aliases). Astro projects use `$lib`-style aliases defined in `tsconfig.json`, not SvelteKit's built-in `$lib`:

```json
{
  "$schema": "https://shadcn-svelte.com/schema.json",
  "tailwind": { "css": "src/styles/app.css", "baseColor": "zinc" },
  "aliases": {
    "components": "$lib/components",
    "utils": "$lib/utils",
    "ui": "$lib/components/ui",
    "hooks": "$lib/hooks",
    "lib": "$lib"
  },
  "typescript": true,
  "registry": "https://shadcn-svelte.com/registry"
}
```

4. Add the matching path alias to `tsconfig.json`:

```jsonc
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "$lib": ["./src/lib"], "$lib/*": ["./src/lib/*"] }
  }
}
```

5. Keep an empty `tailwind.config.js` at the project root — the shadcn-svelte CLI expects one to exist even though UnoCSS, not Tailwind, does the work. Then add components with `bunx shadcn-svelte@latest add button dialog`.

Import added components into `.astro` or other `.svelte` files:

```astro
---
import { Button } from '$lib/components/ui/button/index.js';
---
<Button>Click me</Button>
```

**Honest caveat:** `presetWind4` + `unocss-preset-shadcn` + Astro islands is comparatively new territory with no official support path from either the shadcn-svelte or Astro teams. `unocss-preset-shadcn`'s README code sample still imports `presetWind3` even though the package defaults to Wind4 — use `presetWind4()` as shown above and treat the README snippet as out of date. Verify token colors render correctly (oklch) before committing, and expect the preset to occasionally lag shadcn-svelte releases. shadcn-svelte's interactive components are runes-native (`$props`, snippets, `onclick`) and target `bits-ui` v2 — old forum threads claiming "not Svelte 5 ready" are stale.

## View transitions

Add Astro's `<ClientRouter />` to a shared layout `<head>` to turn multi-page navigation into animated single-page-style transitions with shared/persisted elements. It degrades gracefully where the native View Transitions API is unavailable. Because it swaps the DOM without a full reload, scripts and island state must be reinitialized on navigation — persist elements you want to survive with `transition:persist`.

```astro
---
// src/layouts/Layout.astro
import { ClientRouter } from 'astro:transitions';
const { title } = Astro.props;
---
<html lang="en">
  <head>
    <title>{title}</title>
    <ClientRouter />
  </head>
  <body>
    <slot />
  </body>
</html>
```

Pair matched elements across pages with `transition:name="hero"` and tune motion with `transition:animate={fade({ duration: '0.3s' })}`. `transition:persist` keeps a component (e.g. an audio player or a hydrated island) mounted across navigations. As native cross-document view transitions gain browser support, `<ClientRouter />` is increasingly optional for the animation itself — reach for it when you need its client-side routing, element persistence, or fallback control.

## Images

Use `astro:assets` for local and authorized remote images: the `<Image />` component emits optimized, correctly sized `<img>` with width/height to prevent layout shift, and `getImage()` returns processed attributes for custom markup. Import local images so Astro can process them at build time; declare permitted remote hosts in `astro.config.mjs` (`image.domains` / `image.remotePatterns`).

```astro
---
import { Image } from 'astro:assets';
import hero from '../assets/hero.jpg';
---
<Image src={hero} alt="Product hero" width={1200} height={630} loading="eager" />
```

## Biome: formatting and linting

Biome is the formatter and linter for JS/TS/JSON/CSS. Its Vue/Svelte/Astro support is opt-in and still experimental — per the Biome v2.3 release, "this feature is marked as experimental… To enable the feature, you'll have to opt in the new `html.experimentalFullSupportEnabled` option." Full support recognizes template references; keep unused-code rules enabled. Add only narrowly scoped exceptions for reproduced false positives, and validate formatter changes with both framework checkers. Since v2.4 Biome handles most Svelte 5 control-flow syntax (`{#if}{/if}`), but per its docs "newer features, rare syntax, or edge cases might not be covered yet." Biome does **not** type-check, so it complements — never replaces — `astro check` and `svelte-check`.

```jsonc
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/2.5.14/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "linter": { "enabled": true, "rules": { "preset": "recommended" } },
  "assist": { "enabled": true, "actions": { "source": { "preset": "recommended" } } },
  "html": { "experimentalFullSupportEnabled": true, "formatter": { "enabled": true } }
}
```

Commands: `biome check --write .` formats and applies safe lint fixes; `biome check .` is the read-only CI gate. Run through Bun with `bunx biome check .` if Biome is not a direct dependency.

Type-check separately: `astro check` (validates `.astro` files and frontmatter, uses the Astro language server) and `bunx svelte-check` (validates `.svelte` components). Both should run in CI alongside `biome check`.

## Testing

Split by what you are testing:

- **Plain-TypeScript logic** (utilities in `src/lib`, not touching Svelte or Astro compilation): `bun test` — fast, zero config. Note that `bun test` cannot compile runes, so it cannot test `.svelte` or `.svelte.ts` files.
- **Svelte 5 components**: Vitest in Browser Mode with `vitest-browser-svelte`, which renders in a real browser via Playwright — the reliable path for Svelte 5 reactivity (jsdom plus the older `@testing-library/svelte` struggles with runes). Requires Vitest 4.
- **Astro components**: the experimental Container API (`astro/container`) or `vitest-browser-astro`, driven through Astro's `getViteConfig()` so path aliases and config resolve.
- **End-to-end**: Playwright.

```ts
// vitest.config.ts
import { getViteConfig } from 'astro/config';
import { playwright } from '@vitest/browser-playwright';

export default getViteConfig({
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
});
```

```ts
// src/components/SearchList.test.ts
import { render } from 'vitest-browser-svelte';
import { expect, test } from 'vitest';
import SearchList from './SearchList.svelte';

test('filters items and shows empty state', async () => {
  const screen = render(SearchList, {
    items: [{ id: '1', name: 'Apple' }, { id: '2', name: 'Banana' }],
  });
  await screen.getByPlaceholder('Search…').fill('ban');
  await expect.element(screen.getByText('Banana')).toBeVisible();
  await screen.getByPlaceholder('Search…').fill('zzz');
  await expect.element(screen.getByText(/No matches/)).toBeVisible();
});
```

`getViteConfig()` propagates your Astro config (including `$lib` aliases) into the test environment, so no separate alias wiring is needed.

## Anti-patterns to avoid

| Wrong | Why | Right |
|---|---|---|
| `export let title` / `$: doubled = n * 2` / `on:click` in a `.svelte` file | Svelte 4 legacy syntax; not idiomatic in runes-mode Svelte 5 | `let { title } = $props()`, `const doubled = $derived(n * 2)`, `onclick={...}` |
| `$effect(() => { b = a * 2 })` to sync state | Effects for derivation cause tangled reactivity and update loops | `const b = $derived(a * 2)` |
| `new Counter({ target })` to mount | Class component API removed in Svelte 5 | `mount(Counter, { target, props })` |
| `import { page } from '$app/state'` / `+page.server.ts` | SvelteKit APIs; this is Astro | Astro `Astro.params`, Actions, content collections, middleware |
| Running shadcn-svelte's Tailwind `init` and adding `tailwindcss` | Stack styles with UnoCSS; two engines conflict | Manual setup + `unocss-preset-shadcn`, empty `tailwind.config.js` for the CLI |
| UnoCSS config without `extractor-svelte` or `.ts` in `content.pipeline` | `class:` directives and shadcn barrel classes silently dropped from CSS | Add `extractorSvelte()` and `'(components|src)/**/*.{js,ts}'` |
| Sharing a `.svelte.ts` rune singleton across two separate islands | Islands hydrate as independent roots; instance not shared | nanostores for cross-island state; runes within one island |
| Passing a function as a prop to `server:defer` or a `client:*` island | Island/server props are serialized; functions can't cross the boundary | Pass serializable data; keep callbacks inside the island |
| `client:load` on every interactive component | Ships JS eagerly, defeats islands | `client:idle`/`client:visible`; static `.astro` where no interactivity is needed |
| Using `entry.render()` / `entry.slug` | Removed in current content layer | `render(entry)` and `entry.id` |
| Assuming remark/rehype plugins work out of the box | Astro 7's default Markdown pipeline is native, not unified | Reinstall/configure the remark pipeline explicitly if plugins are needed |
| `bun test` on `.svelte` components | Bun's runner can't compile runes | Vitest Browser Mode + `vitest-browser-svelte` |
| A community Bun *adapter* on Astro 7 | Current Bun adapters pin to older Astro majors | `@astrojs/node` standalone, launched with `bun` |
| Reading secrets via `import.meta.env` in client code | No validation, risks leaking to the bundle | `astro:env` schema; `secret`/`server` vars stay server-side |

## Version & compatibility

| Component | Targeted line | Notes / floor |
|---|---|---|
| Bun | 1.4.x | Runtime, package manager, `bun test`, `bun.lock` text lockfile |
| Astro | 7.x | Stable since 7.0 (June 22, 2026); Vite 8 + Rolldown; native Rust Markdown pipeline |
| Node (build/tooling floor) | 22.12+ | Required by Vite 8 / Astro 7 build tooling even when deploying on Bun |
| `@astrojs/node` | current | Idiomatic SSR adapter; run the standalone server under Bun |
| Svelte | 5.56.x | Runes mode only; legacy syntax excluded from new code |
| `@astrojs/svelte` | 8.1.x | Svelte 5 support; compatible with Astro 7 |
| UnoCSS (`unocss`, `unocss/astro`) | 66.x | `presetWind4` (oklch); `@unocss/astro` sub-package trails the meta-package — pin deliberately |
| `unocss-preset-shadcn` | 1.0.x | Defaults to `presetWind4`; README sample still shows `presetWind3` (out of date) |
| shadcn-svelte | 1.6.x | CLI; runes-native; built on `bits-ui` 2.x; `cn` = `tailwind-merge` + `clsx` |
| Biome | 2.5.x | Svelte/Astro support experimental (`html.experimentalFullSupportEnabled`); no type-checking |
| TypeScript | 5.x | `astro/tsconfigs/strict`; validate via `astro check` + `svelte-check` |
| Vitest | 4.x | Browser Mode + `vitest-browser-svelte` 3.x for Svelte 5 components |
| Playwright | current | E2E and Vitest Browser Mode provider |

**Unresolved constraint:** shadcn-svelte officially targets Tailwind v4, so its UnoCSS path depends on the community `unocss-preset-shadcn` + `presetWind4` combination, which has no official support from either project and is newer than the Tailwind path. Treat it as working-but-verify: confirm token rendering before shipping.

- **Research date:** 2026-09-05
