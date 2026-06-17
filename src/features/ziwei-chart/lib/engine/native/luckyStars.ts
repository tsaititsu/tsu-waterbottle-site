/**
 * Phase 3: 六吉星 + 祿存/擎羊/陀羅 + 天馬 + 地空/地劫（本命版）
 *
 * ✅ VERIFIED 2026-05-04 — 全部星曜 7/7 case 完整驗證通過
 * ✅ VERIFIED 2026-05-18 — 天馬公式 5 筆重新驗證（二次修正後）
 *
 * 修正歷史：
 *   2026-05-04  天魁/天鉞 壬癸年對調錯誤（dreamkinin 現場驗證修正）
 *   2026-05-07  天馬改用命宮支起（非年支），陣列首版 [2,8,11,5,...] ← 錯
 *   2026-05-18  天馬陣列二次修正為 [8,11,11,5,...]，5 筆驗證全通過
 *
 * ⛔ WARNING — 此檔案任何公式或查表陣列修改前，必須：
 *   1. 說明修改原因及來源（學會版 or dreamkinin 驗證）
 *   2. 準備 ≥3 筆含不同干/支組合的驗證案例
 *   3. 更新對應 VERIFIED 日期
 */

import { BRANCHES, type Branch } from './lunarConverter';

export interface LuckyStarPosition {
  name: string;
  branchIdx: number;  // 0=子 system
}

// ── 年干起查表 ───────────────────────────────────────────────────────────────
// index: 甲=0 乙=1 丙=2 丁=3 戊=4 己=5 庚=6 辛=7 壬=8 癸=9

/**
 * 祿存地支（年干起）✅ VERIFIED 2026-05-04
 * 同時作為 擎羊(+1) / 陀羅(-1) 的起算基準。
 * ⛔ 修改此陣列會同步影響擎羊、陀羅、博士十二神起點。
 */
const LU_CUN: number[] = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0];

/**
 * 天魁地支（年干起）✅ VERIFIED 2026-05-04
 * 壬(8)/癸(9) = 卯(3)（dreamkinin 現場驗證，原實作對調已修正）
 * ⛔ 壬/癸 的值曾被對調錯誤，修改前須同時驗證壬癸兩干。
 */
const TIAN_KUI: number[] = [1, 0, 11, 11, 1, 0, 1, 6, 3, 3];

/**
 * 天鉞地支（年干起）✅ VERIFIED 2026-05-04
 * 壬(8)/癸(9) = 巳(5)（dreamkinin 現場驗證，原實作對調已修正）
 * ⛔ 壬/癸 的值曾被對調錯誤，修改前須同時驗證壬癸兩干。
 */
const TIAN_YUE: number[] = [7, 8, 9, 9, 7, 8, 7, 2, 5, 5];

// ── 命宮支起查表 ─────────────────────────────────────────────────────────────
// index: 子=0 丑=1 寅=2 卯=3 辰=4 巳=5 午=6 未=7 申=8 酉=9 戌=10 亥=11

/**
 * 天馬地支（節氣月支三合驛馬）✅ VERIFIED 2026-05-20（9 筆，dreamkinin 原始碼確認）
 *
 * 規則：以**節氣月地支**查表，傳統三合驛馬：
 *   申子辰月(0,4,8) → 寅(2)
 *   亥卯未月(3,7,11) → 巳(5)
 *   寅午戌月(2,6,10) → 申(8)
 *   巳酉丑月(1,5,9) → 亥(11)
 *
 * 從 dreamkinin 紫微攻略 main.js 原始碼比對確認：
 *   "tianMa":{"no":"month_zodiac","position":{
 *     "zi":"yin","chou":"hai","yin":"shen","mao":"si",
 *     "chen":"yin","si":"hai","wu":"shen","wei":"si",
 *     "shen":"yin","you":"hai","xu":"shen","hai":"si"
 *   }}
 * "no":"month_zodiac" 整個 main.js 只此一見（天馬獨有）。
 *
 * 9 筆驗證（FORMULAS.md §4）：
 *   case-3 1990-01-31 寅時 → 丑月 → 亥 ✅
 *   case-8 1979-09-10 寅時 → 酉月 → 亥 ✅
 *   case-2  1973-10-29 未時 → 戌月 → 申 ✅
 *   case-1 1982-06-11 午時 → 午月 → 申 ✅
 *   case-4 1991-01-26 子時 (晚子→1/27) → 丑月 → 亥 ✅
 *   Test D 2020-06-07 子時 (晚子→6/8) → 午月 → 申 ✅
 *   Test E 2023-04-05 子時 (晚子→4/6) → 辰月 → 寅 ✅
 *   Test F 2017-08-16 子時 (晚子→8/17) → 申月 → 寅 ✅
 *
 * ⛔ WARNING — 此公式經歷三次嘗試才找到：
 *   2026-05-04 v1：年支起 [2,8,11,5,...] ← 錯
 *   2026-05-18 v2：命宮支起 [8,11,11,5,8,11,11,5,8,11,11,5] ← 看似 verified 但實為循環驗證
 *   2026-05-20 v3：節氣月支三合驛馬 [2,11,8,5,2,11,8,5,2,11,8,5] ✅ 經 dreamkinin 原始碼 + 9 筆 DK 雙重確認
 *
 * 修改前必須：
 *   1. 確認新規則的學會來源（dreamkinin 原始碼 / 講義）
 *   2. 至少 ≥9 筆 DK 截圖驗證（涵蓋四馬地各 ≥1 筆、含晚子時案例）
 *   3. 不要再循環驗證（用 app output 比對 app output）
 */
