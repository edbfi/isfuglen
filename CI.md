# Development CI

Every PR, default-branch push and manual `ci.yml` dispatch runs the same checks.
The required `ci / required` aggregate rejects failed, cancelled, missing and
skipped prerequisites. Workflow validation is read-only and rejects tracked-file
mutations. Shared guards, gate and Biome repair use versioned releases of
`edbfi/automation`; all external action references use full version tags.

The quality lane runs complementary prek hygiene and stack guards, read-only
Biome, actual type checks, applicable unit tests, a static build and applicable
bundle budget. It uploads one `site-dist` artifact. HTTP smoke and browser lanes
consume those exact bytes, so they neither rebuild nor accidentally test a dev
server. Frozen installs use packageManager's Bun version and a lockfile-keyed cache.
`ci.yml` owns application checks. The independent PR policy workflow also reacts to
label, title and review changes; other check workflows are callable lanes.

Derived logo/font assets precede the unit suite. Bundle limits, eight routes, CSP, privacy, accessibility, DOCX and PDF exports remain covered, including all three browser engines.

Reproduce locally: `bun install --frozen-lockfile`, then
`SKIP=no-commit-to-branch,biome,build prek run --all-files --hook-stage manual`,
`bash .github/scripts/check.sh`, and `bash .github/scripts/smoke.sh`.
Where a browser suite exists, install its Playwright browsers and run
`CI=true bun run test:e2e` after the build. Keep port 4321 free for these checks.
Prek's Biome and build hooks are skipped only because explicit CI steps cover them;
the default-branch hook applies to local commits. No existing stack guards are removed.

The shared Renovate preset includes the official Biome schema manager and isolates
Biome/TypeScript/prek groups. Biome repair computes changes without write permission,
then a separate publisher validates the allowed paths and live PR head before
committing and dispatching full CI on the new SHA. Existing template formatting
exclusions remain in force. TypeScript updates exercise both Astro and Svelte
checks without a separate version cap. Incompatible updates remain unmerged.

Shared automation uses immutable `v3.0.1` references. The custom merger and its
commands are retired. Renovate PR automerge remains explicitly disabled until
required-check enforcement and the integration canary are proven. Enabling it
requires strict, GitHub Actions-sourced required CI and PR policy checks, with no
automated bypass. The read-only `policy / ci / policy` check preserves author
sign-offs, Conventional Commit titles, review and hold-label requirements.

Biome repair retains its existing App credentials and publication boundary.
`.github/repair-policy.json` preserves the previously unconfigured recovery opt-out.
A head pushed only with `GITHUB_TOKEN` can miss PR policy events; it remains blocked
until a supported App/user update produces complete CI and policy checks.

Successful default-branch `ci` completion triggers the existing Pages publisher.
Before building and immediately before publication, it verifies the live default
revision, CI workflow/repository provenance, newest successful run and attempt.
Failed, pending, cancelled, skipped, stale and PR-only CI cannot authorize a deploy.
Manual dispatch remains available for the current fully checked main commit.
The existing frozen build, published directory and custom domain are preserved.
Deployment-selection regression tests run in the mandatory quality lane.

Shared smoke owns readiness, deadlines and process-group cleanup; caller-owned
route/content assertions and all existing browser tests remain mandatory.

The Bun-only hook recognizes Renovate's `datasource=npm` metadata without
treating it as a package-manager invocation. An injected `run: npm install`
fixture was rejected by the unchanged command policy.
