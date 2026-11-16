import type { Point } from '../swing-physics';

/** Shared coordinates of the tree scene's SVG viewBox. */
export const SCENE_WIDTH = 700;
export const SCENE_HEIGHT = 780;
/** Midpoint between the two ropes where they wrap around the branch. */
export const PIVOT: Point = { x: 375, y: 300 };
export const ROPE_LENGTH = 300;
/** Half the distance between the two ropes. */
export const ROPE_SPREAD = 42;
export const PLANK_WIDTH = 108;
export const PLANK_HEIGHT = 12;
export const GROUND_SHADOW_Y = 688;

/**
 * Both ropes turn by the same angle around their own knot, so the plank stays
 * level and its centre moves like a single pendulum hanging from the pivot.
 */
export function seatPosition(angleDeg: number, length = ROPE_LENGTH): Point {
  const radians = (angleDeg * Math.PI) / 180;

  return {
    x: PIVOT.x + length * Math.sin(radians),
    y: PIVOT.y + length * Math.cos(radians),
  };
}

/** A point on the rope `fromBottom` units above where it meets the plank. */
export function pointOnRope(angleDeg: number, side: -1 | 1, fromBottom: number): Point {
  const radians = (angleDeg * Math.PI) / 180;
  const seat = seatPosition(angleDeg);

  return {
    x: seat.x + side * ROPE_SPREAD - fromBottom * Math.sin(radians),
    y: seat.y - fromBottom * Math.cos(radians),
  };
}
