/**
 * Phase 2: 14 主星排布
 *
 * 算法驗證: 7/7 case 完整驗證通過（2026-05-03）
 *
 * 紫微安星訣：找最小 offset ≥ 0 使 (lunarDay + offset) % N == 0
 *   - 商 Q = (lunarDay + offset) / N (% 12)
 *   - ziweiIndex (宮位系統 0=寅) = Q - 1 ± offset（偶+奇-）
 *
 * 天府：branchIdx = (4 - ziwei + 12) % 12
 */

import { BRANCHES, type Branch } from './lunarConverter';

export interface MainStarPosition {
  name: string;
  branchIdx: number;  // 0=子 system
}

// 紫微星系：CW offset from 紫微（branch增方向）
const ZIWEI_SYSTEM: Array<[string, number]> = [
  ['紫微',  0],
  ['天機', 11],  // -1 mod 12
  ['太陽',  9],  // -3 mod 12
  ['武曲',  8],  // -4 mod 12
  ['天同',  7],  // -5 mod 12
  ['廉貞',  4],
];

// 天府星系：CW offset from 天府
const TIANFU_SYSTEM: Array<[string, number]> = [
  ['天府',  0],
  ['太陰',  1],
  ['貪狼',  2],
  ['巨門',  3],
  ['天相',  4],
  ['天梁',  5],
  ['七殺',  6],
  ['破軍', 10],
];

/**
 * 計算紫微星地支 index (0=子)
 * fiveElementsValue: 局數 (2=水, 3=木, 4=金, 5=土, 6=火)
 * lunarDay: 農曆日 1–30
 */
function placeZiweiIdx(fiveElementsValue: number, lunarDay: number): number {
  const N = fiveElementsValue;
  let remainder = -1;
  let quotient = 0;
  let offset = -1;

  do {
    offset++;
    const divisor = lunarDay + offset;
    quotient = Math.floor(divisor / N);
    remainder = divisor % N;
  } while (remainder !== 0);

  quotient %= 12;
  let ziweiPalace = quotient - 1;  // palace index (0=寅)

  if (offset % 2 === 0) {
    ziweiPalace += offset;
  } else {
    ziweiPalace -= offset;
  }

  // fixIndex to [0, 11]
  ziweiPalace = ((ziweiPalace % 12) + 12) % 12;

  // Convert palace index (0=寅) → branch index (0=子)
  return (ziweiPalace + 2) % 12;
}

/**
 * 排布 14 主星，回傳每顆星的地支 index (0=子)
 */
export function placeMainStars(
  fiveElementsValue: number,
  lunarDay: number
): MainStarPosition[] {
  const ziweiIdx = placeZiweiIdx(fiveElementsValue, lunarDay);
  const tianfuIdx = (4 - ziweiIdx + 12) % 12;

  const result: MainStarPosition[] = [];

  for (const [name, cwOffset] of ZIWEI_SYSTEM) {
    result.push({ name, branchIdx: (ziweiIdx + cwOffset) % 12 });
  }

  for (const [name, cwOffset] of TIANFU_SYSTEM) {
    result.push({ name, branchIdx: (tianfuIdx + cwOffset) % 12 });
  }

  return result;
}

/** 便利函式：取得地支字符 */
export function mainStarsToBranchMap(
  fiveElementsValue: number,
  lunarDay: number
): Record<string, Branch> {
  return Object.fromEntries(
    placeMainStars(fiveElementsValue, lunarDay).map(({ name, branchIdx }) => [
      name,
      BRANCHES[branchIdx],
    ])
  );
}
