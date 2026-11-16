import { useId } from 'react';
import { FACE_RADIUS, faceGeometry } from '../face-geometry';

interface MoodFaceProps {
  /** Fractional moods morph smoothly between expressions. */
  mood: number;
  x?: number;
  y?: number;
  radius?: number;
  /** Degrees; the rider leans into the swing. */
  tilt?: number;
  animated?: boolean;
  opacity?: number;
}

const OUTLINE = '#7a4a00';
const INK = '#3b2400';

/** An emoji face drawn in SVG whose expression follows the mood from angry to laughing. */
export function MoodFace({ mood, x = 0, y = 0, radius = FACE_RADIUS, tilt = 0, animated = false, opacity }: MoodFaceProps) {
  const face = faceGeometry(mood);
  const clipId = `mouth${useId().replace(/:/g, '')}`;
  const scale = radius / FACE_RADIUS;

  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt}) scale(${scale})`} opacity={opacity}>
      <g className={animated ? `mood-face mood-face--${face.band}` : 'mood-face'}>
        {face.steamOpacity > 0 && (
          <g className="mood-face__steam" opacity={face.steamOpacity} fill="#ffffff" stroke="#9aa7b4" strokeWidth={1.4}>
            <path d="M -27 -22 a 5 5 0 0 1 2 -9 a 6 6 0 0 1 10 -1 a 5 5 0 0 1 2 9 z" />
            <path d="M 15 -23 a 5 5 0 0 1 2 -9 a 6 6 0 0 1 10 -1 a 5 5 0 0 1 2 9 z" />
          </g>
        )}
        <circle r={FACE_RADIUS} fill={face.skin} stroke={OUTLINE} strokeWidth={2.2} />
        <ellipse cx={-8} cy={-13} rx={11} ry={6} fill="#ffffff" opacity={0.35} />
        {face.blushOpacity > 0 && (
          <g fill="#ff7d7d" opacity={face.blushOpacity}>
            <ellipse cx={-15} cy={5} rx={4.8} ry={2.8} />
            <ellipse cx={15} cy={5} rx={4.8} ry={2.8} />
          </g>
        )}
        <g className="mood-face__eyes">
          {face.eyeOpen > 0 && (
            <g fill={INK} opacity={Math.min(1, face.eyeOpen * 1.5)}>
              <ellipse cx={-9} cy={-5} rx={3.4} ry={face.eyeRy} />
              <ellipse cx={9} cy={-5} rx={3.4} ry={face.eyeRy} />
            </g>
          )}
          {face.eyeOpen < 1 && (
            <path
              d="M -14 -3 Q -9 -10 -4 -3 M 4 -3 Q 9 -10 14 -3"
              fill="none"
              stroke={INK}
              strokeWidth={2.6}
              strokeLinecap="round"
              opacity={1 - face.eyeOpen}
            />
          )}
        </g>
        {face.browOpacity > 0 && (
          <path d={face.browPath} stroke={INK} strokeWidth={2.8} strokeLinecap="round" opacity={face.browOpacity} />
        )}
        <clipPath id={clipId}>
          <path d={face.mouthPath} />
        </clipPath>
        <path
          d={face.mouthPath}
          fill={face.mouthFill === 'open' ? '#6b1d0e' : face.mouthFill === 'teeth' ? '#ffffff' : 'none'}
          stroke="#5a2a00"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {face.mouthFill === 'open' && (
          <g clipPath={`url(#${clipId})`}>
            <rect x={-20} y={face.upperTeeth.y} width={40} height={face.upperTeeth.height + 2} fill="#ffffff" />
            <ellipse {...face.tongue} fill="#ff7b8a" />
          </g>
        )}
        {face.mouthFill === 'teeth' && (
          <path
            d={face.teethLines}
            clipPath={`url(#${clipId})`}
            fill="none"
            stroke="#9b8a7a"
            strokeWidth={1.1}
            opacity={face.grit}
          />
        )}
        {face.tearOpacity > 0 && (
          <g className="mood-face__tears" opacity={face.tearOpacity} fill="#5cc3ff" stroke="#1c7fc9" strokeWidth={1}>
            <path d="M -19 -3 c 3 4 4 7 0 9 c -4 -2 -3 -5 0 -9 z" />
            <path d="M 19 -3 c 3 4 4 7 0 9 c -4 -2 -3 -5 0 -9 z" />
          </g>
        )}
        {face.veinOpacity > 0 && (
          <path
            d="M 13 -21 q 3 0 3 -3 M 18 -24 q 0 3 3 3 M 21 -19 q -3 0 -3 3 M 16 -16 q 0 -3 -3 -3"
            transform="translate(2 1)"
            fill="none"
            stroke="#d9221c"
            strokeWidth={1.8}
            strokeLinecap="round"
            opacity={face.veinOpacity}
          />
        )}
      </g>
    </g>
  );
}
