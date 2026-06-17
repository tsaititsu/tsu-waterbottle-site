/**
 * 流年 / 流月 Horoscope 自主計算模組
 */

import { Solar, Lunar, LunarYear } from 'lunar-javascript';
import { BRANCHES, STEMS } from './lunarConverter';

/**
 * 農曆年月日 → 國曆 Date（供 Advanced 模式流月/流日 queryDate 用）。
 * lunarMonth 1–12 為一般月；**負數 = 閏月**（如 -6 = 閏六月，lunar-javascript 慣例）。
 * lunarDay 1–30。
 */
export function lunarToSolarDate(lunarYear: number, lunarMonth: number, lunarDay: number): Date {
  const solar = Lunar.fromYmd(lunarYear, lunarMonth, lunarDay).getSolar();
  return new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
}
import { MUTAGEN_TABLE } from '../constants';
import type { HeavenlyStem, EarthlyBranch, FilteredStarGroup } from '../../../types/ziwei';

// ── 年干起月法（五虎遁年起月法）─────────────────────────────────────────────
// 甲己年 → 正月=丙寅，起丙(2)
// 乙庚年 → 正月=戊寅，起戊(4)
// 丙辛年 → 正月=庚寅，起庚(6)
// 丁壬年 → 正月=壬寅，起壬(8)
// 戊癸年 → 正月=甲寅，起甲(0)
// const MONTH_STEM_START = [2, 4, 6, 8, 0]; // reserved: 五虎遁年起月法

// 年干起祿存（同 luckyStars.ts）
const LU_CUN   = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0];
// 年支起天馬（同 luckyStars.ts）

// ── 輔助型別 ────────────────────────────────────────────────────────────────

interface PalaceRef {
  index: number;
  name: string;
  earthlyBranch: string; // 地支中文字
}

/** 簡化星曜 */
interface StarRef {
  name: string;
  type: string;
  scope: string;
}

/** placeStar：按地支 index 分配星曜到 12 宮，回傳 FilteredStarGroup[] */
function placeStar(
  branchIdx: number,
  name: string,
  scope: string,
  palaces: PalaceRef[],
  out: Map<number, StarRef[]>,
) {
  const branch = BRANCHES[branchIdx];
  const palace = palaces.find(p => p.earthlyBranch === branch);
  if (!palace) return;
  const existing = out.get(palace.index) ?? [];
  existing.push({ name, type: 'flower', scope });
  out.set(palace.index, existing);
}

function toFilteredStarGroups(
  palaces: PalaceRef[],
  out: Map<number, StarRef[]>,
): FilteredStarGroup[] {
  return palaces.map(p => ({
    palaceIndex: p.index,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stars: (out.get(p.index) ?? []) as any[],
  }));
}

// ── 公開函式 ────────────────────────────────────────────────────────────────

/**
 * 取得查詢日期的農曆年干支 index（直接操作 lunar-javascript）
 * 注意：時辰晚子時由呼叫方傳入正確日期，此處僅處理日期本身。
 */
function getLunarYearStemBranch(queryDate: Date): { ys: number; yb: number; ly: number } {
  const y = queryDate.getFullYear();
  const m = queryDate.getMonth() + 1;
  const d = queryDate.getDate();
  const lunar = Solar.fromYmd(y, m, d).getLunar();
  const ly = lunar.getYear();
  const ys = ((ly - 4) % 10 + 10) % 10;
  const yb = ((ly - 4) % 12 + 12) % 12;
  return { ys, yb, ly };
}

/**
 * 取得查詢日期的節氣月干支 index（使用 lunar-javascript 的 getMonthInGanZhi）
 * 月干支依節令（每個「節」）切換，如 立春=寅月起、驚蟄=卯月起，
 * 比農曆月更精確（農曆正月有時在立春之前）。
 */
