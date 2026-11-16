import { moodToAngle } from '../../shared/mood';
import type { Point } from '../swing-physics';
import { MoodFace } from './mood-face';
import { Plank } from './swing';
import { ROPE_LENGTH, ropesPath, seatPosition } from './scene-geometry';

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

/** A faint outline of one teammate's swing at their mood. */
function VoteSwing({ mood }: { mood: number }) {
  const seat = seatPosition(moodToAngle(mood));

  return (
    <>
      <path d={ropesPath(seat)} />
      <Plank x={seat.x} y={seat.y} className="vote-swing__plank" />
    </>
  );
}

/** Everyone's anonymous mood: a faint swing at its angle and a small face below the swing's path. */
export function MoodArc({ moods }: { moods: readonly number[] }) {
  return (
    <g className="mood-arc">
      <g className="vote-swing" aria-hidden="true">
        {moods.map((mood, index) => (
          <VoteSwing key={index} mood={mood} />
        ))}
      </g>
      {placeVotes(moods).map(({ mood, position }, index) => (
        <MoodFace key={index} mood={mood} x={position.x} y={position.y} radius={VOTE_FACE_RADIUS} />
      ))}
    </g>
  );
}

/** A dashed outline of the swing hanging at the team's average mood. */
export function GhostSwing({ mood }: { mood: number }) {
  const angle = moodToAngle(mood);
  const seat = seatPosition(angle);

  return (
    <g className="ghost-swing" aria-hidden="true">
      <path className="ghost-swing__rope" d={ropesPath(seat)} />
      <MoodFace mood={mood} x={seat.x} y={seat.y - 22} radius={16} opacity={0.7} />
      <Plank x={seat.x} y={seat.y} className="ghost-swing__plank" />
      <text x={seat.x} y={seat.y + 3.5} textAnchor="middle" className="ghost-swing__label">
        TEAM
      </text>
    </g>
  );
}

/** Marks the diagram once the session has ended. */
export function ClosedSign() {
  return (
    <g className="closed-sign" aria-hidden="true">
      <rect x={16} y={12} width={104} height={32} rx={4} />
      <text x={68} y={34} textAnchor="middle" className="closed-sign__text">
        CLOSED
      </text>
    </g>
  );
}