const TIAN_MA: number[] = [2, 11, 8, 5, 2, 11, 8, 5, 2, 11, 8, 5];

// ── 年支起查表（火星/鈴星）─────────────────────────────────────────────────
// index: 子=0 丑=1 寅=2 卯=3 辰=4 巳=5 午=6 未=7 申=8 酉=9 戌=10 亥=11

/**
 * 火星起始地支（年支四組，順數加時辰）✅ VERIFIED 2026-05-04（dreamkinin 實測）
 * 申子辰(0,4,8)→寅(2), 巳酉丑(1,5,9)→卯(3), 寅午戌(2,6,10)→丑(1), 亥卯未(3,7,11)→酉(9)
 * 最終位置：(base + timeIndex) % 12
 * ⛔ 修改前須同時驗證四個年支組各至少一筆。
 */
const HUO_XING_BASE: number[] = [2, 3, 1, 9, 2, 3, 1, 9, 2, 3, 1, 9];

/**
 * 鈴星起始地支（年支四組，順數加時辰）✅ VERIFIED 2026-05-04（dreamkinin 實測）
 * 寅午戌(2,6,10)→卯(3)，其餘三組均→戌(10)
 * 最終位置：(base + timeIndex) % 12
 * ⛔ 修改前須同時驗證四個年支組各至少一筆。
 */
const LING_XING_BASE: number[] = [10, 10, 3, 10, 10, 10, 3, 10, 10, 10, 3, 10];

// ── 計算函式 ────────────────────────────────────────────────────────────────

/**
 * 排布本命六吉星 + 祿存/擎羊/陀羅 + 天馬 + 地空/地劫
 *
 * @param yearStemIdx          年天干 index（0=甲…9=癸）— 使用農曆年干
 * @param yearBranchIdx        年地支 index（0=子…11=亥）— 使用農曆年支（火星/鈴星用）
 * @param lunarMonth           農曆出生月（1–12）
 * @param timeIndex            時辰 index（0–11；晚子時 12 由呼叫方轉為 0）
 * @param solarTermMonthBranchIdx 節氣月地支 index（0=子…11=亥）— 天馬專用
 */
