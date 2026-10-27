import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPositionSmoother } from "./positionSmoother";

describe("remote position smoothing", () => {
  let now: number;
  let nextFrame: number;
  let callbacks: Map<number, FrameRequestCallback>;
  const advance = (time: number) => {
    now = time;
    const pending = [...callbacks.values()];
    callbacks.clear();
    pending.forEach((callback) => callback(time));
  };

  beforeEach(() => {
    now = 0;
    nextFrame = 0;
    callbacks = new Map();
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callbacks.set(++nextFrame, callback);
      return nextFrame;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => callbacks.delete(id));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("paints intermediate frames and settles at the exact received position", () => {
    const paint = vi.fn();
    const motion = createPositionSmoother(paint);
    motion.snap({ x: 10, y: 20 });
    motion.move({ x: 130, y: 80 });
    advance(60);
    expect(paint).toHaveBeenLastCalledWith({ x: 70, y: 50 });
    advance(200);
    expect(paint).toHaveBeenLastCalledWith({ x: 130, y: 80 });
    expect(callbacks.size).toBe(0);
  });

  it("retargets from the painted position when packets arrive early", () => {
    const paint = vi.fn();
    const motion = createPositionSmoother(paint);
    motion.snap({ x: 0, y: 0 });
    motion.move({ x: 120, y: 0 });
    advance(60);
    motion.move({ x: 0, y: 120 });
    expect(callbacks.size).toBe(1);
    motion.draw();
    expect(paint).toHaveBeenLastCalledWith({ x: 60, y: 0 });
    advance(120);
    expect(paint).toHaveBeenLastCalledWith({ x: 30, y: 60 });
    advance(180);
    expect(paint).toHaveBeenLastCalledWith({ x: 0, y: 120 });
  });

  it("lets local dragging or resize take over immediately", () => {
    const paint = vi.fn();
    const motion = createPositionSmoother(paint);
    motion.move({ x: 120, y: 120 });
    advance(60);
    motion.snap({ x: 300, y: 400 });
    advance(180);
    expect(paint).toHaveBeenLastCalledWith({ x: 300, y: 400 });
    expect(callbacks.size).toBe(0);
  });

  it("stops painting when the component unmounts", () => {
    const paint = vi.fn();
    const motion = createPositionSmoother(paint);
    motion.move({ x: 100, y: 100 });
    motion.stop();
    advance(120);
    expect(paint).not.toHaveBeenCalled();
    expect(callbacks.size).toBe(0);
  });
});
