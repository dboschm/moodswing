import { describe, expect, it } from 'vitest';
import { MAX_ANGLE_DEG } from '../shared/mood';
import { SOOTHING_SPRING, angleFromPointer, isSettled, releaseVelocity, stepSwing, type Spring, type SwingMotion } from './swing-physics';

function simulate(
  motion: SwingMotion,
  target: number,
  seconds: number,
  onStep?: (m: SwingMotion) => void,
  spring?: Spring,
) {
  let current = motion;

  for (let time = 0; time < seconds; time += 1 / 60) {
    current = stepSwing(current, target, 1 / 60, spring);
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

  it('settles on the target within a few seconds', () => {
    const final = simulate({ angle: 0, velocity: 0 }, 30, 3);

    expect(final.angle).toBeCloseTo(30, 1);
    expect(isSettled(final, 30)).toBe(true);
  });

  it('carries on a little after a flick, then eases back without wobbling', () => {
    let maxAngle = -Infinity;
    let minAngle = Infinity;
    const final = simulate({ angle: 10, velocity: 80 }, 10, 2, (motion) => {
      maxAngle = Math.max(maxAngle, motion.angle);
      minAngle = Math.min(minAngle, motion.angle);
    });

    expect(maxAngle).toBeGreaterThan(15);
    expect(maxAngle).toBeLessThan(22);
    expect(minAngle).toBeGreaterThan(9);
    expect(isSettled(final, 10)).toBe(true);
  });

  it('swings back and forth a few times on the soothing spring before resting', () => {
    let crossings = 0;
    let previous = 40;
    const final = simulate(
      { angle: 40, velocity: 0 },
      0,
      14,
      (motion) => {
        if (Math.sign(motion.angle) !== Math.sign(previous)) crossings += 1;
        previous = motion.angle;
      },
      SOOTHING_SPRING,
    );

    expect(crossings).toBeGreaterThanOrEqual(3);
    expect(isSettled(final, 0)).toBe(true);
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
        { time: 950, angle: 3 },
        { time: 1000, angle: 6 },
      ]),
    ).toBeCloseTo(60);
    expect(
      releaseVelocity([
        { time: 0, angle: 0 },
        { time: 10, angle: 40 },
      ]),
    ).toBe(80);
  });
});
