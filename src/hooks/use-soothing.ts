import { useEffect, useRef, useState } from 'react';
import { MOOD_BANDS, angleToMood, moodToAngle } from '../../shared/mood';
import { SOOTHING_SPRING, stepSwing, type SwingMotion } from '../swing-physics';

/** Where soothing swings everyone: the middle of the Content band. */
export const SOOTHED_MOOD = MOOD_BANDS.find(({ band }) => band === 'content')!.sample;

/** Looser than the drag settle check; smaller wobbles are invisible at this pace. */
const REST_ANGLE = 0.5;
const REST_SPEED = 2;

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Each swing gets a slightly different pendulum so they drift out of step. */
function springFor(index: number) {
  return { ...SOOTHING_SPRING, omega: SOOTHING_SPRING.omega * (0.88 + 0.24 * ((index * 0.618) % 1)) };
}

/**
 * Once `active` turns on, lets go of every mood and swings each one into
 * Content; `instant` skips straight to the end. Returns the fractional moods
 * to draw, in the order given, and whether they have all come to rest.
 */
export function useSoothing(
  moods: readonly number[],
  active: boolean,
  instant = false,
): { moods: readonly number[]; settled: boolean } {
  const [shown, setShown] = useState<readonly number[] | null>(null);
  const [settled, setSettled] = useState(false);
  const moodsRef = useRef(moods);
  moodsRef.current = moods;
  // Snapshots arrive as new arrays; only restart when the moods themselves change.
  const moodsKey = moods.join(',');

  useEffect(() => {
    setSettled(false);

    if (!active) {
      setShown(null);
      return;
    }

    const start = moodsRef.current;
    const target = moodToAngle(SOOTHED_MOOD);
    const atRest = start.map(() => SOOTHED_MOOD);

    if (instant || start.length === 0 || prefersReducedMotion()) {
      setShown(atRest);
      setSettled(true);
      return;
    }

    const springs = start.map((_, index) => springFor(index));
    let motions: SwingMotion[] = start.map((mood) => ({ angle: moodToAngle(mood), velocity: 0 }));
    let lastTime: number | undefined;
    let frame = 0;

    const tick = (time: number) => {
      const elapsed = lastTime === undefined ? 0 : (time - lastTime) / 1000;
      lastTime = time;
      motions = motions.map((motion, index) => stepSwing(motion, target, elapsed, springs[index]));

      if (motions.every(({ angle, velocity }) => Math.abs(angle - target) < REST_ANGLE && Math.abs(velocity) < REST_SPEED)) {
        setShown(atRest);
        setSettled(true);
        return;
      }

      setShown(motions.map(({ angle }) => angleToMood(angle)));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, instant, moodsKey]);

  return { moods: shown ?? moods, settled };
}
