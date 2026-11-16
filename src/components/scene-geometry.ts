import type { Point } from '../swing-physics';

/** Shared coordinates of the swing diagram's SVG viewBox. */
export const SCENE_WIDTH = 620;
export const SCENE_HEIGHT = 412;
/** Midpoint between the two rope hinges on the beam. */
export const PIVOT: Point = { x: 310, y: 36 };
export const ROPE_LENGTH = 250;
/** Half the distance between the two ropes. */
export const ROPE_SPREAD = 42;
export const PLANK_WIDTH = 108;
export const PLANK_HEIGHT = 12;

/**
 * Both ropes turn by the same angle around their own hinge, so the plank stays
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

/** Both ropes, from their hinges on the beam down to the ends of a plank centred on `seat`. */
export function ropesPath(seat: Point): string {
  return ([-1, 1] as const)
    .map((side) => `M ${PIVOT.x + side * ROPE_SPREAD} ${PIVOT.y} L ${seat.x + side * ROPE_SPREAD} ${seat.y}`)
    .join(' ');
}

/** An SVG arc around the pivot between two swing angles, drawn left to right. */
export function arcPath(fromDeg: number, toDeg: number, radius: number): string {
  const from = seatPosition(fromDeg, radius);
  const to = seatPosition(toDeg, radius);

  return `M ${from.x} ${from.y} A ${radius} ${radius} 0 0 0 ${to.x} ${to.y}`;
}
