import { expect, test } from "@playwright/test";

test("repeated launches cap balls at 30 and preserve the ball being held", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1366, height: 768 });
  const errors: string[] = [];
  const requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("/rest/v1/")) requests.push(request.url());
  });
  await page.goto("/");
  await page.locator(".nav-link").click();
  const first = page.getByRole("button", { name: /^Pelota 1\./ });
  await expect(first).toHaveAttribute("data-phase", "free");
  const box = (await first.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(first).toHaveAttribute("data-grabbed", "true");

  const peak = await page.evaluate(async () => {
    const container = document.querySelector(".guide-balls")!;
    let peak = 0;
    const observer = new MutationObserver(() => {
      peak = Math.max(peak, container.childElementCount);
    });
    observer.observe(container, { childList: true });
    const launch = document.querySelector<HTMLButtonElement>(".nav-link")!;
    // Exercise both burst clicks batched by React and repeated rendered updates.
    for (let batch = 0; batch < 10; batch++) {
      for (let i = 0; i < 10; i++) launch.click();
      await new Promise(requestAnimationFrame);
    }
    await new Promise(requestAnimationFrame);
    observer.disconnect();
    return peak;
  });
  expect(peak).toBe(30);
  await expect(page.locator(".physics-ball")).toHaveCount(30);
  await expect(first).toHaveAttribute("data-grabbed", "true");
  await expect(page.getByRole("button", { name: /^Pelota 2\./ })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: /^Pelota 101\./ }),
  ).toBeVisible();

  await page.mouse.up();
  await expect(first).not.toHaveAttribute("data-grabbed");
  await page
    .locator(".nav-link")
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(first).toHaveCount(0);
  await expect(page.locator(".physics-ball")).toHaveCount(30);
  await expect(
    page.getByRole("button", { name: /^Pelota 102\./ }),
  ).toHaveAttribute("data-phase", "free");
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});
