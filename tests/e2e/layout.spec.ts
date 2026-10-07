import { expect, test } from "@playwright/test";
import { DANISH_NOTES, formatNotes, resetStorage } from "./fixtures";

/**
 * docs/PLAN.md §12.7 and §20.3.
 *
 * The plan asks for visual regression baselines. Pixel baselines are not
 * committed here, because font rasterisation differs between machines and a
 * screenshot from one developer's Linux Chromium fails for everyone else — a
 * test that only its author can pass is worse than none. What it *would* catch,
 * template drift, is caught here by asserting the geometry and the block
 * vocabulary directly, which is both portable and more specific about what
 * broke. Pixel comparison belongs with the manual matrix of §20.4.
 */

const MM = 96 / 25.4;
const round = (value: number) => Math.round(value);

test.beforeEach(async ({ page }) => {
  await resetStorage(page);
});

test("the page is A4 with the plan's margins", async ({ page }) => {
  await page.goto("/");
  await formatNotes(page);

  // Pagination is debounced; the page box is what proves it has happened.
  await page.locator(".pagedjs_page").first().waitFor();

  const geometry = await page.evaluate(() => {
    const box = document.querySelector(".pagedjs_page") as HTMLElement | null;
    const content = document.querySelector(".pagedjs_page_content") as HTMLElement | null;
    if (!box || !content) return null;
    const outer = box.getBoundingClientRect();
    const inner = content.getBoundingClientRect();
    // The preview is scaled with a transform; divide it back out.
    const scale = outer.width / box.offsetWidth;
    return {
      width: box.offsetWidth,
      height: box.offsetHeight,
      column: inner.width / scale,
      left: (inner.left - outer.left) / scale,
      top: (inner.top - outer.top) / scale,
    };
  });

  expect(geometry).not.toBeNull();
  if (!geometry) return;

  expect(round(geometry.width)).toBe(round(210 * MM));
  expect(round(geometry.height)).toBe(round(297 * MM));
  // 170 mm content column, 20 mm side margins, 18 mm top margin.
  expect(round(geometry.column)).toBe(round(170 * MM));
  expect(round(geometry.left)).toBe(round(20 * MM));
  expect(round(geometry.top)).toBe(round(18 * MM));
});

test("every block type keeps its own treatment", async ({ page }) => {
  await page.goto("/");
  await formatNotes(
    page,
    `${DANISH_NOTES}\n\n"Vi skal have en aftale."\n\nTil orientering\nKredsen holder generalforsamling i marts.\n`,
  );

  const preview = page.getByRole("region", { name: "Forhåndsvisning af nyhedsbrevet" });

  for (const selector of [
    ".nl-title",
    ".nl-subtitle",
    ".nl-meta",
    ".nl-intro",
    ".nl-agenda",
    ".nl-decisions",
    ".nl-actions",
    ".nl-notice-important",
    ".nl-notice-info",
    ".nl-quote",
    ".nl-contact",
    ".nl-closing",
  ]) {
    await expect(preview.locator(selector).first(), `missing ${selector}`).toBeVisible();
  }
});

test("the semantic blocks carry a text label, not colour alone", async ({ page }) => {
  await page.goto("/");
  await formatNotes(page);

  const preview = page.getByRole("region", { name: "Forhåndsvisning af nyhedsbrevet" });
  await expect(preview.locator(".nl-agenda .nl-block-label")).toHaveText("Dagsorden");
  await expect(preview.locator(".nl-decisions .nl-block-label")).toHaveText("Beslutninger");
  await expect(preview.locator(".nl-actions .nl-block-label")).toHaveText("Handlinger");
  await expect(preview.locator(".nl-notice-important .nl-block-label")).toHaveText("Vigtigt");
});

test("space before a heading is larger than the space after it", async ({ page }) => {
  await page.goto("/");
  await formatNotes(
    page,
    `${DANISH_NOTES}\n\nNyt fra kredsen\nEn kort tekst under overskriften.\n`,
  );

  const spacing = await page.evaluate(() => {
    const heading = document.querySelector(".nl-h2") as HTMLElement | null;
    if (!heading) return null;
    const style = getComputedStyle(heading);
    return {
      before: Number.parseFloat(style.marginTop),
      after: Number.parseFloat(style.marginBottom),
    };
  });

  expect(spacing).not.toBeNull();
  if (!spacing) return;
  // The cheapest way to make a layout look considered, and easy to undo by
  // accident, so it is asserted rather than described.
  expect(spacing.before).toBeGreaterThan(spacing.after);
});

test("the body measure stays in the comfortable range", async ({ page }) => {
  await page.goto("/");
  await formatNotes(page);

  const characters = await page.evaluate(() => {
    const paragraph = document.querySelector(".nl-intro") as HTMLElement | null;
    if (!paragraph) return null;
    const style = getComputedStyle(paragraph);
    const probe = document.createElement("span");
    probe.style.font = style.font;
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.textContent = "abcdefghijklmnopqrstuvwxyz";
    document.body.append(probe);
    const perCharacter = probe.getBoundingClientRect().width / 26;
    probe.remove();
    return paragraph.getBoundingClientRect().width / perCharacter;
  });

  expect(characters).not.toBeNull();
  if (characters === null) return;
  // The plan's 62–72 characters at A4, with slack for the metric estimate.
  expect(characters).toBeGreaterThan(55);
  expect(characters).toBeLessThan(85);
});

test("the preview scales to fit its pane rather than overflowing it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await formatNotes(page);

  const fits = await page
    .getByRole("region", { name: "Forhåndsvisning af nyhedsbrevet", exact: true })
    .evaluate((viewport) => {
      const scaler = viewport.querySelector(".preview-scaler");
      if (!scaler) return null;
      return scaler.getBoundingClientRect().width <= viewport.getBoundingClientRect().width + 1;
    });

  expect(fits).toBe(true);
});
