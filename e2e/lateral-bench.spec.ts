import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { pitchPoint } from "./pitch";

test("suplentes solo en laterales: límites superior/inferior y regreso a cancha en ambas vistas", async ({
  page,
}) => {
  test.skip(
    !process.env.VITE_SUPABASE_URL ||
      !process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    "Requiere Supabase real.",
  );
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Crear tablero", exact: true })
    .click();
  await page.getByLabel("Tu nombre o apodo").fill("Banco lateral");
  await page.getByRole("button", { name: "Entrar a la cancha" }).click();
  await expect(page.locator(".connection")).toHaveText("Conectado", {
    timeout: 30000,
  });
  const saved = await page.evaluate(() =>
    JSON.parse(
      localStorage.getItem(
        Object.keys(localStorage).find(
          (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
        )!,
      )!,
    ),
  );
  const api = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  expect((await api.auth.setSession(saved)).error).toBeNull();
  const link = await api.rpc("open_board_link", {
    p_code: new URL(page.url()).pathname.split("/").pop(),
  });
  expect(link.error).toBeNull();
  const get = async () => {
    const result = await api.rpc("formation_snapshot", {
      p_board: link.data.board_id,
      p_formation: link.data.formation_id,
    });
    expect(result.error).toBeNull();
    return result.data;
  };
  await page
    .getByRole("button", { name: "Agregar jugador del equipo A", exact: true })
    .click();
  await expect(page.locator(".roster-player")).toHaveCount(1);
  let inverted = false;
  const screen = (p: { x: number; y: number }, horizontal: boolean) => {
    const point = horizontal ? { x: p.y, y: 1 - p.x } : p;
    return inverted ? { x: 1 - point.x, y: 1 - point.y } : point;
  };
  for (const horizontal of [true, false]) {
    const toggle = page.getByRole("button", { name: "Girar cancha" });
    if (
      (await page.locator(".field-wrap").getAttribute("data-horizontal")) !==
      String(horizontal)
    )
      await toggle.click();
    await expect(page.locator(".field-wrap")).toHaveAttribute(
      "data-horizontal",
      String(horizontal),
    );
    await expect
      .poll(async () => {
        return page.locator(".field-wrap").evaluate((el) => {
          const field = el as HTMLElement;
          const width = Number(field.dataset.pitchWidth);
          const height = Number(field.dataset.pitchHeight);
          return field.dataset.horizontal === "true"
            ? width > height
            : height > width;
        });
      })
      .toBe(true);
    inverted =
      (await page.locator(".field-wrap").getAttribute("data-inverted")) ===
      "true";
    const drag = async (x: number, y: number) => {
      const p = (await get()).players[0];
      const origin = screen(
        p.placement === "bench" ? { x: p.outside_x, y: p.outside_y } : p,
        horizontal,
      );
      const start = await pitchPoint(page, origin.x, origin.y);
      const end = screen({ x, y }, horizontal);
      const target = await pitchPoint(page, end.x, end.y);
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x + 7, start.y + 7);
      await expect.poll(async () => (await get()).locks.length).toBe(1);
      await page.mouse.move(target.x, target.y, { steps: 12 });
      await page.mouse.up();
      await expect.poll(async () => (await get()).locks.length).toBe(0);
      return (await get()).players[0];
    };
    for (const y of [-0.2, 1.2]) {
      const p = await drag(0.5, y);
      expect(p.placement).toBe("field");
    }
    for (const [x, y] of [
      [-0.1, 0.5],
      [-0.1, -0.2],
      [-0.1, 1.2],
      [1.1, 0.5],
      [1.1, -0.2],
      [1.1, 1.2],
    ]) {
      const p = await drag(x, y);
      expect(p.placement).toBe("bench");
      expect(p.outside_x < 0 || p.outside_x > 1).toBe(true);
      expect(p.outside_y).toBeGreaterThanOrEqual(0);
      expect(p.outside_y).toBeLessThanOrEqual(1);
    }
    expect((await drag(0.5, 0.5)).placement).toBe("field");
  }
});
