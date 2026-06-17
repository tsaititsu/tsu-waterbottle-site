/**
 * 自主宮位結構生成
 *
 * 生成 12 宮位結構，包含：
 *   - 宮名 / 天干地支
 *   - 身宮 / 命宮 標記
 *   - 大限範圍（虛歲）
 *   - 小限虛歲列表
 *
 * 驗證：壬午年 陽男 火六局（命宮=巳）大限分配完全符合 dreamkinin 參考盤
 */

import { BRANCHES, STEMS } from './lunarConverter';

// ── 常數 ────────────────────────────────────────────────────────────────────

/** 12 宮位名稱（固定順序，index 0 = 命宮，逆時針排列 CCW，地支遞減） */
const PALACE_NAMES = [
  '命宮', '兄弟', '夫妻', '子女', '財帛', '疾厄',
  '遷移', '僕役', '官祿', '田宅', '福德', '父母',
] as const;

/**
 * 五虎遁年起月法：寅宮(branch=2)天干起始 index
 * 甲己年→丙(2), 乙庚年→戊(4), 丙辛年→庚(6), 丁壬年→壬(8), 戊癸年→甲(0)
 */
const MONTH_STEM_START = [2, 4, 6, 8, 0];

/**
 * 小限起始地支 lookup（出生年支 → 小限虛歲 age-1 起始地支）
 * 三合局：亥卯未→丑, 申子辰→戌, 巳酉丑→未, 寅午戌→辰
 */
const MINOR_START: Record<string, number> = {
  '亥': 1, '卯': 1, '未': 1,    // → 丑(1)
  '申': 10, '子': 10, '辰': 10, // → 戌(10)
  '巳': 7, '酉': 7, '丑': 7,    // → 未(7)
  '寅': 4, '午': 4, '戌': 4,    // → 辰(4)
};

// ── 公開型別 ─────────────────────────────────────────────────────────────────

export interface NativePalaceData {
  index:            number;
  name:             string;
  heavenlyStem:     string;
  earthlyBranch:    string;
  isBodyPalace:     boolean;
  isOriginalPalace: boolean;
  decadal: {
    range:         [number, number];
    heavenlyStem:  string;
    earthlyBranch: string;
  };
  ages: number[];
}

// ── 輔助函式 ─────────────────────────────────────────────────────────────────

/** 計算指定地支 branchIdx 的宮位天干 index (0=甲…9=癸)
 *
 * 從寅宮(2)起，依年干推算起始天干，順數 12 宮。
 * 注意：offset 必須先 %12（12地支循環）再 %10（10天干循環），順序不可互換。
 * 錯誤版本：(base + (branchIdx-2+12)) % 10 → 21%10=1 而非 21%12=9
 */
function palaceStemIdx(yearStemIdx: number, branchIdx: number): number {
  const base   = MONTH_STEM_START[yearStemIdx % 5];
  const offset = (branchIdx - 2 + 12) % 12;  // 地支循環偏移量（0–11）
  return (base + offset) % 10;
}

/** 計算小限虛歲列表（男順女逆；虛歲起 1，每 12 年循環） */
function computeMinorLimitAges(
  palaceBranchIdx: number,
  minorStartBranchIdx: number,
  isMale: boolean,
): number[] {
  const r = isMale
    ? ((palaceBranchIdx - minorStartBranchIdx + 1) % 12 + 12) % 12
    : ((minorStartBranchIdx - palaceBranchIdx + 1) % 12 + 12) % 12;
  const firstAge = r === 0 ? 12 : r;
  const ages: number[] = [];
  for (let a = firstAge; a <= 100; a += 12) ages.push(a);
  return ages;
}

// ── 主函式 ───────────────────────────────────────────────────────────────────

/**
 * 生成 12 宮位結構陣列
 *
 * @param mingBranchIdx  命宮地支 index（0=子…11=亥）
 * @param shenBranchIdx  身宮地支 index
 * @param yearStemIdx    年干 index（0=甲…9=癸）
 * @param fiveElementsJu 五行局（2/3/4/5/6）
 * @param isMale         性別
 * @param birthYearBranchIdx  農曆出生年支 index（0=子…11=亥，由 solarToLunar 取得）
 */
