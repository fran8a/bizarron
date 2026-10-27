import { test, expect } from "@playwright/test";

test("players and ball interpolate remote updates in the real canvas", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/src/pages/BoardGate.tsx*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
        import React from '/node_modules/.vite/deps/react.js';
        import ReactDOM from '/node_modules/.vite/deps/react-dom.js';
        const { flushSync } = ReactDOM;
        import Konva from '/node_modules/.vite/deps/konva.js';
        import FootballField from '/src/components/FootballField.tsx';
        export default function Gate() {
          const [x, setX] = React.useState(0.3);
          const [locked, setLocked] = React.useState(true);
          const [horizontal, setHorizontal] = React.useState(false);
          const [version, setVersion] = React.useState(0);
          const player = {id:'player', name:'Motion QA', number:1, team:'A', placement:'field', x, y:0.65};
          const ball = {id:'ball', x, y:0.3, version:1};
          window.motionQA = {
            move: value => flushSync(() => setX(value)),
            release: value => flushSync(() => {setX(value); setLocked(false)}),
            rerender: () => flushSync(() => setVersion(v => v + 1)),
            rotate: () => flushSync(() => setHorizontal(v => !v)),
            read: () => {
              const stage = Konva.stages.find(stage => stage.container().isConnected);
              const player = stage.find('Text').find(text => text.text() === 'Motion QA').getParent();
              const ball = stage.find('RegularPolygon').find(shape => shape.sides() === 5).getParent();
              return {player: player.position(), ball: ball.position()};
            }
          };
          return React.createElement('div', {style:{width:800,height:900}, 'data-version':version},
            React.createElement(FootballField, {
              players:[player], ball, playersPerTeam:7, horizontal,
              locks:locked ? ['player','ball'].map(player_id => ({player_id, user_id:'other', lease_id:player_id, expires_at:'2099-01-01T00:00:00Z'})) : [],
              people:[], now:Date.now(), enabled:true, onSelect:()=>{},
              begin:async()=>true, moving:()=>{}, end:async()=>{}
            }));
        }
      `,
    }),
  );
  await page.goto("/p/tttttttttttttttttttttttttttttttt");
  await page.addStyleTag({
    content: ".field-wrap { width: 800px; height: 900px; }",
  });
  await expect(page.locator(".field-wrap canvas").first()).toBeVisible();
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const read = () =>
    page.evaluate("window.motionQA.read()") as Promise<{
      player: { x: number; y: number };
      ball: { x: number; y: number };
    }>;
  const start = await read();
  await page.evaluate("window.motionQA.move(0.7)");
  expect(await read()).toEqual(start);
  await page.clock.runFor(64);
  const middle = await read();
  expect(middle.player.x).toBeGreaterThan(start.player.x);
  expect(middle.ball.x).toBeGreaterThan(start.ball.x);
  // An unrelated React render must not jump directly to the network target.
  await page.evaluate("window.motionQA.rerender()");
  expect(await read()).toEqual(middle);
  await page.clock.runFor(96);
  const end = await read();
  expect(middle.player.x).toBeLessThan(end.player.x);
  expect(middle.ball.x).toBeLessThan(end.ball.x);
  await page.evaluate("window.motionQA.release(0.8)");
  expect(await read()).toEqual(end);
  await page.clock.runFor(160);
  const settled = await read();
  expect(settled.player.x).toBeGreaterThan(end.player.x);
  expect(settled.ball.x).toBeGreaterThan(end.ball.x);
  // Orientation changes snap to the new coordinate system and leave no old frame running.
  await page.evaluate("window.motionQA.rotate()");
  await page.clock.runFor(32); // Let ResizeObserver publish the rotated pitch dimensions.
  const rotated = await read();
  await page.clock.runFor(160);
  expect(await read()).toEqual(rotated);
  const canvas = await page.locator(".field-wrap canvas").first().boundingBox();
  const origin = (await read()).player;
  await page.mouse.move(canvas!.x + origin.x, canvas!.y + origin.y);
  await page.mouse.down();
  await page.mouse.move(canvas!.x + origin.x + 30, canvas!.y + origin.y + 20);
  // The clock is paused: local pointer motion must not wait for an animation frame.
  const dragged = (await read()).player;
  expect(dragged.x).toBeCloseTo(origin.x + 30);
  expect(dragged.y).toBeCloseTo(origin.y + 20);
  await page.mouse.up();
  await page.clock.runFor(160);
  expect((await read()).player).toEqual(dragged);
  expect(errors).toEqual([]);
});
