import { moodToAngle } from '../../shared/mood';
import { MoodFace } from './mood-face';
import { Plank } from './swing';
import { ROPE_LENGTH, ropesPath, seatPosition } from './scene-geometry';

const VOTE_FACE_RADIUS = 11;
const RING_RADII = [ROPE_LENGTH + 52, ROPE_LENGTH + 76, ROPE_LENGTH + 100];

/**
 * Picks a ring below the swing for each vote, pushing faces outward when they
 * would overlap a neighbour at a similar angle. Rings come back in the order of `moods`.
 */
export function assignRings(moods: readonly number[]): number[] {
  const lastAngleOnRing: (number | undefined)[] = RING_RADII.map(() => undefined);
  const minGapDeg = (radius: number) => ((2 * VOTE_FACE_RADIUS + 2) / radius) * (180 / Math.PI);
  const rings = moods.map(() => 0);

  moods
    .map((mood, index) => ({ index, angle: moodToAngle(mood) }))
    .sort((a, b) => a.angle - b.angle)
    .forEach(({ index, angle }) => {
      const free = RING_RADII.findIndex((radius, ring) => {
        const last = lastAngleOnRing[ring];
        return last === undefined || angle - last >= minGapDeg(radius);
      });
      // When every ring is crowded, overlap on the ring with the most room.
      const ring =
        free >= 0
          ? free
          : RING_RADII.reduce(
              (best, _radius, ringIndex) =>
                (lastAngleOnRing[ringIndex] ?? -Infinity) < (lastAngleOnRing[best] ?? -Infinity) ? ringIndex : best,
              0,
            );

      lastAngleOnRing[ring] = angle;
      rings[index] = ring;
    });

  return rings;
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

interface MoodArcProps {
  moods: readonly number[];
  /** Moods that pick each face's ring, so faces keep their ring while `moods` swing. */
  ringsFrom?: readonly number[];
}

/** Everyone's anonymous mood: a faint swing at its angle and a small face below the swing's path. */
export function MoodArc({ moods, ringsFrom = moods }: MoodArcProps) {
  const rings = assignRings(ringsFrom);

  return (
    <g className="mood-arc">
      <g className="vote-swing" aria-hidden="true">
        {moods.map((mood, index) => (
          <VoteSwing key={index} mood={mood} />
        ))}
      </g>
      {moods.map((mood, index) => {
        const position = seatPosition(moodToAngle(mood), RING_RADII[rings[index]]);

        return <MoodFace key={index} mood={mood} x={position.x} y={position.y} radius={VOTE_FACE_RADIUS} />;
      })}
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
