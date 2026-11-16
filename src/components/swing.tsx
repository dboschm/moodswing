import { moodBand, toMood } from '../../shared/mood';
import { faceGeometry } from '../face-geometry';
import { useSwing } from '../hooks/use-swing';
import { MoodFace } from './mood-face';
import { ROPE_OUTLINE, Rope } from './rope';
import {
  GROUND_SHADOW_Y,
  PIVOT,
  PLANK_HEIGHT,
  PLANK_WIDTH,
  ROPE_LENGTH,
  ROPE_SPREAD,
  pointOnRope,
  seatPosition,
} from './scene-geometry';

interface SwingProps {
  /** The chosen mood; null hangs the swing straight down. */
  mood: number | null;
  onCommit?: (mood: number) => void;
  disabled?: boolean;
  label?: string;
}

const FACE_RADIUS = 31;
const LIMB = '#7a4a00';

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

/** Diagonal rope wraps around the branch where each rope is tied. */
function RopeKnot({ x }: { x: number }) {
  return (
    <g>
      <Rope from={{ x: x - 8, y: PIVOT.y - 19 }} to={{ x: x + 8, y: PIVOT.y - 4 }} />
      <Rope from={{ x: x - 8, y: PIVOT.y - 6 }} to={{ x: x + 8, y: PIVOT.y + 9 }} />
    </g>
  );
}

export function Plank({ x, y, ghost = false }: { x: number; y: number; ghost?: boolean }) {
  const left = x - PLANK_WIDTH / 2;

  if (ghost) {
    return (
      <rect
        x={left}
        y={y - PLANK_HEIGHT / 2}
        width={PLANK_WIDTH}
        height={PLANK_HEIGHT + 5}
        rx={3}
        fill="#ffffff"
        fillOpacity={0.45}
        stroke={ROPE_OUTLINE}
        strokeWidth={2.5}
        strokeDasharray="7 5"
      />
    );
  }

  return (
    <g className="swing__plank" stroke={ROPE_OUTLINE} strokeWidth={2.5} strokeLinejoin="round">
      <rect x={left} y={y + PLANK_HEIGHT / 2 - 2} width={PLANK_WIDTH} height={7} rx={2} fill="#d6bb78" />
      <rect x={left} y={y - PLANK_HEIGHT / 2} width={PLANK_WIDTH} height={PLANK_HEIGHT} rx={3} fill="#f3e2b0" />
      <path d={`M ${left + 12} ${y - 1} H ${left + 70}`} stroke="#dcc791" strokeWidth={1.5} />
    </g>
  );
}

/** Invites people to grab the swing until they first move it. */
function SpeechBubble({ x, y, text }: { x: number; y: number; text: string }) {
  const left = x + 20;
  const top = y - 78;
  const width = 104;
  const height = 34;
  const r = height / 2;

  return (
    <g className="speech-bubble" pointerEvents="none">
      <path
        d={[
          `M ${left + r} ${top} H ${left + width - r}`,
          `A ${r} ${r} 0 0 1 ${left + width - r} ${top + height}`,
          `H ${left + 36} L ${x + 12} ${y - 26} L ${left + 20} ${top + height} H ${left + r}`,
          `A ${r} ${r} 0 0 1 ${left + r} ${top} Z`,
        ].join(' ')}
        fill="#ffffff"
        stroke="#3b2400"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <text x={left + width / 2} y={top + 22} textAnchor="middle" className="speech-bubble__text">
        {text}
      </text>
    </g>
  );
}

/**
 * The draggable swing. The rider's face shows the mood under the swing while
 * it moves; letting go commits that mood.
 */
