import { useId } from 'react';
import { moodBand, toMood } from '../../shared/mood';
import { useSwing } from '../hooks/use-swing';
import type { Spring } from '../swing-physics';
import { MoodFace } from './mood-face';
import { PIVOT, PLANK_HEIGHT, PLANK_WIDTH, ROPE_LENGTH, ROPE_SPREAD, arcPath, pointOnRope, ropesPath, seatPosition } from './scene-geometry';

interface SwingProps {
  /** The chosen mood; null hangs the swing straight down. */
  mood: number | null;
  onCommit?: (mood: number) => void;
  disabled?: boolean;
  label?: string;
  /** How the swing moves when `mood` changes. */
  spring?: Spring;
}

const FACE_RADIUS = 36;
const JOINT_RADIUS = 4.5;

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

export function Plank({ x, y, className = 'swing__plank' }: { x: number; y: number; className?: string }) {
  return (
    <rect
      className={className}
      x={x - PLANK_WIDTH / 2}
      y={y - PLANK_HEIGHT / 2}
      width={PLANK_WIDTH}
      height={PLANK_HEIGHT}
      rx={3}
    />
  );
}

/** The ropes' hinges on the beam; the ghost swing hangs from the same ones. */
function Hinges() {
  return (
    <g className="swing__joint">
      <circle cx={PIVOT.x - ROPE_SPREAD} cy={PIVOT.y} r={JOINT_RADIUS} />
      <circle cx={PIVOT.x + ROPE_SPREAD} cy={PIVOT.y} r={JOINT_RADIUS} />
    </g>
  );
}

/** A double-headed arrow along the seat's path, shown until the first move. */
function DragHint({ angle }: { angle: number }) {
  const arrowId = `drag-arrow${useId().replace(/:/g, '')}`;
  const label = seatPosition(angle, ROPE_LENGTH + 39);

  return (
    <g
      className="drag-hint"
      style={{ transformOrigin: `${PIVOT.x}px ${PIVOT.y}px` }}
      pointerEvents="none"
      aria-hidden="true"
    >
      <defs>
        <marker
          id={arrowId}
          viewBox="0 0 10 10"
          refX={7}
          refY={5}
          markerWidth={5}
          markerHeight={5}
          orient="auto-start-reverse"
        >
          <path className="drag-hint__arrow" d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
      </defs>
      <path
        className="drag-hint__path"
        d={arcPath(angle - 13, angle + 13, ROPE_LENGTH + 20)}
        markerStart={`url(#${arrowId})`}
        markerEnd={`url(#${arrowId})`}
      />
      <text className="drag-hint__text" x={label.x} y={label.y} textAnchor="middle">
        Drag me
      </text>
    </g>
  );
}

/**
 * The draggable swing. The face on the seat shows the mood under the swing
 * while it moves; letting go commits that mood.
 */
export function Swing({ mood, onCommit, disabled = false, label = 'Your mood', spring }: SwingProps) {
  const swing = useSwing({ mood, onCommit, disabled, spring });
  const seat = seatPosition(swing.angle);
  const ropeBottom = (side: -1 | 1) => ({ x: seat.x + side * ROPE_SPREAD, y: seat.y });
  const faceCenter = { x: seat.x, y: seat.y - PLANK_HEIGHT / 2 - FACE_RADIUS + 1 };
  // The face leans into the motion.
  const tilt = clamp(-swing.velocity * 0.05, 12);
  const value = swing.dragging ? toMood(swing.liveMood) : swing.targetMood;
  const band = moodBand(value);
  const grabTop = (side: -1 | 1) => pointOnRope(swing.angle, side, 150);

  return (
    <g className="swing">
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
        <path className="swing__rope" d={ropesPath(seat)} />
        <MoodFace
          mood={swing.liveMood}
          x={faceCenter.x}
          y={faceCenter.y}
          radius={FACE_RADIUS}
          tilt={tilt}
          animated={!swing.dragging}
        />
        <Plank x={seat.x} y={seat.y} />
        <g className="swing__joint">
          <circle cx={ropeBottom(-1).x} cy={ropeBottom(-1).y} r={JOINT_RADIUS - 1} />
          <circle cx={ropeBottom(1).x} cy={ropeBottom(1).y} r={JOINT_RADIUS - 1} />
        </g>
        <ellipse className="swing__focus-ring" cx={seat.x} cy={seat.y - 30} rx={74} ry={54} />
        {/* Generous invisible grab area around the seat and the lower ropes. */}
        <path
          d={[
            `M ${grabTop(-1).x - 18} ${grabTop(-1).y}`,
            `L ${grabTop(1).x + 18} ${grabTop(1).y}`,
            `L ${seat.x + ROPE_SPREAD + 30} ${seat.y + 30}`,
            `L ${seat.x - ROPE_SPREAD - 30} ${seat.y + 30} Z`,
          ].join(' ')}
          fill="transparent"
        />
      </g>
      <Hinges />
      {mood === null && !swing.dragging && !disabled && <DragHint angle={swing.angle} />}
    </g>
  );
}
