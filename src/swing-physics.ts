import { MAX_ANGLE_DEG, clampAngle } from '../shared/mood';

export interface Point {
  x: number;
  y: number;
}

/** Angle in degrees (positive is swung to the right) and its speed in degrees per second. */
export interface SwingMotion {
  angle: number;
  velocity: number;
}

export interface Spring {
  /** Natural frequency in radians per second. */
  omega: number;
  /** Damping ratio: below 1 swings past the target before settling. */
  damping: number;
}

export interface AngleSample {
  /** Milliseconds. */
  time: number;
  angle: number;
}

/**
 * The swing springs back to the chosen mood instead of hanging straight down,
 * so a flick carries it on a little before it eases back to where it was let go.
 */
export const SPRING_OMEGA = 4.2;
export const SPRING_DAMPING = 0.65;
const SETTLE_SPRING: Spring = { omega: SPRING_OMEGA, damping: SPRING_DAMPING };
/** A slower, looser spring that swings back and forth a few times before resting. */
export const SOOTHING_SPRING: Spring = { omega: 2, damping: 0.25 };
const MAX_STEP_SECONDS = 1 / 120;
/** Cap simulated time so a backgrounded tab doesn't replay seconds of physics. */
const MAX_FRAME_SECONDS = 0.1;
const LIMIT_BOUNCE = 0.35;
const MAX_RELEASE_VELOCITY = 80;
const VELOCITY_WINDOW_MS = 100;

/** Angle of the line from the pivot to the pointer, in degrees from straight down. */
export function angleFromPointer(pivot: Point, pointer: Point): number {
  return (Math.atan2(pointer.x - pivot.x, pointer.y - pivot.y) * 180) / Math.PI;
}

export function stepSwing(
  motion: SwingMotion,
  target: number,
  dtSeconds: number,
  { omega, damping }: Spring = SETTLE_SPRING,
): SwingMotion {
  let { angle, velocity } = motion;
  let remaining = Math.min(Math.max(dtSeconds, 0), MAX_FRAME_SECONDS);

  while (remaining > 0) {
    const step = Math.min(remaining, MAX_STEP_SECONDS);
    const acceleration = -(omega ** 2) * (angle - target) - 2 * damping * omega * velocity;

    velocity += acceleration * step;
    angle += velocity * step;

    if (Math.abs(angle) > MAX_ANGLE_DEG) {
      angle = clampAngle(angle);
      velocity = -velocity * LIMIT_BOUNCE;
    }

    remaining -= step;
  }

  return { angle, velocity };
}

export function isSettled(motion: SwingMotion, target: number): boolean {
  return Math.abs(motion.angle - target) < 0.15 && Math.abs(motion.velocity) < 1;
}

/** Estimates how fast the swing was moving when it was let go, from recent drag samples. */
export function releaseVelocity(samples: readonly AngleSample[]): number {
  const last = samples.at(-1);
  const first = last && samples.find((sample) => last.time - sample.time <= VELOCITY_WINDOW_MS);

  if (!last || !first || last.time <= first.time) {
    return 0;
  }

  const velocity = ((last.angle - first.angle) * 1000) / (last.time - first.time);

  return Math.max(-MAX_RELEASE_VELOCITY, Math.min(MAX_RELEASE_VELOCITY, velocity));
}
