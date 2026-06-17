import { BRANCH_GRID, getSanFangSiZheng } from '../i18n';
import type { ZiweiPalace } from '../lib';

interface Props {
  palaces: ZiweiPalace[];
  originPalaceIdx: number;
}

// Returns the center of the inner-facing border of each outer palace cell,
// so lines terminate at the inner frame rather than palace center.
function branchToXY(branch: string): [number, number] | null {
  const pos = BRANCH_GRID[branch];
  if (!pos) return null;
  const [row, col] = pos;
  const isTop = row === 0, isBot = row === 3, isLeft = col === 0, isRight = col === 3;
  if (isTop  && isLeft)  return [0.25, 0.25];
  if (isTop  && isRight) return [0.75, 0.25];
  if (isBot  && isRight) return [0.75, 0.75];
  if (isBot  && isLeft)  return [0.25, 0.75];
  if (isTop)  return [(col + 0.5) / 4, 0.25];
  if (isBot)  return [(col + 0.5) / 4, 0.75];
  if (isLeft) return [0.25, (row + 0.5) / 4];
  if (isRight) return [0.75, (row + 0.5) / 4];
  return null;
}

// strokeWidth in viewBox "0 0 1 1" units ≈ 2–3 screen px at typical chart width
const SW = 0.003;
const DASH = '0.022,0.014';

export function ThreeSideLine({ palaces, originPalaceIdx }: Props) {
  const origin = palaces.find(p => p.index === originPalaceIdx);
  if (!origin) return null;

  const branches = getSanFangSiZheng(origin.earthlyBranch);
  const [b0, b1, b2, b3] = branches;
  const p0 = branchToXY(b0);
  const p1 = branchToXY(b1);
  const p2 = branchToXY(b2);
  const p3 = branchToXY(b3);
  if (!p0 || !p1 || !p2 || !p3) return null;

  return (
    <svg className="three-side-svg" viewBox="0 0 1 1" preserveAspectRatio="none">
      <g stroke="#5a7fa8" strokeOpacity={0.65} strokeWidth={SW} fill="none">
        {/* base ↔ 對宮 */}
        <line x1={p0[0]} y1={p0[1]} x2={p1[0]} y2={p1[1]} strokeDasharray={DASH} />
        {/* base ↔ 逆時針5格 */}
        <line x1={p0[0]} y1={p0[1]} x2={p2[0]} y2={p2[1]} strokeDasharray={DASH} />
        {/* base ↔ 順時針5格 */}
        <line x1={p0[0]} y1={p0[1]} x2={p3[0]} y2={p3[1]} strokeDasharray={DASH} />
        {/* 逆時針5格 ↔ 順時針5格 */}
        <line x1={p2[0]} y1={p2[1]} x2={p3[0]} y2={p3[1]} strokeDasharray={DASH} />
      </g>
    </svg>
  );
}
