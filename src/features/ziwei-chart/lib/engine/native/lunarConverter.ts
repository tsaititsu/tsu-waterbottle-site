/**
 * Phase 0: Solar → Lunar conversion via lunar-javascript
 * Validation: output must match dreamkinin ground truth
 */
import { Solar } from 'lunar-javascript';

export const STEMS  = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'] as const;
export const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'] as const;

export type Stem   = typeof STEMS[number];
export type Branch = typeof BRANCHES[number];

export interface LunarDate {
  year:        number;   // 農曆年（整數）
  month:       number;   // 農曆月 1–12
  day:         number;   // 農曆日 1–30
  isLeap:      boolean;  // 是否閏月
  yearStem:    Stem;     // 年天干
  yearBranch:  Branch;   // 年地支
  monthStem:   Stem;     // 月天干（農曆月推算，五虎遁）
  monthBranch: Branch;   // 月地支（農曆月推算：正月=寅,二月=卯…）
  hourStem:    Stem;     // 時天干（由時辰 index 決定）
  hourBranch:  Branch;   // 時地支
  solarTermMonthBranch: Branch; // 節氣月地支（立春→寅, 驚蟄→卯…），天馬用
}

/**
 * timeIndex 0–11 = 子–亥（含晚子時 12，呼叫前應已轉為 0 + 日期 +1）
 */
export function solarToLunar(solarDate: string, timeIndex: number): LunarDate {
  const [y, m, d] = solarDate.split('-').map(Number);
  const solar = Solar.fromYmd(y, m, d);
  const lunar = solar.getLunar();

  const lunarYear  = lunar.getYear();
  const rawMonth = lunar.getMonth();           // 閏月時為負，如閏四月 = -4
  const isLeap   = rawMonth < 0;
  const lunarDay = lunar.getDay();
  const absMonth = Math.abs(rawMonth);
  // 閏月十五分界法：1–15日視為當月（lm 不進），16日+ 視為下月（lm + 1）
  // 驗證（3 筆）：case-1 壬戌閏四月廿(ld=20≥16)→lm=5→命宮=子 ✅
  //              測試B 庚子閏四月十五(ld=15<16)→lm=4→命宮=亥 ✅
  //              測試C 癸卯閏四月十五(ld=15<16)→lm=4→命宮=亥 ✅
  const lunarMonth = (isLeap && lunarDay >= 16) ? absMonth + 1 : absMonth;

  // 年天干地支
  const yearStemIdx   = ((lunarYear - 4) % 10 + 10) % 10;
  const yearBranchIdx = ((lunarYear - 4) % 12 + 12) % 12;
  const yearStem:   Stem   = STEMS[yearStemIdx];
  const yearBranch: Branch = BRANCHES[yearBranchIdx];

  // 月天干地支（用農曆月推算，不用 lunar-javascript 的節氣月）
  // 正月=寅(2), 二月=卯(3), ..., 十一月=子(0), 十二月=丑(1)
  const monthBranchIdx = (lunarMonth + 1) % 12;
  // 五虎遁年起月法：甲/己→丙寅起, 乙/庚→戊寅起, 丙/辛→庚寅起, 丁/壬→壬寅起, 戊/癸→甲寅起
  const MONTH_STEM_START = [2, 4, 6, 8, 0] as const;
  const monthStemIdx = (MONTH_STEM_START[yearStemIdx % 5] + lunarMonth - 1) % 10;
  const monthStem:   Stem   = STEMS[monthStemIdx];
  const monthBranch: Branch = BRANCHES[monthBranchIdx];

  // 時天干地支（五鼠遁日起時法）
  // 甲/己→甲子起, 乙/庚→丙子起, 丙/辛→戊子起, 丁/壬→庚子起, 戊/癸→壬子起
  const HOUR_STEM_START = [0, 2, 4, 6, 8] as const;
  const dayGanIdx  = lunar.getDayGanIndex();
  const hourBranch: Branch = BRANCHES[timeIndex % 12];
  const hourStemIdx = (HOUR_STEM_START[dayGanIdx % 5] + timeIndex) % 10;
  const hourStem: Stem = STEMS[hourStemIdx];

  // 節氣月地支（天馬用，與農曆月不同）
  // lunar-javascript 的 getMonthInGanZhi() 回傳節氣月干支字串（如「庚寅」），末字為地支
  // 立春之前算前一年的丑月；立春→寅月、驚蟄→卯月、清明→辰月…
  // 注意：本函式接收的 solarDate 已由呼叫端處理過晚子時（晚子時 → 日期+1）
  const solarTermGanZhi = lunar.getMonthInGanZhi();
  const solarTermBranchChar = solarTermGanZhi.charAt(solarTermGanZhi.length - 1);
  const solarTermMonthBranch: Branch = BRANCHES.find(b => b === solarTermBranchChar) ?? BRANCHES[0];

  return {
    year: lunarYear,
    month: lunarMonth,
    day: lunarDay,
    isLeap,
    yearStem,
    yearBranch,
    monthStem,
    monthBranch,
    hourStem,
    hourBranch,
    solarTermMonthBranch,
  };
}
