import { describe, expect, it } from 'vitest';
import { MAX_ANGLE_DEG } from '../shared/mood';
import { angleFromPointer, isSettled, releaseVelocity, stepSwing, type SwingMotion } from './swing-physics';

function simulate(motion: SwingMotion, target: number, seconds: number, onStep?: (m: SwingMotion) => void) {
  let current = motion;

  for (let time = 0; time < seconds; time += 1 / 60) {
    current = stepSwing(current, target, 1 / 60);
    onStep?.(current);
  }

  return current;
}

describe('swing physics', () => {
  it('measures pointer angles from straight down, positive to the right', () => {
    const pivot = { x: 0, y: 0 };

    expect(angleFromPointer(pivot, { x: 0, y: 10 })).toBeCloseTo(0);
    expect(angleFromPointer(pivot, { x: 10, y: 10 })).toBeCloseTo(45);
    expect(angleFromPointer(pivot, { x: -10, y: 10 })).toBeCloseTo(-45);
  });

  it('settles on the target', () => {
    const final = simulate({ angle: 0, velocity: 0 }, 30, 8);

    expect(final.angle).toBeCloseTo(30, 1);
    expect(isSettled(final, 30)).toBe(true);
  });

  it('overshoots after a flick before settling', () => {
    let maxAngle = -Infinity;
    const final = simulate({ angle: 10, velocity: 200 }, 10, 8, (motion) => {
      maxAngle = Math.max(maxAngle, motion.angle);
    });

    expect(maxAngle).toBeGreaterThan(20);
    expect(final.angle).toBeCloseTo(10, 1);
  });

  it('never swings past the limits', () => {
    simulate({ angle: 45, velocity: 400 }, 45, 3, (motion) => {
      expect(Math.abs(motion.angle)).toBeLessThanOrEqual(MAX_ANGLE_DEG);
    });
  });

  it('caps a long frame so a sleeping tab does not explode', () => {
    const next = stepSwing({ angle: 0, velocity: 0 }, 40, 30);

    expect(Number.isFinite(next.angle)).toBe(true);
    expect(next.angle).toBeLessThan(40);
  });

  it('estimates release velocity from the last 100 ms', () => {
    expect(releaseVelocity([])).toBe(0);
    expect(
      releaseVelocity([
        { time: 0, angle: -40 },
        { time: 900, angle: 0 },
        { time: 950, angle: 5 },
        { time: 1000, angle: 10 },
      ]),
    ).toBeCloseTo(100);
    expect(
      releaseVelocity([
        { time: 0, angle: 0 },
        { time: 10, angle: 40 },
      ]),
    ).toBe(400);
  });
});
