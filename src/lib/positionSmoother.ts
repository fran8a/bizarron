type Point = { x: number; y: number };

// Bridge the 120 ms between remote position packets without sending more traffic.
export function createPositionSmoother(paint: (position: Point) => void) {
  let position: Point = { x: 0, y: 0 };
  let frame = 0;

  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };
  const draw = () => paint(position);
  const snap = (target: Point) => {
    stop();
    position = { ...target };
    draw();
  };
  const move = (target: Point) => {
    stop();
    const from = position;
    const to = { ...target };
    const started = performance.now();
    if (from.x === to.x && from.y === to.y) return;
    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - started) / 120));
      position = {
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
      };
      draw();
      frame = progress < 1 ? requestAnimationFrame(tick) : 0;
    };
    frame = requestAnimationFrame(tick);
  };
  return { move, snap, draw, stop };
}