function getSolarTermMonthGanzhi(queryDate: Date): { stemIdx: number; branchIdx: number } {
  const y = queryDate.getFullYear();
  const m = queryDate.getMonth() + 1;
  const d = queryDate.getDate();
  const lunar = Solar.fromYmd(y, m, d).getLunar();
  const ganZhi = lunar.getMonthInGanZhi(); // e.g. "丙寅"
  const stemChar   = ganZhi[0];
  const branchChar = ganZhi[1];
  const stemIdx   = STEMS.indexOf(stemChar as typeof STEMS[number]);
  const branchIdx = BRANCHES.indexOf(branchChar as typeof BRANCHES[number]);
  return { stemIdx: stemIdx < 0 ? 0 : stemIdx, branchIdx: branchIdx < 0 ? 0 : branchIdx };
}

/**
 * 取得查詢日期的日干支 index（使用 lunar-javascript）
 */
function getDayGanzhi(queryDate: Date): { stemIdx: number; branchIdx: number } {
  const y = queryDate.getFullYear();
  const m = queryDate.getMonth() + 1;
  const d = queryDate.getDate();
  const lunar = Solar.fromYmd(y, m, d).getLunar();
  const stemIdx   = lunar.getDayGanIndex();
  const branchIdx = lunar.getDayZhiIndex();
  return { stemIdx, branchIdx };
}

/**
 * 取得查詢日期的農曆月「序數」與農曆日（流月斗君命宮定位用）。
 *
 * 流月閏月規則（2026-06-01 用戶拍板）：閏月「獨立成月」，命宮用農曆月**序數**斗君，
 * 閏六月序數=6 → 流月命宮同六月（不前進），七月才前進。故**不套十五分界**。
 *   （十五分界僅用於本命安命，見 lunarConverter.ts §1.1，此處不沿用。）
 * 閏月與本月的差異由節氣月干（祿羊陀/四化）自然呈現＝「多走一個月」。
 */
function getLunarMonthDay(queryDate: Date): { month: number; day: number } {
  const y = queryDate.getFullYear();
  const m = queryDate.getMonth() + 1;
  const d = queryDate.getDate();
  const lunar = Solar.fromYmd(y, m, d).getLunar();
  const rawMonth = lunar.getMonth();       // 負數 = 閏月
  return { month: Math.abs(rawMonth), day: lunar.getDay() };
}

/**
 * 流月干支字串（與 overlay 月干同源：節氣月干支）。
 * 取該農曆月初一的國曆日 → getSolarTermMonthGanzhi，確保標籤與宮格 overlay 月干一致。
 */
export function monthlyGanZhi(lunarYear: number, lunarMonth: number): string {
  try {
    const d = lunarToSolarDate(lunarYear, lunarMonth, 1);
    const { stemIdx, branchIdx } = getSolarTermMonthGanzhi(d);
    return STEMS[stemIdx] + BRANCHES[branchIdx];
  } catch { return ''; }
}

/**
 * 流月干支「對」：節氣紀月下，一個農曆月常跨一個「節」→ 前後兩個月干支。
 * 取該農曆月初一與末日各自的節氣月干支；相同回單一、不同回「前/後」。
 * 學會教法即用節氣，故一個流月可有兩個天干。
 */
export function monthlyGanZhiPair(lunarYear: number, lunarMonth: number): string {
  try {
    const dStart = lunarToSolarDate(lunarYear, lunarMonth, 1);
    const a = getSolarTermMonthGanzhi(dStart);
    let dEnd: Date;
    try { dEnd = lunarToSolarDate(lunarYear, lunarMonth, 30); }
    catch { dEnd = lunarToSolarDate(lunarYear, lunarMonth, 29); }
    const b = getSolarTermMonthGanzhi(dEnd);
    const sa = STEMS[a.stemIdx] + BRANCHES[a.branchIdx];
    const sb = STEMS[b.stemIdx] + BRANCHES[b.branchIdx];
    return sa === sb ? sa : `${sa}/${sb}`;
  } catch { return ''; }
}

