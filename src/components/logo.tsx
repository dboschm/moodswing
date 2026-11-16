/** Glyph x-height runs from y 10 to the baseline at 20; d and h rise to 4 and g drops to 26. */
const BASELINE = 20;
const X_HEIGHT = 10;

/** Single-stroke lowercase letters, like technical drawing lettering. */
const GLYPHS = {
  m: { width: 12, d: 'M0 20 V10 M0 13 a3 3 0 0 1 6 0 V20 M6 13 a3 3 0 0 1 6 0 V20' },
  o: { width: 10, d: 'M0 15 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0' },
  d: { width: 10, d: 'M0 15 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M10 4 V20' },
  s: {
    width: 8,
    d: 'M8 11.5 C7 10.4 5.6 10 4 10 C2 10 0.5 11 0.5 12.6 C0.5 16 8 14 8 17.4 C8 19 6.3 20 4 20 C2.3 20 1 19.5 0 18.3',
  },
  w: { width: 14, d: 'M0 10 L3.5 20 L7 12 L10.5 20 L14 10' },
  i: { width: 2, d: 'M1 10 V20 M1 6.4 V6.5' },
  n: { width: 8, d: 'M0 20 V10 M0 14 a4 4 0 0 1 8 0 V20' },
  g: { width: 10, d: 'M0 15 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 M10 10 V21 C10 24.5 7.5 26 5 26 C3 26 1.5 25.2 0.6 24' },
  t: { width: 7, d: 'M2.5 5 V17.5 C2.5 19.3 3.5 20 5 20 H7 M0 10 H6.5' },
  h: { width: 8, d: 'M0 4 V20 M0 14 a4 4 0 0 1 8 0 V20' },
} as const;

type Glyph = keyof typeof GLYPHS;
export type LogoWord = 'moodswing' | 'soothing';

const BRAND = 'moodswing';
const GAP = 3.5;

/**
 * Both words letter by letter, lined up so they share "oo" and "ing": those
 * letters slide while the others are rubbed out and drawn anew.
 */
const SLOTS: readonly [Glyph | null, Glyph | null][] = [
  ['m', 's'],
  ['o', 'o'],
  ['o', 'o'],
  ['d', 't'],
  ['s', 'h'],
  ['w', null],
  ['i', 'i'],
  ['n', 'n'],
  ['g', 'g'],
];

/** Where each slot's letter starts when only the slots holding a letter are set side by side. */
function layout(letters: readonly (Glyph | null)[]): { positions: number[]; width: number } {
  let x = 0;
  const positions = letters.map((letter) => {
    const position = x;

    if (letter) {
      x += GLYPHS[letter].width + GAP;
    }

    return position;
  });

  return { positions, width: x - GAP };
}

const brand = layout(SLOTS.map(([letter]) => letter));
const soothing = layout(SLOTS.map(([, letter]) => letter));
// The shorter word sits centred between the brand's guide lines.
const SOOTHING_OFFSET = (brand.width - soothing.width) / 2;
const WIDTH = brand.width;
const X = {
  moodswing: brand.positions,
  soothing: soothing.positions.map((position) => position + SOOTHING_OFFSET),
};

/** The moodswing wordmark, lettered in single strokes between dashed guide lines; it can re-letter itself as "soothing". */
export function Logo({ word = 'moodswing' }: { word?: LogoWord }) {
  return (
    <svg className="logo" viewBox={`-6 2 ${WIDTH + 12} 27`} role="img" aria-label={BRAND}>
      <path
        className="logo__guide"
        d={`M-6 ${X_HEIGHT} H${WIDTH + 6} M-6 ${BASELINE} H${WIDTH + 6} M-3 ${X_HEIGHT - 2} V${BASELINE + 2} M${WIDTH + 3} ${X_HEIGHT - 2} V${BASELINE + 2}`}
      />
      <g className="logo__letters">
        {SLOTS.map(([branded, soothed], index) =>
          branded === soothed ? (
            <path
              key={index}
              className="logo__slide"
              d={GLYPHS[branded!].d}
              style={{ transform: `translateX(${X[word][index]}px)` }}
            />
          ) : (
            <g key={index}>
              {branded && (
                <path
                  className="logo__swap"
                  d={GLYPHS[branded].d}
                  pathLength={1}
                  transform={`translate(${X.moodswing[index]} 0)`}
                  data-shown={word === 'moodswing' || undefined}
                />
              )}
              {soothed && (
                <path
                  className="logo__swap"
                  d={GLYPHS[soothed].d}
                  pathLength={1}
                  transform={`translate(${X.soothing[index]} 0)`}
                  data-shown={word === 'soothing' || undefined}
                />
              )}
            </g>
          ),
        )}
      </g>
    </svg>
  );
}
