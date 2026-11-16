import { memo } from 'react';
import { MAX_ANGLE_DEG, MAX_MOOD, MOOD_BANDS, moodToAngle } from '../../shared/mood';
import { PIVOT, ROPE_LENGTH, ROPE_SPREAD, arcPath, seatPosition } from './scene-geometry';

const BEAM_HALF_WIDTH = ROPE_SPREAD + 54;
const HATCH_STEP = 12;
/** Band boundaries plus both ends of the scale. */
const TICK_MOODS = [...MOOD_BANDS.map((band) => band.min), MAX_MOOD];

function Tick({ mood }: { mood: number }) {
  const angle = moodToAngle(mood);
  const inner = seatPosition(angle, ROPE_LENGTH - 7);
  const outer = seatPosition(angle, ROPE_LENGTH + 7);

  return <path d={`M ${inner.x} ${inner.y} L ${outer.x} ${outer.y}`} />;
}

/**
 * The static diagram behind the swing: a hatched support beam, the plumb line
 * and the seat's path, marked at every mood band.
 */
export const SwingFrame = memo(function SwingFrame() {
  const left = PIVOT.x - BEAM_HALF_WIDTH;
  const right = PIVOT.x + BEAM_HALF_WIDTH;
  const hatches = Array.from({ length: (2 * BEAM_HALF_WIDTH) / HATCH_STEP }, (_, index) => left + index * HATCH_STEP);

  return (
    <g className="swing-frame" aria-hidden="true">
      <path
        className="swing-frame__hatch"
        d={hatches.map((x) => `M ${x} ${PIVOT.y} L ${x + HATCH_STEP} ${PIVOT.y - HATCH_STEP}`).join(' ')}
      />
      <path className="swing-frame__beam" d={`M ${left} ${PIVOT.y} H ${right}`} />
      <path className="swing-frame__guide" d={`M ${PIVOT.x} ${PIVOT.y} V ${PIVOT.y + ROPE_LENGTH}`} />
      <path className="swing-frame__guide" d={arcPath(-MAX_ANGLE_DEG, MAX_ANGLE_DEG, ROPE_LENGTH)} />
      <g className="swing-frame__ticks">
        {TICK_MOODS.map((mood) => (
          <Tick key={mood} mood={mood} />
        ))}
      </g>
    </g>
  );
});
