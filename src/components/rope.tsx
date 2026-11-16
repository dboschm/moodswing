import type { Point } from '../swing-physics';

export const ROPE_OUTLINE = '#6e5320';
const ROPE_BODY = '#d8b878';
const ROPE_TWIST = '#b38b4a';

/** A cartoon rope: dark outline, tan body and dashes that read as twisted strands. */
export function Rope({ from, to, dashed = false }: { from: Point; to: Point; dashed?: boolean }) {
  const d = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;

  if (dashed) {
    return <path d={d} stroke={ROPE_OUTLINE} strokeWidth={3} strokeDasharray="7 6" strokeLinecap="round" />;
  }

  return (
    <g strokeLinecap="round">
      <path d={d} stroke={ROPE_OUTLINE} strokeWidth={7} />
      <path d={d} stroke={ROPE_BODY} strokeWidth={4.2} />
      <path d={d} stroke={ROPE_TWIST} strokeWidth={4.2} strokeDasharray="2.5 4.5" />
    </g>
  );
}
