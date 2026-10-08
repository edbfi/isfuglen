/**
 * Smoke test of the production build. Run after `bun run build`.
 *
 * Serves `dist/` the way GitHub Pages does (`scripts/serve-dist.ts`) on a free port, then
 * requires every published route — the Danish default locale and the `/en` prefix — to return
 * 200 with a `<title>` and the Content-Security-Policy `<meta>` that Astro generates from
 * `security.csp` in astro.config.mjs. The CSP is the enforcement half of the no-backend privacy
 * guarantee and nothing else would notice it going missing.
 *
 * The server only counts as ready once *this* process has bound the port (serve-dist logs after
 * `Bun.serve` succeeds) and answers; if it exits first, for instance because the port is taken,
 * the smoke fails rather than testing whatever else listens there.
 *
 *   bun run smoke              # free port
 *   SMOKE_PORT=4321 bun run smoke
 */
import { existsSync } from "node:fs";

const ROUTES = [
  "/",
  "/om",
  "/privatliv",
  "/hjaelp",
  "/en/",
  "/en/about",
  "/en/privacy",
  "/en/help",
];
const CSP_META = /<meta\s+http-equiv="content-security-policy"\s+content="[^"]*default-src 'self'/i;

function freePort(): number {
  const probe = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
  const { port } = probe;
  probe.stop(true);
  if (!port) throw new Error("could not allocate a free port");
  return port;
}

if (!existsSync("dist/index.html")) {
  console.error("SMOKE FAILED: dist/index.html is missing; run `bun run build` first");
  process.exit(1);
}

const port = process.env.SMOKE_PORT ? Number(process.env.SMOKE_PORT) : freePort();
const base = `http://127.0.0.1:${port}`;
const timeout = () => AbortSignal.timeout(5_000);

const server = Bun.spawn(["bun", "run", "scripts/serve-dist.ts"], {
  env: { ...process.env, PORT: String(port) },
  stdout: "pipe",
  stderr: "inherit",
});
let exited = false;
void server.exited.then(() => {
  exited = true;
});

let bound = false;
const output = (async () => {
  const decoder = new TextDecoder();
  let log = "";
  for await (const chunk of server.stdout) {
    const text = decoder.decode(chunk, { stream: true });
    process.stdout.write(text);
    log += text;
    if (log.includes(`serve-dist: http://localhost:${port} `)) bound = true;
  }
})();

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (exited) throw new Error(`server exited with code ${server.exitCode} before it was ready`);
    if (bound) {
      try {
        await fetch(base, { signal: timeout() });
        return;
      } catch {
        // Not accepting connections yet.
      }
    }
    await Bun.sleep(100);
  }
  throw new Error(`server did not start on ${base}`);
}

const failures: string[] = [];
try {
  await waitForServer();
  for (const route of ROUTES) {
    const response = await fetch(`${base}${route}`, { signal: timeout() });
    const html = await response.text();
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim();
    const problems = [
      response.status === 200 ? "" : `status ${response.status}`,
      title ? "" : "no <title>",
      CSP_META.test(html) ? "" : "no Content-Security-Policy <meta>",
    ].filter(Boolean);
    if (problems.length > 0) {
      failures.push(`${route}: ${problems.join(", ")}`);
    } else {
      console.log(`ok ${route}: ${title} (CSP meta present)`);
    }
  }
  if (exited) failures.push("server exited during the smoke test");
} catch (error) {
  failures.push(String(error));
} finally {
  server.kill();
  await server.exited;
  await output;
}

if (failures.length > 0) {
  console.error(`SMOKE FAILED:\n${failures.join("\n")}`);
  process.exit(1);
}
