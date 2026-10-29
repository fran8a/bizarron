import { describe, expect, it } from "vitest";
import {
  fieldDrop,
  fromScreen,
  pitchGeometry,
  toScreen,
} from "../src/lib/model";

describe("continuous pitch rotation", () => {
  it("takes a team below the center through right, top, left and bottom", () => {
    const sides = [
      { x: 0.5, y: 0.8 },
      { x: 0.8, y: 0.5 },
      { x: 0.5, y: 0.2 },
      { x: 0.2, y: 0.5 },
      { x: 0.5, y: 0.8 },
    ];
    sides.forEach((expected, turn) => {
      const point = toScreen(0.5, 0.8, turn % 2 === 1, turn % 4 >= 2);
      expect(point.x).toBeCloseTo(expected.x);
      expect(point.y).toBeCloseTo(expected.y);
    });
  });

  it.each([0, 1, 2, 3])(
    "preserves drops, routes and outside bench coordinates at turn %i",
    (turn) => {
      const horizontal = turn % 2 === 1;
      const inverted = turn >= 2;
      for (const original of [
        { x: 0.23, y: 0.71 },
        { x: -0.1, y: 0.3 },
      ]) {
        const screen = toScreen(original.x, original.y, horizontal, inverted);
        const restored = fromScreen(
          screen.x,
          screen.y,
          horizontal,
          inverted,
          false,
        );
        expect(restored.x).toBeCloseTo(original.x);
        expect(restored.y).toBeCloseTo(original.y);
      }
      const geometry = pitchGeometry(600, horizontal, horizontal ? 2 : 1, 900);
      const screen = toScreen(0.23, 0.71, horizontal, inverted);
      const drop = fieldDrop(
        geometry.left + screen.x * geometry.width,
        geometry.top + screen.y * geometry.heightInside,
        { left: 0, top: 0, width: 600, height: geometry.height },
        horizontal,
        horizontal ? 2 : 1,
        inverted,
      );
      expect(drop?.x).toBeCloseTo(0.23);
      expect(drop?.y).toBeCloseTo(0.71);
    },
  );
});