/** 節氣（節）名 簡體→{繁體, 拼音}。流月跨節的「換干日」即落在這 12 節之一。 */
const JIEQI_MAP: Record<string, { zh: string; py: string }> = {
  '立春': { zh: '立春', py: 'Lichun' }, '惊蛰': { zh: '驚蟄', py: 'Jingzhe' },
  '清明': { zh: '清明', py: 'Qingming' }, '立夏': { zh: '立夏', py: 'Lixia' },
  '芒种': { zh: '芒種', py: 'Mangzhong' }, '小暑': { zh: '小暑', py: 'Xiaoshu' },
  '立秋': { zh: '立秋', py: 'Liqiu' }, '白露': { zh: '白露', py: 'Bailu' },
  '寒露': { zh: '寒露', py: 'Hanlu' }, '立冬': { zh: '立冬', py: 'Lidong' },
  '大雪': { zh: '大雪', py: 'Daxue' }, '小寒': { zh: '小寒', py: 'Xiaohan' },
};
function jieQiAt(date: Date): { zh: string; py: string } | null {
  try {
    const name = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate()).getLunar().getJieQi();
    return name && JIEQI_MAP[name] ? JIEQI_MAP[name] : null;
  } catch { return null; }
}

/**
 * 流月「換干日」：節氣紀月下，流月跨「節」當天月干支會切換。
 * 回傳該月第一個「進入後段月干支」的農曆日(transitionDay)+ 前/後干支 + 該日節氣；
 * 整月同一干支(無跨節)回 null。供流日選單標示「哪天起換干」。
 */
export function monthGanZhiSplit(
  lunarYear: number, lunarMonth: number,
): { transitionDay: number; before: string; after: string; jieqi: { zh: string; py: string } | null } | null {
  try {
    const first = getSolarTermMonthGanzhi(lunarToSolarDate(lunarYear, lunarMonth, 1));
    const before = STEMS[first.stemIdx] + BRANCHES[first.branchIdx];
    let maxD = 30;
    try { lunarToSolarDate(lunarYear, lunarMonth, 30); } catch { maxD = 29; }
    for (let d = 2; d <= maxD; d++) {
      const dt = lunarToSolarDate(lunarYear, lunarMonth, d);
      const g = getSolarTermMonthGanzhi(dt);
      const gz = STEMS[g.stemIdx] + BRANCHES[g.branchIdx];
      if (gz !== before) return { transitionDay: d, before, after: gz, jieqi: jieQiAt(dt) };
    }
    return null;
  } catch { return null; }
}

/**
 * 流月干支分行資料（流月選單用）：跨節回兩段（前/後干支 + 各自國曆範圍），不跨節回一段。
 * 例 正月：[{gz:庚寅, range:2/17~3/5}, {gz:辛卯, range:3/6~3/18}]
 */
export function monthGanZhiRows(lunarYear: number, lunarMonth: number): { gz: string; range: string }[] {
  const md = (d: number) => { const x = lunarToSolarDate(lunarYear, lunarMonth, d); return `${x.getMonth() + 1}/${x.getDate()}`; };
  try {
    let maxD = 30;
    try { lunarToSolarDate(lunarYear, lunarMonth, 30); } catch { maxD = 29; }
    const split = monthGanZhiSplit(lunarYear, lunarMonth);
    if (!split) {
      const g = getSolarTermMonthGanzhi(lunarToSolarDate(lunarYear, lunarMonth, 1));
      return [{ gz: STEMS[g.stemIdx] + BRANCHES[g.branchIdx], range: `${md(1)}~${md(maxD)}` }];
    }
    return [
      { gz: split.before, range: `${md(1)}~${md(split.transitionDay - 1)}` },
      { gz: split.after,  range: `${md(split.transitionDay)}~${md(maxD)}` },
    ];
  } catch { return []; }
}

/** 該農曆月的國曆起訖（M/D~M/D），供 Advanced 流月國曆對照。 */
export function monthlySolarRange(lunarYear: number, lunarMonth: number): string {
  try {
    const s = lunarToSolarDate(lunarYear, lunarMonth, 1);
    let e: Date;
    try { e = lunarToSolarDate(lunarYear, lunarMonth, 30); }
    catch { e = lunarToSolarDate(lunarYear, lunarMonth, 29); }
    return `${s.getMonth() + 1}/${s.getDate()}~${e.getMonth() + 1}/${e.getDate()}`;
  } catch { return ''; }
}

