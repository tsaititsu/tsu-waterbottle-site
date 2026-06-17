import { STEMS, BRANCHES, type Stem, type Branch } from './lunarConverter';

// 五虎遁年起月法：各年干起寅月的月天干（index）
// 甲/己→丙(2), 乙/庚→戊(4), 丙/辛→庚(6), 丁/壬→壬(8), 戊/癸→甲(0)
const MONTH_STEM_START = [2, 4, 6, 8, 0] as const;

// 納音五行（口訣公式，取代手打查表以根除 typo；推導/驗證見 FORMULAS §2.4）
//   干數：甲乙=1 丙丁=2 戊己=3 庚辛=4 壬癸=5  = floor(stemIdx/2)+1
//   支數：子丑/午未=1 寅卯/申酉=2 辰巳/戌亥=3 = (floor(branchIdx/2)%3)+1
//   和 = 干數+支數，>5 則 −5；和→五行：1木 2金 3水 4火 5土
// 五行 index 編碼：0=金 1=木 2=水 3=火 4=土
const SUM_TO_WUXING = [-1, 1, 0, 2, 3, 4] as const; // 和(1..5) → 五行 index
/** 命宮干支（天干 index 0–9、地支 index 0–11）→ 納音五行 index（0金1木2水3火4土）*/
function nayinWuxing(stemIdx: number, branchIdx: number): number {
  const ganNum = Math.floor(stemIdx / 2) + 1;
  const zhiNum = (Math.floor(branchIdx / 2) % 3) + 1;
  let he = ganNum + zhiNum;
  if (he > 5) he -= 5;
  return SUM_TO_WUXING[he];
}

// 五行 → 五行局數（局數 = 局的數字）
const WUXING_TO_JU = [4, 3, 2, 6, 5] as const; // 金4, 木3, 水2, 火6, 土5

// 五行局名稱（供顯示用）
export const JU_NAMES = ['', '', '水二局', '木三局', '金四局', '土五局', '火六局'] as const;
export type FiveElementsClass = typeof JU_NAMES[number];

export interface MingGongResult {
  mingGongBranch:  Branch;   // 命宮地支
  mingGongStem:    Stem;     // 命宮天干
  shenGongBranch:  Branch;   // 身宮地支
  fiveElementsJu:  2 | 3 | 4 | 5 | 6;  // 五行局數
  fiveElementsClass: FiveElementsClass; // 五行局名稱（如「土五局」）
}

/**
 * 計算命宮、身宮、五行局
 * @param lunarMonth  農曆月份（1–12，閏月用正數）
 * @param timeIndex   時辰 index（0–11；晚子時呼叫方已轉為 0 + 日期+1）
 * @param yearStemIdx 年天干 index（甲=0...癸=9），取自 lunar.getYearGanIndex()
 */
export function computeMingGong(
  lunarMonth:  number,
  timeIndex:   number,
  yearStemIdx: number,
): MingGongResult {
  // ── 命宮地支 ───────────────────────────────────────────────────────────────
  // 月建：農曆月份對應同名地支（子月=子, 丑月=丑...）
  // lunarMonth=1(寅月)→branch 2, lunarMonth=11(子月)→branch 0
  const yueLuo = (lunarMonth + 1) % 12;         // 月落宮（月建地支 index）
  const mingIdx = (yueLuo - timeIndex + 12) % 12; // 命宮地支 index（逆數時辰）

  // ── 命宮天干 ───────────────────────────────────────────────────────────────
  // 五虎遁年起月法：取命宮所在月份的月天干
  // 命宮地支 → 對應月份（寅=1, 卯=2...丑=12），用 寅=0 系統計算
  const mingIdxYin0 = (mingIdx - 2 + 12) % 12;  // 寅=0 系統
  const mingStemIdx = (MONTH_STEM_START[yearStemIdx % 5] + mingIdxYin0) % 10;

  // ── 命宮干支 → 納音五行 → 五行局（公式，見上方 nayinWuxing）──────────────────
  const wuxingIdx = nayinWuxing(mingStemIdx, mingIdx);
  const ju = WUXING_TO_JU[wuxingIdx] as 2 | 3 | 4 | 5 | 6;

  // ── 身宮地支 ───────────────────────────────────────────────────────────────
  // 身宮 = 月落宮 + ti = (命宮 + ti) + ti = 命宮 + 2*ti (順時辰方向)
  const shenIdx = (mingIdx + 2 * timeIndex) % 12;

  return {
    mingGongBranch:    BRANCHES[mingIdx],
    mingGongStem:      STEMS[mingStemIdx],
    shenGongBranch:    BRANCHES[shenIdx],
    fiveElementsJu:    ju,
    fiveElementsClass: JU_NAMES[ju],
  };
}