export function Swing({ mood, onCommit, disabled = false, label = 'Your mood' }: SwingProps) {
  const swing = useSwing({ mood, onCommit, disabled });
  const seat = seatPosition(swing.angle);
  const ropeBottom = (side: -1 | 1) => ({ x: seat.x + side * ROPE_SPREAD, y: seat.y + 2 });
  const ropeTop = (side: -1 | 1) => ({ x: PIVOT.x + side * ROPE_SPREAD, y: PIVOT.y });
  const faceCenter = { x: seat.x, y: seat.y - PLANK_HEIGHT / 2 - FACE_RADIUS + 3 };
  const skin = faceGeometry(swing.liveMood).skin;
  // Legs trail behind the motion and the head leans into it.
  const legLag = clamp(-swing.velocity * 0.09, 16);
  const tilt = clamp(-swing.velocity * 0.05, 12);
  const rise = (ROPE_LENGTH - (seat.y - PIVOT.y)) / ROPE_LENGTH;
  const value = swing.dragging ? toMood(swing.liveMood) : swing.targetMood;
  const band = moodBand(value);
  const hand = (side: -1 | 1) => pointOnRope(swing.angle, side, 54);
  const shoulder = (side: -1 | 1) => ({ x: faceCenter.x + side * 25, y: faceCenter.y + 13 });

  return (
    <g className="swing">
      <ellipse
        cx={seat.x}
        cy={GROUND_SHADOW_Y}
        rx={56 * (1 - rise * 0.9)}
        ry={9 * (1 - rise * 0.7)}
        fill="#2f6e17"
        opacity={0.75 - rise}
      />
      <g
        ref={swing.handleRef}
        className="swing__handle"
        data-dragging={swing.dragging || undefined}
        data-disabled={disabled || undefined}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={mood === null && !swing.dragging ? 'Not chosen yet' : `${band.label} (${value})`}
        aria-disabled={disabled || undefined}
        {...swing.handlers}
      >
        <g className={swing.dragging ? 'swing__body' : 'swing__body swing__body--idle'}>
          <Rope from={ropeTop(-1)} to={ropeBottom(-1)} />
          <Rope from={ropeTop(1)} to={ropeBottom(1)} />
          <MoodFace
            mood={swing.liveMood}
            x={faceCenter.x}
            y={faceCenter.y}
            radius={FACE_RADIUS}
            tilt={tilt}
            animated={!swing.dragging}
          />
          <Plank x={seat.x} y={seat.y} />
          <g stroke={LIMB} strokeWidth={3.5} strokeLinecap="round" fill="none">
            {([-1, 1] as const).map((side) => (
              <path
                key={side}
                d={`M ${seat.x + side * 9} ${seat.y + 6} Q ${seat.x + side * 10 + legLag * 0.4} ${seat.y + 20} ${seat.x + side * 11 + legLag} ${seat.y + 31}`}
              />
            ))}
            {([-1, 1] as const).map((side) => {
              const from = shoulder(side);
              const to = hand(side);

              return <path key={side} d={`M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${(from.y + to.y) / 2 + 9} ${to.x} ${to.y}`} />;
            })}
          </g>
          {([-1, 1] as const).map((side) => (
            <ellipse
              key={side}
              cx={seat.x + side * 13 + legLag}
              cy={seat.y + 33}
              rx={6.5}
              ry={3.8}
              fill="#d23b2a"
              stroke="#5a1a10"
              strokeWidth={1.5}
            />
          ))}
          {([-1, 1] as const).map((side) => (
            <circle key={side} cx={hand(side).x} cy={hand(side).y} r={4.5} fill={skin} stroke={LIMB} strokeWidth={1.5} />
          ))}
          <ellipse className="swing__focus-ring" cx={seat.x} cy={seat.y - 18} rx={74} ry={56} />
          {/* Generous invisible grab area around the seat and the lower ropes. */}
          <path
            d={[
              `M ${pointOnRope(swing.angle, -1, 150).x - 18} ${pointOnRope(swing.angle, -1, 150).y}`,
              `L ${pointOnRope(swing.angle, 1, 150).x + 18} ${pointOnRope(swing.angle, 1, 150).y}`,
              `L ${seat.x + ROPE_SPREAD + 30} ${seat.y + 42}`,
              `L ${seat.x - ROPE_SPREAD - 30} ${seat.y + 42} Z`,
            ].join(' ')}
            fill="transparent"
          />
        </g>
      </g>
      <RopeKnot x={PIVOT.x - ROPE_SPREAD} />
      <RopeKnot x={PIVOT.x + ROPE_SPREAD} />
      {mood === null && !swing.dragging && !disabled && <SpeechBubble x={faceCenter.x} y={faceCenter.y} text="Drag me!" />}
    </g>
  );
}