/** 該農曆日的國曆日期（M/D），供 Advanced 流日國曆對照。 */
export function dailySolar(lunarYear: number, lunarMonth: number, lunarDay: number): string {
  try {
    const d = lunarToSolarDate(lunarYear, lunarMonth, lunarDay);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch { return ''; }
}

/** 流日干支字串（與 overlay 日干同源）。該農曆日不存在（如小月廿九後的卅）回空字串。 */
export function dailyGanZhi(lunarYear: number, lunarMonth: number, lunarDay: number): string {
  try {
    const d = lunarToSolarDate(lunarYear, lunarMonth, lunarDay);
    const { stemIdx, branchIdx } = getDayGanzhi(d);
    return STEMS[stemIdx] + BRANCHES[branchIdx];
  } catch { return ''; }
}

/** 今天的農曆年(數字)/月序數/是否閏月/日，供 Advanced 模式「今」快捷。 */
export function todayLunar(): { year: number; month: number; isLeap: boolean; day: number } {
  return solarToLunarParts(new Date());
}

/** 國曆 Date → 農曆 {年數字, 月序數, 是否閏月, 日}（日期選擇器 / 今 用）。 */
export function solarToLunarParts(date: Date): { year: number; month: number; isLeap: boolean; day: number } {
  const lunar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate()).getLunar();
  const { ly } = getLunarYearStemBranch(date);
  const rawMonth = lunar.getMonth();
  return { year: ly, month: Math.abs(rawMonth), isLeap: rawMonth < 0, day: lunar.getDay() };
}

/** 某農曆年的閏月序數（0 = 當年無閏月）。流月列插入「閏X月」格用。 */
export function leapMonthOfYear(lunarYear: number): number {
  return LunarYear.fromYear(lunarYear).getLeapMonth();
}

/** 本命命宮地支 index（palace.index === 0），斗君錨定用 */
function natalMingBranchIdx(palaces: PalaceRef[]): number {
  const ming = palaces.find(p => p.index === 0);
  const idx = ming ? BRANCHES.indexOf(ming.earthlyBranch as typeof BRANCHES[number]) : 0;
  return idx < 0 ? 0 : idx;
}

/**
 * 斗君法流月命宮地支。
 *
 * 斗君宮職 = 本命盤寅位的宮職；流年盤該宮職所在地支 = 農曆正月命宮，
 * 之後每農曆月順時針 +1。化簡後（與宮職排列方向無關，offset 相消）：
 *   正月命宮地支 = (流年地支 − 本命命宮地支 + 2) mod 12
 *   流月命宮地支 = 正月命宮 + (農曆月 − 1) = (流年地支 − 本命命宮地支 + 1 + 農曆月) mod 12
 *
 * 驗證（本命命宮=子）：流年辰→正月午、流年午→正月申、流年午二月→酉。
 */
function douJunMonthlyBranchIdx(
  yearBranchIdx: number,
  natalMingIdx: number,
  lunarMonth: number,
): number {
  return (((yearBranchIdx - natalMingIdx + 1 + lunarMonth) % 12) + 12) % 12;
}

/**
 * 建立流年 Horoscope 資料
 */
