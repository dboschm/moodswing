import { memo, type SVGProps } from 'react';
import { SCENE_HEIGHT, SCENE_WIDTH } from './scene-geometry';

type Circle = readonly [cx: number, cy: number, r: number];

/*
 * Leafy shapes are unions of circles. Drawing all circles once with a thick
 * stroke and then again without one leaves a single outline around the union,
 * the way the cartoon draws its tree crowns.
 */
const CROWN: readonly Circle[] = [
  [120, 80, 75], [230, 50, 80], [350, 45, 85], [470, 55, 80], [580, 90, 75],
  [60, 160, 60], [170, 150, 80], [300, 140, 90], [430, 140, 90], [560, 160, 80], [645, 150, 50],
  [95, 200, 45], [185, 207, 48], [280, 210, 45], [375, 210, 46], [470, 208, 46], [560, 198, 45], [630, 182, 40],
];
const CROWN_SHADE: readonly Circle[] = CROWN.filter(([, cy]) => cy > 150).map(([cx, cy, r]) => [cx, cy + 16, r * 0.85]);
const CROWN_LIGHT: readonly Circle[] = CROWN.filter(([, cy]) => cy < 100).map(([cx, cy, r]) => [cx - 18, cy - 14, r * 0.5]);
const LEFT_LEAVES: readonly Circle[] = [[44, 262, 26], [78, 252, 22], [30, 292, 20], [66, 290, 22]];
const RIGHT_LEAVES: readonly Circle[] = [[622, 214, 26], [654, 230, 22], [604, 238, 19], [640, 252, 18]];

const LEAF = '#4f9a2b';
const LEAF_DARK = '#3a7a1c';
const LEAF_LIGHT = '#69b23a';
const LEAF_OUTLINE = '#24520f';
const BARK = '#8b4a1c';
const BARK_DARK = '#6b3510';
const BARK_LIGHT = '#b4692e';
const BARK_OUTLINE = '#3b1d08';

const TRUNK_PATH = [
  'M 85 668',
  'C 120 662 150 650 160 612',
  'C 170 560 168 470 160 405',
  // left branch
  'C 130 370 95 330 55 300',
  'C 45 292 40 280 50 276',
  'C 90 300 130 330 160 350',
  'C 165 300 160 250 150 200',
  'L 255 195',
  'C 250 240 248 270 252 290',
  // right branch, which holds the swing
  'C 300 280 380 282 450 276',
  'C 520 270 575 250 610 222',
  'C 618 216 626 222 620 230',
  'C 585 262 520 296 450 306',
  'C 380 314 300 316 262 336',
  'C 245 380 242 470 250 560',
  // roots
  'C 255 610 285 650 340 668',
  'C 300 674 270 668 245 676',
  'C 215 684 180 676 150 678',
  'C 120 680 100 672 85 668 Z',
].join(' ');

const TRUNK_SHADE_PATH = [
  'M 226 330',
  'C 232 400 228 480 236 590',
  'C 244 630 280 656 330 668',
  'L 340 668',
  'C 285 650 255 610 250 560',
  'C 242 470 245 380 262 336 Z',
].join(' ');

function Circles({ circles, ...props }: { circles: readonly Circle[] } & SVGProps<SVGGElement>) {
  return (
    <g {...props}>
      {circles.map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
      ))}
    </g>
  );
}

function LeafCluster({ circles, id }: { circles: readonly Circle[]; id: string }) {
  return (
    <g>
      <Circles circles={circles} fill={LEAF_OUTLINE} stroke={LEAF_OUTLINE} strokeWidth={7} />
      <Circles circles={circles} fill={LEAF} />
      <clipPath id={id}>
        <Circles circles={circles} />
      </clipPath>
      <Circles
        circles={circles.map(([cx, cy, r]) => [cx + 4, cy + 10, r * 0.8] as const)}
        fill={LEAF_DARK}
        clipPath={`url(#${id})`}
      />
    </g>
  );
}

function Cloud({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g className="cloud" transform={`translate(${x} ${y}) scale(${scale})`}>
      <g fill="#ffffff">
        <circle cx={-58} cy={0} r={28} />
        <circle cx={-20} cy={-22} r={40} />
        <circle cx={30} cy={-14} r={34} />
        <circle cx={68} cy={2} r={25} />
        <rect x={-80} y={0} width={170} height={26} rx={13} />
      </g>
      <ellipse cx={4} cy={22} rx={78} ry={6} fill="#e3eef8" />
    </g>
  );
}

/** The static backdrop: sky, clouds, meadow and the tree whose right branch holds the swing. */
export const TreeScene = memo(function TreeScene() {
  return (
    <g className="tree-scene" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8cc8f4" />
          <stop offset="1" stopColor="#bfe1fb" />
        </linearGradient>
        <linearGradient id="meadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cc443" />
          <stop offset="1" stopColor="#4c9a28" />
        </linearGradient>
        <clipPath id="crown-clip">
          <Circles circles={CROWN} />
        </clipPath>
      </defs>
      <rect width={SCENE_WIDTH} height={SCENE_HEIGHT} fill="url(#sky)" />
      <g className="clouds">
        <Cloud x={575} y={420} />
        <Cloud x={95} y={505} scale={0.7} />
      </g>
      <path d="M 0 566 C 120 554 260 550 380 556 S 600 564 700 552 L 700 780 L 0 780 Z" fill="url(#meadow)" />
      <ellipse cx={215} cy={674} rx={205} ry={30} fill="#2f6e17" />

      <path d={TRUNK_PATH} fill={BARK} />
      <path d={TRUNK_SHADE_PATH} fill={BARK_DARK} />
      <g fill="none" stroke={BARK_LIGHT} strokeLinecap="round">
        <path d="M 180 610 C 188 530 186 470 176 412" strokeWidth={5} />
        <path d="M 199 566 C 204 506 202 456 197 424" strokeWidth={3} />
        <path d="M 290 300 C 350 292 420 292 490 284" strokeWidth={3} />
        <path d="M 140 370 C 115 345 90 318 66 298" strokeWidth={3} />
      </g>
      <path d={TRUNK_PATH} fill="none" stroke={BARK_OUTLINE} strokeWidth={3.5} strokeLinejoin="round" />

      <Circles circles={CROWN} fill={LEAF_OUTLINE} stroke={LEAF_OUTLINE} strokeWidth={7} />
      <Circles circles={CROWN} fill={LEAF} />
      <g clipPath="url(#crown-clip)">
        <Circles circles={CROWN_SHADE} fill={LEAF_DARK} />
        <Circles circles={CROWN_LIGHT} fill={LEAF_LIGHT} />
      </g>
      <LeafCluster circles={LEFT_LEAVES} id="left-leaves" />
      <LeafCluster circles={RIGHT_LEAVES} id="right-leaves" />
    </g>
  );
});