export function placeLuckyStars(
  yearStemIdx:              number,
  yearBranchIdx:            number,
  lunarMonth:               number,
  timeIndex:                number,
  solarTermMonthBranchIdx:  number,
): LuckyStarPosition[] {
  const ti = timeIndex % 12;  // 防禦：確保在 0–11

  // 祿存 / 擎羊(+1) / 陀羅(-1)（年干起）✅ VERIFIED 2026-05-04
  const luCun    = LU_CUN[yearStemIdx];
  const qingYang = (luCun + 1) % 12;
  const tuoLuo   = (luCun - 1 + 12) % 12;

  // 天魁 / 天鉞（年干起）✅ VERIFIED 2026-05-04
  const tianKui = TIAN_KUI[yearStemIdx];
  const tianYue = TIAN_YUE[yearStemIdx];

  // 左輔：辰(3)宮起正月，順數(+1/月) ✅ VERIFIED 2026-05-04
  // 公式：(3 + lunarMonth) % 12
  // ⛔ 起點宮位為辰(3)，非其他宮；方向為順行(+)，非逆行。
  const zuoFu = (3 + lunarMonth) % 12;

  // 右弼：戌(10)宮起正月，逆數(-1/月) ✅ VERIFIED 2026-05-04
  // 公式：(23 - lunarMonth) % 12，等同於 (10 - lunarMonth + 13*12) % 12
  // ⛔ 起點宮位為戌(10)，方向為逆行(-)。23 = 12 + 11 = 確保正值。
  const youBi = (23 - lunarMonth) % 12;

  // 文昌：戌(10)宮起子時，逆數(-1/時) ✅ VERIFIED 2026-05-04
  // 公式：(10 - ti + 12) % 12
  // ⛔ 起點宮位為戌(10)，方向逆行(-)；與文曲方向相反。
  const wenChang = (10 - ti + 12) % 12;

  // 文曲：辰(4)宮起子時，順數(+1/時) ✅ VERIFIED 2026-05-04
  // 公式：(4 + ti) % 12
  // ⛔ 起點宮位為辰(4)，方向順行(+)；與文昌方向相反。
  const wenQu = (4 + ti) % 12;

  // 天馬（節氣月支三合驛馬）✅ VERIFIED 2026-05-20（見 TIAN_MA 陣列說明）
  // ⛔ 天馬用「節氣月支」查表，不是農曆月、不是命宮支、不是年支。
  //    節氣月由呼叫端（lunarConverter）從 lunar.getMonthInGanZhi() 解析末字得到。
  //    晚子時情形已由 createAstrolabe 將 calcDate +1 處理，輸入這裡的節氣月已是正確的次日節氣月。
  const tianMa = TIAN_MA[solarTermMonthBranchIdx];

  // 地空：亥(11)宮起子時，逆數(-1/時) ✅ VERIFIED 2026-05-04
  // 公式：(11 - ti + 12) % 12
  // ⛔ 起點宮位為亥(11)，方向逆行(-)；與地劫方向相反。
  const diKong = (11 - ti + 12) % 12;

  // 地劫：亥(11)宮起子時，順數(+1/時) ✅ VERIFIED 2026-05-04
  // 公式：(11 + ti) % 12
  // ⛔ 起點宮位為亥(11)，方向順行(+)；與地空方向相反。
  const diJie = (11 + ti) % 12;

  // 火星（年支組查表 + 時辰順數）✅ VERIFIED 2026-05-04（見 HUO_XING_BASE 陣列說明）
  const huoXing = (HUO_XING_BASE[yearBranchIdx] + ti) % 12;

  // 鈴星（年支組查表 + 時辰順數）✅ VERIFIED 2026-05-04（見 LING_XING_BASE 陣列說明）
  const lingXing = (LING_XING_BASE[yearBranchIdx] + ti) % 12;

  return [
    { name: '天魁', branchIdx: tianKui  },
    { name: '天鉞', branchIdx: tianYue  },
    { name: '左輔', branchIdx: zuoFu   },
    { name: '右弼', branchIdx: youBi   },
    { name: '文昌', branchIdx: wenChang },
    { name: '文曲', branchIdx: wenQu   },
    { name: '祿存', branchIdx: luCun   },
    { name: '擎羊', branchIdx: qingYang },
    { name: '陀羅', branchIdx: tuoLuo  },
    { name: '天馬', branchIdx: tianMa  },
    { name: '地空', branchIdx: diKong  },
    { name: '地劫', branchIdx: diJie   },
    { name: '火星', branchIdx: huoXing },
    { name: '鈴星', branchIdx: lingXing },
  ];
}

/** 便利函式：回傳 { 星名: Branch } map */
export function luckyStarsToBranchMap(
  yearStemIdx:              number,
  yearBranchIdx:            number,
  lunarMonth:               number,
  timeIndex:                number,
  solarTermMonthBranchIdx:  number,
): Record<string, Branch> {
  return Object.fromEntries(
    placeLuckyStars(yearStemIdx, yearBranchIdx, lunarMonth, timeIndex, solarTermMonthBranchIdx)
      .map(({ name, branchIdx }) => [name, BRANCHES[branchIdx]])
  );
}