export function buildYearlyHoroscope(
  queryDate: Date,
  palaces: PalaceRef[],
): {
  palaceIndex: number;
  palaceName: string;
  heavenlyStem: HeavenlyStem;
  earthlyBranch: EarthlyBranch;
  mutagen: readonly string[];
  stars: FilteredStarGroup[];
} {
  const { ys, yb } = getLunarYearStemBranch(queryDate);

  const yearlyBranch = BRANCHES[yb] as EarthlyBranch;
  const yearlyHeavenlyStem = STEMS[ys] as HeavenlyStem;

  // 流年命宮 = 年支所落宮位
  const yearlyPalace = palaces.find(p => p.earthlyBranch === yearlyBranch);
  const yearlyPalaceIndex = yearlyPalace?.index ?? 0;
  const yearlyPalaceName  = yearlyPalace?.name  ?? '';

  // 流年四化（學會版）
  const mutagen = MUTAGEN_TABLE[ys];

  // 流年星曜分配
  const out = new Map<number, StarRef[]>();
  const luCun    = LU_CUN[ys];
  const qingYang = (luCun + 1) % 12;
  const tuoLuo   = (luCun - 1 + 12) % 12;
  const hongLuan = ((3 - yb) % 12 + 12) % 12;
  const tianXi   = (hongLuan + 6) % 12;

  placeStar(luCun,    '年祿', 'yearly', palaces, out); // → 年祿
  placeStar(qingYang, '年羊', 'yearly', palaces, out); // → 年羊
  placeStar(tuoLuo,   '年陀', 'yearly', palaces, out); // → 年陀
  placeStar(hongLuan, '年鸞', 'yearly', palaces, out); // → 年鸞
  placeStar(tianXi,   '年喜', 'yearly', palaces, out); // → 年喜

  return {
    palaceIndex:    yearlyPalaceIndex,
    palaceName:     yearlyPalaceName,
    heavenlyStem:   yearlyHeavenlyStem,
    earthlyBranch:  yearlyBranch,
    mutagen,
    stars: toFilteredStarGroups(palaces, out),
  };
}

/**
 * 建立流月 Horoscope 資料
 *
 * 月干支 = 依節氣（getMonthInGanZhi），比農曆月精確。
 * 流月命宮地支 = 月支（寅月=寅宮, 卯月=卯宮 …）
 */
export function buildMonthlyHoroscope(
  queryDate: Date,
  palaces: PalaceRef[],
): {
  palaceIndex: number;
  palaceName: string;
  heavenlyStem: HeavenlyStem;
  earthlyBranch: EarthlyBranch;
  mutagen: readonly string[];
  stars: FilteredStarGroup[];
} {
  // 月干（節氣月）→ 月祿/月羊/月陀 + 流月四化（與命宮定位無關，沿用）
  const { stemIdx: monthStemIdx } = getSolarTermMonthGanzhi(queryDate);

  // 流月命宮地支 → 斗君法（依本命命宮地支 + 流年地支 + 農曆月）
  const { yb: yearBranchIdx } = getLunarYearStemBranch(queryDate);
  const { month: lunarMonth } = getLunarMonthDay(queryDate);
  const monthlyBranchIdx = douJunMonthlyBranchIdx(
    yearBranchIdx, natalMingBranchIdx(palaces), lunarMonth,
  );

  const monthlyBranch       = BRANCHES[monthlyBranchIdx] as EarthlyBranch;
  const monthlyHeavenlyStem = STEMS[monthStemIdx]        as HeavenlyStem;

  // 流月命宮所在宮位（斗君地支對應的宮）
  const monthlyPalace     = palaces.find(p => p.earthlyBranch === monthlyBranch);
  const monthlyPalaceIdx  = monthlyPalace?.index ?? 0;
  const monthlyPalaceName = monthlyPalace?.name  ?? '';

  // 流月四化
  const mutagen = MUTAGEN_TABLE[monthStemIdx];

  // 月祿/月羊/月陀 (依月干)
  const out = new Map<number, StarRef[]>();
  const mLuCun    = LU_CUN[monthStemIdx];
  const mQingYang = (mLuCun + 1) % 12;
  const mTuoLuo   = (mLuCun - 1 + 12) % 12;
  placeStar(mLuCun,    '月祿', 'monthly', palaces, out);
  placeStar(mQingYang, '月羊', 'monthly', palaces, out);
  placeStar(mTuoLuo,   '月陀', 'monthly', palaces, out);

  return {
    palaceIndex:   monthlyPalaceIdx,
    palaceName:    monthlyPalaceName,
    heavenlyStem:  monthlyHeavenlyStem,
    earthlyBranch: monthlyBranch,
    mutagen,
    stars: toFilteredStarGroups(palaces, out),
  };
}