export function createNativePalaces(
  mingBranchIdx: number,
  shenBranchIdx: number,
  yearStemIdx: number,
  fiveElementsJu: number,
  isMale: boolean,
  birthYearBranchIdx: number,
): NativePalaceData[] {
  const isYangStem = yearStemIdx % 2 === 0;

  // 大限方向：陽男陰女順，陰男陽女逆（傳統規則，標籤直接用年干，不分性別翻轉）
  // 陽男(male+陽年)→순, 陰女(female+陰年)→순, 陰男(male+陰年)→逆, 陽女(female+陽年)→逆
  // 公式：isMale === isYangStem → true=順, false=逆
  // 驗算：壬午年陽男 isMale=true isYangStem=true → true → 順行 ✓
  //       己丑年陰女 isMale=false isYangStem=false → true → 順行 ✓ (dreamkinin confirmed)
  const isDecadalForward = isMale === isYangStem;

  // 小限起始地支 index（農曆年支決定，正月前出生者農曆年支≠陽曆年支）
  const minorStartBranchIdx = MINOR_START[BRANCHES[birthYearBranchIdx]] ?? 0;

  return Array.from({ length: 12 }, (_, ccwOffset) => {
    // 宮位地支（從命宮 CCW，branch -1 per step）
    const branchIdx = (mingBranchIdx - ccwOffset + 12) % 12;
    const stemIdx   = palaceStemIdx(yearStemIdx, branchIdx);

    // 該宮位的大限 step 序號（0 = 命宮起始大限）
    const decadalStep = isDecadalForward
      ? (branchIdx - mingBranchIdx + 12) % 12   // 順：branch 增加方向
      : (mingBranchIdx - branchIdx + 12) % 12;  // 逆：branch 減少方向

    const decadalStart = fiveElementsJu + decadalStep * 10;
    const decadalEnd   = decadalStart + 9;

    // 小限虛歲
    const ages = computeMinorLimitAges(branchIdx, minorStartBranchIdx, isMale);

    return {
      index:            ccwOffset,
      name:             PALACE_NAMES[ccwOffset],
      heavenlyStem:     STEMS[stemIdx],
      earthlyBranch:    BRANCHES[branchIdx],
      isBodyPalace:     branchIdx === shenBranchIdx,
      isOriginalPalace: ccwOffset === 0,  // 命宮
      decadal: {
        range:         [decadalStart, decadalEnd] as [number, number],
        heavenlyStem:  STEMS[stemIdx],
        earthlyBranch: BRANCHES[branchIdx],
      },
      ages,
    };
  });
}

// ── 農曆日期字串生成 ──────────────────────────────────────────────────────────

const CHINESE_DIGITS = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** 農曆年數字 → 中文年份，如 2002 → "二〇〇二年" */
function toChineseYear(year: number): string {
  return String(year).split('').map(d => CHINESE_DIGITS[parseInt(d)]).join('') + '年';
}

const CHINESE_MONTHS = [
  '', '正月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];

/** 農曆日 1-30 → 中文日期 */
function toChineseDay(day: number): string {
  if (day <= 9)  return '初' + CHINESE_DIGITS[day];
  if (day === 10) return '初十';
  if (day <= 19) return '十' + CHINESE_DIGITS[day - 10];
  if (day === 20) return '二十';
  if (day <= 29) return '廿' + CHINESE_DIGITS[day - 20];
  return '三十';
}

/**
 * 生成農曆日期字串，格式：二〇〇二年四月初十
 * 符合 i18n.lunarToArabic() 的解析格式
 *
 * @param lunarMonth 顯示用月份（閏月案例請傳 absMonth，非十五分界調整後的 lm）
 * @param isLeap     是否閏月。true 時月份前綴「閏」字，例如「閏四月十六」
 */
export function formatLunarDate(
  lunarYear: number,
  lunarMonth: number,
  lunarDay: number,
  isLeap: boolean = false,
): string {
  const monthLabel = (isLeap ? '閏' : '') + CHINESE_MONTHS[lunarMonth];
  return toChineseYear(lunarYear) + monthLabel + toChineseDay(lunarDay);
}
