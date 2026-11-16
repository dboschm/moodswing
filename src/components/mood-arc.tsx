import { LAUGHING_SIDE, MAX_ANGLE_DEG, moodToAngle } from '../../shared/mood';
import type { Point } from '../swing-physics';
import { MoodFace } from './mood-face';
import { Plank } from './swing';
import { Rope } from './rope';
import { PIVOT, ROPE_LENGTH, ROPE_SPREAD, seatPosition } from './scene-geometry';

const VOTE_FACE_RADIUS = 11;
const RING_RADII = [ROPE_LENGTH + 52, ROPE_LENGTH + 76, ROPE_LENGTH + 100];

export interface PlacedVote {
  mood: number;
  position: Point;
}

/**
 * Puts each vote on an arc below the swing at its mood's angle, pushing faces
 * outward onto further rings when they would overlap.
 */
export function placeVotes(moods: readonly number[]): PlacedVote[] {
  const lastAngleOnRing: (number | undefined)[] = RING_RADII.map(() => undefined);
  const minGapDeg = (radius: number) => ((2 * VOTE_FACE_RADIUS + 2) / radius) * (180 / Math.PI);

  return [...moods]
    .sort((a, b) => moodToAngle(a) - moodToAngle(b))
    .map((mood) => {
      const angle = moodToAngle(mood);
      const free = RING_RADII.findIndex((radius, ring) => {
        const last = lastAngleOnRing[ring];
        return last === undefined || angle - last >= minGapDeg(radius);
      });
      // When every ring is crowded, overlap on the ring with the most room.
      const ring =
        free >= 0
          ? free
          : RING_RADII.reduce(
              (best, _radius, index) =>
                (lastAngleOnRing[index] ?? -Infinity) < (lastAngleOnRing[best] ?? -Infinity) ? index : best,
              0,
            );

      lastAngleOnRing[ring] = angle;
      return { mood, position: seatPosition(angle, RING_RADII[ring]) };
    });
}

/** The scale under the swing: a dashed path, the two extremes, and everyone's anonymous mood. */
export function MoodArc({ moods }: { moods: readonly number[] }) {
  const start = seatPosition(-MAX_ANGLE_DEG);
  const end = seatPosition(MAX_ANGLE_DEG);
  const laughingEnd = seatPosition((MAX_ANGLE_DEG + 9) * LAUGHING_SIDE);
  const angryEnd = seatPosition(-(MAX_ANGLE_DEG + 9) * LAUGHING_SIDE);

  return (
    <g className="mood-arc">
      <path
        d={`M ${start.x} ${start.y} A ${ROPE_LENGTH} ${ROPE_LENGTH} 0 0 0 ${end.x} ${end.y}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth={3}
        strokeDasharray="2 10"
        strokeLinecap="round"
        opacity={0.85}
      />
      <MoodFace mood={100} x={laughingEnd.x} y={laughingEnd.y} radius={14} />
      <MoodFace mood={0} x={angryEnd.x} y={angryEnd.y} radius={14} />
      {placeVotes(moods).map(({ mood, position }, index) => (
        <MoodFace key={index} mood={mood} x={position.x} y={position.y} radius={VOTE_FACE_RADIUS} />
      ))}
    </g>
  );
}

/** A see-through swing hanging at the team's average mood. */
export function GhostSwing({ mood }: { mood: number }) {
  const angle = moodToAngle(mood);
  const seat = seatPosition(angle);

  return (
    <g className="ghost-swing" opacity={0.75} aria-hidden="true">
      <Rope from={{ x: PIVOT.x - ROPE_SPREAD, y: PIVOT.y }} to={{ x: seat.x - ROPE_SPREAD, y: seat.y }} dashed />
      <Rope from={{ x: PIVOT.x + ROPE_SPREAD, y: PIVOT.y }} to={{ x: seat.x + ROPE_SPREAD, y: seat.y }} dashed />
      <MoodFace mood={mood} x={seat.x} y={seat.y - 22} radius={16} opacity={0.8} />
      <Plank x={seat.x} y={seat.y} ghost />
      <text x={seat.x} y={seat.y + 5} textAnchor="middle" className="ghost-swing__label">
        TEAM
      </text>
    </g>
  );
}

/** Hangs from the left branch once the session has ended. */
export function ClosedSign() {
  return (
    <g className="closed-sign" aria-hidden="true">
      <path d="M 86 322 L 80 382 M 138 368 L 146 382" stroke="#6e5320" strokeWidth={2.5} strokeLinecap="round" />
      <rect x={62} y={380} width={102} height={34} rx={4} fill="#f3e2b0" stroke="#6e5320" strokeWidth={2.5} />
      <text x={113} y={403} textAnchor="middle" className="closed-sign__text">
        CLOSED
      </text>
    </g>
  );
}