/**
 * 建立小限 Overlay 資料
 *
 * 小限干 = 小限宮位的宮干，由此推算小祿/小羊/小陀及四化。
 */
export function buildMinorLimitOverlay(
  minorLimitPalaceHeavenlyStem: string,
  palaces: PalaceRef[],
): {
  heavenlyStem: HeavenlyStem;
  mutagen: readonly string[];
  stars: FilteredStarGroup[];
} {
  const stemIdx = STEMS.indexOf(minorLimitPalaceHeavenlyStem as typeof STEMS[number]);
  if (stemIdx < 0) return { heavenlyStem: '甲', mutagen: [], stars: [] };

  const luCun    = LU_CUN[stemIdx];
  const qingYang = (luCun + 1) % 12;
  const tuoLuo   = (luCun - 1 + 12) % 12;

  const out = new Map<number, StarRef[]>();
  placeStar(luCun,    '小祿', 'minorLimit', palaces, out);
  placeStar(qingYang, '小羊', 'minorLimit', palaces, out);
  placeStar(tuoLuo,   '小陀', 'minorLimit', palaces, out);

  return {
    heavenlyStem: minorLimitPalaceHeavenlyStem as HeavenlyStem,
    mutagen:      MUTAGEN_TABLE[stemIdx],
    stars:        toFilteredStarGroups(palaces, out),
  };
}

/**
 * 建立流日 Horoscope 資料
 *
 * 日干支直接從 lunar-javascript 取得，不需推算。
 * 流日命宮地支 = 日支所落宮位。
 */
export function buildDailyHoroscope(
  queryDate: Date,
  palaces: PalaceRef[],
): {
  palaceIndex: number;
  palaceName: string;
  heavenlyStem: HeavenlyStem;
  earthlyBranch: EarthlyBranch;
  mutagen: readonly string[];
  stars: FilteredStarGroup[];
} {
  // 日干 → 日祿/日羊/日陀 + 流日四化（查農民曆日干，與命宮定位無關，沿用）
  const { stemIdx: dayStemIdx } = getDayGanzhi(queryDate);

  // 流日命宮地支 → 斗君法：該流月命宮 + (農曆日 − 1)
  const { yb: yearBranchIdx } = getLunarYearStemBranch(queryDate);
  const { month: lunarMonth, day: lunarDay } = getLunarMonthDay(queryDate);
  const monthlyBranchIdx = douJunMonthlyBranchIdx(
    yearBranchIdx, natalMingBranchIdx(palaces), lunarMonth,
  );
  const dailyBranchIdx = (monthlyBranchIdx + (lunarDay - 1)) % 12;

  const dailyBranch       = BRANCHES[dailyBranchIdx] as EarthlyBranch;
  const dailyHeavenlyStem = STEMS[dayStemIdx]        as HeavenlyStem;

  // 流日命宮所在宮位（斗君地支對應的宮）
  const dailyPalace     = palaces.find(p => p.earthlyBranch === dailyBranch);
  const dailyPalaceIdx  = dailyPalace?.index ?? 0;
  const dailyPalaceName = dailyPalace?.name  ?? '';

  // 流日四化（依日干）
  const mutagen = MUTAGEN_TABLE[dayStemIdx];

  // 日祿/日羊/日陀 (依日干)
  const out = new Map<number, StarRef[]>();
  const dLuCun    = LU_CUN[dayStemIdx];
  const dQingYang = (dLuCun + 1) % 12;
  const dTuoLuo   = (dLuCun - 1 + 12) % 12;
  placeStar(dLuCun,    '日祿', 'daily', palaces, out);
  placeStar(dQingYang, '日羊', 'daily', palaces, out);
  placeStar(dTuoLuo,   '日陀', 'daily', palaces, out);

  return {
    palaceIndex:   dailyPalaceIdx,
    palaceName:    dailyPalaceName,
    heavenlyStem:  dailyHeavenlyStem,
    earthlyBranch: dailyBranch,
    mutagen,
    stars: toFilteredStarGroups(palaces, out),
  };
}
